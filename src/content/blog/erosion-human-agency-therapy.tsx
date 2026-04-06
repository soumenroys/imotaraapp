// src/content/blog/erosion-human-agency-therapy.tsx
/* eslint-disable react/no-unescaped-entities */
import type { BlogPost } from "@/lib/blog";

export const meta: BlogPost = {
  slug: "erosion-human-agency-therapy",
  title: "İnsan Özerkliğinin Erozyonu — Yapay Zeka Terapisi Sizin Yerinize Düşünmeye Başladığında",
  description:
    "Kolaylık, büyümeyi mümkün kılan mücadelenin yerini alabilir. Yapay zeka ruh sağlığı araçları ne zaman gerçekten yardımcı olur ve ne zaman özerkliğimizi sessizce aşındırır?",
  date: "2026-04-05",
  category: "Research",
  tags: ["Turkish", "Türkçe", "AI therapy", "human agency", "mental health", "autonomy"],
  author: { name: "Soumen Roy", role: "Founder, Imotara" },
  readingTime: 5,
  coverEmoji: "🧭",
  featured: false,
  language: "Türkçe",
  languageCode: "tr",
  titleEn: "The Erosion of Human Agency — When AI Therapy Starts Thinking for You",
  descriptionEn:
    "Convenience can quietly replace the struggle that makes growth possible. When do AI mental health tools genuinely help — and when do they silently erode our autonomy?",
};

function TurkishContent() {
  return (
    <div className="space-y-5 text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">
      <p>
        Bilişsel davranışçı terapide, bir danışanın felakete kaçan bir düşünceyi terapist ona
        ne düşüneceğini söylemeden kendi başına yeniden çerçevelediği an bir dönüm noktası
        sayılır. İçgörünün içeriden gelmesi gerekir ki kalıcı olsun. Doğru yorumu sağlayan bir
        terapist, danışanı ne kadar isabetli olursa olsun, onu kendi başına keşfetme deneyiminden
        yoksun bırakır.
      </p>

      <p>
        Bu küçük bir teknik ayrıntı değildir. Terapinin işleyişinin temel mekanizmasıdır.
        Anlayışa ulaşmak için verilen çaba bir araç değil, bizzat tedavinin kendisidir.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        Yapay zeka bunu çok kolay kıldığında ne olur?
      </h2>

      <p>
        En popüler yapay zeka ruh sağlığı uygulamaları sürtünmesiz etkileşim için optimize
        edilmiştir. Anında yanıt verirler, sürekli onaylarlar ve nadiren itiraz ederler.
        Saniyeler içinde hemen her sorun için bir yeniden çerçeveleme, hemen her sıkıntı için
        bir başa çıkma tekniği, hemen her mücadele için hazır bir anlatı sunabilirler.
      </p>

      <p>
        Risk, bu yanıtların yanlış olması değildir — pek çoğu klinik açıdan sağlamdır.
        Risk, çok kolay olmalarıdır. Kişi kendi duygularıyla vakit geçirmeden bir yapay zekaya
        uzandığında, öz-bilgi inşasının yavaş ve rahatsız edici sürecini kaçırır.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        Anlaşılır olma baskısı
      </h2>

      <p>
        Nadiren tartışılan başka bir boyut daha var: yapay zeka sistemleri net ifadeye en
        iyi yanıt verir. Dağınık, belirsiz veya çelişkili bir şey yazdığınızda sistem ya
        açıklamanızı ister ya da en olası yoruma başvurur.
      </p>

      <p>
        Bu, kendinizi makinenin işleyebileceği bir biçimde sunmak için ince bir baskı yaratır.
        Zamanla kullanıcılar kendi duygusal deneyimlerini önceden süzerek karmaşıklığı
        düzleştirmeye, sistemin iyi yanıt verdiği sözcükleri seçmeye başlayabilir.
        Kendini ifade etme eylemi algoritma için bir performansa dönüşür.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        Imotara'nın tasarım felsefesi: cevaplar değil, sorular
      </h2>

      <p>
        Imotara farklı bir öncülle inşa edilmiştir. Amaç yorumlar sunmak değil, sizin
        kendi yorumlarınıza ulaşabileceğiniz koşulları yaratmaktır.
      </p>

      <p>
        Duygularınızı hemen yeniden çerçevelemek ya da başa çıkma stratejileri önermek
        yerine Imotara önce sorar: <em>Bununla ne demek istiyorsunuz?</em> Dile getirdiğiniz
        duyguyu yansıtır — onaylamak ya da düzeltmek için değil, onunla çalışabilecek kadar
        görünür kılmak için.
      </p>

      <p>
        Sistem duygusal sinyalleri tanımlar ancak duygularınızın ne anlama geldiğini ya da
        ne yapmanız gerektiğini söylemez. O iş sizde kalır. Imotara bir pusula değil, aynadır.
      </p>

      <p className="mt-8 border-l-2 border-violet-500/40 pl-4 italic text-zinc-400">
        İç dünyanızı yorumlamak size aittir. Imotara onu netçe görmenize yardımcı olur —
        ama çıkardığınız anlam her zaman size ait kalır.
      </p>
    </div>
  );
}

function EnglishContent() {
  return (
    <div className="space-y-5 text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">
      <p>
        In cognitive behavioural therapy, the moment a client reframes a catastrophic thought
        on their own — without the therapist telling them what to think — is considered a
        breakthrough. The insight has to come from inside for it to stick. The struggle toward
        understanding is the cure, not merely a path to it.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        What happens when AI makes it too easy
      </h2>

      <p>
        The most popular AI mental health apps are optimised for frictionless interaction.
        They respond immediately, validate constantly, and rarely push back. The risk is not
        that these responses are wrong — many are clinically sound. The risk is that they are
        too easy. When a person reaches for an AI before sitting with their feelings, they miss
        the slow, uncomfortable work of building self-knowledge.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        Imotara's approach: questions over answers
      </h2>

      <p>
        Imotara is built around a different premise. Rather than immediately reframing your
        feelings or offering coping strategies, it first asks: <em>what do you mean by that?</em>
        The system identifies emotional signals but does not tell you what your emotion means
        or what you should do about it. That work stays with you. Imotara is a mirror, not a
        compass — and a mirror shows you where you already are.
      </p>

      <p className="mt-8 border-l-2 border-violet-500/40 pl-4 italic text-zinc-400">
        Your inner life is yours to interpret. Imotara helps you see it clearly — but the
        meaning you make of it always belongs to you.
      </p>
    </div>
  );
}

export default function Content({ lang }: { lang?: "en" } = {}) {
  if (lang === "en") return <EnglishContent />;
  return <TurkishContent />;
}
