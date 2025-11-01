import Link from "next/link";

export default function Home() {
  return (
    <section className="mx-auto max-w-3xl text-center py-24 sm:py-32">
      <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-100 sm:text-5xl">
        An Immortal Friend for Your Emotions
      </h1>

      <p className="mt-5 text-lg leading-7 text-zinc-600 dark:text-zinc-400">
        Imotara listens with empathy and learns with you — quietly, ethically,
        and forever. Share your feelings, track your reflections, and chat with
        your emotional companion.
      </p>

      <div className="mt-10">
        <Link
          href="/chat"
          className="inline-flex items-center rounded-full px-6 py-3 text-sm font-medium bg-indigo-500 text-white hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          aria-label="Get started chatting with Imotara"
        >
          Get Started
        </Link>
      </div>
    </section>
  );
}
