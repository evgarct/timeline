import { describe, expect, it } from "vitest";
import { canReserveStorage, DEFAULT_STORAGE_LIMIT_BYTES, normalizeOwnerAllowlist, resolveStorageLimit } from "./storage";

describe("storage quota", () => {
  it("allows usage below and exactly at the limit", () => {
    expect(canReserveStorage({ usedBytes: DEFAULT_STORAGE_LIMIT_BYTES - 10, limitBytes: DEFAULT_STORAGE_LIMIT_BYTES }, 10)).toBe(true);
    expect(canReserveStorage({ usedBytes: DEFAULT_STORAGE_LIMIT_BYTES - 9, limitBytes: DEFAULT_STORAGE_LIMIT_BYTES }, 10)).toBe(false);
  });

  it("exempts owner ids from the default storage limit", () => {
    const allowlist = normalizeOwnerAllowlist("owner-a, owner-b");
    expect(resolveStorageLimit({ userId: "owner-a", ownerAllowlist: allowlist })).toBeNull();
    expect(resolveStorageLimit({ userId: "user-c", ownerAllowlist: allowlist })).toBe(DEFAULT_STORAGE_LIMIT_BYTES);
  });

  it("uses policy limits for non-owner users", () => {
    expect(resolveStorageLimit({
      userId: "user-c",
      ownerAllowlist: new Set(),
      policyLimitBytes: 1024
    })).toBe(1024);
  });
});
