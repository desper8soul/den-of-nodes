import type { MetadataRoute } from "next";

// Icons under public/icons/ are temporary placeholders — replace with final brand artwork later.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Home Dashboard",
    short_name: "Dashboard",
    description: "Raspberry Pi home network dashboard",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    theme_color: "#0b1220",
    background_color: "#0b1220",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512-maskable.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
