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
    orientation: "portrait"
  };
}

