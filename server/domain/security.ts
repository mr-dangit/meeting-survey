import { createHash, randomBytes } from "node:crypto";

export const generateAccessSecret = () => randomBytes(32).toString("base64url");
export const hashAccessSecret = (secret: string) => createHash("sha256").update(secret).digest("hex");
