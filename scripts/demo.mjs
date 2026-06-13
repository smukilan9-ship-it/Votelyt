import "dotenv/config";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const DEMO_ELECTION_ID = process.env.DEMO_ELECTION_ID ?? "DEMO26";
const DEMO_OWNER_ID = "votelyt-demo-owner";
const DEMO_OWNER_USERNAME = "votelyt-demo-owner";
const DEMO_TITLE = "Votelyt Demo Election";
const DEMO_DESCRIPTION = "Public demonstration election for testing the Votelyt voting experience.";

const CANDIDATES = [
  {
    slug: "python",
    name: "Python",
    tagline: "Readable, versatile, everywhere.",
    description:
      "The language powering AI, automation, data science, and millions of applications worldwide.",
    imageSource: "https://randomuser.me/api/portraits/women/44.jpg",
  },
  {
    slug: "javascript",
    name: "JavaScript",
    tagline: "The language of the web.",
    description: "Runs modern websites, applications, and full-stack platforms.",
    imageSource: "https://randomuser.me/api/portraits/men/32.jpg",
  },
  {
    slug: "rust",
    name: "Rust",
    tagline: "Performance without compromise.",
    description: "Memory-safe systems programming focused on reliability and speed.",
    imageSource: "https://randomuser.me/api/portraits/men/75.jpg",
  },
  {
    slug: "go",
    name: "Go",
    tagline: "Simple. Fast. Scalable.",
    description: "Designed for cloud infrastructure, backend systems, and modern services.",
    imageSource: "https://randomuser.me/api/portraits/women/68.jpg",
  },
];

function tokenLookup(token) {
  return createHash("sha256").update(token.toUpperCase()).digest("hex");
}

function demoCode(index) {
  return `DEMO${String(index).padStart(2, "0")}`;
}

function demoCodes() {
  return Array.from({ length: 100 }, (_, index) => demoCode(index + 1));
}

function fallbackPortrait(name) {
  const initials = name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop stop-color="#1b2838"/><stop offset="1" stop-color="#4a9eff"/></linearGradient></defs><rect width="900" height="1200" fill="url(#g)"/><circle cx="450" cy="410" r="190" fill="rgba(255,255,255,.22)"/><rect x="230" y="680" width="440" height="310" rx="120" fill="rgba(255,255,255,.18)"/><text x="450" y="455" text-anchor="middle" font-family="Arial, sans-serif" font-size="128" font-weight="700" fill="white">${initials}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

async function fetchPortraitDataUrl(candidate) {
  try {
    const response = await fetch(candidate.imageSource);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const contentType = response.headers.get("content-type") ?? "image/jpeg";
    const buffer = Buffer.from(await response.arrayBuffer());
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  } catch (error) {
    console.warn(`Could not fetch ${candidate.imageSource}; using generated fallback for ${candidate.name}.`);
    console.warn(error instanceof Error ? error.message : String(error));
    return fallbackPortrait(candidate.name);
  }
}

function createPrisma() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required to seed the demo election.");
  }
  const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

async function ensureDemoOwner(prisma) {
  const passwordHash = await bcrypt.hash(`disabled:${DEMO_OWNER_ID}`, 12);
  return prisma.user.upsert({
    where: { id: DEMO_OWNER_ID },
    create: {
      id: DEMO_OWNER_ID,
      username: DEMO_OWNER_USERNAME,
      passwordHash,
      role: "USER",
    },
    update: {
      username: DEMO_OWNER_USERNAME,
      passwordHash,
      role: "USER",
    },
  });
}

async function deleteDemoElection(prisma) {
  await prisma.auditLog.deleteMany({ where: { electionId: DEMO_ELECTION_ID } });
  await prisma.vote.deleteMany({ where: { electionId: DEMO_ELECTION_ID } });
  await prisma.election.deleteMany({ where: { id: DEMO_ELECTION_ID } });
}

async function buildVoters() {
  const voters = [];
  for (let index = 1; index <= 100; index++) {
    const code = demoCode(index);
    voters.push({
      id: `demo-voter-${String(index).padStart(3, "0")}`,
      metadata: {
        name: `Demo Voter ${String(index).padStart(3, "0")}`,
        demoCode: code,
        demo: "true",
      },
      tokenHash: await bcrypt.hash(code, 10),
      tokenLookup: tokenLookup(code),
    });
  }
  return voters;
}

async function createDemoElection(prisma) {
  await ensureDemoOwner(prisma);

  const [portraits, voters] = await Promise.all([
    Promise.all(CANDIDATES.map(fetchPortraitDataUrl)),
    buildVoters(),
  ]);

  await prisma.$transaction(async (tx) => {
    const now = new Date();
    await tx.election.create({
      data: {
        id: DEMO_ELECTION_ID,
        title: DEMO_TITLE,
        description: DEMO_DESCRIPTION,
        template: "GENERIC",
        status: "ACTIVE",
        authMode: "ACCESS_CODE",
        authFields: [],
        candidateFields: [{ fieldName: "tagline", fieldLabel: "Tagline", isRequired: true }],
        allowAbstain: false,
        activatedAt: now,
        ownerId: DEMO_OWNER_ID,
      },
    });

    const position = await tx.position.create({
      data: {
        id: "demo-position-favorite-language",
        electionId: DEMO_ELECTION_ID,
        title: "Favorite Programming Language",
        description: "Pick the language you would most enjoy seeing win this public Votelyt demo.",
        maxWinners: 1,
        maxVotes: 1,
        restrictions: {},
        sortOrder: 0,
      },
    });

    for (const [index, candidate] of CANDIDATES.entries()) {
      await tx.candidate.create({
        data: {
          id: `demo-candidate-${candidate.slug}`,
          electionId: DEMO_ELECTION_ID,
          positionId: position.id,
          name: candidate.name,
          description: `${candidate.tagline} ${candidate.description}`,
          photoUrl: portraits[index],
          metadata: {
            tagline: candidate.tagline,
            source: candidate.imageSource,
            demo: true,
          },
        },
      });
    }

    await tx.voter.createMany({
      data: voters.map((voter) => ({
        id: voter.id,
        electionId: DEMO_ELECTION_ID,
        metadata: voter.metadata,
        tokenHash: voter.tokenHash,
        tokenLookup: voter.tokenLookup,
        hasVoted: false,
      })),
    });
  }, { timeout: 30000 });
}

async function ensureDemoElection(prisma) {
  const existing = await prisma.election.findUnique({
    where: { id: DEMO_ELECTION_ID },
    select: { id: true },
  });
  if (!existing) {
    await createDemoElection(prisma);
  }
}

async function recreate(prisma) {
  await deleteDemoElection(prisma);
  await createDemoElection(prisma);
  console.log(`Recreated demo election ${DEMO_ELECTION_ID}.`);
}

async function resetVotes(prisma) {
  await ensureDemoElection(prisma);
  const deleted = await prisma.vote.deleteMany({ where: { electionId: DEMO_ELECTION_ID } });
  console.log(`Deleted ${deleted.count} demo vote row(s).`);
}

async function resetVoters(prisma) {
  await ensureDemoElection(prisma);
  const updated = await prisma.voter.updateMany({
    where: { electionId: DEMO_ELECTION_ID },
    data: { hasVoted: false, votedAt: null },
  });
  console.log(`Reset ${updated.count} demo voter(s) to not voted.`);
}

async function regenerateCodes(prisma) {
  await ensureDemoElection(prisma);
  const voters = await prisma.voter.findMany({
    where: { electionId: DEMO_ELECTION_ID },
    orderBy: { id: "asc" },
    select: { id: true },
  });

  if (voters.length !== 100) {
    throw new Error(`Expected 100 demo voters, found ${voters.length}. Run npm run demo:recreate.`);
  }

  for (let index = 1; index <= 100; index++) {
    const code = demoCode(index);
    await prisma.voter.update({
      where: { id: `demo-voter-${String(index).padStart(3, "0")}` },
      data: {
        tokenHash: await bcrypt.hash(code, 10),
        tokenLookup: tokenLookup(code),
      },
    });
  }
  console.log("Regenerated demo access-code hashes for DEMO01 through DEMO100.");
}

async function info(prisma) {
  await ensureDemoElection(prisma);
  const [election, voters, votes] = await Promise.all([
    prisma.election.findUnique({
      where: { id: DEMO_ELECTION_ID },
      include: {
        positions: { include: { candidates: true } },
      },
    }),
    prisma.voter.count({ where: { electionId: DEMO_ELECTION_ID } }),
    prisma.vote.count({ where: { electionId: DEMO_ELECTION_ID } }),
  ]);

  console.log(JSON.stringify({
    id: DEMO_ELECTION_ID,
    url: `/vote/${DEMO_ELECTION_ID}`,
    title: election?.title,
    status: election?.status,
    voters,
    votes,
    codes: `${demoCodes()[0]} ... ${demoCodes().at(-1)}`,
    candidates: election?.positions[0]?.candidates.map((candidate) => ({
      name: candidate.name,
      hasPhoto: Boolean(candidate.photoUrl),
    })),
  }, null, 2));
}

async function main() {
  const command = process.argv[2] ?? "recreate";
  const prisma = createPrisma();
  try {
    if (command === "recreate" || command === "seed") await recreate(prisma);
    else if (command === "reset-votes") await resetVotes(prisma);
    else if (command === "reset-voters") await resetVoters(prisma);
    else if (command === "regenerate-codes") await regenerateCodes(prisma);
    else if (command === "info") await info(prisma);
    else {
      throw new Error(`Unknown command "${command}". Use recreate, reset-votes, reset-voters, regenerate-codes, or info.`);
    }

    console.log(`Demo Election ID: ${DEMO_ELECTION_ID}`);
    console.log(`Demo URL: /vote/${DEMO_ELECTION_ID}`);
    console.log(`Example codes: DEMO01, DEMO02, DEMO100`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
