import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "Charlie Dairy Farm", short_name: "Charlie Dairy",
    description: "Charlie Dairy Farm records and management",
    start_url: "/", scope: "/", display: "standalone",
    background_color: "#ffffff", theme_color: "#143a22",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
