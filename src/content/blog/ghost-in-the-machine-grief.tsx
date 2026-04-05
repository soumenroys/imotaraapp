// src/content/blog/ghost-in-the-machine-grief.tsx
import type { BlogPost } from "@/lib/blog";

export const meta: BlogPost = {
  slug: "ghost-in-the-machine-grief",
  title: "机器中的幽灵 — 失去、记忆与AI",
  description:
    "技术开始模拟已故的人。在我们接受AI悲伤工具之前，我们需要问：它们让我们付出了什么代价，又夺走了什么？",
  date: "2026-04-10",
  category: "Mental Health",
  tags: ["Chinese", "中文", "grief", "AI ethics", "memory", "loss"],
  author: { name: "Soumen Roy", role: "Founder, Imotara" },
  readingTime: 6,
  coverEmoji: "🕯️",
  featured: false,
  language: "中文",
  languageCode: "zh",
  titleEn: "The Ghost in the Machine — Grief, Memory, and AI After Loss",
  descriptionEn:
    "Technology is beginning to simulate the dead. Before we embrace AI grief tools, we need to ask what they cost us — and what they take away.",
};

function ChineseContent() {
  return (
    <div className="space-y-5 text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">
      <p>
        2021年，一部韩国纪录片展示了一位母亲用VR技术与她两年前因罕见疾病去世的女儿"相见"的过程。
        那个数字重建的形象会动，用她的声音说话，说出她可能会说的话。母亲泪流满面，伸手想要触碰她。
      </p>

      <p>
        这段画面被数百万人观看。反应几乎对半分裂——一半人觉得它美丽，另一半人觉得它令人不安。
      </p>

      <p>
        这种分裂不是品味上的分歧。它是一条断层线，穿过我们面临的一些最根本的问题：当AI
        开始有能力模拟我们失去的人，我们应当如何面对？
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        技术已经到来——而且在加速
      </h2>

      <p>
        AI悼念服务现在已商业化。公司提供用逝者的短信、邮件和社交媒体帖子训练聊天机器人的服务。
        语音克隆可以从几分钟的音频中复现一个人的语音模式。一些服务走得更远，从已知的风格和
        个性中推断出逝者从未说过的回应。
      </p>

      <p>
        推销词充满同情心：它缓解了失去的冲击，延长了与某人在完全离去前相处的时间，让你能说
        出那些没来得及说的话。对某些人、在某些情况下，它可能确实有所帮助。
      </p>

      <p>
        但这项技术也有能力做一件悲伤研究认为有害的事情：打断放手的过程。
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        悲伤的本质是什么
      </h2>

      <p>
        悲伤的目的——尽管这话说起来很痛苦——是完成一种逐渐的重新定向。与逝者形成的纽带不会消失。
        但随着时间流逝，并有支持陪伴，它们会转变：从期待身体存在，变成一种保存在记忆、意义和
        内心表征中的关系。
      </p>

      <p>
        完整地处理完的悲伤，是某个失去的人成为被携带之人的机制。一个随时可以交谈的模拟，
        可能会干扰这种转变。它提供了一个替代对象——一个能回应的、似乎存在的、在缺席变得难以承受
        时可以回归的对象。而正因为它缓解了那种难以承受，它可能阻止悲伤者穿越其中。
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        Imotara的立场
      </h2>

      <p>
        Imotara不是悲伤模拟工具，也永远不会成为悲伤模拟工具。它能做到的——也是研究表明在
        悲伤中真正有用的——是提供一个空间，让失去亲人者可以用现在时态表达自己的感受。
      </p>

      <p>
        悲伤不主要是沟通缺失的问题。它不能通过与逝者进行更多对话来解决。它的解决方式是——
        缓慢地、非线性地、痛苦地——处理<em>你自己</em>在失去的余波中所经历的。
      </p>

      <p>
        Imotara的作用是陪伴你——不是重建你失去的人，而是在你还在失去他们的过程中，
        陪伴现在的你。
      </p>

      <p className="mt-8 border-l-2 border-amber-500/40 pl-4 italic text-zinc-400">
        有些缺失无法——也不应该——被填补。Imotara不会尝试。它只是在你找到承载方式的过程中，
        陪伴着你。
      </p>
    </div>
  );
}

function EnglishContent() {
  return (
    <div className="space-y-5 text-sm leading-7 text-zinc-300 sm:text-base sm:leading-8">
      <p>
        In 2021, a Korean documentary showed a mother using VR technology to "meet" her daughter,
        who had died two years earlier. The digital reconstruction moved, spoke in her voice, and
        said things she might have said. The mother, in tears, reached out to touch her. Reactions
        from millions of viewers split almost exactly down the middle between those who found it
        beautiful and those who found it deeply disturbing.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        What grief is actually for
      </h2>

      <p>
        The purpose of grief — painful as this is to say — is to accomplish a gradual
        reorientation. The bonds formed with the deceased transform over time: from the expectation
        of physical presence to a relationship held in memory, meaning, and internal representation.
        A simulation that can be talked to at any time may interrupt this transformation, providing
        a substitute that eases the unbearability — and precisely because it eases it, prevents
        the bereaved from moving through it.
      </p>

      <h2 className="mt-8 text-base font-semibold text-zinc-100 sm:text-lg">
        Where Imotara stands
      </h2>

      <p>
        Imotara is not a grief simulation tool, and it will never be one. What it can do is
        provide a space where the bereaved person can express what they are feeling in the present
        tense. Grief is resolved — slowly, non-linearly, painfully — by processing what
        <em> you</em> are experiencing in the aftermath of loss. Imotara's role is to hold space
        for that — not to replace the person it's about.
      </p>

      <p className="mt-8 border-l-2 border-amber-500/40 pl-4 italic text-zinc-400">
        Some absences cannot — and should not — be filled. Imotara doesn't try to. It simply
        stays with you while you find a way to carry yours.
      </p>
    </div>
  );
}

export default function Content({ lang }: { lang?: "en" } = {}) {
  if (lang === "en") return <EnglishContent />;
  return <ChineseContent />;
}
