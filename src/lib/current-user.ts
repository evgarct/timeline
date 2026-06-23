import "server-only";
import { auth, isNeonAuthConfigured } from "./auth/server";

export async function getAuthenticatedUserId() {
  if (!isNeonAuthConfigured || !auth) return null;
  const session = await auth.getSession();
  return session.data?.user?.id ?? null;
}

export async function getCurrentUserId() {
  if (!isNeonAuthConfigured || !auth) return "demo-user";
  return getAuthenticatedUserId();
}

