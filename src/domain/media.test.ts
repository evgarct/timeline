import { describe, expect, it } from "vitest";
import { detectMediaType, inBodyObjectKey, progressObjectKeys, safeFileName } from "./media";

describe("media detection", () => {
  it("detects JPEG, PNG, PDF, HEIC and HEIF signatures", () => {
    expect(detectMediaType(Uint8Array.from([0xff, 0xd8, 0xff]))).toBe("image/jpeg");
    expect(detectMediaType(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(detectMediaType(new TextEncoder().encode("%PDF-1.7"))).toBe("application/pdf");
    expect(detectMediaType(new TextEncoder().encode("\0\0\0\u0018ftypheic"))).toBe("image/heic");
    expect(detectMediaType(new TextEncoder().encode("\0\0\0\u0018ftypmif1"))).toBe("image/heif");
  });

  it("rejects unknown data and sanitizes response filenames", () => {
    expect(detectMediaType(new TextEncoder().encode("not-media"))).toBeNull();
    expect(safeFileName("report\"\r\n.pdf")).toBe("report___.pdf");
  });

  it("keeps generated object keys inside the authenticated user namespace", () => {
    expect(progressObjectKeys("user/../other", "asset-id")).toEqual({
      objectKey: "users/user%2F..%2Fother/progress/asset-id/full.jpg",
      thumbnailObjectKey: "users/user%2F..%2Fother/progress/asset-id/thumbnail.jpg"
    });
    expect(inBodyObjectKey("user/../other", "asset-id", "pdf"))
      .toBe("users/user%2F..%2Fother/inbody/asset-id/original.pdf");
  });
});
