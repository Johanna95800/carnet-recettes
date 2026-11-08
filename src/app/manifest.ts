import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Carnet de recettes",
    short_name: "Recettes",
    description: "Les recettes de la famille, au même endroit.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf7f1",
    theme_color: "#c2410c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
