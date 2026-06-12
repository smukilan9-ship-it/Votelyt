# Votelyt Development

This document describes how to work on the current codebase locally.

## Requirements

- Node.js compatible with Next.js 16 and React 19.
- npm.
- PostgreSQL database URL. Neon pooled PostgreSQL is the target setup.

## Local Setup

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Set at least:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/neondb?sslmode=require"
NEXTAUTH_SECRET="<32-byte base64 random>"
NEXTAUTH_URL="http://localhost:3000"
SUPERADMIN_USERNAME="Mukilan"
SUPERADMIN_PASSWORD="<strong password>"
```

Generate Prisma client:

```bash
npx prisma generate
```

Apply migrations:

```bash
npx prisma migrate deploy
```

Seed the bootstrap superadmin when needed:

```bash
node prisma/seed.ts
```

Start the development server:

```bash
npm run dev
```

`npm run dev` uses `next dev --webpack`. This is the current preferred local dev-server choice because Webpack avoids Turbopack/font issues observed when the project path contains spaces. `npm run dev:turbo` remains available for testing the default Next dev server.

## Common Commands

| Task | Command |
|---|---|
| Install dependencies | `npm install` |
| Run dev server | `npm run dev` |
| Run default Next dev server | `npm run dev:turbo` |
| Generate Prisma client | `npx prisma generate` |
| Apply migrations | `npx prisma migrate deploy` |
| Create a migration during development | `npx prisma migrate dev --name <name>` |
| Seed superadmin | `node prisma/seed.ts` |
| Lint | `npm run lint` |
| Typecheck | `npx tsc --noEmit` |
| Build | `npm run build` |
| Start production build | `npm run start` |
| Run vote concurrency load test | `node scripts/loadtest.mjs` |

There is no `typecheck` script in `package.json`.

## Project Structure

| Path | Purpose |
|---|---|
| `app` | Next.js App Router pages and API route handlers. |
| `app/admin/(auth)` | Public admin auth pages. |
| `app/admin/(console)` | Authenticated admin console. |
| `app/api/auth` | Signup and NextAuth endpoints. |
| `app/api/elections` | Election management, turnout, results, voter management, public election config. |
| `app/api/vote` | Public ballot and submit endpoints. |
| `app/vote` | Public voter entry and ballot UI. |
| `components/admin` | Admin-specific UI components. |
| `components/ui` | Shared UI components and visual shell. |
| `components/vote` | Voter-flow UI components. |
| `lib` | Auth, tenant, Prisma, token, CSV, template, and election-integrity helpers. |
| `prisma` | Prisma schema, migrations, and seed script. |
| `scripts` | Local development and verification utilities. |
| `types` | Type augmentation, currently NextAuth session types. |

## Prisma Workflow

Schema file:

```text
prisma/schema.prisma
```

Migration directory:

```text
prisma/migrations
```

Configuration file:

```text
prisma.config.ts
```

Development flow for schema changes:

1. Edit `prisma/schema.prisma`.
2. Create a migration with `npx prisma migrate dev --name <name>`.
3. Review the generated SQL in `prisma/migrations`.
4. Run `npx prisma generate`.
5. Update route handlers and documentation as needed.
6. Run lint, typecheck, and build.

Do not use reset or force-reset commands on production data.

## Authentication Development

Important files:

- `lib/authOptions.ts`
- `lib/auth.ts`
- `lib/tenant.ts`
- `app/api/auth/[...nextauth]/route.ts`
- `app/api/auth/signup/route.ts`
- `types/next-auth.d.ts`

Admin API handlers should use:

- `requireUser()` for collection-level authenticated routes.
- `authorizeElection(id)` for election-specific routes.

Server-rendered admin pages should use:

- `getCurrentUser()`
- `ownerScope(user)`

## Election Integrity Development

Important file:

```text
lib/electionIntegrity.ts
```

Use `requireSetupMutableElection()` for setup mutations that must be blocked after an election opens.

Current setup mutation routes already using it:

- `PATCH /api/elections/[id]`
- `POST /api/elections/[id]/positions`
- `POST /api/elections/[id]/candidates`
- `DELETE /api/elections/[id]/candidates`
- `POST /api/elections/[id]/voters`
- `DELETE /api/elections/[id]/voters`
- `DELETE /api/elections/[id]/voters/[voterId]`
- `POST /api/elections/[id]/voters/[voterId]/regenerate`
- `POST /api/elections/[id]/voters/regenerate`

Status transition logic lives in:

```text
app/api/elections/[id]/status/route.ts
```

## Voting Development

Important files:

- `app/vote/[id]/page.tsx`
- `app/api/elections/[id]/public/route.ts`
- `app/api/vote/ballot/route.ts`
- `app/api/vote/submit/route.ts`
- `lib/tokens.ts`
- `lib/voterTokens.ts`

Do not rely on client-side ballot state for integrity. The submit route must continue to re-authenticate and revalidate credentials, election status, restrictions, candidate IDs, duplicate selections, and `maxVotes`.

## Load Test

`scripts/loadtest.mjs` is a sandboxed concurrency test.

It:

- Creates a temporary owner and active election.
- Creates voters and candidates.
- Fires concurrent vote submissions.
- Verifies vote count and `hasVoted` count.
- Replays the same credentials to test duplicate rejection.
- Deletes the sandbox election and owner.

Run against a local server:

```bash
node scripts/loadtest.mjs
```

Change voter count:

```bash
node scripts/loadtest.mjs 100
```

Use another base URL:

```bash
LOADTEST_BASE="http://localhost:3001" node scripts/loadtest.mjs 100
```

## Contribution Workflow

Recommended workflow:

1. Check `git status --short`.
2. Create a branch for the change.
3. Keep edits scoped to the requested behavior.
4. For API or database changes, update the relevant docs in `docs/`.
5. Run `npm run lint`.
6. Run `npx tsc --noEmit`.
7. Run `npm run build`.
8. Commit with a focused message.

## Current Technical Debt and Cautions

- Public signup is intentionally enabled and not rate-limited.
- Public voter endpoints are not rate-limited.
- Two-field voter lookup scans election voters in application code.
- There is no audit-log UI.
- Election deletion is destructive and cascades data after authorization.
- Strict CSP is not configured.
- Position edit/delete and candidate edit APIs do not currently exist.
