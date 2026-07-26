import "server-only";

// Not derived from the request's Host header — that can be a Vercel preview/deployment domain.
const DEFAULT_SITE_ORIGIN = "https://form.safronov.dev";

export function siteOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");

  // Vercel sets VERCEL_ENV to "production" | "preview" | "development"; it's unset for local dev,
  // where .env's own NEXT_PUBLIC_APP_URL already covers this via the branch above. Preview deployments
  // write to their own scoped R2/Neon resources, so falling back to the pinned production domain here
  // would silently hand back a share URL that 404s on prod instead of pointing at the preview
  // deployment that actually holds the just-uploaded report — use this deployment's own
  // auto-generated URL (VERCEL_URL, set by Vercel on every deployment with no config needed) instead.
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== "production") {
    if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
    throw new Error(`NEXT_PUBLIC_APP_URL must be set explicitly outside production (VERCEL_ENV=${process.env.VERCEL_ENV})`);
  }
  return DEFAULT_SITE_ORIGIN;
}
