// src/content/blog/digital-twin-anxiety.tsx
import type { BlogPost } from "@/lib/blog";

export const meta: BlogPost = {
  slug: "digital-twin-anxiety",
  title: "デジタルツイン不安 — AIがあなたのメンタルヘルスを先読みするとき",
  description:
    "AIはうつ病の発症を9ヶ月前に予測できる。しかし、アルゴリズムに自分の精神的未来をラベル付けされることは、それ自体が一種の害になり得る。",
  date: "2026-03-29",
  category: "Research",
  tags: ["Japanese", "日本語", "predictive AI", "mental health", "digital twin", "privacy"],
  author: { name: "Soumen Roy", role: "Founder, Imotara" },
  readingTime: 5,
  coverEmoji: "🔮",
  featured: false,
  language: "日本語",
  languageCode: "ja",
  titleEn: "Digital Twin Anxiety — When AI Predicts Your Mental Health Before You Do",
  descriptionEn:
    "Predictive AI can flag depression before a person feels it. But being labelled by an algorithm before you understand yourself can be its own form of harm.",
};

function JapaneseContent() {
  return (
    <div className="space-y-5 text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">
      <p>
        2022年、米国の大学の研究者がある研究を発表しました。AIモデルがスマートフォンの使用パターンだけを使って、
        うつ病の発症を臨床診断の9ヶ月前に85%の精度で予測できたというものです。
        タイピング速度、メッセージ間隔、SNSの使用頻度、GPSによる移動データ。それだけで。
      </p>

      <p>
        この発見は画期的な成果として称賛されました。しかし、論文に埋もれていた問いに誰も向き合いませんでした。
        <em>モデルが間違えた学生はどうなるのか？</em> そして正しく予測された学生は——
        同意もしないまま、アルゴリズムが自分の精神的未来について下した評決と共に生きることになります。
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        「デジタルツイン」の問題
      </h2>

      <p>
        デジタルツインとは、現実の物体をデータモデルで模倣したものです。橋がストレス下でどう振る舞うか、
        タービンが経年劣化でどう故障するかをシミュレーションするために工学で使われています。
        同じ論理が今、人間の精神にも適用されようとしています。
      </p>

      <p>
        予測型メンタルヘルスAIは、あなたのデータ——言語、行動、生理的シグナル——からモデルを構築し、
        心理的な未来を予測します。理論上は早期介入が可能になります。しかし実際には、
        間違っているかもしれず、あなたには見えず、あなたの知らないところで他者が行動に移すかもしれない、
        あなたの「影の分身」が生まれます。
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        予測が自己成就的予言になるとき
      </h2>

      <p>
        より微妙な危険もあります。リスクがあると告げられること自体がリスクを生むのです。
        健康心理学の研究は一貫して示しています——診断ラベルは行動とアイデンティティを形成します。
        アプリに「うつ病への高い脆弱性」を示唆されたと知った学生は、普通の悲しみを症状として解釈し始め、
        自己評価を下げ、脅威に感じる状況から遠ざかるかもしれません。予測されたまさにその結果を
        加速させながら。
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        Imotaraが異なるアプローチをとる理由
      </h2>

      <p>
        Imotaraは感情の検出を行いますが、予測プロファイリングとは正反対の方向で機能します。
        データのパターンから将来の心理状態を予測するのではなく、Imotaraはあなたが<em>今この瞬間
        自分の言葉で共有することを選んだもの</em>を受け取ります。
      </p>

      <p>
        感情分析は<em>あなた自身</em>がリアルタイムで自分を理解するためのものです——プロファイルを
        構築するためでも、予測するためでも、ラベルを貼るためでもありません。
        あなたの感情データはリスクスコアを生成するモデルに入力されません。洞察はあなたの元に留まります。
      </p>

      <p className="mt-8 border-l-2 border-violet-500/40 pl-4 italic text-zinc-400">
        あなたは予測されたリスクスコアではありません。Imotaraは今のあなたが誰であるかを
        理解する手助けをします——アルゴリズムがあなたが何者になるかもしれないと考えるものではなく。
      </p>
    </div>
  );
}

function EnglishContent() {
  return (
    <div className="space-y-5 text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">
      <p>
        In 2022, a researcher at a major US university described a study in which an AI model
        predicted the onset of depression in college students with 85% accuracy — nine months
        before clinical diagnosis. The model used nothing more than smartphone usage patterns:
        typing speed, time between messages, social app activity, and movement data from GPS.
      </p>

      <p>
        The finding was celebrated as a breakthrough. But buried in the paper was a question
        nobody seemed to ask: <em>what happens to the students the model is wrong about?</em>
        And what happens to the ones it gets right — who now live with an algorithmic verdict
        about their future mental state that they never consented to?
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        The "digital twin" problem
      </h2>

      <p>
        A digital twin is a data model that mirrors a real-world object. The same logic is
        now being applied to human minds. Predictive mental health AI builds a model of you
        from your data and uses it to forecast your psychological future. In practice, it creates
        a shadow version of you that may be wrong, that you cannot see, and that others may act
        on without your knowledge.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        Why Imotara takes a different approach
      </h2>

      <p>
        Imotara uses emotion detection — but it works in the opposite direction from predictive
        profiling. Rather than forecasting your future psychological state, Imotara works with
        what you <em>choose to share right now</em>, in your own words. The insight stays with
        you. There are no predictions. There are no verdicts.
      </p>

      <p className="mt-8 border-l-2 border-violet-500/40 pl-4 italic text-zinc-400">
        You are not your predicted risk score. Imotara exists to help you understand who you
        are right now — not who an algorithm thinks you might become.
      </p>
    </div>
  );
}

export default function Content({ lang }: { lang?: "en" } = {}) {
  if (lang === "en") return <EnglishContent />;
  return <JapaneseContent />;
}
