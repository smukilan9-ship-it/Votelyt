# Votelyt Security

This document describes implemented security controls and known limitations in the current codebase.

## Admin Authentication

Admin authentication uses NextAuth v4 Credentials provider.

Implemented in:

- `app/api/auth/[...nextauth]/route.ts`
- `lib/authOptions.ts`
- `lib/auth.ts`

Properties:

- Username/password login.
- Passwords stored with bcrypt.
- JWT session strategy.
- Seven-day session max age.
- Session user includes `id` and `role`.
- Existing sessions refresh the current role from the database during JWT callbacks.
- Deleted users are treated as invalid sessions.

Public signup is intentional and implemented in `app/api/auth/signup/route.ts`.

Signup behavior:

- Accepts username and password.
- Enforces username pattern `^[a-zA-Z0-9_.-]{3,32}$`.
- Requires password length of at least eight characters.
- Creates users with role `USER`.
- Returns only `id` and `username`.

## Route Protection

Admin page protection:

- `app/admin/(console)/layout.tsx` checks `getCurrentUser()` and redirects to `/admin/login`.
- `app/admin/(console)/page.tsx` also checks `getCurrentUser()`.
- `app/admin/(console)/elections/[id]/page.tsx` checks `getCurrentUser()` and tenant scope.

Admin API protection:

- Collection routes call `requireUser()`.
- Election-specific routes call `authorizeElection(id)`.
- Unauthenticated admin API requests return `401`.
- Authenticated non-owner access returns `404` to avoid election ID enumeration across tenants.

Public routes:

- `/admin/login`
- `/admin/signup`
- `/api/auth/signup`
- `/api/elections/[id]/public`
- `/api/vote/ballot`
- `/api/vote/submit`
- `/vote`
- `/vote/[id]`

## Tenant Isolation

Tenant isolation is implemented in `lib/tenant.ts`.

Rules:

- `USER` role is scoped by `Election.ownerId`.
- `SUPERADMIN` receives an empty owner scope and can access all elections.
- `authorizeElection()` uses a scoped database query before allowing election-specific API operations.
- Admin server pages use `ownerScope(user)` for election queries.

This prevents a normal admin from reading or mutating another admin's election through the documented admin routes.

## Public Voter Endpoints

Voter endpoints do not use admin sessions.

`GET /api/elections/[id]/public` returns minimal public election metadata needed by the voter UI. It does not return positions, candidates, voters, token hashes, or results.

`POST /api/vote/ballot` and `POST /api/vote/submit` validate:

- Election existence.
- `Election.status === "ACTIVE"`.
- Voter credentials.
- Whether the voter has already voted.

The submit route re-authenticates the voter and does not trust the client-provided ballot state.

## Election Freezing

Setup freezing is implemented in `lib/electionIntegrity.ts`.

`isSetupMutable(election)` only returns true when:

- `status === "DRAFT"`
- `activatedAt === null`

The following server routes use the freeze guard:

- `PATCH /api/elections/[id]`
- `POST /api/elections/[id]/positions`
- `POST /api/elections/[id]/candidates`
- `DELETE /api/elections/[id]/candidates`
- `POST /api/elections/[id]/voters`
- `DELETE /api/elections/[id]/voters`
- `DELETE /api/elections/[id]/voters/[voterId]`
- `POST /api/elections/[id]/voters/[voterId]/regenerate`
- `POST /api/elections/[id]/voters/regenerate`

Blocked setup mutations write `BLOCKED_ACTIVE_MUTATION` audit logs and return `403`.

## One-Way Lifecycle Transitions

`PATCH /api/elections/[id]/status` allows only:

- `DRAFT -> ACTIVE`
- `ACTIVE -> ENDED`

Invalid transitions write `INVALID_STATUS_TRANSITION` audit logs and return `400`.

The status update uses `updateMany` with the current status in the `where` clause so a concurrent transition does not silently overwrite a newer status.

## Vote Integrity

Implemented controls:

- Voter credentials are verified during ballot retrieval and again during submit.
- Access codes use SHA-256 lookup fingerprints plus bcrypt verification.
- `(electionId, tokenLookup)` is unique.
- The submit route atomically claims the voter with `hasVoted: false -> true`.
- Candidate IDs are validated against the submitted position.
- Position restrictions are rechecked during submit.
- `maxVotes` is enforced server-side.
- Duplicate candidate IDs within one position are rejected.
- If abstaining is disabled, every eligible position with candidates must receive a vote.
- Results are blocked until `status === "ENDED"`.

## Audit Logging

Audit logging is backend-only.

Implemented in:

- `lib/electionIntegrity.ts`
- `AuditLog` model in `prisma/schema.prisma`

Logged actions currently include:

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

There is no frontend audit log viewer yet.

## Security Headers

`next.config.ts` sets baseline headers for all routes:

- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`

The app does not currently set a strict Content Security Policy. The code comments note that inline styles, data URL images, blob CSV downloads, and external HLS video currently make a tight CSP non-trivial.

## Input and File Handling

Implemented validation examples:

- Signup validates username format and minimum password length.
- Election creation requires a title.
- Two-field auth mode requires exactly two auth fields for generic elections.
- Candidate creation requires `positionId` and `name`.
- Candidate creation verifies the position belongs to the same election.
- Candidate photo uploads are capped at 2 MB.
- Voter imports reject empty files.
- Voter imports check required two-field columns.
- Voter imports reject duplicate primary identifiers in the file and existing database.
- Bulk access-code regeneration caps one request at 500 voters.

## Known Limitations

- Public signup is intentional and currently unrestricted.
- Rate limiting is not implemented on signup, login, public election metadata, voter authentication, vote submission, or admin APIs.
- There is no frontend audit log viewer.
- The public election metadata endpoint exists by design for the voter flow.
- There is no strict CSP.
- There is no CAPTCHA or lockout for repeated voter credential attempts.
- Two-field voter authentication scans voter rows in application code.
- `DELETE /api/elections/[id]` can delete a previously opened election after authorization and cascades all associated data.
- Audit logs do not have database foreign keys to `User` or `Election`.
- Candidate photos are stored as data URLs in the database; the app enforces size but does not perform malware scanning.
- There is no dedicated monitoring or alerting integration in the repository.
