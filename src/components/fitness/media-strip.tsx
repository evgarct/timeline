"use client";

import { useEffect, useRef } from "react";
import type { ProgressPhoto } from "@/domain/events";
import { cn } from "@/lib/utils";

export function MediaStrip({
  photos,
  priority = false,
  large = false,
  openLabel,
  interactive = true
}: {
  photos: ProgressPhoto[];
  priority?: boolean;
  large?: boolean;
  openLabel: string;
  interactive?: boolean;
}) {
  const galleryRef = useRef<HTMLDivElement>(null);
  const displayPhotos = photos.filter((photo) => photo.url).slice(0, 3);

  useEffect(() => {
    if (!interactive || !galleryRef.current || displayPhotos.length === 0) return;
    let lightbox: import("photoswipe/lightbox").default | null = null;
    void import("photoswipe/lightbox").then(({ default: PhotoSwipeLightbox }) => {
      if (!galleryRef.current) return;
      lightbox = new PhotoSwipeLightbox({
        gallery: galleryRef.current,
        children: "a",
        pswpModule: () => import("photoswipe"),
        bgOpacity: 0.96,
        pinchToClose: true,
        closeOnVerticalDrag: true,
        showHideAnimationType: "zoom"
      });
      lightbox.init();
    });
    return () => lightbox?.destroy();
  }, [displayPhotos.length, interactive]);

  if (!displayPhotos.length) return null;

  return (
    <div
      ref={galleryRef}
      className={cn(
        "grid gap-1 overflow-hidden rounded-xl",
        displayPhotos.length === 1 ? "grid-cols-1" : displayPhotos.length === 2 ? "grid-cols-2" : "grid-cols-3"
      )}
    >
      {displayPhotos.map((photo, index) => {
        const content = (
          <>
            {/* Private signed URLs expire, so native images are used instead of Next's persistent optimizer cache. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.thumbnailUrl ?? photo.url}
              alt={photo.alt}
              className="size-full object-cover"
              loading={priority ? "eager" : "lazy"}
              fetchPriority={priority ? "high" : "auto"}
            />
            {index === 2 && photos.length > 3 ? (
              <span className="absolute inset-0 flex items-center justify-center bg-foreground/55 text-lg font-semibold text-background">
                +{photos.length - 3}
              </span>
            ) : null}
          </>
        );
        const className = cn(
          "relative block overflow-hidden bg-muted",
          large ? "aspect-[3/4]" : "aspect-[4/5]"
        );
        return interactive ? (
          <a
            key={photo.id}
            href={photo.url}
            data-pswp-width={photo.width ?? 3000}
            data-pswp-height={photo.height ?? 4000}
            aria-label={`${openLabel}: ${photo.alt}`}
            className={className}
          >
            {content}
          </a>
        ) : <span key={photo.id} className={className}>{content}</span>;
      })}
      {interactive ? photos.slice(3).filter((photo) => photo.url).map((photo) => (
        <a
          key={photo.id}
          href={photo.url}
          data-pswp-width={photo.width ?? 3000}
          data-pswp-height={photo.height ?? 4000}
          aria-label={`${openLabel}: ${photo.alt}`}
          className="hidden"
        />
      )) : null}
    </div>
  );
}
