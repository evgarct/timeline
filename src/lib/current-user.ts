import "server-only";
import { auth, isNeonAuthConfigured } from "./auth/server";

export async function getCurrentUserId() {
  if (!isNeonAuthConfigured || !auth) return "demo-user";
  const session = await auth.getSession();
  return session.data?.user?.id ?? null;
}

