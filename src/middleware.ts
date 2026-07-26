import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Link-preview crawlers (Telegram, WhatsApp, iMessage, etc.) must reach the /r/[id] page itself so its
// OG tags build a rich preview card — a redirect here would send them straight to the PDF with no card
// at all. Real visitors get redirected straight to the PDF instead of landing on an intermediate page.
const PREVIEW_BOT_USER_AGENT_PATTERN =
  /bot|facebookexternalhit|telegrambot|whatsapp|slackbot|discordbot|twitterbot|linkedinbot|skypeuripreview|vkshare|redditbot|pinterest|embedly|quora link preview|outbrain|w3c_validator|iframely/i;

// `redirect()` called from the async `/r/[id]` Server Component (which also has an async
// `generateMetadata`) does not reliably produce an HTTP redirect in production — verified against the
// deployed app: a real Safari UA still gets a 200 HTML page instead of a 307, while the exact same
// `redirect()` call works fine in a plain synchronous page (`src/app/page.tsx`). Middleware runs before
// any rendering and can unconditionally set the response status, so it doesn't have that race.
export function middleware(request: NextRequest) {
  const match = request.nextUrl.pathname.match(/^\/r\/([^/]+)$/);
  if (!match) return NextResponse.next();

  const userAgent = request.headers.get("user-agent") ?? "";
  if (PREVIEW_BOT_USER_AGENT_PATTERN.test(userAgent)) return NextResponse.next();

  return NextResponse.redirect(new URL(`/api/nutrition/reports/${match[1]}/pdf`, request.url));
}

export const config = {
  matcher: "/r/:id"
};
