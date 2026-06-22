import "server-only";
import { createNeonAuth } from "@neondatabase/auth/next/server";

export const isNeonAuthConfigured = Boolean(
  process.env.E2E_DEMO_MODE !== "true" &&
  process.env.NEON_AUTH_BASE_URL &&
  process.env.NEON_AUTH_COOKIE_SECRET
);

export const auth = isNeonAuthConfigured
  ? createNeonAuth({
      baseUrl: process.env.NEON_AUTH_BASE_URL!,
      cookies: {
        secret: process.env.NEON_AUTH_COOKIE_SECRET!
      }
    })
  : null;
