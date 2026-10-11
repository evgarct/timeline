import { describe, expect, it } from "vitest";
import { canonicalYoutubeUrl, youtubeThumbnailUrl, youtubeUrlSchema, youtubeVideoId } from "./youtube";

describe("youtubeVideoId", () => {
  it("extracts the id from every common YouTube URL shape", () => {
    const id = "dQw4w9WgXcQ";
    for (const url of [
      `https://www.youtube.com/watch?v=${id}`, `https://youtube.com/watch?v=${id}&t=42s`, `https://m.youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}`, `https://youtu.be/${id}?si=abc`, `https://www.youtube.com/shorts/${id}`,
      `https://www.youtube.com/embed/${id}`, `https://www.youtube-nocookie.com/embed/${id}`, `https://www.youtube.com/live/${id}`
    ]) expect(youtubeVideoId(url), url).toBe(id);
  });

  it("rejects other hosts, missing or malformed ids and non-http protocols", () => {
    for (const url of [
      "https://vimeo.com/123456789", "https://www.youtube.com/watch", "https://www.youtube.com/watch?v=short",
      "https://youtu.be/", "javascript:alert(1)", "not a url", "https://evil.example/watch?v=dQw4w9WgXcQ", "https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ"
    ]) expect(youtubeVideoId(url), url).toBeUndefined();
  });
});

describe("youtubeUrlSchema", () => {
  it("normalizes to the canonical watch URL and rejects anything else", () => {
    expect(youtubeUrlSchema.parse(" https://youtu.be/dQw4w9WgXcQ?si=x ")).toBe(canonicalYoutubeUrl("dQw4w9WgXcQ"));
    expect(youtubeUrlSchema.safeParse("https://example.com/video").success).toBe(false);
  });

  it("builds the thumbnail URL from the id", () => {
    expect(youtubeThumbnailUrl("dQw4w9WgXcQ")).toBe("https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });
});
