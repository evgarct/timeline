import Image from "next/image";

export function MediaStrip({
  photos,
  priority = false,
  large = false
}: {
  photos: Array<{ id: string; url: string; alt: string }>;
  priority?: boolean;
  large?: boolean;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 overflow-hidden rounded-xl">
      {photos.slice(0, 3).map((photo) => (
        <div key={photo.id} className={large ? "relative aspect-[3/4]" : "relative aspect-[4/5]"}>
          <Image
            src={photo.url}
            alt={photo.alt}
            fill
            sizes={large ? "(max-width: 512px) 33vw, 160px" : "(max-width: 512px) 30vw, 140px"}
            className="object-cover"
            priority={priority}
          />
        </div>
      ))}
    </div>
  );
}

