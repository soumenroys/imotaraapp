// src/app/manifest.ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
    const base =
        process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

    return {
        name: "Imotara",
        short_name: "Imotara",
        description:
            "An emotion-aware, privacy-first companion that listens, reflects, and grows with you.",
        start_url: "/",
        scope: "/",
        display: "standalone",
        orientation: "portrait",
        background_color: "#020617", // Aurora dark base
        theme_color: "#020617",
        categories: ["health", "lifestyle", "productivity"],
        icons: [
            // --- Primary PWA Icons ---
            {
                src: `${base}/android-chrome-192.png`,
                sizes: "192x192",
                type: "image/png",
            },
            {
                src: `${base}/android-chrome-512.png`,
                sizes: "512x512",
                type: "image/png",
            },

            // --- Fallback favicon set ---
            {
                src: `${base}/favicon-32.png`,
                sizes: "32x32",
                type: "image/png",
            },
            {
                src: `${base}/favicon-16.png`,
                sizes: "16x16",
                type: "image/png",
            },

            // --- Maskable icons for Android adaptive UI ---
            {
                src: `${base}/android-chrome-192.png`,
                sizes: "192x192",
                type: "image/png",
                purpose: "maskable",
            },
            {
                src: `${base}/android-chrome-512.png`,
                sizes: "512x512",
                type: "image/png",
                purpose: "maskable",
            },

            // --- Apple Touch Icon (iOS Safari) ---
            {
                src: `${base}/apple-touch-icon.png`,
                sizes: "180x180",
                type: "image/png",
            },
        ],
    };
}
