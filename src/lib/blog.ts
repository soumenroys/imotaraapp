// src/lib/blog.ts
// Blog post types and loader utilities.
// Each post lives in src/content/blog/ as a .tsx module that exports
// `meta` (BlogPost metadata) and a default React component (the body).

import type { ComponentType } from "react";

export interface BlogPost {
  slug: string;
  title: string;
  description: string;         // Used in card preview + SEO description
  date: string;                // ISO date string e.g. "2026-04-05"
  category: BlogCategory;
  tags: string[];
  author: BlogAuthor;
  readingTime: number;         // Estimated minutes (auto-calculated or manual)
  coverEmoji?: string;         // Optional emoji used as cover art fallback
  coverImage?: string;         // Optional /public image path or external URL
  featured?: boolean;          // Pin to top of list
  language?: string;           // Display label e.g. "Español", "हिन्दी"
  languageCode?: string;       // BCP-47 code e.g. "es", "hi" — omit or "en" for English
  titleEn?: string;            // English title shown when ?en=1 (SEO + header)
  descriptionEn?: string;      // English description shown when ?en=1
}

export type BlogCategory =
  | "Mental Health"
  | "Mindfulness"
  | "Product"
  | "Research"
  | "Stories";

export interface BlogAuthor {
  name: string;
  role?: string;
  avatar?: string;             // URL or /public path — optional
}

export interface BlogPostModule {
  meta: BlogPost;
  // Content accepts optional lang prop; English-only posts may ignore it
  default: ComponentType<{ lang?: "en" }>;
}

// ─── Post registry ───────────────────────────────────────────────────────────
// Import every post here. The slug in meta must match the filename (without .tsx).

import * as WhatIsImotara from "@/content/blog/what-is-imotara";
import * as EmotionsAndLanguage from "@/content/blog/emotions-and-language";
import * as DeceptiveEmpathy from "@/content/blog/deceptive-empathy-in-ai";
import * as AlucinacionDigital from "@/content/blog/alucinacion-digital-manejo-crisis";
import * as EmotionalDependence from "@/content/blog/emotional-dependence-synthetic-loneliness";
import * as ConfidentialiteEmotionnelle from "@/content/blog/confidentialite-exploration-emotionnelle";
import * as AiCulturalBias from "@/content/blog/ai-cultural-bias-discrimination";
import * as SihhaNafsiyya from "@/content/blog/sihha-nafsiyya-dhakaa-istinai";
import * as DigitalTwinAnxiety from "@/content/blog/digital-twin-anxiety";
import * as DoomscrollingEchoChambers from "@/content/blog/doomscrolling-echo-chambers";
import * as ErosionHumanAgency from "@/content/blog/erosion-human-agency-therapy";
import * as AlgorithmicGaslighting from "@/content/blog/algorithmic-gaslighting";
import * as GhostInTheMachineGrief from "@/content/blog/ghost-in-the-machine-grief";

const ALL_MODULES: BlogPostModule[] = [
  WhatIsImotara as BlogPostModule,
  EmotionsAndLanguage as BlogPostModule,
  DeceptiveEmpathy as BlogPostModule,
  AlucinacionDigital as BlogPostModule,
  EmotionalDependence as BlogPostModule,
  ConfidentialiteEmotionnelle as BlogPostModule,
  AiCulturalBias as BlogPostModule,
  SihhaNafsiyya as BlogPostModule,
  DigitalTwinAnxiety as BlogPostModule,
  DoomscrollingEchoChambers as BlogPostModule,
  ErosionHumanAgency as BlogPostModule,
  AlgorithmicGaslighting as BlogPostModule,
  GhostInTheMachineGrief as BlogPostModule,
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** All posts sorted newest-first. */
export function getAllPosts(): BlogPost[] {
  return ALL_MODULES.map((m) => m.meta).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

/** Posts filtered by category. */
export function getPostsByCategory(category: BlogCategory): BlogPost[] {
  return getAllPosts().filter((p) => p.category === category);
}

/** Posts filtered by tag. */
export function getPostsByTag(tag: string): BlogPost[] {
  return getAllPosts().filter((p) => p.tags.includes(tag));
}

/** Single post meta by slug — null if not found. */
export function getPostBySlug(slug: string): BlogPost | null {
  return getAllPosts().find((p) => p.slug === slug) ?? null;
}

/** Single post module (meta + Content component) by slug. */
export function getPostModuleBySlug(slug: string): BlogPostModule | null {
  return ALL_MODULES.find((m) => m.meta.slug === slug) ?? null;
}

/** All unique tags across all posts. */
export function getAllTags(): string[] {
  const set = new Set<string>();
  getAllPosts().forEach((p) => p.tags.forEach((t) => set.add(t)));
  return Array.from(set).sort();
}

/** All unique categories that have at least one post. */
export function getAllCategories(): BlogCategory[] {
  const set = new Set<BlogCategory>();
  getAllPosts().forEach((p) => set.add(p.category));
  return Array.from(set);
}

/** Related posts: same category, excluding current, up to `limit`. */
export function getRelatedPosts(slug: string, limit = 3): BlogPost[] {
  const current = getPostBySlug(slug);
  if (!current) return [];
  return getAllPosts()
    .filter((p) => p.slug !== slug && p.category === current.category)
    .slice(0, limit);
}

/** Format date for display e.g. "April 5, 2026". */
export function formatPostDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
