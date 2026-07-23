import { createHash, createHmac } from "node:crypto";

const SECRET = process.env.MCP_TOKEN_PEPPER ?? "development-default-secret-key-for-mcp-oauth";

export interface AuthCodeData {
  token: string;
  expiresAt: number;
  code_challenge?: string;
  code_challenge_method?: string;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(`${process.env.MCP_TOKEN_PEPPER ?? "development"}:${token}`).digest("hex");
}

export function signCode(data: AuthCodeData): string {
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  const signature = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${signature}`;
}

export function verifyCode(code: string): AuthCodeData | null {
  const parts = code.split(".");
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expectedSignature = createHmac("sha256", SECRET).update(payload).digest("base64url");
  if (signature !== expectedSignature) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof data.token === "string" && typeof data.expiresAt === "number") {
      if (Date.now() < data.expiresAt) {
        return data;
      }
    }
  } catch {
    return null;
  }
  return null;
}
