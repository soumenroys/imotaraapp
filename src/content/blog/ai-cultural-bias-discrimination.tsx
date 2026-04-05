// src/content/blog/ai-cultural-bias-discrimination.tsx
import type { BlogPost } from "@/lib/blog";

export const meta: BlogPost = {
  slug: "ai-cultural-bias-discrimination",
  title: "AI-এর সাংস্কৃতিক পক্ষপাত — যখন প্রযুক্তি সবার কথা বোঝে না",
  description:
    "পশ্চিমা মানসিকতায় তৈরি AI কি সত্যিই বাংলা, তামিল বা আরবি ভাষায় কথা বলা মানুষদের বুঝতে পারে? কীভাবে সাংস্কৃতিক পক্ষপাত মানসিক স্বাস্থ্য প্রযুক্তিকে ব্যর্থ করে।",
  date: "2026-03-14",
  category: "Research",
  tags: ["Bengali", "cultural bias", "AI discrimination", "multilingual", "বাংলা"],
  author: { name: "Soumen Roy", role: "Founder, Imotara" },
  readingTime: 7,
  coverEmoji: "🌐",
  featured: true,
  language: "বাংলা",
  languageCode: "bn",
  titleEn: "AI's Cultural Bias — When Technology Doesn't Understand Everyone",
  descriptionEn:
    "Can AI built on Western psychology truly understand people who think in Bengali, Tamil or Arabic? How cultural bias causes mental health technology to fail non-Western users.",
};

function BengaliContent() {
  return (
    <div className="space-y-5 text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">
      <p>
        ধরুন আপনি বাংলায় লিখলেন: <em>"আমার মনটা ভালো নেই, কেমন যেন ফাঁকা ফাঁকা লাগছে।"</em>{" "}
        একটি পশ্চিমা AI এই বাক্যটি অনুবাদ করতে পারবে, কিন্তু বুঝতে পারবে না।
        কারণ "ফাঁকা ফাঁকা" — এই অনুভূতিটি বাংলা সংস্কৃতির একটি নির্দিষ্ট রঙ বহন করে।
        এটি শুধু "emptiness" নয়।
      </p>

      <p>
        অথবা কেউ তামিলে বললেন: <em>"என் மனசு சரியில்ல"</em> — আমার মন ঠিক নেই।
        অথবা আরবিতে: <em>"قلبي مثقل"</em> — আমার হৃদয় ভারী। এই অভিব্যক্তিগুলি শুধু
        শব্দ নয়, এগুলি সংস্কৃতি, ইতিহাস এবং একটি নির্দিষ্ট জীবনবোধের ধারক।
      </p>

      <p>
        যে AI শুধু ইংরেজিতে "train" হয়েছে, সে এই গভীরতা বুঝতে পারে না। এবং
        যে tool একজন মানুষের আবেগকে সত্যিকার অর্থে বুঝতে পারে না, সে তাকে সাহায্যও
        করতে পারে না।
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        সমস্যার পরিধি
      </h2>

      <p>
        ৭৫% এরও বেশি AI mental wellness tool মূলত ইংরেজিভাষীদের জন্য তৈরি।
        তাদের training data ইংরেজি পাঠ্য দ্বারা পরিপূর্ণ, emotion taxonomy পশ্চিমা
        মনোবিজ্ঞান থেকে নেওয়া, এবং crisis detection ইংরেজিতে কষ্ট কেমন শোনায়
        তার উপর calibrate করা।
      </p>

      <p>
        এটি একটি দ্বি-স্তরীয় মানসিক স্বাস্থ্য প্রযুক্তি ব্যবস্থা তৈরি করে। যারা
        ইংরেজিতে কথা বলেন তারা সম্পূর্ণ সুবিধা পান। বাকি সবাই একটি degraded,
        culturally misaligned অভিজ্ঞতা পান।
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        ইমোতারা কীভাবে এই সমস্যার সমাধান করে
      </h2>

      <p>
        Imotara ২২টি ভাষায় কাজ করে — ১২টি ভারতীয় ভাষা এবং ১০টি বৈশ্বিক ভাষা।
        কিন্তু শুধু ভাষা সমর্থন যথেষ্ট নয়।
      </p>

      <p>
        Imotara-এর emotion detection system প্রতিটি ভাষার নিজস্ব script এবং
        romanized উভয় রূপ থেকে তৈরি। বাংলায় "মন খারাপ", হিন্দিতে "dil bujha hua hai",
        তামিলে "மனசு சரியில்ல" — এই সবগুলি expression Imotara চেনে।
      </p>

      <p>
        পারিবারিক দায়িত্ব, সামাজিক চাপ, ধর্মীয় পরিচয় — এগুলি acknowledge করা হয়,
        dismiss করা হয় না।
      </p>

      <p className="mt-8 border-l-2 border-rose-500/40 pl-4 italic text-zinc-400">
        আপনার ভাষায়, আপনার অনুভূতির ভাষায় — Imotara সেখানে আছে।
      </p>
    </div>
  );
}

function EnglishContent() {
  return (
    <div className="space-y-5 text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">
      <p>
        Suppose you write in Bengali: <em>"Amar monta bhalo nei, kemon jeno faka faka lagche."</em>{" "}
        (My mind is not well, it feels strangely hollow.) A Western AI can translate this sentence,
        but it cannot understand it. Because "faka faka" — this feeling — carries a specific shade
        of Bengali emotional experience. It is not simply "emptiness."
      </p>

      <p>
        Or someone says in Tamil: <em>"En manasu sarillla"</em> (my mind is not right). Or in
        Arabic: <em>"Qalbi mithqal"</em> (my heart is heavy). These expressions are not just words
        — they carry culture, history, and a specific way of understanding life.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        The scale of the problem
      </h2>

      <p>
        Over 75% of AI mental wellness tools are built primarily for English speakers. Their
        training data is dominated by English text, their emotion taxonomies derive from Western
        psychological frameworks, and their crisis detection is calibrated for the way distress
        sounds in English.
      </p>

      <p>
        This creates a two-tier system. Users who speak English and express distress in ways
        legible to Western psychology get the full benefit. Everyone else gets a degraded,
        culturally misaligned experience — or nothing at all.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        How cultural bias causes active harm
      </h2>

      <ul className="list-inside list-disc space-y-2 pl-2 text-zinc-400">
        <li>
          <strong className="text-zinc-300">Misidentification of distress.</strong> In many
          South Asian languages, emotional pain is expressed through physical metaphors —
          "my chest feels heavy," "my head is burning." A system trained on Western data
          may not recognise these as distress signals.
        </li>
        <li>
          <strong className="text-zinc-300">Culturally inappropriate responses.</strong>{" "}
          Concepts like "setting boundaries" carry very different meanings in collectivist
          cultures. Advice framed around Western individualism can feel alienating.
        </li>
        <li>
          <strong className="text-zinc-300">Religious context ignored.</strong> For millions
          of people, faith is central to how they process suffering. AI with no framework
          for this gives responses that feel hollow.
        </li>
      </ul>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        How Imotara addresses this
      </h2>

      <p>
        Imotara supports 22 languages — 12 Indian languages and 10 global ones — with
        emotion detection built from native script and romanized forms of each language.
        Family duty, social pressure, religious identity are acknowledged, not dismissed.
      </p>

      <p className="mt-8 border-l-2 border-rose-500/40 pl-4 italic text-zinc-400">
        In your language, in the language of your feelings — Imotara is there.
      </p>
    </div>
  );
}

export default function Content({ lang }: { lang?: "en" } = {}) {
  if (lang === "en") return <EnglishContent />;
  return <BengaliContent />;
}
