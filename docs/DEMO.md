# Votelyt Public Demo

This document describes the dedicated public demo election used for portfolio, Reddit, Dev.to, Hacker News, and quick-review traffic.

The demo is data-only. It does not change authentication logic, voting logic, audit logging, election-integrity safeguards, status transition rules, or active-election freeze protections.

## Demo Summary

| Item | Value |
|---|---|
| Election name | `Votelyt Demo Election` |
| Election ID | `DEMO26` |
| Demo URL | `/vote/DEMO26` |
| Status | `ACTIVE` internally, presented as Open in the UI |
| Authentication mode | `ACCESS_CODE` |
| Voter codes | `DEMO01` through `DEMO100` |
| Positions | 5 technology categories |
| Candidates | 20 logo-based candidates |

Description:

```text
A public demo election showcasing the Votelyt voting experience.
```

## Demo Architecture

The demo is created by [`scripts/demo.mjs`](../scripts/demo.mjs). It writes normal Votelyt database records:

- `User` owner: `votelyt-demo-owner`
- `Election`: `DEMO26`
- five `Position` rows
- twenty `Candidate` rows
- 100 `Voter` rows
- no special voting routes
- no special authentication branch

The demo election is isolated by deterministic IDs and a dedicated owner. Reset scripts target only `DEMO26` and associated demo rows.

## Candidate Seeding

The demo creates five positions:

| Position | Candidates |
|---|---|
| Best Programming Language | Python, JavaScript, Rust, Go |
| Best AI Model | ChatGPT, Claude, Gemini, Grok |
| Best Hosting Platform | Vercel, Netlify, Railway, Render |
| Best Database | PostgreSQL, MySQL, MongoDB, SQLite |
| Best Developer Tool | VS Code, Cursor, Windsurf, Zed |

Candidate image sources:

| Candidate | Logo source |
|---|---|
| Python | `https://cdn.simpleicons.org/python` |
| JavaScript | `https://cdn.simpleicons.org/javascript` |
| Rust | `https://cdn.simpleicons.org/rust` |
| Go | `https://cdn.simpleicons.org/go` |
| ChatGPT | `https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg` |
| Claude | `https://cdn.simpleicons.org/anthropic` |
| Gemini | `https://cdn.simpleicons.org/googlegemini` |
| Grok | `https://commons.wikimedia.org/wiki/Special:Redirect/file/Grok-icon.svg` |
| Vercel | `https://cdn.simpleicons.org/vercel` |
| Netlify | `https://cdn.simpleicons.org/netlify` |
| Railway | `https://cdn.simpleicons.org/railway` |
| Render | `https://cdn.simpleicons.org/render` |
| PostgreSQL | `https://cdn.simpleicons.org/postgresql` |
| MySQL | `https://cdn.simpleicons.org/mysql` |
| MongoDB | `https://cdn.simpleicons.org/mongodb` |
| SQLite | `https://cdn.simpleicons.org/sqlite` |
| VS Code | `https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vscode/vscode-original.svg` |
| Cursor | `https://cdn.simpleicons.org/cursor` |
| Windsurf | `https://cdn.simpleicons.org/windsurf` |
| Zed | `https://cdn.simpleicons.org/zedindustries` |

The script fetches each logo and stores a composed SVG logo card as a `data:` URL in `Candidate.photoUrl`, the same database field used by normal candidate image uploads. The generated card gives every logo a consistent background, white logo panel, and candidate label so cards render cleanly in the existing voter UI.

If a remote logo fetch fails, the script stores a generated SVG fallback so every candidate still has an image. Candidate taglines are stored in `Candidate.metadata.tagline`. The voter UI currently renders `Candidate.description`, so the seeded public card description includes the tagline followed by the description.

## Demo Voter Generation

The script creates 100 voters:

```text
DEMO01
DEMO02
DEMO03
...
DEMO100
```

For each voter:

- `metadata.name` is set to a demo voter label.
- `metadata.demoCode` stores the visible demo code for admin/debug visibility.
- `tokenHash` stores a bcrypt hash of the demo code.
- `tokenLookup` stores the SHA-256 fingerprint used by access-code lookup.
- `hasVoted` starts as `false`.

Each code can vote exactly once because the normal vote submission transaction atomically flips `hasVoted` from `false` to `true`.

## Commands

Recreate the full demo election:

```bash
npm run demo:recreate
```

Reset only demo vote rows:

```bash
npm run demo:reset-votes
```

Reset demo voters to not voted:

```bash
npm run demo:reset-voters
```

Reapply access-code hashes for `DEMO01` through `DEMO100`:

```bash
npm run demo:regenerate-codes
```

Show current demo metadata:

```bash
npm run demo:info
```

## Reset Workflow

For a completely clean public demo:

```bash
npm run demo:recreate
```

For a lightweight reset that preserves candidates and voter rows:

```bash
npm run demo:reset-votes
npm run demo:reset-voters
npm run demo:regenerate-codes
```

The scripts are safe to rerun after database resets. If `DEMO26` is missing, reset commands recreate the demo election first.

## Verification Checklist

After seeding:

1. Open `/vote/DEMO26`.
2. Enter `DEMO01`.
3. Select one candidate in each category and submit.
4. Confirm five vote rows are recorded for `DEMO26`.
5. Confirm `DEMO01` cannot vote again.
6. Confirm `DEMO02` can still authenticate.
7. Confirm all candidate cards render logo images.

## Operational Notes

- The demo election is intentionally `ACTIVE` after seeding.
- Because the election is active, normal admin/API setup mutation routes are frozen.
- The seed script writes directly to the database so it can create the election, candidates, voters, and active status in one setup operation.
- The public demo should be reset periodically if many visitors use the shared demo codes.
