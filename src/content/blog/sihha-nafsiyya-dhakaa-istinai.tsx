// src/content/blog/sihha-nafsiyya-dhakaa-istinai.tsx
import type { BlogPost } from "@/lib/blog";

export const meta: BlogPost = {
  slug: "sihha-nafsiyya-dhakaa-istinai",
  title: "الصحة النفسية والذكاء الاصطناعي — هل يمكن لآلة أن تفهم ألمك؟",
  description:
    "في عالم يتسارع فيه الذكاء الاصطناعي، كيف نحافظ على صحتنا النفسية؟ عن العلاقة بين التكنولوجيا والمشاعر الإنسانية في الثقافة العربية.",
  date: "2026-03-22",
  category: "Mental Health",
  tags: ["Arabic", "العربية", "صحة نفسية", "ذكاء اصطناعي", "emotional wellness"],
  author: { name: "فريق إيموتارا", role: "Imotara Team" },
  readingTime: 6,
  coverEmoji: "🌙",
  featured: true,
  language: "العربية",
  languageCode: "ar",
  titleEn: "Mental Health and AI — Can a Machine Understand Your Pain?",
  descriptionEn:
    "In a world accelerating with AI, how do we protect our mental health? On the relationship between technology and human emotion in Arab cultures.",
};

function ArabicContent() {
  return (
    <div className="space-y-5 text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">
      {/* Arabic content - RTL */}
      <div dir="rtl" className="space-y-5 text-right font-[system-ui]">
        <p>
          تخيّل أنك تمرّ بليلة صعبة. القلق يثقل صدرك، والأفكار تتسارع في رأسك،
          ولا تجد أحداً تتحدث إليه في تلك الساعة المتأخرة من الليل. تفتح تطبيقاً
          للذكاء الاصطناعي، وتكتب ما تشعر به. يردّ عليك فوراً:{" "}
          <em>"أنا أفهم تماماً ما تمرّ به."</em>
        </p>

        <p>لكن هل يفهم حقاً؟</p>

        <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
          الصحة النفسية في الثقافة العربية — سياق خاص
        </h2>

        <p>
          في كثير من المجتمعات العربية، لا تزال الصحة النفسية تحمل وصمةً اجتماعية.
          الحديث عن الاكتئاب أو القلق قد يُقابَل بـ"تقوَّ على نفسك" أو "اتكل على الله
          وستمرّ". ليس هذا تجاهلاً للألم — بل هو تعبير ثقافي عن طريقة التعامل معه.
        </p>

        <p>
          لكن الواقع أن ملايين الشباب العربي يعانون في صمت. يحملون أثقال التوقعات
          الأسرية، وضغوط العمل، والعزلة في المدن الكبرى — وكثيرٌ منهم لا يجدون
          مساحةً آمنة للتعبير عن ذلك.
        </p>

        <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
          ما الذي يجعل تطبيق الصحة النفسية جيداً للمستخدم العربي؟
        </h2>

        <p>
          ليس كافياً أن يترجم التطبيق ردوده إلى العربية. الصحة النفسية تتشكّل بالثقافة.
          التعبير عن الحزن بالعربية يختلف عن الإنجليزية — نقول "قلبي مثقل" لا
          "أشعر بالاكتئاب". نقول "روحي تعبانة" لا "أعاني من إرهاق عاطفي".
        </p>

        <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
          كيف يتعامل إيموتارا مع هذا؟
        </h2>

        <p>
          إيموتارا يدعم اللغة العربية — سواء بالخط العربي الأصيل أو بالحروف اللاتينية
          (الـ Arabizi). يكتشف النظام تلقائياً اللغة التي تكتب بها ويستجيب بنفس السياق.
        </p>

        <p>
          والأهم: إيموتارا لا يدّعي أنه يشعر. ما يفعله هو أنه يساعدك على{" "}
          <strong className="text-zinc-100">فهم نفسك</strong> — يطرح الأسئلة الصحيحة،
          يعكس ما تقوله بطريقة تساعدك على رؤيته بوضوح أكثر.
        </p>
      </div>

      <p className="mt-8 border-r-2 border-amber-500/40 pr-4 text-right italic text-zinc-400" dir="rtl">
        مشاعرك حقيقية بكل لغة تتحدث بها. إيموتارا هنا — يسمعك.
      </p>
    </div>
  );
}

function EnglishContent() {
  return (
    <div className="space-y-5 text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">
      <p>
        Imagine going through a difficult night. Anxiety weighs on your chest, thoughts race
        through your mind, and there is no one to talk to at that late hour. You open an AI app
        and write what you feel. It responds immediately: <em>"I completely understand what you're
        going through."</em>
      </p>

      <p>But does it really understand?</p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        Mental health in Arab cultures — a specific context
      </h2>

      <p>
        In many Arab societies, mental health still carries social stigma. Talking about
        depression or anxiety may be met with "be strong" or "trust in God and it will pass."
        This is not a dismissal of pain — it is a cultural expression of how to handle it.
      </p>

      <p>
        But the reality is that millions of young Arab people suffer in silence. They carry
        the weight of family expectations, work pressures, and urban isolation — and many find
        no safe space to express this.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        What makes a good mental health app for Arabic speakers?
      </h2>

      <p>
        It is not enough for an app to translate its responses into Arabic. Mental health is
        shaped by culture. Expressing sadness in Arabic is different from English — we say
        <em> "qalbi mithqal"</em> (my heart is heavy), not "I feel depressed." We say{" "}
        <em>"rouhi ta'bana"</em> (my soul is tired), not "I'm experiencing emotional fatigue."
        These linguistic differences carry real psychological distinctions.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        How Imotara approaches this
      </h2>

      <p>
        Imotara supports Arabic — both in native Arabic script and in Arabizi (Arabic written
        in Latin characters, widely used by younger Arabic speakers). The system automatically
        detects the language you write in and responds within the same linguistic context.
      </p>

      <p>
        Most importantly: Imotara does not claim to feel. What it does instead is help you
        understand yourself — asking the right questions, reflecting what you say in a way that
        helps you see it more clearly. When it detects that what you're experiencing goes beyond
        what a digital tool can offer, it clearly guides you toward specialised help.
      </p>

      <p className="mt-8 border-l-2 border-amber-500/40 pl-4 italic text-zinc-400">
        Your feelings are real in every language you speak. Imotara is listening.
      </p>
    </div>
  );
}

export default function Content({ lang }: { lang?: "en" } = {}) {
  if (lang === "en") return <EnglishContent />;
  return <ArabicContent />;
}
