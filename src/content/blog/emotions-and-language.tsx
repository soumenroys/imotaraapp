// src/content/blog/emotions-and-language.tsx
import type { BlogPost } from "@/lib/blog";

export const meta: BlogPost = {
  slug: "emotions-and-language",
  title: "Emoções e Linguagem — Por Que as Palavras Que Escolhemos Moldam o Que Sentimos",
  description:
    "A linguagem não apenas descreve emoções — ela as molda. Por que o Imotara suporta 22 idiomas e como isso protege quem sente em português mas pensa em inglês.",
  date: "2026-01-29",
  category: "Mental Health",
  tags: ["Portuguese", "language", "emotions", "multilingual", "emoções"],
  author: { name: "Soumen Roy", role: "Founder, Imotara" },
  readingTime: 5,
  coverEmoji: "🌍",
  featured: false,
  language: "Português",
  languageCode: "pt",
  titleEn: "Emotions and Language — How the Words We Choose Shape What We Feel",
  descriptionEn:
    "Language doesn't just describe emotions — it shapes them. Why Imotara supports 22 languages and how it protects those who feel in one language but work in another.",
};

function PortugueseContent() {
  return (
    <div className="space-y-5 text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">
      <p>
        Existe uma palavra em português — <em>saudade</em> — que descreve um anseio melancólico
        profundo por algo ou alguém que amamos e que está ausente. O inglês não tem uma palavra
        única para isso. Nem o hindi. Mas o sentimento existe em todos os idiomas.
      </p>

      <p>
        A linguagem não apenas descreve emoções. Ela as molda. As palavras disponíveis para você
        determinam, em parte, com que precisão você consegue identificar o que está sentindo —
        e pesquisas sugerem que nomear uma emoção reduz sua intensidade. "Nomeie para dominar",
        como diz o neurocientista Dan Siegel.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        O problema das ferramentas emocionais só em inglês
      </h2>

      <p>
        A maioria das ferramentas de bem-estar com IA foi criada para falantes de inglês.
        O vocabulário emocional é inglês. As respostas são em inglês. Os pressupostos sobre
        como as pessoas expressam sofrimento — as metáforas, as referências culturais, a
        intensidade da linguagem — estão enraizados em um contexto ocidental anglófono.
      </p>

      <p>
        Isso cria uma lacuna real. Para quem pensa em português, sente mais naturalmente
        em seu idioma materno ou alterna entre idiomas no meio de uma conversa, uma ferramenta
        que só entende inglês compreende apenas uma parte de você.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        O vocabulário emocional do português
      </h2>

      <p>
        Além de <em>saudade</em>, o português tem expressões que resistem à tradução direta:
        "estou com o coração apertado" (meu coração está comprimido), "a cabeça está pesada"
        (minha cabeça está pesada — como quando pensamentos demais se acumulam), "tô com um
        peso na alma" (carrego um peso na alma). Cada uma dessas expressões carrega nuances
        emocionais que uma tradução literal apaga.
      </p>

      <p>
        Quando você usa essas expressões com uma IA que as traduz mas não as compreende,
        algo se perde. Não apenas palavras — mas a precisão emocional que permite que você
        seja verdadeiramente ouvido.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        Como o Imotara aborda isso
      </h2>

      <p>
        O Imotara suporta 22 idiomas — incluindo português do Brasil e de Portugal. O suporte
        de idioma não é apenas tradução. É reconhecimento.
      </p>

      <p>
        Quando você escreve "tô péssimo, não consigo sair do buraco", o Imotara não traduz
        para o equivalente clínico em inglês antes de responder. Ele trabalha com a expressão
        como ela chegou — no idioma e no registro em que foi escrita.
      </p>

      <p>
        O vocabulário emocional — as palavras que o Imotara usa para reconhecer sofrimento,
        tristeza, ansiedade, esperança — é construído a partir de padrões em script nativo e
        formas romanizadas de cada idioma suportado.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        Por que isso importa para a segurança emocional
      </h2>

      <p>
        Para muitas pessoas — especialmente em famílias multilíngues e comunidades de
        imigrantes — o idioma em que você sente e o idioma que usa no trabalho são diferentes.
        A segurança emocional muitas vezes existe na língua materna. É nessa língua que você
        não precisa primeiro se traduzir.
      </p>

      <p className="mt-8 border-l-2 border-indigo-500/40 pl-4 italic text-zinc-400">
        Seus sentimentos são válidos em todos os idiomas que você fala. O Imotara está
        ouvindo em todos eles.
      </p>
    </div>
  );
}

function EnglishContent() {
  return (
    <div className="space-y-5 text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">
      <p>
        There is a word in Portuguese — <em>saudade</em> — that describes a deep, melancholic
        longing for something or someone you love that is absent. English doesn't have a single
        word for this. Neither does Hindi. But the feeling exists in every language.
      </p>

      <p>
        Language doesn't just describe emotions. It shapes them. The words available to you
        determine, in part, how precisely you can identify what you're feeling — and research
        suggests that naming an emotion reduces its intensity. "Name it to tame it," as
        neuroscientist Dan Siegel puts it.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        The problem with English-only emotional AI
      </h2>

      <p>
        Most AI wellness tools are built for English speakers. If you think in Portuguese,
        feel most naturally in your mother tongue, or switch languages mid-sentence, a tool
        that only understands your words in English is only understanding part of you.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        How Imotara approaches this
      </h2>

      <p>
        Imotara supports 22 languages — including Brazilian and European Portuguese. Language
        support isn't just translation. It's recognition. The system works with your expression
        as it arrives — in the language and register in which it was written. Your feelings are
        valid in every language you speak. Imotara is listening in all of them.
      </p>

      <p className="mt-8 border-l-2 border-indigo-500/40 pl-4 italic text-zinc-400">
        Emotional safety often lives in the mother tongue. Imotara is the space where you don't
        have to translate yourself first.
      </p>
    </div>
  );
}

export default function Content({ lang }: { lang?: "en" } = {}) {
  if (lang === "en") return <EnglishContent />;
  return <PortugueseContent />;
}
