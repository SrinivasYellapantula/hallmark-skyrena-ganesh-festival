import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hallmark Skyrena Ganesh Festival 2026",
    short_name: "Ganesh 2026",
    description: "Restricted Hallmark Skyrena festival committee workspace.",
    start_url: "/",
    display: "standalone",
    background_color: "#f8f2e7",
    theme_color: "#b43120",
    orientation: "portrait-primary",
    icons: [
      { src: "/skyrena-app-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/skyrena-app-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
