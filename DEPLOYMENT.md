# Deployment, Rollback & Recovery — Votelyt Election Platform

Target: **Vercel** (Next.js 16) + **Neon Postgres**.

---

## 1. Environment variables

Set these in **Vercel → Settings → Environment Variables** (Production + Preview).
See `.env.example` for the full annotated list.

| Variable | Required | Notes |
|---|---|---|
| `DATABASE_URL` | ✅ | Neon **pooled** connection string (`…-pooler.…`). |
| `NEXTAUTH_SECRET` | ✅ | `openssl rand -base64 32`. Rotating it invalidates all sessions. |
| `NEXTAUTH_URL` | ✅ | Production domain. |
| `SUPERADMIN_USERNAME` / `SUPERADMIN_PASSWORD` | ✅ (seed) | Bootstrap admin; seeded once. |

> Secrets are **server-only**. None are prefixed `NEXT_PUBLIC_`, so nothing
> reaches the client bundle.

---

## 2. Migration safety

Most migrations are additive, but the password-reset removal migration is
destructive by design: it drops the reset-token table and unused account email /
token-version columns. The schema history lives in `prisma/migrations/` and is
reproducible.

Rules going forward:
- **Never** run `prisma migrate reset` / `prisma db push --force-reset` against production.
- Production deploys apply migrations with **`prisma migrate deploy`** (forward-only;
  never generates or drops). The build does **not** auto-apply migrations.
- Destructive changes (drop column/table, narrow a type, add a constraint that can
  fail on existing data) require an explicit, reviewed migration and a backup first.
  Prefer the **expand/contract** pattern: add new → backfill → switch reads/writes →
  drop old in a later release.

Recommended deploy order for a schema change:
```
1. Take a Neon branch/backup (see §4).
2. npx prisma migrate deploy        # apply reviewed forward migration
3. Deploy the app build that matches the new schema.
```

---

## 3. Rollback strategy

**Application rollback (Vercel) is data-safe.** A Vercel rollback only swaps the
serving build; it does **not** touch the database. To roll back:

- Vercel Dashboard → Deployments → pick the last-good deployment → **Promote to Production**, **or**
- `vercel rollback <deployment-url>`.

**Compatibility rule:** because additive migrations leave old columns in place, the
previous app build keeps working after a rollback. Only a *destructive* migration
breaks this — which is why destructive changes must ship as expand/contract across
two releases, so any single release is rollback-safe.

If a bad **migration** (not app code) needs reverting, write a new forward
migration that undoes it — do not delete migration files or edit applied ones.

---

## 4. Backup & recovery (Neon)

- **Point-in-time restore:** Neon retains history (7 days on free tier, longer on
  paid). Console → Project → **Restore** to recover to a timestamp before an incident.
- **Branches as backups:** before any risky migration, create a Neon **branch** of
  production (`main`) — an instant copy-on-write snapshot you can restore from or test against.
- **Logical dump (offline backup):**
  ```
  pg_dump "$DATABASE_URL" -Fc -f backup-$(date +%F).dump
  # restore: pg_restore -d "$TARGET_URL" backup-YYYY-MM-DD.dump
  ```
- Schedule periodic `pg_dump` to object storage for true off-platform backups.

**Recovery drill:** restore a Neon branch from a snapshot, point a Preview
deployment's `DATABASE_URL` at it, verify, then promote if needed.

---

## 5. Data-loss risk assessment

| Action | Data at risk | Mitigation |
|---|---|---|
| Vercel app rollback | None | DB untouched. |
| `prisma migrate deploy` (reviewed) | Depends on migration | Forward-only; back up before destructive drops. |
| Destructive migration | High | Backup + expand/contract + review. |
| `migrate reset` / `--force-reset` | **Total** | Never in prod; not in any script. |
| Deleting an election (cascade) | That election's children | Owner-scoped, intentional; consider soft-delete later. |

---

## 6. Build & runtime config

- Build: `prisma generate && next build` (+ `postinstall: prisma generate`) so the
  client is always regenerated on Vercel — prevents stale-client 500s.
- API routes that use bcrypt/Prisma pin `runtime = "nodejs"` (not Edge).
- Heavy routes (voter import, bulk code regeneration) set `maxDuration = 60`.
