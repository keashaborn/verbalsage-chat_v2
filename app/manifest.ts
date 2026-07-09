import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LifeSwitch",
    short_name: "LifeSwitch",
    start_url: "/",
    display: "standalone",
    background_color: "#111113",
    theme_color: "#111113",
    icons: [
      { src: "/brand/lifeswitch/app-icon-favorite-192-v4.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/brand/lifeswitch/app-icon-favorite-512-v4.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/brand/lifeswitch/app-icon-favorite-192-v4.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/lifeswitch/app-icon-favorite-512-v4.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
