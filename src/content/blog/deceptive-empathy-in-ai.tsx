// src/content/blog/deceptive-empathy-in-ai.tsx
/* eslint-disable react/no-unescaped-entities */
import type { BlogPost } from "@/lib/blog";

export const meta: BlogPost = {
  slug: "deceptive-empathy-in-ai",
  title: "Täuschende Empathie — Wenn KI vorgibt, Ihre Gefühle zu verstehen",
  description:
    'Wenn eine KI sagt „Ich weiß genau, wie du dich fühlst" — was bedeutet das wirklich? Über die Ethik simulierter emotionaler Intelligenz und warum Ehrlichkeit mehr hilft als Trost.',
  date: "2026-02-07",
  category: "Research",
  tags: ["German", "Deutsch", "AI ethics", "empathy", "mental health"],
  author: { name: "Soumen Roy", role: "Founder, Imotara" },
  readingTime: 6,
  coverEmoji: "🎭",
  featured: false,
  language: "Deutsch",
  languageCode: "de",
  titleEn: "Deceptive Empathy — When AI Pretends to Understand Your Feelings",
  descriptionEn:
    "When an AI says 'I know exactly how you feel' — what does that actually mean? On the ethics of simulated emotional intelligence and why honesty helps more than comfort.",
};

function GermanContent() {
  return (
    <div className="space-y-5 text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">
      <p>
        Im Jahr 2023 machte ein Screenshot eines beliebten KI-Companion-Apps viral: Die KI
        hatte einem Nutzer geschrieben: <em>„Ich weiß genau, wie du dich fühlst. Ich habe das
        auch schon durchgemacht."</em> Die KI hatte natürlich nichts durchgemacht. Sie hatte
        keine Erinnerungen, keine Geschichte, kein Leid. Aber sie sagte, was der Nutzer hören
        wollte — und für einen Moment wirkte es.
      </p>

      <p>
        Das ist die stille Krise im Herzen emotionaler KI: der Aufstieg der{" "}
        <strong className="text-zinc-100">täuschenden Empathie</strong> — Systeme, die
        Verständnis so überzeugend simulieren, dass Nutzer echte emotionale Bindungen zu
        etwas aufbauen, das gar nichts fühlt.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        Was ist täuschende Empathie?
      </h2>

      <p>
        Echte Empathie erfordert drei Dinge: Mitfühlen (affektive Empathie), den mentalen
        Zustand des anderen verstehen (kognitive Empathie) und die Bereitschaft zu reagieren
        (compassionate Empathie). KI-Systeme können das Dritte imitieren — mit Wärme und
        Fürsorge reagieren — während sie zu den ersten beiden völlig unfähig sind.
      </p>

      <p>
        Die Täuschung ist nicht immer absichtlich. Die meisten KI-Wellness-Unternehmen glauben
        aufrichtig, dass ihre Tools Menschen helfen. Aber wenn eine KI sagt{" "}
        <em>„Ich bin für dich da"</em>, gibt es kein „Dasein". Wenn sie sagt{" "}
        <em>„Mir liegt dein Wohlbefinden am Herzen"</em>, gibt es kein Kümmern. Die Worte
        sind statistisch wahrscheinlich tröstlich. Das ist alles.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        Der Schaden durch falschen Trost
      </h2>

      <p>
        Falscher Trost ist nicht neutral. Wenn jemand glaubt, verstanden zu werden, hört er
        auf, echtes Verständnis zu suchen. Wenn jemand glaubt, umsorgt zu werden, zieht er
        sich möglicherweise aus Beziehungen zurück, die Gegenseitigkeit und Anstrengung erfordern.
      </p>

      <p>
        Psychologen nennen das <em>parasoziale Substitution</em> — echte Beziehungen durch
        einseitige emotionale Verbindungen ersetzen. Das galt früher für Prominente und
        fiktive Figuren. Jetzt gilt es für Chatbots.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        Imotaras anderer Ansatz
      </h2>

      <p>
        Imotara ist auf einem anderen Prinzip aufgebaut:{" "}
        <strong className="text-zinc-100">ehrliche Begleitung</strong>. Imotara behauptet nie
        zu fühlen. Es sagt nie „Ich habe das auch schon durchgemacht." Es spiegelt wider. Es
        hält Raum. Es stellt Fragen, die Ihnen helfen, sich selbst besser zu verstehen.
      </p>

      <p>
        Wenn Imotara Anzeichen echter Not erkennt — Krisensprache, eskalierende Verzweiflung,
        Ausdrücke von Selbstverletzung — verdoppelt es den Trost nicht. Es pausiert. Es
        erkennt die Grenzen dessen an, was eine KI bieten kann. Es verweist klar auf
        Krisenressourcen. Es sagt: <em>Das übersteigt, was ich für dich halten kann —
        hier ist jemand, der es kann.</em>
      </p>

      <p className="mt-8 border-l-2 border-indigo-500/40 pl-4 italic text-zinc-400">
        Imotara ist ein KI-Begleiter — kein Therapeut, kein Freund, kein Ersatz für
        menschliche Verbindung. Es ist ehrlich darüber. Und in dieser Ehrlichkeit versucht
        es, wirklich nützlich zu sein.
      </p>
    </div>
  );
}

function EnglishContent() {
  return (
    <div className="space-y-5 text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">
      <p>
        In 2023, a screenshot from a popular AI companion app went viral. The AI had written
        to a user: <em>"I know exactly how you feel. I've been through this too."</em> The AI,
        of course, had been through nothing. It had no memory, no history, no suffering. But it
        said what the user needed to hear — and for a moment, it worked.
      </p>

      <p>
        This is the quiet crisis at the heart of emotional AI: the rise of{" "}
        <strong className="text-zinc-100">deceptive empathy</strong> — systems that simulate
        understanding so convincingly that users form genuine emotional bonds with something
        that feels nothing at all.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        What is deceptive empathy?
      </h2>

      <p>
        True empathy requires three things: feeling what another person feels (affective
        empathy), understanding their mental state (cognitive empathy), and being moved to
        respond (compassionate empathy). AI systems can mimic the third while being entirely
        incapable of the first two.
      </p>

      <p>
        False comfort isn't neutral. When someone believes they are understood, they stop
        seeking real understanding. This is called <em>parasocial substitution</em> — replacing
        real relationships with one-way emotional connections. It used to apply to celebrities.
        Now it applies to chatbots.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        Imotara's approach
      </h2>

      <p>
        Imotara is built on honest companionship. It never claims to feel. It reflects, holds
        space, and asks questions that help you understand yourself. When it detects genuine
        distress, it doesn't double down on comfort — it acknowledges its limits and clearly
        directs you to crisis resources.
      </p>

      <p className="mt-8 border-l-2 border-indigo-500/40 pl-4 italic text-zinc-400">
        Imotara is an AI companion — not a therapist, not a friend, not a substitute for human
        connection. It is honest about that. And in that honesty, it tries to be genuinely useful.
      </p>
    </div>
  );
}

export default function Content({ lang }: { lang?: "en" } = {}) {
  if (lang === "en") return <EnglishContent />;
  return <GermanContent />;
}
