import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";
import { generateToken, hashToken, fingerprintToken } from "./tokens";

type VoterTokenDb = typeof prisma | Prisma.TransactionClient;

/**
 * Generate a fresh access code for one voter and atomically replace the stored
 * `tokenHash` + `tokenLookup`. Overwriting these immediately invalidates the
 * previous code (vote-time auth fingerprints the code and looks it up, then
 * bcrypt-verifies — a stale code no longer matches either).
 *
 * Retries on the rare `(electionId, tokenLookup)` unique collision so a 1-in-a-
 * billion duplicate can never surface to the caller. Returns the raw code, which
 * is shown to the admin exactly once.
 *
 * `hasVoted` is intentionally left untouched: regenerating a code must not let
 * someone vote twice or bypass restrictions.
 */
export async function regenerateVoterToken(
  electionId: string,
  voterId: string,
  db: VoterTokenDb = prisma
): Promise<string> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const token = generateToken();
    const tokenHash = await hashToken(token);
    const tokenLookup = fingerprintToken(token);
    try {
      // Scope by electionId too so a mismatched voter can't be updated.
      const res = await db.voter.updateMany({
        where: { id: voterId, electionId },
        data: { tokenHash, tokenLookup },
      });
      if (res.count === 0) throw new Error("VOTER_NOT_FOUND");
      return token;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        continue; // fingerprint collision — try a new code
      }
      throw err;
    }
  }
  throw new Error("Could not generate a unique access code after several attempts");
}
