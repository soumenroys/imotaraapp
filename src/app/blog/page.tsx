// src/app/blog/page.tsx
import type { Metadata } from "next";
import { getAllPosts, getAllCategories } from "@/lib/blog";
import BlogListClient from "@/components/blog/BlogListClient";
import { OG_IMAGE } from "@/lib/seo/ogImage";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Thoughts on emotional wellness, mindfulness, AI, and building a kinder inner world — from the Imotara team.",
  openGraph: {
            ...OG_IMAGE,
    title: "Imotara Blog",
    description:
      "Thoughts on emotional wellness, mindfulness, AI, and building a kinder inner world.",
  },
};

export default function BlogListPage() {
  const posts = getAllPosts();
  const categories = getAllCategories();

  return (
    <main
      className="mx-auto w-full max-w-5xl px-4 py-10 sm:px-6"
      aria-labelledby="blog-title"
    >
      <BlogListClient posts={posts} categories={categories} />
    </main>
  );
}
