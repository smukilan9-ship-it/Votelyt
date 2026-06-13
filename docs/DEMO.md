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
| Position | Favorite Programming Language |

Description:

```text
Public demonstration election for testing the Votelyt voting experience.
```

## Demo Architecture

The demo is created by [`scripts/demo.mjs`](../scripts/demo.mjs). It writes normal Votelyt database records:

- `User` owner: `votelyt-demo-owner`
- `Election`: `DEMO26`
- one `Position`
- four `Candidate` rows
- 100 `Voter` rows
- no special voting routes
- no special authentication branch

The demo election is isolated by deterministic IDs and a dedicated owner. Reset scripts target only `DEMO26` and associated demo rows.

## Candidate Seeding

The demo creates one position:

```text
Favorite Programming Language
```

Candidates:

| Candidate | Tagline | Portrait source |
|---|---|---|
| Python | Readable, versatile, everywhere. | `https://randomuser.me/api/portraits/women/44.jpg` |
| JavaScript | The language of the web. | `https://randomuser.me/api/portraits/men/32.jpg` |
| Rust | Performance without compromise. | `https://randomuser.me/api/portraits/men/75.jpg` |
| Go | Simple. Fast. Scalable. | `https://randomuser.me/api/portraits/women/68.jpg` |

The script fetches each image and stores it as a `data:` URL in `Candidate.photoUrl`, the same storage shape used by normal candidate image uploads. If a remote image fetch fails, the script stores a generated SVG fallback so every candidate still has an image.

Candidate taglines are stored in `Candidate.metadata.tagline`. The voter UI currently renders `Candidate.description`, so the seeded public card description includes the tagline followed by the description.

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
3. Select a candidate and submit.
4. Confirm one vote row is recorded for `DEMO26`.
5. Confirm `DEMO01` cannot vote again.
6. Confirm `DEMO02` can still authenticate.
7. Confirm all candidate cards render portrait images.

## Operational Notes

- The demo election is intentionally `ACTIVE` after seeding.
- Because the election is active, normal admin/API setup mutation routes are frozen.
- The seed script writes directly to the database so it can create the election, candidates, voters, and active status in one setup operation.
- The public demo should be reset periodically if many visitors use the shared demo codes.
