export const DEFAULT_STORAGE_LIMIT_BYTES = 250 * 1024 * 1024;

export type StorageQuota = {
  limitBytes: number | null;
  usedBytes: number;
};

export function normalizeOwnerAllowlist(value: string | undefined) {
  return new Set((value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean));
}

export function resolveStorageLimit(input: {
  userId: string;
  ownerAllowlist: Set<string>;
  policyLimitBytes?: number | null;
}) {
  if (input.ownerAllowlist.has(input.userId)) return null;
  return input.policyLimitBytes ?? DEFAULT_STORAGE_LIMIT_BYTES;
}

export function canReserveStorage(quota: StorageQuota, proposedBytes: number) {
  if (quota.limitBytes === null) return true;
  return quota.usedBytes + proposedBytes <= quota.limitBytes;
}

export function formatStorageMegabytes(bytes: number) {
  return Math.round(bytes / 1024 / 1024);
}
