import "server-only";

// Not derived from the request's Host header — that can be a Vercel preview/deployment domain.
const DEFAULT_SITE_ORIGIN = "https://form.safronov.dev";

export function siteOrigin(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || DEFAULT_SITE_ORIGIN).replace(/\/+$/, "");
}
