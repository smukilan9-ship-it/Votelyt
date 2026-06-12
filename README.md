# Votelyt

Votelyt is a self-hostable election platform for schools and organizations that need private online voting, controlled voter access, live turnout monitoring, and sealed results. It provides an authenticated admin console for election setup and operations, plus a public voter experience that authenticates each voter and records ballots without storing a voter reference on individual vote rows.

---

## Features

### Election Management

- Create elections from scratch or from built-in templates.
- Configure election title, description, authentication mode, abstain policy, voter fields, positions, and eligibility rules.
- Use short, typeable six-character election IDs for voter access.
- Manage a three-phase lifecycle: Draft, Open, Close.
- Enforce one-way status transitions on the server: `DRAFT -> ACTIVE -> ENDED`.
- Freeze setup mutations after an election has opened.

### Candidate Management

- Add candidates to positions before an election opens.
- Upload candidate photos as JPEG, PNG, or WebP files up to 2 MB.
- Capture custom candidate metadata fields defined during election setup.
- Remove candidates only while the election is still mutable.
- Audit candidate creation and deletion attempts.

### Voter Management

- Import voters from CSV, XLS, or XLSX files.
- Define custom voter fields per election.
- Mark one voter field as the primary identifier and reject duplicate identifiers during import.
- Support access-code and two-field voter authentication modes.
- Generate and download one-time-visible voter access codes.
- Regenerate individual or bulk access codes before polls open.
- Search, refresh, remove, or clear the voter roll while the election is in Draft.

### Authentication

- Admin authentication with NextAuth Credentials provider.
- Username/password accounts with bcrypt-hashed passwords.
- JWT session strategy with user ID and role embedded in the token.
- User-owned elections with tenant scoping at the API and server-component layer.
- `SUPERADMIN` role for cross-tenant support access.

### Voting Experience

- Public voter entry page at `/vote`.
- Direct election links at `/vote/[id]`.
- Access-code or two-field voter authentication.
- Ballot generation based on voter eligibility restrictions.
- Candidate selection limits per position.
- Review screen before submission.
- Hold-to-confirm ballot submission.
- Kiosk-style reset after successful submission.

### Results & Analytics

- Live turnout widget in the admin console.
- Turnout counts for total, voted, pending, and percentage.
- Cumulative turnout series generated from `votedAt` timestamps.
- Results remain sealed until the election is closed.
- Results are ranked by vote count, with tie-aware winner selection.
- Animated chart and podium views for closed elections.

### Security & Integrity

- Tenant-scoped admin API access through `authorizeElection()`.
- Public voter APIs re-authenticate voters at ballot load and submit time.
- Access-code lookup uses SHA-256 fingerprints plus bcrypt verification.
- Unique `(electionId, tokenLookup)` constraint prevents duplicate access-code fingerprints per election.
- Vote submission uses an atomic `hasVoted: false -> true` database claim to reject double submissions.
- Ballot eligibility and candidate ownership are revalidated on submit.
- Votes store `electionId`, `positionId`, and `candidateId`, not `voterId`.
- Active and previously opened elections block setup mutations through server-side checks.
- Backend audit logs are written for election creation, activation, ending, invalid transitions, candidate events, voter imports/removals, code regeneration, and blocked mutations.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 16 App Router, React 19, Tailwind CSS 4, Framer Motion, GSAP, Lucide React |
| Backend | Next.js Route Handlers, Prisma 7, bcryptjs, nanoid, xlsx |
| Database | PostgreSQL on Neon |
| Authentication | NextAuth v4 Credentials provider, JWT sessions |
| Infrastructure | Vercel, Neon pooled Postgres |
| Deployment | `prisma migrate deploy`, `prisma generate`, `next build` |

---

## Architecture

Votelyt is a single Next.js application. Admin routes are authenticated and tenant-scoped. Voter routes are public, but every ballot and submission request validates the election state and voter credentials.

```mermaid
flowchart TD
  Browser["Browser"]
  Next["Next.js 16 App Router"]
  Pages["Server and Client Components"]
  API["Route Handlers"]
  Auth["NextAuth JWT Sessions"]
  Prisma["Prisma Client"]
  Neon["PostgreSQL on Neon"]

  Browser --> Next
  Next --> Pages
  Next --> API
  API --> Auth
  API --> Prisma
  Pages --> Prisma
  Prisma --> Neon
```

Admin data access is centralized around `lib/tenant.ts`:

- `ownerScope(user)` scopes regular users to their own elections.
- `authorizeElection(id)` returns `401` for unauthenticated requests and `404` for inaccessible elections.
- `SUPERADMIN` can access all elections.

Voter data access is intentionally separate:

- `/api/elections/[id]/public` returns only the public election configuration needed by the voter UI.
- `/api/vote/ballot` authenticates a voter and returns the eligible ballot.
- `/api/vote/submit` re-authenticates the voter and writes votes inside a transaction.

---

## Election Lifecycle

```mermaid
stateDiagram-v2
  [*] --> DRAFT
  DRAFT --> ACTIVE: Open polls
  ACTIVE --> ENDED: Close polls
  ACTIVE --> DRAFT: blocked
  ENDED --> ACTIVE: blocked
  ENDED --> DRAFT: blocked
```

Votelyt stores lifecycle state in the `Election.status` enum:

- `DRAFT`: setup phase. Admins can configure the election, add candidates, import voters, and regenerate codes.
- `ACTIVE`: polls are open. Voting is enabled and election setup is frozen.
- `ENDED`: polls are closed. Voting is disabled and results are available to authorized admins.

Integrity protections implemented in the lifecycle:

- Server-side transition validation only allows `DRAFT -> ACTIVE` and `ACTIVE -> ENDED`.
- Activation sets `Election.activatedAt`.
- Setup mutations require `status === "DRAFT"` and `activatedAt === null`.
- Invalid transition attempts are audit logged.
- Blocked mutations on active or previously opened elections are audit logged.
- Results API returns `403` until the election is `ENDED`.

---

## Getting Started

### Prerequisites

- Node.js 18 or newer.
- npm.
- PostgreSQL connection string. Neon pooled Postgres is the production target.

### 1. Clone the repository

```bash
git clone https://github.com/smukilan9-ship-it/Votelyt.git
cd Votelyt
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and set:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/neondb?sslmode=require"
NEXTAUTH_SECRET="<32-byte base64 random>"
NEXTAUTH_URL="http://localhost:3000"
SUPERADMIN_USERNAME="Mukilan"
SUPERADMIN_PASSWORD="<strong password>"
```

Generate a local auth secret with:

```bash
openssl rand -base64 32
```

### 4. Apply Prisma migrations

```bash
npx prisma migrate dev
```

### 5. Seed the bootstrap superadmin

```bash
node prisma/seed.ts
```

### 6. Start the development server

```bash
npm run dev
```

Open:

- App: `http://localhost:3000`
- Admin signup: `http://localhost:3000/admin/signup`
- Admin login: `http://localhost:3000/admin/login`
- Admin console: `http://localhost:3000/admin`
- Voter portal: `http://localhost:3000/vote`

### Useful commands

```bash
npm run lint
npx tsc --noEmit
npm run build
```

For vote-concurrency testing against a running local app:

```bash
node scripts/loadtest.mjs 40
```

---

## Environment Variables

| Variable | Required | Description |
|---|---:|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string. Production should use the Neon pooled connection string. |
| `NEXTAUTH_SECRET` | Yes | Secret used by NextAuth to sign and encrypt session tokens. Rotating it invalidates existing sessions. |
| `NEXTAUTH_URL` | Yes | Public base URL for NextAuth callbacks. Use `http://localhost:3000` locally and the production domain in Vercel. |
| `SUPERADMIN_USERNAME` | Yes for seed | Username for the bootstrap `SUPERADMIN` created by `prisma/seed.ts`. |
| `SUPERADMIN_PASSWORD` | Yes for seed | Password for the bootstrap `SUPERADMIN`. It is bcrypt-hashed before storage. |

No current environment variable is prefixed with `NEXT_PUBLIC_`.

---

## Database

The Prisma schema is defined in `prisma/schema.prisma`. Migrations live in `prisma/migrations/`.

### Key Entities

- `User`: admin account with username, password hash, role, and owned elections.
- `Election`: top-level election record with status, auth mode, candidate field config, abstain policy, owner, and `activatedAt`.
- `Position`: ballot contest with title, vote limits, winner count, sort order, and JSON eligibility restrictions.
- `Candidate`: candidate record with optional photo URL and custom metadata.
- `Voter`: voter record with metadata, access-code hash/fingerprint fields, and vote status.
- `Vote`: anonymous vote record for an election, position, and candidate.
- `AuditLog`: backend audit entry with action, user ID, election ID, metadata, and timestamp.

### Important Constraints

- `User.username` is unique.
- `Election.ownerId` scopes elections to admins.
- `Voter` has `@@unique([electionId, tokenLookup])`.
- Most election child tables index `electionId`.
- Votes intentionally do not contain `voterId`.

---

## API Overview

Important API groups:

- `app/api/auth/*`: signup and NextAuth credential sessions.
- `app/api/elections`: list and create tenant-scoped elections.
- `app/api/elections/[id]`: election detail, configuration update, and deletion.
- `app/api/elections/[id]/status`: lifecycle transitions.
- `app/api/elections/[id]/candidates`: candidate creation and removal.
- `app/api/elections/[id]/voters`: voter import, voter list, and voter roll clearing.
- `app/api/elections/[id]/voters/*/regenerate`: single and bulk code regeneration.
- `app/api/elections/[id]/public`: minimal public config for the voter portal.
- `app/api/elections/[id]/turnout`: turnout analytics for authorized admins.
- `app/api/elections/[id]/results`: sealed results for authorized admins after close.
- `app/api/vote/ballot`: voter authentication and eligible ballot generation.
- `app/api/vote/submit`: vote validation and transactional ballot submission.

---

## Security

Votelyt implements several election-specific safeguards, but it is not a finished security product. The protections below are present in the current codebase.

### Access Control

- Admin pages redirect unauthenticated users to `/admin/login`.
- Admin APIs require a valid session.
- Election APIs are owner-scoped through `authorizeElection()`.
- Non-owner access returns `404` to avoid exposing election existence.
- Public voter APIs expose only voter-facing election configuration and require voter credentials for ballots and submissions.

### Vote Protection

- Voters are re-authenticated during submission.
- Vote submission is transactional.
- Double voting is prevented with an atomic `hasVoted: false -> true` update.
- Submission revalidates position eligibility, candidate ownership, duplicate selections, and max-vote limits.
- Results are unavailable until the election is closed.

### Election Integrity

- Active elections are frozen against setup mutations.
- Previously opened elections remain protected by `activatedAt`.
- Status transitions are one-way.
- Access-code fingerprints are unique per election.
- Primary voter identifiers are checked for duplicates during import and single-voter add.
- CSV exports escape cells and neutralize spreadsheet formula injection.

### Audit Logging

Backend audit logs are persisted for critical election events:

- election creation;
- election activation and ending;
- invalid status transition attempts;
- candidate creation;
- candidate deletion attempts;
- voter imports and removals;
- voter code regeneration;
- blocked active-election mutations.

### Known Security Gaps

- No rate limiting is currently implemented.
- No database-level row-level security policies are currently implemented.
- Audit logs are not tamper-evident and have no admin UI.
- Whole-election deletion is a hard cascade delete.
- Candidate photos are stored as base64 data URLs in the database.

---

## Deployment

The intended production deployment is Vercel for the Next.js application and Neon for PostgreSQL.

### Vercel

Set the required environment variables in Vercel project settings for Production and Preview. Use the production domain for `NEXTAUTH_URL`.

Build command:

```bash
npm run build
```

The build script runs:

```bash
prisma generate && next build
```

### Neon

Use the pooled Neon connection string for `DATABASE_URL`.

Before deploying schema-dependent application code:

```bash
npx prisma migrate deploy
```

Production migration rules:

- Do not run `prisma migrate reset` against production.
- Do not use force-reset commands against production.
- Prefer forward-only migrations.
- Back up or branch the Neon database before destructive schema changes.

See `DEPLOYMENT.md` for rollback and recovery notes.

---

## Project Structure

```text
app/                  Next.js routes, layouts, pages, and API handlers
components/           Admin, voter, and shared UI components
lib/                  Auth, tenancy, tokens, Prisma, templates, integrity helpers
prisma/               Schema, migrations, and seed script
scripts/              Operational scripts, including vote concurrency load test
```

---

## Contributing

Contributions should preserve election integrity and tenant isolation as first-order constraints.

Before opening a pull request:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

When changing Prisma schema:

1. Create a migration.
2. Run `npx prisma generate`.
3. Restart any running dev server.
4. Document production migration impact if the change is destructive or operationally sensitive.

When changing election behavior:

- Keep validation on the server.
- Keep voter routes independent of admin sessions.
- Do not expose token hashes, raw access codes, owner IDs, or partial results.
- Re-check tenant scoping on every new admin API route.
- Treat changes to vote submission, lifecycle transitions, deletion, and audit logging as high risk.

---

## Acknowledgements

Built with Next.js, React, Prisma, Neon, NextAuth, and Tailwind CSS.
