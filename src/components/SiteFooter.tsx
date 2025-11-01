import Link from "next/link";

export default function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto w-full max-w-5xl px-6 py-8 text-sm text-zinc-600 dark:text-zinc-400">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Imotara. All rights reserved.</p>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:underline">Privacy</Link>
            <Link href="/terms" className="hover:underline">Terms</Link>
            <Link href="/connect" className="hover:underline">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
