import bcrypt from "bcryptjs";
import { createHash } from "crypto";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

export function generateToken(): string {
  return nanoid();
}

/**
 * Public-facing election id: always exactly 6 characters from the same
 * unambiguous alphabet as access codes (no I/O/0/1), so it's short, typeable
 * and shareable. Used as the Election primary key at creation time.
 */
export function generateElectionId(): string {
  return nanoid();
}

/**
 * Deterministic, non-reversible fingerprint of a token used as an indexed
 * lookup key so vote-time auth is O(1) instead of bcrypt-scanning every voter.
 * Always fingerprint the normalized (uppercased) token.
 */
export function fingerprintToken(token: string): string {
  return createHash("sha256").update(token.toUpperCase()).digest("hex");
}

export async function hashToken(token: string): Promise<string> {
  return bcrypt.hash(token, 10);
}

export async function verifyToken(
  token: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(token, hash);
}
