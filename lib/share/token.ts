import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** 32 random bytes, base64url: 43 characters, 256 bits. Only its hash is ever stored. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

export const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

/** sha256 hex of the token. A fast hash is fine: the input is 256 bits of randomness, not a password. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Constant-time comparison of two hex digests. */
export function hashesEqual(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  return x.length === y.length && timingSafeEqual(x, y);
}
