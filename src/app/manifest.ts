import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fitness Timeline",
    short_name: "Timeline",
    description: "Chronology of body transformation.",
    start_url: "/ru/today",
    display: "standalone",
    background_color: "#f6f2ec",
    theme_color: "#f6f2ec",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" }
    ]
  };
}

