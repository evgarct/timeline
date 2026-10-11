import { createHmac, timingSafeEqual } from "node:crypto";

/** How long a photo upload link stays valid after the agent asked for it. */
export const UPLOAD_LINK_TTL_MS = 15 * 60 * 1000;

export interface UploadTokenPayload {
  userId: string;
  assetId: string;
  /** Expiry as epoch milliseconds. */
  expiresAt: number;
}

// The signing key is derived from a secret the server already has, so the feature needs no new env variable; the
// derivation means the R2 secret itself is never used as a MAC key directly or exposed by a token.
function signingKey(secret: string) {
  return createHmac("sha256", "form-agent-upload-v1").update(secret).digest();
}

const encode = (value: string) => Buffer.from(value, "utf8").toString("base64url");
const decode = (value: string) => Buffer.from(value, "base64url").toString("utf8");

function sign(body: string, secret: string) {
  return createHmac("sha256", signingKey(secret)).update(body).digest("base64url");
}

/** `base64url(userId.assetId.expiresAt).signature`: one asset, one user, a short lifetime. */
export function signUploadToken(payload: UploadTokenPayload, secret: string) {
  const body = encode(`${payload.userId}\n${payload.assetId}\n${payload.expiresAt}`);
  return `${body}.${sign(body, secret)}`;
}

/** The payload of a genuine, unexpired token, or null for anything else (bad shape, wrong signature, expired). */
export function verifyUploadToken(token: string, secret: string, now = Date.now()): UploadTokenPayload | null {
  const [body, signature, extra] = token.split(".");
  if (!body || !signature || extra !== undefined) return null;
  const expected = Buffer.from(sign(body, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  const [userId, assetId, expires] = decode(body).split("\n");
  const expiresAt = Number(expires);
  if (!userId || !assetId || !Number.isFinite(expiresAt) || expiresAt <= now) return null;
  return { userId, assetId, expiresAt };
}
