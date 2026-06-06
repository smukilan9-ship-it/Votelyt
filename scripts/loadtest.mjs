// Sandboxed concurrency test: can 40 voters vote at the exact same time?
// Creates an isolated throwaway election + owner, fires 40 concurrent POSTs to
// the real /api/vote/submit endpoint, verifies integrity, then deletes
// everything it created (cascade). Safe to run against the shared dev DB.
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import { createHash, randomUUID } from "crypto";
import { customAlphabet } from "nanoid";

const N = Number(process.argv[2] ?? 40);
const BASE = process.env.LOADTEST_BASE ?? "http://localhost:3000";
const nano = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
const fp = (t) => createHash("sha256").update(t.toUpperCase()).digest("hex");

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

const tag = `LOADTEST-${randomUUID().slice(0, 8)}`;
let electionId, ownerId;

async function setup() {
  const owner = await prisma.user.create({
    data: { username: `${tag}-owner`, passwordHash: "x", role: "USER" },
  });
  ownerId = owner.id;

  const election = await prisma.election.create({
    data: {
      title: `${tag} Election`,
      status: "ACTIVE",
      authMode: "ACCESS_CODE",
      authFields: [],
      allowAbstain: true,
      ownerId,
    },
  });
  electionId = election.id;

  const position = await prisma.position.create({
    data: { electionId, title: "President", maxWinners: 1, maxVotes: 1, sortOrder: 0 },
  });
  const candidates = await Promise.all(
    ["Ada", "Grace", "Linus"].map((name) =>
      prisma.candidate.create({ data: { electionId, positionId: position.id, name, metadata: {} } })
    )
  );

  // 40 voters, each with a unique plaintext access code we keep for the test.
  const voters = [];
  for (let i = 0; i < N; i++) {
    const code = nano();
    const hash = await bcrypt.hash(code, 10);
    await prisma.voter.create({
      data: { electionId, metadata: {}, tokenHash: hash, tokenLookup: fp(code), hasVoted: false },
    });
    voters.push({ code, candidateId: candidates[i % candidates.length].id, positionId: position.id });
  }
  return voters;
}

async function castVote(v) {
  const t0 = performance.now();
  try {
    const res = await fetch(`${BASE}/api/vote/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        electionId,
        credentials: { access_code: v.code },
        selections: [{ positionId: v.positionId, candidateIds: [v.candidateId] }],
      }),
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, ok: res.ok, body, ms: performance.now() - t0 };
  } catch (e) {
    return { status: 0, ok: false, body: { error: String(e) }, ms: performance.now() - t0 };
  }
}

function summarize(label, results) {
  const ok = results.filter((r) => r.ok).length;
  const codes = {};
  for (const r of results) codes[r.status] = (codes[r.status] ?? 0) + 1;
  const times = results.map((r) => r.ms).sort((a, b) => a - b);
  const p = (q) => times[Math.min(times.length - 1, Math.floor(q * times.length))].toFixed(0);
  console.log(`\n${label}: ${ok}/${results.length} succeeded`);
  console.log(`  status codes: ${JSON.stringify(codes)}`);
  console.log(`  latency ms — min ${times[0].toFixed(0)} / p50 ${p(0.5)} / p95 ${p(0.95)} / max ${times.at(-1).toFixed(0)}`);
  const errs = [...new Set(results.filter((r) => !r.ok).map((r) => r.body?.error))].filter(Boolean);
  if (errs.length) console.log(`  errors: ${JSON.stringify(errs)}`);
  return ok;
}

async function cleanup() {
  if (electionId) await prisma.election.delete({ where: { id: electionId } }).catch(() => {});
  if (ownerId) await prisma.user.delete({ where: { id: ownerId } }).catch(() => {});
}

(async () => {
  let failed = false;
  try {
    console.log(`Setting up sandbox election "${tag}" with ${N} voters @ ${BASE} ...`);
    const voters = await setup();

    console.log(`\nFiring ${N} vote submissions SIMULTANEOUSLY...`);
    const wallStart = performance.now();
    const wave1 = await Promise.all(voters.map(castVote));
    const wallMs = performance.now() - wallStart;
    const ok1 = summarize("Wave 1 (concurrent)", wave1);
    console.log(`  wall-clock for all ${N}: ${wallMs.toFixed(0)} ms`);

    // Integrity checks
    const voteCount = await prisma.vote.count({ where: { electionId } });
    const votedCount = await prisma.voter.count({ where: { electionId, hasVoted: true } });
    console.log(`\nIntegrity:`);
    console.log(`  votes recorded: ${voteCount} (expected ${N})`);
    console.log(`  voters marked hasVoted: ${votedCount} (expected ${N})`);

    // Double-vote guard: replay every code; all must be rejected (409).
    console.log(`\nReplaying all ${N} codes to test double-vote guard...`);
    const wave2 = await Promise.all(voters.map(castVote));
    const ok2 = summarize("Wave 2 (replay — all should fail 409)", wave2);
    const voteCountAfter = await prisma.vote.count({ where: { electionId } });

    const pass =
      ok1 === N && voteCount === N && votedCount === N && ok2 === 0 && voteCountAfter === N;
    console.log(`\n${pass ? "✅ PASS" : "❌ FAIL"} — concurrency + integrity`);
    if (!pass) failed = true;
  } catch (e) {
    console.error("Test crashed:", e);
    failed = true;
  } finally {
    console.log(`\nCleaning up sandbox...`);
    await cleanup();
    await prisma.$disconnect();
    console.log("Done. Sandbox removed.");
    process.exit(failed ? 1 : 0);
  }
})();
