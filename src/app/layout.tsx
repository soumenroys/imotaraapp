import "./globals.css";
import { Inter } from "next/font/google";

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Imotara — An Immortal Friend for Your Emotions",
  description:
    "A quiet, charitable exploration at the edge of feeling, memory and meaning. A companion that notices — without surveillance or ads.",
  keywords: [
    "Imotara",
    "AI friend",
    "emotional wellbeing",
    "digital companion",
    "ethical AI",
    "mental health",
    "empathy",
  ],
  metadataBase: new URL("https://imotara.com"),
  openGraph: {
    title: "Imotara — An Immortal Friend for Your Emotions",
    description:
      "A companion that listens, remembers, and grows with your emotions — quietly, ethically, and forever.",
    url: "https://imotara.com",
    siteName: "Imotara",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Imotara — An Immortal Friend for Your Emotions",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Imotara — An Immortal Friend for Your Emotions",
    description:
      "An emotion-aware companion that listens, learns, and grows with you — quietly, ethically, and forever.",
    creator: "@imotara",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  authors: [{ name: "Soumen Roy", url: "https://soumenroy.com" }],
  category: "AI Companion",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-zinc-50 dark:bg-black">
      <body
        className={`${inter.className} flex flex-col min-h-screen text-zinc-800 dark:text-zinc-100`}
      >
        <header className="flex justify-between items-center px-8 py-6 border-b border-zinc-200 dark:border-zinc-800">
          <h1 className="text-2xl font-semibold tracking-tight">
            imotara<span className="text-indigo-500">★</span>
          </h1>
          <nav className="flex gap-6 text-sm text-zinc-600 dark:text-zinc-400">
            <a
              href="/"
              className="hover:text-indigo-500 transition-colors duration-200"
            >
              Home
            </a>
            <a
              href="/about"
              className="hover:text-indigo-500 transition-colors duration-200"
            >
              About
            </a>
            <a
              href="/connect"
              className="hover:text-indigo-500 transition-colors duration-200"
            >
              Connect
            </a>
          </nav>
        </header>

        <main className="flex-1 flex flex-col items-center justify-center px-8 py-16">
          {children}
        </main>

        <footer className="text-center py-6 text-sm text-zinc-500 dark:text-zinc-600 border-t border-zinc-200 dark:border-zinc-800">
          © {new Date().getFullYear()} Imotara. All rights reserved.
        </footer>
      </body>
    </html>
  );
}
