import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const generateAccessSecret = () => randomBytes(32).toString("base64url");
export const hashAccessSecret = (secret: string) => createHash("sha256").update(secret).digest("hex");

export function passphraseMatches(actual: string, expected: string): boolean {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
