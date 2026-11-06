// src/components/imotara/OpeningGreeting.tsx
// The companion's first words in every chat ⇒ lib/imotara/openingGreeting.ts.
// A plain companion-side bubble — no copy/read-aloud/bookmark actions, because
// it is not a stored message.
import { openingGreeting } from "@/lib/imotara/openingGreeting";

export default function OpeningGreeting({ companionName, lang }: { companionName?: string | null; lang?: string | null }) {
  return (
    <div className="mx-auto mb-4 flex max-w-3xl justify-start px-1" data-testid="opening-greeting">
      <div dir="auto" className="max-w-[82%] rounded-2xl rounded-tl-md border border-white/10 bg-white/5 px-4 py-2.5 text-[14px] leading-relaxed text-zinc-200">
        {openingGreeting(companionName, lang)}
      </div>
    </div>
  );
}
