# Votelyt Documentation

Votelyt is a self-hostable election platform for schools and organizations that need private online voting, controlled voter access, live turnout monitoring, and sealed results. It combines an authenticated admin console for election setup and operations with a public voter flow that authenticates each voter, validates eligibility, atomically records ballots, and separates vote rows from voter identity.

**Tech stack:** Next.js 16 App Router, React 19, Tailwind CSS 4, Next.js Route Handlers, Prisma 7, PostgreSQL on Neon, NextAuth v4 Credentials provider, bcryptjs, nanoid, xlsx, Vercel.

**Repository structure:** `app/` contains pages and API route handlers; `components/` contains admin, voter, and shared UI; `lib/` contains auth, tenant, Prisma, token, template, CSV, and election-integrity helpers; `prisma/` contains the schema, migrations, and seed script; `docs/` contains focused technical reference documents; `scripts/` contains local verification utilities.

Primary references:

- [README.md](README.md)
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/DATABASE.md](docs/DATABASE.md)
- [docs/ELECTION_LIFECYCLE.md](docs/ELECTION_LIFECYCLE.md)
- [docs/VOTING_FLOW.md](docs/VOTING_FLOW.md)
- [docs/SECURITY.md](docs/SECURITY.md)
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)

## Table of Contents

- [Product Overview](#product-overview)
- [How the App Works in One Pass](#how-the-app-works-in-one-pass)
- [System Architecture](#system-architecture)
- [Frontend Architecture](#frontend-architecture)
- [Backend and API Architecture](#backend-and-api-architecture)
- [Database Design](#database-design)
- [Authentication and Authorization](#authentication-and-authorization)
- [Election Lifecycle](#election-lifecycle)
- [Voting Flow](#voting-flow)
- [Election Integrity Safeguards](#election-integrity-safeguards)
- [Audit Logging](#audit-logging)
- [Security Model](#security-model)
- [Core Engineering Decisions](#core-engineering-decisions)
- [Deployment](#deployment)
- [Local Development](#local-development)
- [Known Limitations](#known-limitations)
- [Future Improvements](#future-improvements)
- [Glossary](#glossary)

## Product Overview

Votelyt manages the operational lifecycle of an online election: creating the election, defining positions and eligibility rules, importing voters, distributing credentials, opening polls, collecting votes, closing polls, and calculating results. The app is oriented around small to mid-sized organizational elections where administrators need a controlled voter roll and voters need a simple ballot experience.

The core product surfaces are:

- Admin console at `/admin` for election creation, setup, voter management, lifecycle control, turnout monitoring, and results.
- Public voter entry at `/vote` and direct election voting pages at `/vote/[id]`.
- Admin APIs under `/api/elections/*`.
- Public voter APIs under `/api/vote/*` and the public election metadata endpoint at `/api/elections/[id]/public`.

The implementation intentionally keeps admin operations and voter operations separate. Admin APIs require an authenticated NextAuth session and tenant authorization. Voter APIs are public but validate election state and voter credentials on every ballot and submit request.

For the shorter public-facing overview, see [README.md](README.md). For focused architecture detail, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## How the App Works in One Pass

1. An admin signs up or logs in through the admin auth pages in `app/admin/(auth)`. Signup is public and creates a `USER` account; login uses NextAuth Credentials with bcrypt password verification.
2. The admin creates an election from the dashboard. `POST /api/elections` creates the `Election`, optional `VoterFieldDef` rows, initial `Position` rows, and an `ELECTION_CREATED` audit log inside a transaction.
3. The admin configures the election while it is `DRAFT`: title, description, abstain policy, authentication mode, voter fields, positions, candidates, eligibility restrictions, and voter roll.
4. The admin imports voters through `POST /api/elections/[id]/voters`. Access-code elections generate raw codes once, store bcrypt hashes in `tokenHash`, and store SHA-256 fingerprints in `tokenLookup`. Two-field elections store voter metadata used for credential matching.
5. The admin opens polls through `PATCH /api/elections/[id]/status` with `status: "ACTIVE"`. The route allows only `DRAFT -> ACTIVE`, sets `activatedAt`, and writes `ELECTION_ACTIVATED`.
6. Once polls are open, setup routes are frozen server-side. Candidate creation/deletion, position creation, voter import/removal, code regeneration, and election configuration updates are blocked by `requireSetupMutableElection()`.
7. A voter opens `/vote/[id]`. The page requests `GET /api/elections/[id]/public`, which returns only public election metadata needed to render the login form.
8. The voter submits credentials to `POST /api/vote/ballot`. The server requires the election to be `ACTIVE`, validates the access code or two configured fields, rejects voters who already voted, and returns only positions for which the voter is eligible.
9. The voter chooses candidates and confirms submission. The client posts credentials and selections to `POST /api/vote/submit`.
10. The submit route re-authenticates the voter, starts a transaction, atomically flips `Voter.hasVoted` from `false` to `true`, revalidates restrictions and candidates, enforces `maxVotes`, and inserts `Vote` rows.
11. Concurrent duplicate submissions with the same voter can authenticate initially, but only one can claim `hasVoted: false`. Later requests return `409`.
12. The admin closes polls through `PATCH /api/elections/[id]/status` with `status: "ENDED"`. The route allows only `ACTIVE -> ENDED` and writes `ELECTION_ENDED`.
13. Results become available to authorized admins through `GET /api/elections/[id]/results`. The route remains sealed with `403` until the election is `ENDED`.
14. Results are calculated from candidate vote counts, sorted by vote count and name, and winners are marked using `maxWinners` with tie-aware cutoff handling.
15. Administrative lifecycle events, blocked mutations, invalid transitions, candidate events, voter imports/removals, and code regeneration events are persisted to `audit_logs`.

## System Architecture

Votelyt is a single Next.js application. There is no separate API service. Server-rendered admin pages, client-side console interactions, public voter pages, route handlers, authentication, and database access all live in one repository.

```mermaid
flowchart TD
  Browser["Browser"]
  App["Next.js App Router"]
  AdminPages["Admin server and client pages"]
  VotePages["Public voter pages"]
  RouteHandlers["API route handlers"]
  NextAuth["NextAuth credentials auth"]
  Guards["Auth and tenant guards"]
  Prisma["Prisma Client"]
  Postgres["Neon PostgreSQL"]

  Browser --> App
  App --> AdminPages
  App --> VotePages
  App --> RouteHandlers
  AdminPages --> Guards
  RouteHandlers --> Guards
  RouteHandlers --> NextAuth
  AdminPages --> Prisma
  RouteHandlers --> Prisma
  Prisma --> Postgres
```

Important implementation files:

- [`lib/prisma.ts`](lib/prisma.ts) creates the Prisma client with the Neon adapter.
- [`lib/authOptions.ts`](lib/authOptions.ts) defines the NextAuth Credentials provider and JWT callbacks.
- [`lib/auth.ts`](lib/auth.ts) exposes `getCurrentUser()` and `requireUser()`.
- [`lib/tenant.ts`](lib/tenant.ts) implements owner scoping and `authorizeElection()`.
- [`lib/electionIntegrity.ts`](lib/electionIntegrity.ts) centralizes setup freezing and audit logging.
- [`app/api/vote/submit/route.ts`](app/api/vote/submit/route.ts) implements the atomic voting transaction.

For more detail, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Frontend Architecture

The frontend uses the Next.js 16 App Router with a mix of server components and client components.

Primary route groups:

| Path | Purpose |
|---|---|
| `app/page.tsx` | Public landing page. |
| `app/admin/(auth)` | Admin login and signup pages. |
| `app/admin/(console)` | Authenticated admin console pages. |
| `app/vote/page.tsx` | Public election ID entry page. |
| `app/vote/[id]/page.tsx` | Public voter authentication, ballot, review, and submit flow. |

Admin pages use server-side session checks. `app/admin/(console)/layout.tsx` calls `getCurrentUser()` and redirects unauthenticated requests to `/admin/login`. `app/admin/(console)/elections/[id]/page.tsx` uses `ownerScope(user)` to load only tenant-accessible elections and returns `notFound()` for missing or inaccessible records.

The main election console is implemented in [`app/admin/(console)/elections/[id]/ElectionConsole.tsx`](app/admin/(console)/elections/%5Bid%5D/ElectionConsole.tsx). It is a client component that calls admin APIs for lifecycle changes, candidate creation/deletion, voter import, code regeneration, turnout, and results. Results components are dynamically imported because they include heavier visualization dependencies.

The voter flow in [`app/vote/[id]/page.tsx`](app/vote/%5Bid%5D/page.tsx) keeps credentials and ballot selections in browser state only. It loads public configuration, submits credentials for ballot retrieval, maintains selection state, and submits the final selections to the backend. The server repeats all critical validation; the client flow is not trusted for election integrity.

## Backend and API Architecture

The backend is implemented with Next.js Route Handlers under `app/api`.

Admin API routes:

| Route group | Responsibility |
|---|---|
| `app/api/elections/route.ts` | List and create elections. |
| `app/api/elections/[id]/route.ts` | Read, update, and delete one election. |
| `app/api/elections/[id]/status/route.ts` | Apply lifecycle transitions. |
| `app/api/elections/[id]/positions/route.ts` | Create positions. |
| `app/api/elections/[id]/candidates/route.ts` | Create and delete candidates. |
| `app/api/elections/[id]/voters/route.ts` | List, import, add, and clear voters. |
| `app/api/elections/[id]/voters/[voterId]/route.ts` | Remove one voter. |
| `app/api/elections/[id]/voters/[voterId]/regenerate/route.ts` | Regenerate one voter access code. |
| `app/api/elections/[id]/voters/regenerate/route.ts` | Bulk-regenerate access codes. |
| `app/api/elections/[id]/turnout/route.ts` | Return turnout counts and a turnout time series. |
| `app/api/elections/[id]/results/route.ts` | Return sealed results after close. |

Public voter API routes:

| Route | Responsibility |
|---|---|
| `GET /api/elections/[id]/public` | Return minimal public election metadata for the voter UI. |
| `POST /api/vote/ballot` | Authenticate a voter and return the eligible ballot. |
| `POST /api/vote/submit` | Re-authenticate, claim the voter, validate selections, and insert votes. |

Auth API routes:

| Route | Responsibility |
|---|---|
| `GET/POST /api/auth/[...nextauth]` | NextAuth handler. |
| `POST /api/auth/signup` | Public account creation. |

Admin APIs use `requireUser()` or `authorizeElection()`. Election-specific admin APIs return `401` for unauthenticated requests and `404` for authenticated users who cannot access the election. This avoids leaking whether another tenant's election ID exists.

## Database Design

The database is PostgreSQL. Prisma schema and migrations are in [`prisma/schema.prisma`](prisma/schema.prisma) and [`prisma/migrations`](prisma/migrations).

```mermaid
erDiagram
  User ||--o{ Election : owns
  Election ||--o{ VoterFieldDef : defines
  Election ||--o{ Position : contains
  Election ||--o{ Candidate : contains
  Election ||--o{ Voter : registers
  Position ||--o{ Candidate : groups
  Position ||--o{ Vote : receives
  Candidate ||--o{ Vote : receives
  Election ||--o{ AuditLog : records

  User {
    string id PK
    string username UK
    string passwordHash
    Role role
    datetime createdAt
    datetime updatedAt
  }

  Election {
    string id PK
    string ownerId FK
    string title
    ElectionStatus status
    AuthMode authMode
    json authFields
    json candidateFields
    boolean allowAbstain
    datetime activatedAt
  }

  Voter {
    string id PK
    string electionId FK
    json metadata
    string tokenHash
    string tokenLookup
    boolean hasVoted
    datetime votedAt
  }

  Position {
    string id PK
    string electionId FK
    string title
    int maxWinners
    int maxVotes
    json restrictions
    int sortOrder
  }

  Candidate {
    string id PK
    string electionId FK
    string positionId FK
    string name
    string photoUrl
    json metadata
  }

  Vote {
    string id PK
    string electionId
    string positionId FK
    string candidateId FK
    datetime createdAt
  }

  AuditLog {
    string id PK
    string action
    string userId
    string electionId
    json metadata
    datetime createdAt
  }
```

Key models:

- `User`: admin account with unique username, bcrypt password hash, and `USER` or `SUPERADMIN` role.
- `Election`: top-level election configuration, owner, status, auth mode, candidate field definitions, abstain policy, and `activatedAt`.
- `VoterFieldDef`: per-election voter metadata field definitions.
- `Position`: contest definition with `maxVotes`, `maxWinners`, and JSON eligibility restrictions.
- `Candidate`: candidate under a position, with optional photo data URL and custom metadata.
- `Voter`: voter roll record with metadata, optional access-code hash/fingerprint, `hasVoted`, and `votedAt`.
- `Vote`: one candidate selection, storing `electionId`, `positionId`, and `candidateId`, but not `voterId`.
- `AuditLog`: backend event log for administrative integrity actions.

Important constraints and indexes:

- `User.username` is unique.
- `Election.ownerId` is indexed.
- `Election.status` is indexed.
- `Voter` has indexes on `electionId` and `(electionId, hasVoted)`.
- `Voter` has a unique `(electionId, tokenLookup)` constraint for access-code fingerprints.
- Candidate, position, and vote foreign keys cascade on delete.

The cascade behavior matters operationally. Candidate deletion can cascade votes, so candidate deletion is blocked after an election opens. Election deletion is still destructive after authorization and cascades election data; see [Known Limitations](#known-limitations).

For deeper model notes, see [docs/DATABASE.md](docs/DATABASE.md).

## Authentication and Authorization

Admin authentication uses NextAuth v4 with the Credentials provider.

Implementation files:

- [`lib/authOptions.ts`](lib/authOptions.ts)
- [`lib/auth.ts`](lib/auth.ts)
- [`lib/tenant.ts`](lib/tenant.ts)
- [`types/next-auth.d.ts`](types/next-auth.d.ts)
- [`app/api/auth/[...nextauth]/route.ts`](app/api/auth/%5B...nextauth%5D/route.ts)
- [`app/api/auth/signup/route.ts`](app/api/auth/signup/route.ts)

The credentials provider trims the username, loads the user by unique username, and verifies the submitted password with bcrypt. Sessions use JWTs with a seven-day max age. The JWT callback refreshes the current role from the database, and deleted users are treated as invalid sessions.

Authorization is tenant-scoped:

- Every `Election` belongs to a `User` through `ownerId`.
- `ownerScope(user)` restricts normal users to `{ ownerId: user.id }`.
- `SUPERADMIN` receives an empty owner scope and can access all elections.
- `authorizeElection(electionId)` combines session validation with tenant access checks.

Public signup is intentionally enabled. New accounts are created with role `USER`. Superadmin bootstrap is handled by [`prisma/seed.ts`](prisma/seed.ts).

## Election Lifecycle

Votelyt stores lifecycle state in `Election.status` using the `ElectionStatus` enum. The UI presents these as Draft, Open, and Close or Closed.

```mermaid
stateDiagram-v2
  [*] --> DRAFT
  DRAFT --> ACTIVE: open polls
  ACTIVE --> ENDED: close polls
  ACTIVE --> DRAFT: blocked
  ENDED --> ACTIVE: blocked
  ENDED --> DRAFT: blocked
```

Allowed transitions:

| From | To | Allowed |
|---|---|---:|
| `DRAFT` | `ACTIVE` | Yes |
| `ACTIVE` | `ENDED` | Yes |
| `ACTIVE` | `DRAFT` | No |
| `ENDED` | `ACTIVE` | No |
| `ENDED` | `DRAFT` | No |
| `DRAFT` | `ENDED` | No |

The lifecycle route is [`app/api/elections/[id]/status/route.ts`](app/api/elections/%5Bid%5D/status/route.ts). It validates the requested status, runs inside a transaction, checks the current status, writes audit logs for activation or ending, and uses `updateMany` with the current status in the `where` clause to avoid silently overwriting a concurrent transition.

`Election.activatedAt` records whether an election has ever opened. It is set when `DRAFT` transitions to `ACTIVE` and is preserved afterward. Setup mutability checks require both `status === "DRAFT"` and `activatedAt === null`.

For more detail, see [docs/ELECTION_LIFECYCLE.md](docs/ELECTION_LIFECYCLE.md).

## Voting Flow

Voting is public but credential-gated. Voters do not need admin sessions. The public voter APIs validate election state and voter credentials.

```mermaid
sequenceDiagram
  participant Voter
  participant VoteUI as /vote/[id]
  participant PublicConfig as GET /api/elections/[id]/public
  participant BallotAPI as POST /api/vote/ballot
  participant SubmitAPI as POST /api/vote/submit
  participant DB as PostgreSQL

  Voter->>VoteUI: Opens election URL
  VoteUI->>PublicConfig: Request public config
  PublicConfig->>DB: Load election and voter fields
  PublicConfig-->>VoteUI: id, title, status, authMode, authFields
  VoteUI-->>Voter: Render credentials form
  Voter->>BallotAPI: Submit credentials
  BallotAPI->>DB: Load ACTIVE election
  BallotAPI->>DB: Match voter by access code or two fields
  BallotAPI->>DB: Load positions and candidates
  BallotAPI-->>VoteUI: Eligible ballot
  Voter->>VoteUI: Make selections
  VoteUI-->>Voter: Review selections
  Voter->>SubmitAPI: Hold to confirm submission
  SubmitAPI->>DB: Re-authenticate voter
  SubmitAPI->>DB: Begin transaction
  SubmitAPI->>DB: Atomically set hasVoted true
  SubmitAPI->>DB: Validate eligibility and selections
  SubmitAPI->>DB: Insert vote rows
  SubmitAPI-->>VoteUI: ok
  VoteUI-->>Voter: Confirmation and reset
```

Access-code elections use `tokenLookup` for indexed lookup and `tokenHash` for bcrypt verification. Two-field elections compare configured metadata fields case-insensitively. The current two-field implementation scans election voters in application code.

The submit route re-authenticates the voter and validates:

- Election is `ACTIVE`.
- Credentials identify a real voter.
- Voter has not already voted.
- Submitted positions exist.
- Position restrictions still allow the voter.
- Candidate IDs belong to the submitted position.
- `maxVotes` is not exceeded.
- Duplicate candidate IDs are not present in a position.
- Required selections exist when `allowAbstain` is false.

Votes are inserted as separate rows with `electionId`, `positionId`, and `candidateId`. They do not store `voterId`.

For a line-by-line flow explanation, see [docs/VOTING_FLOW.md](docs/VOTING_FLOW.md).

## Election Integrity Safeguards

The key integrity safeguards are server-side. UI controls may hide invalid actions, but the API routes enforce the rules.

### Frozen Setup

[`lib/electionIntegrity.ts`](lib/electionIntegrity.ts) defines:

```ts
export function isSetupMutable(election: ElectionIntegrityState): boolean {
  return election.status === "DRAFT" && election.activatedAt === null;
}
```

Routes call `requireSetupMutableElection()` before setup mutations. If an election is not mutable, the API writes `BLOCKED_ACTIVE_MUTATION` and returns `403`.

Frozen routes include:

- `PATCH /api/elections/[id]`
- `POST /api/elections/[id]/positions`
- `POST /api/elections/[id]/candidates`
- `DELETE /api/elections/[id]/candidates`
- `POST /api/elections/[id]/voters`
- `DELETE /api/elections/[id]/voters`
- `DELETE /api/elections/[id]/voters/[voterId]`
- `POST /api/elections/[id]/voters/[voterId]/regenerate`
- `POST /api/elections/[id]/voters/regenerate`

There are no current API routes for candidate editing, position editing, or position deletion.

### Atomic Double-Vote Prevention

[`app/api/vote/submit/route.ts`](app/api/vote/submit/route.ts) claims a voter inside the vote transaction:

```ts
const claim = await tx.voter.updateMany({
  where: { id: matchedVoter.id, hasVoted: false },
  data: { hasVoted: true, votedAt: new Date() },
});
```

Only one concurrent request can update a voter from not-voted to voted. If the update count is not one, the route returns `409`.

### Stale Ballot Protection

The submit route does not trust the ballot returned earlier. It reloads election state, voter metadata, positions, and candidates, then revalidates all critical constraints before inserting votes.

### Sealed Results

`GET /api/elections/[id]/results` requires admin authorization and returns `403` until `Election.status === "ENDED"`.

## Audit Logging

Audit logs are persisted in the `AuditLog` model and `audit_logs` table. Logging is backend-only; there is no frontend audit viewer yet.

Implementation:

- [`lib/electionIntegrity.ts`](lib/electionIntegrity.ts) contains `writeAuditLog()`.
- [`prisma/schema.prisma`](prisma/schema.prisma) defines `AuditLog`.
- Migration `20260610120000_add_audit_logs_and_activation_tracking` creates `audit_logs` and adds `Election.activatedAt`.

Logged actions include:

- `ELECTION_CREATED`
- `ELECTION_ACTIVATED`
- `ELECTION_ENDED`
- `INVALID_STATUS_TRANSITION`
- `BLOCKED_ACTIVE_MUTATION`
- `CANDIDATE_CREATED`
- `CANDIDATE_DELETE_ATTEMPTED`
- `VOTERS_IMPORTED`
- `VOTERS_REMOVED`
- `VOTER_CODES_REGENERATED`

Audit metadata is JSON and varies by route. Examples include attempted action names, candidate IDs, voter counts, regeneration scope, status transitions, and whether the election had previously opened.

## Security Model

Security is implemented through a combination of authentication, tenant authorization, server-side validation, route-level lifecycle enforcement, and database constraints.

Implemented controls:

- Bcrypt password hashing for admin accounts.
- NextAuth JWT sessions with server-side role refresh.
- Tenant scoping through `Election.ownerId`.
- `SUPERADMIN` role for cross-tenant access.
- Public voter APIs that validate credentials and election state.
- Access-code fingerprints for indexed lookup plus bcrypt verification.
- Unique `(electionId, tokenLookup)` constraint.
- Atomic `hasVoted` claim for duplicate-submit prevention.
- Server-side validation of position eligibility and candidate ownership.
- Setup mutation freezing after opening.
- One-way lifecycle transitions.
- Results blocked until close.
- Baseline security headers in [`next.config.ts`](next.config.ts).

Security headers currently configured:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`

The app does not currently configure a strict Content Security Policy. The code comments in `next.config.ts` note that inline styles, data URL candidate photos, blob CSV downloads, and external HLS video make a tight CSP a future hardening task.

For more detail, see [docs/SECURITY.md](docs/SECURITY.md).

## Core Engineering Decisions

### Next.js

Next.js provides one application surface for server-rendered admin pages, public voter pages, route handlers, and deployment to Vercel. This keeps the app deployable as a single project while still allowing server-side authorization and database access in route handlers and server components.

### Prisma

Prisma provides a typed database access layer over PostgreSQL, a committed migration history, and generated TypeScript types for the election data model. The app uses Prisma transactions for election creation, status changes, voter imports, audit logging, and vote submission.

### PostgreSQL and Neon

PostgreSQL is used for relational integrity, indexes, transactions, JSON metadata fields, and count-based result queries. Neon is the configured production target and is accessed through the Prisma Neon serverless adapter with a pooled connection string.

### NextAuth

NextAuth handles credentials-based admin sessions without a separate auth service. JWT sessions include user ID and role, and callbacks keep role data fresh by reading from the database.

### Server-Side Election Freezing

Election setup freezing is enforced in API routes instead of relying on hidden or disabled frontend controls. This matters because admin users or hostile clients can call APIs directly.

### Audit Logging

Audit logging creates a backend record of meaningful administrative events and blocked integrity-sensitive attempts. It is designed as a persistence layer first; the current app does not include an audit viewer.

### One-Way Lifecycle Transitions

The one-way `DRAFT -> ACTIVE -> ENDED` lifecycle prevents reopening closed elections or returning active elections to setup mode. It keeps ballot configuration and historical results from being mutated after voting begins.

## Deployment

The production target is Vercel plus Neon PostgreSQL.

```mermaid
flowchart TD
  Dev["Developer"]
  GitHub["GitHub repository"]
  Vercel["Vercel deployment"]
  Next["Next.js app"]
  Neon["Neon PostgreSQL pooled endpoint"]

  Dev --> GitHub
  GitHub --> Vercel
  Vercel --> Next
  Next --> Neon
```

Required environment variables:

| Variable | Required | Notes |
|---|---:|---|
| `DATABASE_URL` | Yes | Neon pooled PostgreSQL connection string with `sslmode=require`. |
| `NEXTAUTH_SECRET` | Yes | NextAuth JWT signing secret. Rotating it invalidates sessions. |
| `NEXTAUTH_URL` | Yes | Public base URL for the deployment. |
| `SUPERADMIN_USERNAME` | Seed only | Bootstrap superadmin username. |
| `SUPERADMIN_PASSWORD` | Seed only | Bootstrap superadmin password. |

Package scripts:

| Script | Command |
|---|---|
| `dev` | `next dev --webpack` |
| `dev:turbo` | `next dev` |
| `build` | `prisma generate && next build` |
| `start` | `next start` |
| `lint` | `eslint` |
| `postinstall` | `prisma generate` |

Production migration command:

```bash
npx prisma migrate deploy
```

The build script does not apply migrations. Apply migrations before deploying application code that depends on new schema.

For rollout and rollback notes, see [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).

## Local Development

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Set required values:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/neondb?sslmode=require"
NEXTAUTH_SECRET="<32-byte base64 random>"
NEXTAUTH_URL="http://localhost:3000"
SUPERADMIN_USERNAME="Mukilan"
SUPERADMIN_PASSWORD="<strong password>"
```

Generate Prisma client and apply migrations:

```bash
npx prisma generate
npx prisma migrate deploy
```

Seed the bootstrap superadmin if needed:

```bash
node prisma/seed.ts
```

Run the dev server:

```bash
npm run dev
```

`npm run dev` uses `next dev --webpack`. This is the current preferred local dev-server choice because Webpack avoids Turbopack/font issues observed when the project path contains spaces. `npm run dev:turbo` remains available.

Useful verification commands:

```bash
npm run lint
npx tsc --noEmit
npm run build
node scripts/loadtest.mjs 40
```

For contributor workflow details, see [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md).

## Known Limitations

Current known limitations are documented here intentionally:

- Public signup is intentional and currently unrestricted.
- Rate limiting is not currently implemented on signup, login, public election metadata, voter authentication, vote submission, or admin APIs.
- The audit log has no frontend viewer yet.
- The public election metadata endpoint exists for the voter flow.
- Large-scale two-field voter authentication may need optimization later because it scans voter rows in application code.
- There is no strict Content Security Policy.
- There is no CAPTCHA, account lockout, or voter credential attempt throttling.
- Vote rows do not include `voterId`, which protects privacy but limits ballot-level forensic traceability.
- There is no vote receipt mechanism.
- There is no signed ballot snapshot or ballot version field.
- `DELETE /api/elections/[id]` can delete a previously opened election after authorization and cascades associated data.
- Audit logs do not have database foreign keys to users or elections.
- Candidate photos are stored as data URLs in the database.
- There is no dedicated monitoring or alerting configuration in the repository.
- Candidate editing, position editing, and position deletion API routes do not currently exist.

## Future Improvements

These are natural follow-up areas based on the current implementation:

- Add rate limiting for public auth, voter auth, vote submit, signup, and sensitive admin mutations.
- Add an admin audit-log viewer with filtering by election, action, user, and time.
- Optimize two-field voter authentication with normalized lookup columns or indexed credential fingerprints.
- Introduce soft delete or archive behavior for elections that have opened.
- Add stricter Content Security Policy support after replacing or constraining current inline, data URL, blob, and external-media needs.
- Add monitoring, structured logs, and alerting for production incidents.
- Add explicit ballot versioning if election setup becomes more editable before activation.
- Add automated end-to-end tests around opening, voting, duplicate submit, closing, and results.
- Add API tests for lifecycle transition failures and frozen mutation failures.

## Glossary

**Election:** The top-level record that owns configuration, lifecycle state, positions, candidates, voter fields, voters, and results.

**Position:** A contest within an election, such as President or House Captain. Positions define selection limits, winner count, sort order, and optional voter eligibility restrictions.

**Candidate:** A person or option running under a position. Candidates belong to both an election and a position.

**Voter:** A voter-roll entry for one election. Voters store metadata, credential data, and turnout state.

**Vote:** One stored candidate selection. Vote rows store election, position, and candidate IDs, but not voter IDs.

**AuditLog:** Backend event record for administrative actions and blocked integrity-sensitive attempts.

**Draft:** User-facing setup state; internally `DRAFT`. Admins can configure the election while it has never opened.

**Open:** User-facing active voting state; internally `ACTIVE`. Voters can authenticate and submit ballots. Setup mutations are frozen.

**Closed:** User-facing post-election state; internally `ENDED`. Voting is disabled and authorized admins can view results.

**Access code:** A six-character voter credential generated for access-code elections. The raw code is shown to admins once, while the database stores a bcrypt hash and SHA-256 lookup fingerprint.

**Tenant isolation:** The rule that normal admins can access only elections where `Election.ownerId` matches their user ID. `SUPERADMIN` bypasses owner scoping.
