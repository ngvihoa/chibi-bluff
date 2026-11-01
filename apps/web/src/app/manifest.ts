import type { MetadataRoute } from "next";

/** Install as an app (docs/architecture.md §6.1). Served by Next at /manifest.webmanifest. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Chibi Bluff",
    short_name: "Chibi Bluff",
    description:
      "Game lừa bịp chibi: tuyên bố mình là ai cũng được, miễn đừng để bị lộ tẩy. Chơi với bot hoặc với bạn bè.",
    lang: "vi",
    // The proxy sends "/" on to /vi or /en, whichever the player picked.
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Phones only have a portrait table; desktops ignore this.
    orientation: "portrait",
    background_color: "#1c1a36",
    theme_color: "#1c1a36",
    categories: ["games"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
