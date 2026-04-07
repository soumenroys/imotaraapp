// src/app/rss.xml/route.ts
import { NextResponse } from "next/server";
import { getAllPosts } from "@/lib/blog";

const SITE_URL = "https://www.imotara.com";

export async function GET() {
  const posts = getAllPosts();

  const items = posts
    .map((post) => {
      const title = post.titleEn ?? post.title;
      const description = post.descriptionEn ?? post.description;
      return `
    <item>
      <title><![CDATA[${title}]]></title>
      <link>${SITE_URL}/blog/${post.slug}</link>
      <guid isPermaLink="true">${SITE_URL}/blog/${post.slug}</guid>
      <description><![CDATA[${description}]]></description>
      <pubDate>${new Date(post.date + "T00:00:00Z").toUTCString()}</pubDate>
      <author>${post.author.name}</author>
      <category>${post.category}</category>
      ${post.tags.map((t) => `<category>${t}</category>`).join("\n      ")}
    </item>`;
    })
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Imotara Blog — Emotional Wellness &amp; Mental Health</title>
    <link>${SITE_URL}/blog</link>
    <description>Thoughts on emotional wellness, mindfulness, AI ethics, and building a kinder inner world — from the Imotara team.</description>
    <language>en-us</language>
    <managingEditor>roysowmen@gmail.com (Soumen Roy)</managingEditor>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <atom:link href="${SITE_URL}/rss.xml" rel="self" type="application/rss+xml"/>
    <image>
      <url>${SITE_URL}/og-image.png</url>
      <title>Imotara</title>
      <link>${SITE_URL}</link>
    </image>
    ${items}
  </channel>
</rss>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
