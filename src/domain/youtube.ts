import { z } from "zod";

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/;

/** The 11-character video id of a YouTube watch / youtu.be / shorts / embed / live URL, or undefined for anything else. */
export function youtubeVideoId(value: string): string | undefined {
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return undefined;
  const host = url.hostname.toLowerCase().replace(/^(www|m)\./, "");
  let id: string | undefined;
  if (host === "youtu.be") {
    id = url.pathname.slice(1).split("/")[0];
  } else if (host === "youtube.com" || host === "youtube-nocookie.com") {
    id = url.pathname === "/watch"
      ? url.searchParams.get("v") ?? undefined
      : url.pathname.match(/^\/(?:shorts|embed|live)\/([^/?]+)/)?.[1];
  }
  return id && YOUTUBE_ID.test(id) ? id : undefined;
}

export const canonicalYoutubeUrl = (id: string) => `https://www.youtube.com/watch?v=${id}`;

/** Accepts any recognised YouTube link and stores the canonical watch URL, so clients can derive the id and thumbnail. */
export const youtubeUrlSchema = z.string().trim().max(300).transform((value, ctx) => {
  const id = youtubeVideoId(value);
  if (!id) {
    ctx.addIssue({ code: "custom", message: "invalid_youtube_url" });
    return z.NEVER;
  }
  return canonicalYoutubeUrl(id);
});

/** Thumbnail frame YouTube serves for a video id (no script, no cookies until the user opens the video). */
export const youtubeThumbnailUrl = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
