"use client";

import { Play } from "lucide-react";
import { useState } from "react";
import { youtubeThumbnailUrl, youtubeVideoId } from "@/domain/youtube";

/**
 * Click-to-load YouTube player. Nothing from youtube.com is loaded until the person presses play (a thumbnail from
 * i.ytimg.com is the only request), and the embed uses the privacy-enhanced youtube-nocookie.com host.
 */
export function YoutubePlayer({ url, title, playLabel }: { url: string; title: string; playLabel: string }) {
  const id = youtubeVideoId(url);
  const [playing, setPlaying] = useState(false);
  if (!id) return null;

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-[var(--s-radius-lg)] bg-[var(--s-surface-container-highest)]" data-testid="youtube-player">
      {playing ? (
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="absolute inset-0 size-full border-0"
        />
      ) : (
        <button type="button" onClick={() => setPlaying(true)} aria-label={`${playLabel}: ${title}`} className="group absolute inset-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--s-primary)]">
          {/* eslint-disable-next-line @next/next/no-img-element -- remote YouTube thumbnail */}
          <img src={youtubeThumbnailUrl(id)} alt="" loading="lazy" className="size-full object-cover" />
          <span className="absolute inset-0 grid place-items-center bg-black/25 transition-colors group-hover:bg-black/10">
            <span className="grid size-16 place-items-center rounded-full bg-[var(--s-primary)] text-[var(--s-on-primary)] shadow-lg transition-transform group-hover:scale-110"><Play className="ml-1 size-7 fill-current" /></span>
          </span>
        </button>
      )}
    </div>
  );
}
