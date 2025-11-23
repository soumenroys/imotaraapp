// src/app/manifest.ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    const base = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    return {
        name: "Imotara",
        short_name: "Imotara",
        description:
            "An emotion-aware, privacy-first companion that listens, reflects, and grows with you.",
        start_url: "/",
        display: "standalone",
        background_color: "#000000",
        theme_color: "#000000",
        icons: [
            {
                src: `${base}/icons/icon-192.png`,
                sizes: "192x192",
                type: "image/png",
            },
            {
                src: `${base}/icons/icon-512.png`,
                sizes: "512x512",
                type: "image/png",
            },
        ],
    };
}
