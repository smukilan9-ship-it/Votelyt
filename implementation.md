# Implementation Context — Election Platform Redesign

> **Read this first in any new session.** It is the durable, session-portable context doc so we don't re-audit. Keep the **Progress** checklist updated at the end of every work session.

---

## 1. Stack & architecture snapshot

- **Framework:** Next.js **16.2.7** (App Router) — ⚠️ **non-standard build**. `AGENTS.md` mandates reading `node_modules/next/dist/docs/` before coding. Confirmed differences from older Next:
  - **`middleware.ts` is renamed to `proxy.ts`** (`export default async function proxy(req)` + `export const config = { matcher }`). Recommendation in docs: do auth at the **Data Access Layer**, not middleware.
  - `cookies()` / `headers()` are **async** (`await cookies()`).
  - Route handler dynamic params are a Promise: `{ params }: { params: Promise<{ id: string }> }` (existing code already does this). Optional `RouteContext<'/path/[id]'>` global helper exists.
- **React** 19.2.4 · **Tailwind** 4 (`@theme inline` in `app/globals.css`) · **Prisma** 7.8 with **`@prisma/adapter-neon`** (Neon serverless driver) · **next-auth** 4.24 (installed, was unused) · **bcryptjs** · framer-motion, gsap, three.js, xlsx, csv-parse.
- **DB:** Neon PostgreSQL. `prisma.config.ts` loads `.env` via `import "dotenv/config"` (Prisma does NOT auto-load env). Datasource url = `DATABASE_URL`.
- **Env vars** (`.env`): `DATABASE_URL`, `ADMIN_SECRET` (legacy, being removed), `NEXTAUTH_SECRET`, `NEXTAUTH_URL`. **New:** `SUPERADMIN_USERNAME`, `SUPERADMIN_PASSWORD`.

### Route map
- Public: `/` (landing), `/vote`, `/vote/[id]`
- Auth: `/admin/(auth)/login`, `/admin/(auth)/signup` (new)
- Console (protected): `/admin/(console)` → dashboard `page.tsx`, `elections/new`, `elections/[id]`
- API: `/api/auth/[...nextauth]` (new), `/api/auth/signup` (new), `/api/elections[...]`, `/api/vote/{ballot,submit}`. Legacy `/api/admin/{login,logout}` being removed.

### Models (`prisma/schema.prisma`)
`User` (new), `Election` (+`ownerId`), `VoterFieldDef`, `Position`, `Voter`, `Candidate`, `Vote`. Removed: `AdminSession`.
Enums: `Role(USER|SUPERADMIN)` (new), `ElectionStatus`, `ElectionTemplate(GENERIC|SCHOOL)`, `AuthMode(ACCESS_CODE|TWO_FIELDS)`.
All election children cascade from `electionId`, so **tenancy is enforced at the `Election.ownerId` boundary** — children are reached only through an owned election.

---

## 2. Decisions log

| Decision | Choice | Why |
|---|---|---|
| Sequencing | **Foundation first** (auth → users → tenancy → DB), then creation-flow/templates, then UI/perf | Everything depends on users existing |
| Auth | **next-auth v4 Credentials + Prisma**, JWT session strategy (no DB session table) | Deps already installed; fewer Neon round-trips; lean schema |
| Route protection | DAL + console layout redirect (NOT next-auth middleware) | This Next renames middleware→proxy; next-auth v4 middleware helper is risky here |
| Tenant isolation | **Centralized app-layer scoping** via `lib/tenant.ts` (`authorizeElection`/`ownerScope`) applied at every route + server component | Strongest option that doesn't hinder dev. A query-interceptor Prisma extension was **deferred** (it fights legitimate `electionId`-scoped child queries → breakage risk). Postgres RLS also deferred (Prisma+Neon pooling needs per-request session vars → friction) |
| Existing data | **Seed superadmin, backfill all elections to it**; SUPERADMIN role can see all tenants | Keeps dev/support access; preserves data |
| Migration | 3-step: add nullable `ownerId`+`User` → seed+backfill → make non-null, drop `admin_sessions` | Safe forward-only on live data |

**Deferred / Phase-2 hardening:** (1) Postgres RLS policies layered over app-layer scoping; (2) Prisma client extension that hard-fails un-scoped tenant queries.

---

## 3. Phased roadmap

### Phase 1 — Foundation (DONE ✓)
1A. Schema: `User` + `Role` + `Election.ownerId` + all missing FK indexes.
1B. Auth: `lib/authOptions.ts`, `app/api/auth/[...nextauth]/route.ts`, signup route + page, login page rework, `lib/auth.ts` → `getServerSession`/`requireUser`.
1C. Tenancy: `lib/tenant.ts` (`requireUser`, `assertElectionOwner`→404, `ownerScope`), apply to every `/api/elections/*` route + server components; Prisma extension; audit `public/route.ts` field exposure.
1D. Cutover: remove `AdminSession`, `/api/admin/*`, `ADMIN_SECRET`; update `.env`/`SETUP.md`/`README.md`.

### Phase 2 — Creation flow + templates (DONE ✓)
- `lib/templates.ts` → **registry**: `TEMPLATES`, `getTemplate(id)`, type `ElectionTemplateDef`. **8 templates**: `school-fixed` (submits `template:SCHOOL`, preserved), `school-custom`, `university-council`, `club`, `corporate-board`, `community-association`, `society`, `event-committee`. Each fully editable after load.
- Entry choice `app/admin/(console)/elections/new/page.tsx` → **Create Your Own** vs **Load a Template**.
- Custom builder `app/admin/(console)/elections/new/custom/page.tsx` — 6 steps (Details → Voter fields → **Identifiers** → Positions → Candidate fields → Review). Prefills from `?template=<id>`; `fixed` templates collapse to Details+Review.
- **Identifier workflow:** fields created first, then pick **Primary** (required, unique) + **Secondary** (optional; required for TWO_FIELDS). Per-step validation blocks progress until valid.
- **Uniqueness enforced** server-side in `app/api/elections/[id]/voters/route.ts`: CSV import + single-add reject blank (400) and duplicate (409) primary-identifier values, within-file and vs DB.
- New `Election.candidateFields` JSON column (migration `add_candidate_fields`); create route persists template/builder candidate fields.
- Premium gallery `app/admin/(console)/elections/templates/page.tsx`.
- (Deferred) Postgres RLS hardening; wiring candidateFields into the candidate-add form in ElectionConsole.

### Phase 3 — Navigation + UI/UX (DONE ✓)
- Nav `components/admin/ConsoleNav.tsx`: **Home** (brand → /admin control panel), **Create Election**, **Vote (always visible, accented)**, **Sign Out**; responsive mobile drawer. (Home/Dashboard both = `/admin`.)
- `components/ui/InteractiveHeading.tsx` — cursor-tracking gradient + lift; used on new/templates headings.
- `components/ui/InteractiveBackground.tsx` — **cursor-reactive parallax** blobs, rAF parks when idle (no constant loop). Wired via `AdminBackground.tsx`, replacing the three.js `Atmosphere.tsx` (kept, unused). Glass identity preserved.

**P2/P3 verification (curl + preview):** pages render; template create → **201** with `candidateFields` persisted; dup identifier **409** / blank **400**; premium gallery + responsive nav + always-on Vote confirmed by screenshot; zero console errors.
⚠️ **After any `prisma generate`/migration, RESTART the dev server** — HMR reloads app code but not `node_modules/@prisma/client`, → 500 on writes hitting new columns.

### Phase 4 — Performance + QA (NOT STARTED)
- Indexes (front-loaded P1), N+1 fixes in results/turnout, route code-splitting, lazy-load three/gsap, request dedupe, optimistic UI, bundle trim. QA sweep: bugs/UX/security/scalability/tech-debt.

---

## 4. Key file / utility index

**Auth & tenancy**
| Path | Role |
|---|---|
| `lib/prisma.ts` | Prisma singleton — **`PrismaNeon` (Neon WS adapter)**. Don't swap to raw pg/direct endpoint (ETIMEDOUT on autosuspend). |
| `lib/auth.ts` | `getCurrentUser()` / `requireUser()` over `getServerSession`. |
| `lib/authOptions.ts` | next-auth `NextAuthOptions`, Credentials provider, JWT strategy. |
| `lib/tenant.ts` | Tenancy choke point: `requireUser`, `authorizeElection`→404, `canAccessElection`, `ownerScope`. |
| `types/next-auth.d.ts` | Session/JWT augmented with `id` + `role`. |
| `app/api/auth/[...nextauth]/route.ts` · `app/api/auth/signup/route.ts` | next-auth handler · signup. |
| `app/admin/(auth)/login|signup/page.tsx` | Auth UI. |
| `app/admin/(console)/layout.tsx` | Protected layout — `getCurrentUser` redirect. |
| `app/api/elections/route.ts` · `[id]/**` | List/create scoped+stamped; sub-routes call `authorizeElection`. |
| `app/api/vote/*` · `[id]/public/route.ts` | Public, unauthenticated, minimal fields. |

**Creation flow & templates (P2)**
| Path | Role |
|---|---|
| `lib/templates.ts` | `TEMPLATES` registry + `getTemplate(id)` + school defaults (`buildSchoolPositions`, `SCHOOL_*`). |
| `app/admin/(console)/elections/new/page.tsx` | Entry choice (Create Your Own / Load Template). |
| `app/admin/(console)/elections/new/custom/page.tsx` | 6-step custom builder (identifiers, candidate fields, eligibility). |
| `app/admin/(console)/elections/templates/page.tsx` | Premium gallery. |
| `app/api/elections/[id]/voters/route.ts` | Voter import/add + **primary-identifier uniqueness**. |
| `lib/csv.ts` · `lib/tokens.ts` | Spreadsheet parse · bcrypt token gen/verify. |

**UI / motion (P3)**
| Path | Role |
|---|---|
| `components/admin/ConsoleNav.tsx` | Responsive nav, always-visible Vote. |
| `components/ui/InteractiveHeading.tsx` | Cursor-reactive heading. |
| `components/ui/InteractiveBackground.tsx` | Cursor parallax background (via `AdminBackground.tsx`). |
| `components/ui/Atmosphere.tsx` | Old three.js shader bg — **unused** now. |
| `app/globals.css` | Design tokens (black/white/blue glass). |

---

## 5. Progress checklist

### Phase 1
- [x] Deliverable 0: `implementation.md` created
- [x] 1A schema: `User`, `Role`, `Election.ownerId`, indexes
- [x] DB reset (user-consented) → clean migration history; `add_users_owner_indexes` migration applied
- [x] Seed superadmin (`prisma/seed.ts`, run via `node prisma/seed.ts`) — username `Mukilan`
- [x] `drop_admin_sessions` migration applied (AdminSession removed; ownerId is NOT NULL)
- [x] 1B `lib/authOptions.ts` + `app/api/auth/[...nextauth]/route.ts` + `types/next-auth.d.ts`
- [x] 1B signup route (`app/api/auth/signup`) + signup page
- [x] 1B login page rework (signIn credentials) + ConsoleNav signOut
- [x] 1B `lib/auth.ts` → `getCurrentUser`/`requireUser`
- [x] 1C `lib/tenant.ts` helpers (`authorizeElection`, `ownerScope`, `canAccessElection`)
- [x] 1C apply scoping to ALL election routes + dashboard + detail page + console layout
- [~] 1C Prisma tenant extension — **deferred** to Phase-2 hardening (breakage risk; helpers enforce isolation)
- [x] 1C `public/route.ts` audited — already minimal, no owner leak
- [x] 1D remove AdminSession / `/api/admin/*` / `ADMIN_SECRET`
- [x] 1D `.env` updated (strong NEXTAUTH_SECRET, SUPERADMIN_*; ADMIN_SECRET removed)
- [x] 1D SETUP.md updated (README is generic CNA boilerplate — left as-is)
- [x] **tsc clean** + **live verification PASSED** (see below)

**Verification results (live, via preview):**
- Signup validates (201 valid / 400 invalid username|password) ✓
- Login via next-auth credentials → JWT session ✓; session token **not** readable from `document.cookie` (**httpOnly**) ✓
- Isolation: User B on User A's election → `GET` **404**, `PATCH` **404**, `DELETE` **404**, `results` **404**; B's list **empty** ✓
- Owner GET own election → **200** ✓
- Superadmin → **200** on another tenant + sees **all** elections ✓
- Public voter endpoint → **200** unauthenticated, exposes only id/title/status/authMode/authFields/allowAbstain (**no ownerId leak**) ✓

**Infra note:** switched runtime DB driver back to `PrismaNeon` (Neon-native WS→pooler) — a raw `pg` Pool to Neon's *direct* endpoint hit `ETIMEDOUT` on autosuspend resume under `next dev`. Turbopack dev cache (`.next`) corrupted once during repeated restarts → fixed with `rm -rf .next`. Neon free-tier autosuspend makes the *first* request after idle slow (cold start); not a code issue.
**Test artifacts:** several throwaway users/elections (`ua_*`, `ub_*`, `owner_*`, `carol_*`, etc.) exist in the dev DB from verification — harmless; superadmin will see them. Clean up later if desired.

### Phase 2 — Creation flow + templates ✓
- [x] `lib/templates.ts` registry (8 templates) + `Election.candidateFields` column/migration
- [x] Entry choice page + 6-step custom builder (primary/secondary identifiers, candidate fields, eligibility)
- [x] Premium templates gallery
- [x] Primary-identifier uniqueness on import + single-add (409/400)
- [x] Verified: template create 201 + candidateFields persisted; dup 409 / blank 400

### Phase 3 — Navigation + UI/UX ✓
- [x] Responsive ConsoleNav (Home/Create/Vote-always/Sign Out)
- [x] InteractiveHeading + cursor-reactive InteractiveBackground (replaces Atmosphere loop)
- [x] Verified: gallery + nav screenshot, no console errors

### Phase 4 — Performance + QA — IN PROGRESS
Done this pass:
- [x] **Turnout series** `app/api/elections/[id]/turnout/route.ts` — replaced O(N·STEPS) per-step `stamps.filter` with a single moving-pointer sweep over the already-sorted stamps → O(N+STEPS).
- [x] **Turnout polling** `components/admin/TurnoutWidget.tsx` — in-flight guard + `AbortController` (abort on unmount) + pause when `document.hidden`, with an immediate refresh on `visibilitychange`. Stops needless 10s polling of a backgrounded tab.
- [x] **Code-split results** `ElectionConsole.tsx` — `ResultsChart`/`ResultsPodium` (both pull GSAP) now `next/dynamic` (`ssr:false`, loading skeleton), deferred out of the console bundle until the Results tab opens.
- [x] **Optimistic candidate delete** — removes the card from state immediately, rolls back + toasts on failure.
- [x] **candidateFields wired into add-candidate form** — modal renders an input per custom field (required-validated), sent as `meta_<fieldName>` (FormData) / `metadata` (JSON); `candidates/route.ts` persists them to `Candidate.metadata`.
- [x] **QA/security:** token CSV export (`downloadTokens`) now escapes `"`→`""` and neutralizes spreadsheet formula injection (`= + - @` leads). 
- [x] **Pre-existing breakage fixed:** Prisma client was stale (schema had `tokenLookup`, client didn't → tsc errors + 500s on voters/ballot/submit). Ran `prisma generate`; `tsc --noEmit` now clean. ⚠️ restart dev server after.
- School (Fixed) template **already** supports choosing Access code vs Two fields (Details step + `route.ts` resolves `SCHOOL_AUTH_FIELDS`); refined the preset note copy.
- Positions step (`06`): richer Votes/Winners explainer + worked example, plus accessible hover/focus `LabelTip` tooltips on the Votes & Winners inputs.

Still outstanding:
- N+1 in results route is already fine (`_count`); landing `three`/`gsap` only in unused `Atmosphere.tsx` (not bundled).
- Optional Postgres RLS + Prisma scoping extension (deferred since P1).
- ⚠️ Browser verification of this pass blocked by Neon autosuspend + Turbopack cold-start in this env (homepage compile 32s; /admin/login didn't respond in 90s). Verified statically: `tsc` clean, `prisma generate` ok, `/` → 200. Re-verify interactively once the server is warm.

---

### Phase 5 — Production-readiness audit (DONE ✓)
**Schema:** `@@unique([electionId, tokenLookup])` on Voter (no dup access codes; replaces the plain index). Password-reset storage was later removed via `20260606123000_remove_password_reset_and_rate_limit_env`.
**Auth:** username/password login via NextAuth JWT sessions. Rate limiting and self-service password reset have been removed.
**Password recovery:** removed entirely: no Resend mailer, reset-token table, forgot/reset API routes, forgot/reset pages, or login reset link.
**Access-code regeneration (NEW — didn't exist):** `lib/voterTokens.ts` + single & bulk routes + VoterList UI (per-row + "Regenerate all", CSV download). Old code invalidated, no dup voter rows, hasVoted preserved.
**Reliability:** atomic one-vote claim in `vote/submit` (fixes double-vote race); JSON-parse guards + input validation on all mutating routes.
**Deploy:** `build`=`prisma generate && next build` + `postinstall` (fixes stale-client 500s); security headers in `next.config.ts`; `runtime="nodejs"` + `maxDuration=60` on bcrypt routes; `.env.example`; `DEPLOYMENT.md` (rollback/backup/migration safety).
**Bug fixes (untouched files):** hydration bugs (`Math.random`/ref-in-render) in `vote/[id]` ballot + `ResultsPodium` confetti made deterministic; `/admin/login` `useSearchParams` prerender failure fixed (read from `window` in handler).
**Verified:** `tsc` clean · `next build` exit 0 · data-layer assertions pass for regeneration old/new code, no dup voters, multi-regen, atomic concurrent vote, hasVoted preserved, dup-code constraint, tenant isolation.
**Remaining:** no known lint/build blocker.

## 6. Verification playbook (Phase 1)
1. `prisma migrate dev` (env via prisma.config.ts) + seed → confirm superadmin + backfilled ownerId.
2. Dev server via **preview tools** (not raw Bash). Sign up User A & B; each creates an election.
3. **Isolation proof:** as A, GET/PATCH/DELETE B's election id and every `/api/elections/[id]/*` subroute → expect **404**. Dashboards show only own. Superadmin sees all.
4. Voter `/vote/[id]` + `/api/vote/submit` still work unauthenticated end-to-end.
5. `preview_network`: auth cookies `httpOnly`+`secure`(prod), CSRF token on auth routes.
