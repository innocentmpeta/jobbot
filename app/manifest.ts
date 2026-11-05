import type { MetadataRoute } from "next";

// Lets you "Add to Home Screen" on iOS/Android and open JobBot like an app
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JobBot",
    short_name: "JobBot",
    start_url: "/matches",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0f766e",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
