import "dotenv/config";
import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

const DEMO_ELECTION_ID = process.env.DEMO_ELECTION_ID ?? "DEMO26";
const DEMO_OWNER_ID = "votelyt-demo-owner";
const DEMO_OWNER_USERNAME = "votelyt-demo-owner";
const DEMO_TITLE = "Votelyt Demo Election";
const DEMO_DESCRIPTION = "A public demo election showcasing the Votelyt voting experience.";
const DEMO_VOTER_COUNT = 100;

const POSITIONS = [
  {
    slug: "programming-language",
    title: "Best Programming Language",
    description: "Choose the language you would most want in your next project.",
    candidates: [
      {
        slug: "python",
        name: "Python",
        tagline: "Readable, versatile, everywhere.",
        description: "A general-purpose language used across automation, AI, data, and web services.",
        logoSource: "https://cdn.simpleicons.org/python",
        accent: "#3776AB",
      },
      {
        slug: "javascript",
        name: "JavaScript",
        tagline: "The language of the web.",
        description: "The runtime language powering interactive websites and full-stack platforms.",
        logoSource: "https://cdn.simpleicons.org/javascript",
        accent: "#F7DF1E",
      },
      {
        slug: "rust",
        name: "Rust",
        tagline: "Performance without compromise.",
        description: "Systems programming focused on speed, reliability, and memory safety.",
        logoSource: "https://cdn.simpleicons.org/rust",
        accent: "#CE422B",
      },
      {
        slug: "go",
        name: "Go",
        tagline: "Simple. Fast. Scalable.",
        description: "A practical language for cloud infrastructure, backend services, and tooling.",
        logoSource: "https://cdn.simpleicons.org/go",
        accent: "#00ADD8",
      },
    ],
  },
  {
    slug: "ai-model",
    title: "Best AI Model",
    description: "Vote for the AI assistant or model family you would most want on your team.",
    candidates: [
      {
        slug: "chatgpt",
        name: "ChatGPT",
        tagline: "Conversational AI for everyday work.",
        description: "OpenAI's assistant experience for writing, coding, research, and creative tasks.",
        logoSource: "https://upload.wikimedia.org/wikipedia/commons/0/04/ChatGPT_logo.svg",
        accent: "#10A37F",
      },
      {
        slug: "claude",
        name: "Claude",
        tagline: "Thoughtful, careful, capable.",
        description: "Anthropic's assistant family for analysis, writing, coding, and long-context work.",
        logoSource: "https://cdn.simpleicons.org/anthropic",
        accent: "#D97757",
      },
      {
        slug: "gemini",
        name: "Gemini",
        tagline: "Google's multimodal model family.",
        description: "A model ecosystem for search, reasoning, multimodal input, and productivity workflows.",
        logoSource: "https://cdn.simpleicons.org/googlegemini",
        accent: "#8E75B2",
      },
      {
        slug: "grok",
        name: "Grok",
        tagline: "Real-time AI from xAI.",
        description: "An xAI assistant known for live context, current events, and a more irreverent tone.",
        logoSource: "https://commons.wikimedia.org/wiki/Special:Redirect/file/Grok-icon.svg",
        accent: "#FFFFFF",
      },
    ],
  },
  {
    slug: "hosting-platform",
    title: "Best Hosting Platform",
    description: "Pick the deployment platform you would trust for a polished product launch.",
    candidates: [
      {
        slug: "vercel",
        name: "Vercel",
        tagline: "Frontend cloud for modern apps.",
        description: "A deployment platform focused on Next.js, edge delivery, previews, and developer workflow.",
        logoSource: "https://cdn.simpleicons.org/vercel",
        accent: "#FFFFFF",
      },
      {
        slug: "netlify",
        name: "Netlify",
        tagline: "Composable web deployments.",
        description: "A platform for frontend hosting, serverless functions, deploy previews, and web workflows.",
        logoSource: "https://cdn.simpleicons.org/netlify",
        accent: "#00C7B7",
      },
      {
        slug: "railway",
        name: "Railway",
        tagline: "Infrastructure from your repository.",
        description: "A hosting platform for deploying services, databases, and application backends quickly.",
        logoSource: "https://cdn.simpleicons.org/railway",
        accent: "#8B5CF6",
      },
      {
        slug: "render",
        name: "Render",
        tagline: "Cloud apps without server chores.",
        description: "A hosting platform for web services, static sites, workers, and managed databases.",
        logoSource: "https://cdn.simpleicons.org/render",
        accent: "#46E3B7",
      },
    ],
  },
  {
    slug: "database",
    title: "Best Database",
    description: "Choose the data layer you would want behind a serious application.",
    candidates: [
      {
        slug: "postgresql",
        name: "PostgreSQL",
        tagline: "Reliable relational power.",
        description: "An extensible relational database with strong SQL support and production-grade reliability.",
        logoSource: "https://cdn.simpleicons.org/postgresql",
        accent: "#4169E1",
      },
      {
        slug: "mysql",
        name: "MySQL",
        tagline: "A long-running web database staple.",
        description: "A widely used relational database for applications, content systems, and services.",
        logoSource: "https://cdn.simpleicons.org/mysql",
        accent: "#4479A1",
      },
      {
        slug: "mongodb",
        name: "MongoDB",
        tagline: "Document data at scale.",
        description: "A document database for flexible schemas, JSON-like data, and distributed applications.",
        logoSource: "https://cdn.simpleicons.org/mongodb",
        accent: "#47A248",
      },
      {
        slug: "sqlite",
        name: "SQLite",
        tagline: "Small, embedded, dependable.",
        description: "A serverless relational database engine embedded into applications and devices.",
        logoSource: "https://cdn.simpleicons.org/sqlite",
        accent: "#003B57",
      },
    ],
  },
  {
    slug: "developer-tool",
    title: "Best Developer Tool",
    description: "Vote for the editor or coding tool you would keep open all day.",
    candidates: [
      {
        slug: "vscode",
        name: "VS Code",
        tagline: "The editor most developers know.",
        description: "Microsoft's extensible code editor with a deep extension ecosystem.",
        logoSource: "https://cdn.jsdelivr.net/gh/devicons/devicon/icons/vscode/vscode-original.svg",
        accent: "#007ACC",
      },
      {
        slug: "cursor",
        name: "Cursor",
        tagline: "AI-native code editing.",
        description: "A coding environment built around AI-assisted editing, search, and codebase context.",
        logoSource: "https://cdn.simpleicons.org/cursor",
        accent: "#FFFFFF",
      },
      {
        slug: "windsurf",
        name: "Windsurf",
        tagline: "Agentic development workflow.",
        description: "An AI coding environment designed for assisted edits across real projects.",
        logoSource: "https://cdn.simpleicons.org/windsurf",
        accent: "#4DE1C1",
      },
      {
        slug: "zed",
        name: "Zed",
        tagline: "Fast collaborative editing.",
        description: "A high-performance code editor focused on speed, collaboration, and modern development.",
        logoSource: "https://cdn.simpleicons.org/zedindustries",
        accent: "#084CCF",
      },
    ],
  },
];

function tokenLookup(token) {
  return createHash("sha256").update(token.toUpperCase()).digest("hex");
}

function demoCode(index) {
  return `DEMO${String(index).padStart(2, "0")}`;
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function logoFallback(candidate) {
  const initials = candidate.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" rx="112" fill="${candidate.accent}"/><text x="256" y="292" text-anchor="middle" font-family="Arial, sans-serif" font-size="136" font-weight="800" fill="#fff">${escapeXml(initials)}</text></svg>`;
}

function logoCardDataUrl(candidate, logoSvg) {
  const logoData = `data:image/svg+xml;base64,${Buffer.from(logoSvg).toString("base64")}`;
  const darkAccent = candidate.accent.toLowerCase() === "#ffffff" ? "#4A9EFF" : candidate.accent;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1200" viewBox="0 0 900 1200">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop stop-color="#07111f"/>
      <stop offset=".55" stop-color="#0d1626"/>
      <stop offset="1" stop-color="${darkAccent}"/>
    </linearGradient>
    <radialGradient id="glow" cx=".25" cy=".18" r=".75">
      <stop stop-color="${darkAccent}" stop-opacity=".55"/>
      <stop offset=".55" stop-color="${darkAccent}" stop-opacity=".16"/>
      <stop offset="1" stop-color="#000" stop-opacity="0"/>
    </radialGradient>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="28" stdDeviation="32" flood-color="#000" flood-opacity=".32"/>
    </filter>
  </defs>
  <rect width="900" height="1200" fill="url(#bg)"/>
  <rect width="900" height="1200" fill="url(#glow)"/>
  <circle cx="738" cy="188" r="190" fill="#fff" opacity=".07"/>
  <circle cx="144" cy="1010" r="250" fill="#000" opacity=".18"/>
  <rect x="180" y="235" width="540" height="540" rx="140" fill="#f8fbff" filter="url(#shadow)"/>
  <rect x="210" y="265" width="480" height="480" rx="116" fill="#fff"/>
  <image href="${logoData}" x="310" y="365" width="280" height="280" preserveAspectRatio="xMidYMid meet"/>
  <text x="450" y="910" text-anchor="middle" font-family="Arial, sans-serif" font-size="62" font-weight="800" fill="#fff">${escapeXml(candidate.name)}</text>
  <text x="450" y="972" text-anchor="middle" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#d9e8ff" opacity=".78">${escapeXml(candidate.tagline)}</text>
</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

async function fetchLogoCardDataUrl(candidate) {
  try {
    const response = await fetch(candidate.logoSource);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const svg = await response.text();
    return logoCardDataUrl(candidate, svg);
  } catch (error) {
    console.warn(`Could not fetch ${candidate.logoSource}; using generated logo fallback for ${candidate.name}.`);
    console.warn(error instanceof Error ? error.message : String(error));
    return logoCardDataUrl(candidate, logoFallback(candidate));
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
  for (let index = 1; index <= DEMO_VOTER_COUNT; index++) {
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

  const allCandidates = POSITIONS.flatMap((position) => position.candidates);
  const [logoCards, voters] = await Promise.all([
    Promise.all(allCandidates.map(fetchLogoCardDataUrl)),
    buildVoters(),
  ]);
  const logoBySlug = new Map(allCandidates.map((candidate, index) => [candidate.slug, logoCards[index]]));

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

    for (const [positionIndex, positionDef] of POSITIONS.entries()) {
      const position = await tx.position.create({
        data: {
          id: `demo-position-${positionDef.slug}`,
          electionId: DEMO_ELECTION_ID,
          title: positionDef.title,
          description: positionDef.description,
          maxWinners: 1,
          maxVotes: 1,
          restrictions: {},
          sortOrder: positionIndex,
        },
      });

      for (const candidate of positionDef.candidates) {
        await tx.candidate.create({
          data: {
            id: `demo-candidate-${positionDef.slug}-${candidate.slug}`,
            electionId: DEMO_ELECTION_ID,
            positionId: position.id,
            name: candidate.name,
            description: `${candidate.tagline} ${candidate.description}`,
            photoUrl: logoBySlug.get(candidate.slug),
            metadata: {
              tagline: candidate.tagline,
              source: candidate.logoSource,
              demo: true,
            },
          },
        });
      }
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

  if (voters.length !== DEMO_VOTER_COUNT) {
    throw new Error(
      `Expected ${DEMO_VOTER_COUNT} demo voters, found ${voters.length}. Run npm run demo:recreate first.`,
    );
  }

  for (let index = 0; index < voters.length; index += 1) {
    const code = demoCode(index + 1);
    const tokenHash = await bcrypt.hash(code, 10);

    await prisma.voter.update({
      where: { id: voters[index].id },
      data: {
        tokenHash,
        tokenLookup: tokenLookup(code),
        metadata: {
          name: `Demo Voter ${String(index + 1).padStart(3, "0")}`,
          demoCode: code,
          demo: true,
        },
      },
    });
  }

  console.log(`Regenerated ${voters.length} demo voter access code hash(es).`);
}

async function info(prisma) {
  const election = await prisma.election.findUnique({
    where: { id: DEMO_ELECTION_ID },
    include: {
      positions: {
        orderBy: { sortOrder: "asc" },
        include: {
          candidates: {
            orderBy: { name: "asc" },
            select: {
              name: true,
              photoUrl: true,
              metadata: true,
            },
          },
        },
      },
    },
  });
  const voterCount = await prisma.voter.count({ where: { electionId: DEMO_ELECTION_ID } });
  const voteCount = await prisma.vote.count({ where: { electionId: DEMO_ELECTION_ID } });

  console.log(JSON.stringify({
    electionId: DEMO_ELECTION_ID,
    exists: Boolean(election),
    title: election?.title,
    description: election?.description,
    status: election?.status,
    authMode: election?.authMode,
    url: `/vote/${DEMO_ELECTION_ID}`,
    positions: election?.positions.map((position) => ({
      title: position.title,
      candidates: position.candidates.map((candidate) => ({
        name: candidate.name,
        hasImage: Boolean(candidate.photoUrl),
        imageKind: candidate.photoUrl?.startsWith("data:image/svg+xml") ? "seeded-logo-svg" : "external",
        source: candidate.metadata?.source,
      })),
    })) ?? [],
    voterCount,
    voteCount,
    exampleCodes: [demoCode(1), demoCode(2), demoCode(DEMO_VOTER_COUNT)],
  }, null, 2));
}

async function main() {
  const command = process.argv[2] ?? "info";
  const prisma = createPrisma();

  try {
    if (command === "recreate" || command === "seed") {
      await recreate(prisma);
      return;
    }

    if (command === "reset-votes") {
      await resetVotes(prisma);
      return;
    }

    if (command === "reset-voters") {
      await resetVoters(prisma);
      return;
    }

    if (command === "regenerate-codes") {
      await regenerateCodes(prisma);
      return;
    }

    if (command === "info") {
      await info(prisma);
      return;
    }

    throw new Error(`Unknown demo command: ${command}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
