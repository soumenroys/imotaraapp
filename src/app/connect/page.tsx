"use client";

export default function ConnectPage() {
  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    alert("Thanks for reaching out — we’ll get back soon!");
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16 text-zinc-900 dark:text-zinc-100">
      <h1 className="text-3xl font-semibold tracking-tight">Connect</h1>
      <p className="mt-6 leading-7 text-zinc-600 dark:text-zinc-400">
        We’d love to hear from you. Share feedback, explore partnerships, or ask
        for help.
      </p>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        <div className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
          <h2 className="text-lg font-medium">Email</h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            <a
              href="mailto:hello@imotara.com"
              className="underline underline-offset-4 hover:text-indigo-500"
            >
              hello@imotara.com
            </a>
          </p>
        </div>
        <div className="rounded-2xl border border-zinc-200 p-6 dark:border-zinc-800">
          <h2 className="text-lg font-medium">Partnerships</h2>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            <a
              href="mailto:partners@imotara.com"
              className="underline underline-offset-4 hover:text-indigo-500"
            >
              partners@imotara.com
            </a>
          </p>
        </div>
      </div>

      <form className="mt-10 space-y-4" onSubmit={onSubmit}>
        <label className="block">
          <span className="text-sm text-zinc-700 dark:text-zinc-300">
            Your message
          </span>
          <textarea
            className="mt-2 w-full rounded-xl border border-zinc-200 bg-white p-3 outline-none ring-0 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950"
            rows={5}
            placeholder="Tell us what’s on your mind…"
          />
        </label>
        <button
          type="submit"
          className="rounded-2xl border border-zinc-200 px-4 py-2 text-sm font-medium hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
        >
          Send
        </button>
      </form>
    </main>
  );
}
