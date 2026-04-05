// src/content/blog/what-is-imotara.tsx
import type { BlogPost } from "@/lib/blog";

export const meta: BlogPost = {
  slug: "what-is-imotara",
  title: "What is Imotara?",
  description:
    "Imotara is a quiet, private space to talk about how you feel — no judgement, no social feed, no noise. Just a gentle AI companion that listens.",
  date: "2026-01-15",
  category: "Product",
  tags: ["introduction", "companion", "emotional wellness", "privacy"],
  author: {
    name: "Soumen Roy",
    role: "Founder, Imotara",
  },
  readingTime: 4,
  coverEmoji: "💙",
  featured: true,
  language: "English",
  languageCode: "en",
};

export default function Content({ lang: _lang }: { lang?: "en" } = {}) {
  return (
    <div className="space-y-5 text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">
      <p>
        Most apps want your attention. Imotara wants the opposite — it wants
        to give you back a little calm.
      </p>

      <p>
        Imotara is an AI emotional wellness companion. A quiet, private space
        where you can talk about how you feel without worrying about who is
        reading it, what algorithm is watching, or how many likes you're
        getting. There is no feed, no followers, no performance. Just you and
        a companion that listens.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        Why does this exist?
      </h2>

      <p>
        Imotara was born from a simple observation: most of us carry a lot of
        feelings we never quite find the right place for. We talk to friends
        when we can, we journal when we're disciplined enough, and we push
        everything else into the quiet corners of our days.
      </p>

      <p>
        The idea wasn't to replace human connection. It was to fill the gap —
        the 2am moment, the commute, the quiet Sunday when something just
        feels off and you can't explain why. Imotara is there for those
        moments.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        What does it actually do?
      </h2>

      <p>
        At its core, Imotara is a conversation. You write how you feel. Imotara
        responds — gently, thoughtfully, without rushing you toward solutions
        or optimism. It notices the emotion underneath your words. It
        remembers what you've shared over time. It adapts to you.
      </p>

      <p>You can also:</p>

      <ul className="list-disc space-y-1 pl-5">
        <li>Track your mood over days and weeks</li>
        <li>Set a daily check-in reminder</li>
        <li>Reflect on how you've been feeling lately</li>
        <li>Export or delete your data anytime</li>
      </ul>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        Privacy, for real
      </h2>

      <p>
        Privacy isn't a feature toggle here. It's a design principle. Your
        messages stay on your device unless you choose to sync them to the
        cloud. Your language preference is never sent to our servers. You can
        delete everything with one tap.
      </p>

      <p>
        We use AI to understand your emotions — but the model doesn't receive
        your name, email, location, or any identifying information. Just the
        words you share, and nothing else.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        Is it for everyone?
      </h2>

      <p>
        Imotara is designed for anyone who wants a gentle, private space for
        their inner world. It's not a therapy app. It's not a crisis service.
        It's a companion — calm, patient, and always available.
      </p>

      <p>
        If you're going through a serious mental health crisis, please reach
        out to a qualified professional or a crisis helpline. Imotara will
        always show you local resources if it senses you're in distress.
      </p>

      <p className="mt-8 border-l-2 border-indigo-500/40 pl-4 text-zinc-400 italic">
        "An immortal friend for your emotions." — that's what we're building.
        Something that listens without fatigue, remembers without judgement,
        and cares without agenda.
      </p>
    </div>
  );
}
