# Election App — Setup Guide

## Prerequisites
- Node.js 18+
- PostgreSQL 14+ running locally (or any PG connection string)

## 1. Configure environment

Edit `.env`:
```
DATABASE_URL="postgresql://USER:PASSWORD@HOST/DB?sslmode=require"

# next-auth (JWT sessions). Generate a strong secret: `openssl rand -base64 32`
NEXTAUTH_SECRET="<random 32-byte base64>"
NEXTAUTH_URL="http://localhost:3000"

# Bootstrap superadmin (seeded once). Change in production.
SUPERADMIN_USERNAME="Mukilan"
SUPERADMIN_PASSWORD="<strong password>"
```

## 2. Run migrations

```bash
npx prisma migrate dev
```

## 3. Seed the superadmin

```bash
node prisma/seed.ts
```

This creates the `SUPERADMIN` account from `.env`. The superadmin can access every
tenant's data (for support); regular users only ever see their own.

## 4. Start the app

```bash
npm run dev
```

App runs at http://localhost:3000

- Sign up / sign in: http://localhost:3000/admin/signup · http://localhost:3000/admin/login
- Admin console: http://localhost:3000/admin
- Voter portal: http://localhost:3000/vote

## Authentication & multi-tenancy

- Accounts use **username + password**; passwords are **bcrypt-hashed** (cost 12).
- Sessions are **JWT** via next-auth, stored in an **httpOnly** cookie (secure in
  production), with built-in CSRF protection on auth routes.
- **Every election is owned by the user who created it.** Data is isolated per
  tenant at the API and page layer (`lib/tenant.ts`): a user requesting another
  user's election/voters/results/etc. receives **404**. Only a `SUPERADMIN` can
  access across tenants.

## Usage Flow

### Admin
1. Create an account at `/admin/signup` (or log in at `/admin/login`)
2. Create an election (Generic or School template)
3. Add candidates to each position
4. Import voters via CSV/Excel upload — download the generated token CSV
5. Activate the election
6. Share the voter link + each voter's unique token
7. Monitor turnout live on the Overview tab
8. End the election to unlock results

### Voters
1. Go to `/vote/<election-id>`
2. Enter their 6-character access token
3. Select candidates for each position they're eligible for
4. Submit ballot

## CSV Import Format

For **School template**, columns: `id_no`, `kutumba`, `name`, `class`

Example:
```
id_no,kutumba,name,class
S001,Atri,Alice Kumar,10A
S002,Kashyapa,Bob Singh,10B
```

For **Generic** elections, use the field names you defined when creating the election.

## Security Notes

- Access tokens are bcrypt-hashed in the database
- Votes store only `(election_id, position_id, candidate_id)` — no voter reference
- Double-voting prevention uses a database transaction with a re-check
- Results are locked until the admin explicitly ends the election
