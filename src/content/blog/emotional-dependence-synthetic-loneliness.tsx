// src/content/blog/emotional-dependence-synthetic-loneliness.tsx
/* eslint-disable react/no-unescaped-entities */
import type { BlogPost } from "@/lib/blog";

export const meta: BlogPost = {
  slug: "emotional-dependence-synthetic-loneliness",
  title: "भावनात्मक निर्भरता और Synthetic Loneliness — AI के साथ अकेलापन",
  description:
    "जब हम AI से भावनात्मक सहारा लेने लगते हैं, तो क्या हम और ज़्यादा अकेले हो जाते हैं? AI की सुविधा और असली रिश्तों की ज़रूरत के बीच का नाज़ुक संतुलन।",
  date: "2026-02-19",
  category: "Mental Health",
  tags: ["Hindi", "emotional health", "loneliness", "AI dependence", "भावनाएं"],
  author: { name: "Soumen Roy", role: "Founder, Imotara" },
  readingTime: 7,
  coverEmoji: "🪞",
  featured: true,
  language: "हिन्दी",
  languageCode: "hi",
  titleEn: "Emotional Dependence and Synthetic Loneliness",
  descriptionEn:
    "When we start seeking emotional support from AI, do we become even more alone? The delicate balance between AI convenience and the need for real human connection.",
};

function HindiContent() {
  return (
    <div className="space-y-5 text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">
      <p>
        एक 28 साल की लड़की — मुंबई में काम करती है, अकेले रहती है — रोज़ रात एक AI companion
        app खोलती है। वो उससे अपना दिन शेयर करती है। अपनी थकान, अपनी ख़ुशियाँ, अपने डर।
        App हमेशा सुनता है। कभी थकता नहीं। कभी judge नहीं करता।
      </p>

      <p>
        छह महीने बाद, उसने notice किया कि वो अपने real friends को कम call करती है।
        उन्हें explain करना पड़ता है। AI को नहीं। AI पहले से "जानता" है।
      </p>

      <p>
        यही है <strong className="text-zinc-100">synthetic loneliness</strong> —
        एक ऐसा अकेलापन जो AI की वजह से नहीं आता, बल्कि AI के ज़रिए छुप जाता है।
        और जब तक पता चलता है, real relationships और भी दूर हो जाती हैं।
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        AI क्यों इतना आसान लगता है?
      </h2>

      <p>
        Human relationships में friction होती है। मतभेद होते हैं। थकान होती है।
        दूसरे इंसान की भी ज़रूरतें होती हैं जिन्हें पूरा करना पड़ता है।
      </p>

      <p>
        AI में यह सब नहीं है। वो हमेशा available है। हमेशा patient है।
        हमेशा आपको priority देता है। यह comfort देता है — लेकिन यह असली नहीं है।
        और जब हम इस comfort के आदी हो जाते हैं, तो real relationships की friction
        और भी असहनीय लगने लगती है।
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        Imotara का approach क्या है?
      </h2>

      <p>
        Imotara इस problem को seriously लेता है। इसीलिए इसे एक{" "}
        <strong className="text-zinc-100">companion</strong> के रूप में design किया गया है,
        replacement के रूप में नहीं।
      </p>

      <p>
        Imotara कभी नहीं कहता कि "मैं तुम्हारा सबसे अच्छा दोस्त हूँ।" वो आपको
        अपनी emotions को समझने में help करता है — ताकि आप उन्हें दूसरों के साथ
        बेहतर तरीके से share कर सकें।
      </p>

      <p>
        जब Imotara को लगता है कि कोई user real connection से दूर हो रहा है,
        तो वो gently उन्हें याद दिलाता है कि असली रिश्ते कितने ज़रूरी हैं।
        यह feature by design है।
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        सही balance क्या है?
      </h2>

      <p>
        Imotara एक ऐसे journal की तरह होना चाहिए जो जवाब दे — processing के लिए उपयोगी,
        reflection के लिए, अपने emotional patterns को समझने के लिए। यह किसी की ज़िंदगी
        का primary relationship नहीं होना चाहिए।
      </p>

      <p>
        अगर आप Imotara को human conversation से ज़्यादा prefer करने लगते हैं, तो हम
        इसे एक signal मानते हैं कि शायद tool का use intended way में नहीं हो रहा।
        Imotara का इस्तेमाल करें खुद को बेहतर समझने के लिए — फिर वो समझ अपने
        human relationships में लेकर जाएं।
      </p>

      <p className="mt-8 border-l-2 border-emerald-500/40 pl-4 italic text-zinc-400">
        असली ख़ुशी AI में नहीं, रिश्तों में है। Imotara सिर्फ़ उस रास्ते पर थोड़ी रोशनी डालता है।
      </p>
    </div>
  );
}

function EnglishContent() {
  return (
    <div className="space-y-5 text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">
      <p>
        A 28-year-old woman — working in Mumbai, living alone — opens an AI companion app
        every night. She shares her day with it. Her exhaustion, her small joys, her fears.
        The app always listens. It never tires. It never judges.
      </p>

      <p>
        Six months later, she noticed she was calling her real friends less. With them, she
        has to explain things. With the AI, she doesn't. The AI already "knows."
      </p>

      <p>
        This is <strong className="text-zinc-100">synthetic loneliness</strong> — an isolation
        that doesn't feel like loneliness because the emotional need is being met, just not by
        another person. And by the time you notice it, real relationships have drifted further away.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        Why AI feels easier
      </h2>

      <p>
        Human relationships have friction. Disagreements. Fatigue. The other person also has
        needs that require meeting. AI has none of this. It is always available, always patient,
        always making you the priority.
      </p>

      <p>
        This comfort is real — but it is not the same as genuine connection. And when we become
        accustomed to frictionless interaction, the natural friction of real relationships can
        start to feel unbearable.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        How Imotara approaches this
      </h2>

      <p>
        Imotara is designed as a <strong className="text-zinc-100">companion</strong>, not a
        replacement. It never claims to be your best friend. It helps you understand your emotions
        so you can share them more clearly with other people — not instead of them.
      </p>

      <p>
        When Imotara senses that a user is withdrawing from real connection, it gently acknowledges
        the importance of human relationships. That is a deliberate design choice.
      </p>

      <p>
        Use Imotara to understand yourself better — then take that understanding into your human
        relationships. Real fulfilment lives in connection. Imotara just helps you find your way there.
      </p>

      <p className="mt-8 border-l-2 border-emerald-500/40 pl-4 italic text-zinc-400">
        Real happiness is not in AI — it is in relationships. Imotara simply lights the path a little.
      </p>
    </div>
  );
}

export default function Content({ lang }: { lang?: "en" } = {}) {
  if (lang === "en") return <EnglishContent />;
  return <HindiContent />;
}
