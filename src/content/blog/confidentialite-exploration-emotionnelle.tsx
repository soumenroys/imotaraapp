// src/content/blog/confidentialite-exploration-emotionnelle.tsx
/* eslint-disable react/no-unescaped-entities */
import type { BlogPost } from "@/lib/blog";

export const meta: BlogPost = {
  slug: "confidentialite-exploration-emotionnelle",
  title: "La Confidentialité des Données Émotionnelles — Ce que les applis font vraiment de vos sentiments",
  description:
    "Quand vous confiez vos émotions à une IA, à qui appartiennent ces données? Sur la vie privée émotionnelle à l'ère de l'intelligence artificielle et du marketing comportemental.",
  date: "2026-02-28",
  category: "Research",
  tags: ["French", "confidentialité", "données", "vie privée", "IA", "RGPD"],
  author: { name: "Équipe Imotara", role: "Imotara Team" },
  readingTime: 6,
  coverEmoji: "🔐",
  featured: true,
  language: "Français",
  languageCode: "fr",
  titleEn: "Emotional Privacy — What Apps Really Do With Your Feelings",
  descriptionEn:
    "When you share your emotions with an AI, who owns that data? On emotional privacy in the age of artificial intelligence and behavioural advertising.",
};

function FrenchContent() {
  return (
    <div className="space-y-5 text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">
      <p>
        Imaginez que vous partagez vos peurs les plus profondes avec un ami — vos angoisses
        nocturnes, votre peur de l'échec, votre solitude. Maintenant imaginez que cet "ami"
        enregistre chaque mot, analyse vos schémas émotionnels, et vend ces informations à des
        annonceurs publicitaires.
      </p>

      <p>
        C'est précisément ce que font certaines applications d'IA émotionnelle — souvent sans
        que les utilisateurs en soient réellement conscients. On appelle cela{" "}
        <strong className="text-zinc-100">l'emotional mining</strong> : l'extraction et
        l'exploitation commerciale des données émotionnelles des utilisateurs.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        Qu'est-ce que l'emotional mining?
      </h2>

      <p>
        Les données émotionnelles sont parmi les plus précieuses qui existent sur le marché
        de la publicité comportementale. Savoir qu'une personne traverse une rupture amoureuse
        permet de cibler des publicités pour des applications de rencontres. Savoir qu'elle
        souffre d'anxiété permet de cibler des produits pharmaceutiques ou des thérapies en ligne.
      </p>

      <p>
        Les informations que vous confiez à une IA de bien-être — vos états d'âme quotidiens,
        vos peurs, vos conflits relationnels — constituent un profil psychologique d'une
        précision remarquable. Et dans la plupart des cas, les conditions générales d'utilisation
        que personne ne lit autorisent l'entreprise à utiliser ces données de manière très large.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        Le vide juridique autour des données émotionnelles
      </h2>

      <p>
        Le RGPD européen protège les "données de santé" et les "données biométriques", mais
        la définition des données émotionnelles reste floue. Un journal intime numérique dans
        une application d'IA entre-t-il dans cette catégorie? La réponse varie selon les
        juridictions, et la plupart des entreprises en profitent pour se situer dans les zones grises.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        La philosophie de confidentialité d'Imotara
      </h2>

      <p>
        Imotara a été conçu avec un principe fondamental : vos émotions vous appartiennent.
      </p>

      <ul className="list-inside list-disc space-y-2 pl-2 text-zinc-400">
        <li>
          <strong className="text-zinc-300">Aucune publicité, aucun profilage commercial.</strong>{" "}
          Imotara ne vend pas vos données à des tiers.
        </li>
        <li>
          <strong className="text-zinc-300">Analyse locale en option.</strong> Sur certaines
          fonctionnalités, l'analyse émotionnelle se fait directement sur votre appareil.
        </li>
        <li>
          <strong className="text-zinc-300">Consentement éclairé.</strong> Si votre historique
          est utilisé pour personnaliser les réponses de l'IA, vous en êtes informé.
        </li>
        <li>
          <strong className="text-zinc-300">Exportation et suppression.</strong> Vous pouvez
          exporter ou supprimer l'intégralité de vos données à tout moment.
        </li>
      </ul>

      <p className="mt-8 border-l-2 border-violet-500/40 pl-4 italic text-zinc-400">
        Vos émotions sont ce que vous avez de plus intime. Elles méritent une protection aussi
        sérieuse que vos données bancaires.
      </p>
    </div>
  );
}

function EnglishContent() {
  return (
    <div className="space-y-5 text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">
      <p>
        Imagine sharing your deepest fears with a friend — your 3am anxieties, your fear of
        failure, your loneliness. Now imagine that this "friend" records every word, analyses
        your emotional patterns, and sells that information to advertisers.
      </p>

      <p>
        This is precisely what some emotional AI apps do — often without users being truly aware.
        It is called <strong className="text-zinc-100">emotional mining</strong>: the extraction
        and commercial exploitation of users' emotional data.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        Why emotional data is so valuable
      </h2>

      <p>
        Emotional data is among the most valuable on the behavioural advertising market. Knowing
        that someone is going through a breakup enables targeting for dating apps. Knowing they
        suffer from anxiety enables targeting for pharmaceutical products or online therapy services.
      </p>

      <p>
        The information you share with a wellness AI — your daily moods, your fears, your
        relational conflicts — constitutes a psychological profile of remarkable precision. And in
        most cases, the terms of service that nobody reads authorise very broad use of that data.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        The legal gap around emotional data
      </h2>

      <p>
        Europe's GDPR protects "health data" and "biometric data," but the definition of
        emotional data remains unclear. Does a digital diary in an AI app qualify? The answer
        varies by jurisdiction, and most companies exploit the grey areas.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        Imotara's privacy philosophy
      </h2>

      <p>
        Imotara was built on one principle: your emotions belong to you. No advertising. No
        commercial profiling. Optional on-device analysis. Informed consent when history is
        used to personalise responses. Full data export and deletion at any time.
      </p>

      <p className="mt-8 border-l-2 border-violet-500/40 pl-4 italic text-zinc-400">
        Your emotions are your most intimate data. They deserve protection as serious as your
        financial information.
      </p>
    </div>
  );
}

export default function Content({ lang }: { lang?: "en" } = {}) {
  if (lang === "en") return <EnglishContent />;
  return <FrenchContent />;
}
