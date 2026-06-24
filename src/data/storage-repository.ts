import "server-only";
import { eq } from "drizzle-orm";
import { database } from "@/db/client";
import { storagePolicies } from "@/db/schema";
import { getMediaStorageUsedBytes } from "./media-repository";
import { normalizeOwnerAllowlist, resolveStorageLimit, type StorageQuota } from "@/domain/storage";

export async function getStorageQuota(userId: string): Promise<StorageQuota> {
  const policyLimitBytes = await getPolicyLimitBytes(userId);
  return {
    usedBytes: await getMediaStorageUsedBytes(userId),
    limitBytes: resolveStorageLimit({
      userId,
      policyLimitBytes,
      ownerAllowlist: normalizeOwnerAllowlist(process.env.PRIVATE_UNLIMITED_USER_IDS)
    })
  };
}

async function getPolicyLimitBytes(userId: string) {
  if (process.env.E2E_DEMO_MODE === "true") return undefined;
  if (!database) return undefined;
  const [policy] = await database
    .select({ limitBytes: storagePolicies.limitBytes })
    .from(storagePolicies)
    .where(eq(storagePolicies.userId, userId))
    .limit(1);
  return policy?.limitBytes;
}
