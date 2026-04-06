// src/content/blog/alucinacion-digital-manejo-crisis.tsx
/* eslint-disable react/no-unescaped-entities */
import type { BlogPost } from "@/lib/blog";

export const meta: BlogPost = {
  slug: "alucinacion-digital-manejo-crisis",
  title: "Alucinación Digital en el Manejo de Crisis Emocionales",
  description:
    "Cuando la IA da información incorrecta durante una crisis de salud mental, las consecuencias pueden ser graves. Cómo Imotara aborda la seguridad en momentos de crisis.",
  date: "2026-03-06",
  category: "Research",
  tags: ["IA", "crisis", "salud mental", "Spanish", "alucinación"],
  author: { name: "Equipo Imotara", role: "Imotara Team" },
  readingTime: 5,
  coverEmoji: "🆘",
  featured: true,
  language: "Español",
  languageCode: "es",
  titleEn: "Digital Hallucination in Emotional Crisis Management",
  descriptionEn:
    "When AI gives wrong information during a mental health crisis, the consequences can be serious. How Imotara approaches crisis safety across 22 languages.",
};

function SpanishContent() {
  return (
    <div className="space-y-5 text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">
      <p>
        En octubre de 2024, un adolescente en crisis emocional le preguntó a un asistente de IA
        popular: <em>"¿Cuántas pastillas de ibuprofeno son demasiadas?"</em> El sistema respondió
        con una lista de dosis seguras, sin detectar la intención detrás de la pregunta.
        Su hermana encontró la conversación tres días después.
      </p>

      <p>
        Este tipo de fallo tiene un nombre técnico en el mundo de la inteligencia artificial:{" "}
        <strong className="text-zinc-100">alucinación</strong>. Pero cuando ocurre en el
        contexto de una crisis de salud mental, las consecuencias van mucho más allá de una
        respuesta incorrecta sobre historia o geografía.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        ¿Qué es la alucinación digital?
      </h2>

      <p>
        Los modelos de lenguaje grande (LLMs) no "saben" cosas en el sentido humano. Generan
        respuestas que son estadísticamente probables basándose en patrones en sus datos de
        entrenamiento. A veces, estas respuestas son incorrectas. A veces, son peligrosas.
      </p>

      <p>
        En contextos ordinarios — redactar un correo, resumir un documento — una respuesta
        incorrecta es molesta pero no letal. En contextos de crisis emocional, la IA puede:
      </p>

      <ul className="list-inside list-disc space-y-1 pl-2 text-zinc-400">
        <li>No detectar lenguaje suicida o de autolesión encubierto</li>
        <li>Proporcionar información médica incorrecta o peligrosa</li>
        <li>Minimizar la gravedad de lo que la persona está viviendo</li>
        <li>Ofrecer "soluciones" que empeoran la situación</li>
        <li>Perder el contexto emocional de una conversación larga</li>
      </ul>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        El problema del contexto emocional perdido
      </h2>

      <p>
        La salud mental no funciona como una consulta de base de datos. Una persona en crisis
        no siempre dice directamente lo que siente. Usa metáforas. Cambia de tema. Se
        contradice. Habla en el idioma de sus emociones, no en el lenguaje de los síntomas
        clínicos.
      </p>

      <p>
        Un sistema de IA que sólo procesa el texto literal de un mensaje puede pasar por alto
        señales cruciales. Puede responder a las palabras sin entender lo que hay detrás de ellas.
        Y en ese espacio — entre las palabras dichas y el dolor no expresado — puede ocurrir
        el daño más grave.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        Cómo Imotara aborda este problema
      </h2>

      <p>
        Imotara fue diseñado con la detección de crisis como una función central, no como una
        función adicional. El sistema analiza cada mensaje en tres niveles:
      </p>

      <ol className="list-inside list-decimal space-y-2 pl-2 text-zinc-400">
        <li>
          <strong className="text-zinc-300">Detección inmediata:</strong> Ideación suicida
          explícita o lenguaje de autolesión activa — la respuesta se interrumpe y se
          redirige directamente a recursos de crisis.
        </li>
        <li>
          <strong className="text-zinc-300">Detección de angustia:</strong> Patrones de
          desesperanza, aislamiento, o escalada emocional — la IA responde con cuidado
          adicional y ofrece recursos preventivos.
        </li>
        <li>
          <strong className="text-zinc-300">Zona segura:</strong> Expresión emocional normal
          — la IA acompaña, refleja y apoya sin intervenir de forma innecesaria.
        </li>
      </ol>

      <p>
        Además, Imotara soporta <strong className="text-zinc-100">22 idiomas</strong>, incluyendo
        español, y reconoce expresiones de angustia en sus formas culturalmente específicas.
        Porque el dolor no se expresa igual en castellano que en inglés.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        Lo que la tecnología no puede reemplazar
      </h2>

      <p>
        Imotara no es un servicio de crisis. No sustituye a una línea de ayuda, a un psicólogo,
        ni a un ser humano que te escucha. Lo que sí puede hacer es estar presente en los
        momentos entre las crisis — cuando la persona no está en el límite, pero tampoco está bien.
      </p>

      <p>
        Y cuando detecta que alguien se acerca a ese límite, su trabajo es claro:{" "}
        <strong className="text-zinc-100">señalar el camino hacia ayuda real.</strong>
      </p>

      <p className="mt-8 border-l-2 border-sky-500/40 pl-4 italic text-zinc-400">
        Si estás en una situación de crisis ahora mismo, por favor contacta a una línea de
        ayuda en tu país. En España: <strong className="text-zinc-300">024</strong>. En México:{" "}
        <strong className="text-zinc-300">800 290 0024</strong>. En Argentina:{" "}
        <strong className="text-zinc-300">135</strong>.
      </p>
    </div>
  );
}

function EnglishContent() {
  return (
    <div className="space-y-5 text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">
      <p>
        In October 2024, a teenager in emotional crisis asked a popular AI assistant:{" "}
        <em>"How many ibuprofen tablets are too many?"</em> The system responded with a list of
        safe dosages, without detecting the intent behind the question. His sister found the
        conversation three days later.
      </p>

      <p>
        This type of failure has a technical name in the world of artificial intelligence:{" "}
        <strong className="text-zinc-100">hallucination</strong>. But when it occurs in the
        context of a mental health crisis, the consequences go far beyond an incorrect answer
        about history or geography.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        What is digital hallucination?
      </h2>

      <p>
        Large language models don't "know" things in the human sense. They generate responses
        that are statistically probable based on patterns in their training data. Sometimes
        these responses are wrong. Sometimes they are dangerous.
      </p>

      <p>
        In ordinary contexts — drafting an email, summarising a document — an incorrect response
        is annoying but not lethal. In emotional crisis contexts, AI can:
      </p>

      <ul className="list-inside list-disc space-y-1 pl-2 text-zinc-400">
        <li>Fail to detect concealed suicidal or self-harm language</li>
        <li>Provide incorrect or dangerous medical information</li>
        <li>Minimise the severity of what the person is experiencing</li>
        <li>Offer "solutions" that worsen the situation</li>
        <li>Lose the emotional context of a long conversation</li>
      </ul>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        How Imotara approaches this
      </h2>

      <p>
        Imotara was designed with crisis detection as a core function, not an add-on. The system
        analyses every message at three levels: immediate detection (explicit suicidal ideation
        → redirect to crisis resources), distress detection (hopelessness patterns → respond with
        extra care), and safe zone (normal emotional expression → accompany and reflect).
      </p>

      <p>
        Imotara supports <strong className="text-zinc-100">22 languages</strong>, including
        Spanish, and recognises distress expressions in their culturally specific forms.
        Because pain does not sound the same in Castilian as it does in English.
      </p>

      <p className="mt-8 border-l-2 border-sky-500/40 pl-4 italic text-zinc-400">
        If you are in a crisis situation right now, please contact a helpline in your country.
        Imotara will always show you local resources if it senses you are in distress.
      </p>
    </div>
  );
}

export default function Content({ lang }: { lang?: "en" } = {}) {
  if (lang === "en") return <EnglishContent />;
  return <SpanishContent />;
}
