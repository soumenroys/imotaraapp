// src/content/blog/algorithmic-gaslighting.tsx
import type { BlogPost } from "@/lib/blog";

export const meta: BlogPost = {
  slug: "algorithmic-gaslighting",
  title: "Gaslighting Algoritmico — Quando l'AI Ti Fa Dubitare delle Tue Emozioni",
  description:
    "I sistemi di AI addestrati su dati collettivi possono sottilmente invalidare la tua esperienza individuale. Capire questa dinamica è il primo passo per resistere.",
  date: "2026-04-08",
  category: "Research",
  tags: ["Italian", "Italiano", "gaslighting", "AI bias", "emotional validation"],
  author: { name: "Soumen Roy", role: "Founder, Imotara" },
  readingTime: 6,
  coverEmoji: "🪞",
  featured: false,
  language: "Italiano",
  languageCode: "it",
  titleEn: "Algorithmic Gaslighting — When AI Makes You Doubt Your Own Emotions",
  descriptionEn:
    "AI systems trained on population-level data can subtly invalidate your individual experience. Understanding this dynamic is the first step to resisting it.",
};

function ItalianContent() {
  return (
    <div className="space-y-5 text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">
      <p>
        Il gaslighting, nel senso clinico del termine, è un meccanismo di manipolazione
        psicologica in cui una persona viene indotta a dubitare della propria percezione della
        realtà. Il termine si è diffuso nell'uso comune — a volte in modo impreciso — ma il suo
        significato fondamentale è preciso: la tua esperienza è reale, ma qualcuno con potere
        su di te ti sta dicendo che non lo è.
      </p>

      <p>
        Una versione di questa dinamica si sta manifestando su larga scala, mediata non da
        individui abusivi ma da sistemi di AI che elaborano il tuo input emotivo e restituiscono
        una risposta modellata sui dati di milioni di altre persone.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        Come i sistemi di AI ti normalizzano contro
      </h2>

      <p>
        I modelli linguistici sono addestrati su testi prodotti da grandi popolazioni. I pattern
        che apprendono — quali emozioni sono "appropriate" in una data situazione, come devono
        essere espresse, come appare una risposta "sana" — riflettono la media statistica di
        quei dati di addestramento.
      </p>

      <p>
        Quando la tua esperienza si discosta da quella media, il sistema potrebbe non
        contraddirla esplicitamente. Ma risponderà in modi che assumono la media. Proporrà
        tecniche di coping pensate per presentazioni tipiche. Userà un linguaggio che mappa
        la tua esperienza su categorie familiari. Suggerirà che stai "pensando troppo" quando
        la tua sofferenza non si adatta allo schema standard.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        Il problema della cancellazione culturale e contestuale
      </h2>

      <p>
        Questo effetto non è distribuito uniformemente. Le persone la cui esperienza emotiva
        è già sottorappresentata nei dati di addestramento — per il loro background culturale,
        lingua, genere, età o neurodiversità — hanno più probabilità di incontrare risposte
        che sembrano fuori luogo.
      </p>

      <p>
        Per questi utenti, il gaslighting algoritmico è strutturale: il sistema è stato costruito
        senza tenerli in mente, e ora implicitamente dice loro che il loro modo di sentire è
        insolito, difficile, o non del tutto giusto.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        Cosa fa Imotara di diverso
      </h2>

      <p>
        Imotara è progettato con l'intento specifico di non normalizzarti contro la tua esperienza.
        L'analisi emotiva non viene utilizzata per determinare se le tue emozioni sono "corrette"
        o "proporzionate". Viene utilizzata per capire ciò che hai espresso — al livello delle
        tue parole specifiche, non di una categoria emotiva generalizzata.
      </p>

      <p>
        Il sistema supporta 22 lingue, inclusi dialetti e varianti che la maggior parte degli
        strumenti emotivi di AI ignora completamente. Il vocabolario emotivo che riconosce
        include idiomi culturalmente specifici — l'arabo <em>"qalbi mithqal"</em>, l'hindi
        <em> "dil bhaari hai"</em>, il portoghese <em>"coração apertado"</em> — che non si
        traducono facilmente nei quadri clinici occidentali, ma che portano un significato
        emotivo preciso e importante.
      </p>

      <p className="mt-8 border-l-2 border-rose-500/40 pl-4 italic text-zinc-400">
        Le tue emozioni non sono valori anomali statistici. Sono tue. Imotara è stato costruito
        per incontrarsi dove sei — non dove si troverebbe la persona media.
      </p>
    </div>
  );
}

function EnglishContent() {
  return (
    <div className="space-y-5 text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">
      <p>
        Gaslighting, in the clinical sense, is a pattern of manipulation in which a person is
        made to question their own perception of reality. A version of this dynamic is now
        emerging at scale, mediated not by abusive individuals but by AI systems trained on
        millions of other people's data.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        How AI systems normalise against you
      </h2>

      <p>
        Language models learn what emotions are "appropriate" in a given situation based on the
        statistical average of their training data. When your experience deviates from that average,
        the system doesn't explicitly contradict you — but it responds as if the average applies.
        It suggests you're "overthinking" when your distress doesn't fit the standard pattern.
        The cumulative effect: you feel vaguely unrecognised, start reshaping your words toward
        what the system understands, and gradually drift from the texture of your actual experience.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        What Imotara does differently
      </h2>

      <p>
        Imotara is designed not to normalise against you. The emotion analysis is used to
        understand what you expressed — at the level of your specific words, not a generalised
        category. It supports 22 languages with culturally-specific emotional vocabulary that
        most AI emotion tools ignore entirely.
      </p>

      <p className="mt-8 border-l-2 border-rose-500/40 pl-4 italic text-zinc-400">
        Your emotions are not statistical outliers. They are yours. Imotara was built to meet
        you where you are — not where the average person would be.
      </p>
    </div>
  );
}

export default function Content({ lang }: { lang?: "en" } = {}) {
  if (lang === "en") return <EnglishContent />;
  return <ItalianContent />;
}
