import { describe, expect, it } from "vitest";
import { signUploadToken, verifyUploadToken } from "./agent-upload-token";

const secret = "test-secret";
const payload = { userId: "user-1", assetId: "7f1c1c4e-3b6e-4b6b-8f0e-2a4f5f9d7a11", expiresAt: 2_000_000 };

describe("agent upload token", () => {
  it("round-trips a genuine token before it expires", () => {
    expect(verifyUploadToken(signUploadToken(payload, secret), secret, 1_000_000)).toEqual(payload);
  });

  it("rejects an expired token, a wrong secret, a tampered body and malformed input", () => {
    const token = signUploadToken(payload, secret);
    expect(verifyUploadToken(token, secret, 2_000_001)).toBeNull();
    expect(verifyUploadToken(token, "other-secret", 1_000_000)).toBeNull();

    const [, signature] = token.split(".");
    const forged = `${Buffer.from("user-2\n" + payload.assetId + "\n" + payload.expiresAt).toString("base64url")}.${signature}`;
    expect(verifyUploadToken(forged, secret, 1_000_000)).toBeNull();
    expect(verifyUploadToken("nonsense", secret)).toBeNull();
    expect(verifyUploadToken(`${token}.extra`, secret, 1_000_000)).toBeNull();
  });
});
