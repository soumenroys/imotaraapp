// src/lib/imotara/nudgeStrings.ts
// Localised strings for re-engagement push notifications.
// Covers all 22 languages Imotara supports.
// The `pb` (personalised body) templates embed the user's own snippet so the
// surrounding template text is the only part that needs translating — the
// snippet itself is already in the user's language.

export type NudgeLang = {
  /** Generic notification title when no prior chat context is available. */
  gt: string;
  /** Generic notification body variants (one picked at random). */
  gb: string[];
  /** Personalised title when the user's last message is available. */
  pt: string;
  /**
   * Personalised body variants — call with the LOCALISED WEEKDAY of the last
   * conversation.
   *
   * ⛔ These must never contain the person's own words. A lock screen is read
   * by whoever picks the phone up: a partner, a parent, a colleague. Quoting
   * someone's message about their mother, their marriage or their diagnosis
   * onto a lock screen can out their use of a mental-health app to the person
   * they are trying to get away from.
   *
   * The weekday is the hook: specific enough that the PERSON knows exactly what
   * is meant, and meaningless to anyone else.
   */
  rb: (day: string) => string[];
};

export const NUDGE_STRINGS: Record<string, NudgeLang> = {
  en: {
    gt: "Imotara misses you 💙",
    gb: [
      "It's been a little while. How are you feeling? I'm here whenever you're ready.",
      "You haven't visited in a couple of days. A moment of reflection can make a big difference.",
      "Whenever you're ready, I'm here to listen.",
      "It's a good time to check in with yourself. Imotara is here.",
    ],
    pt: "Imotara remembers 💙",
    rb: (d) => [
      `There\u2019s something from ${d} I\u2019ve been wondering about.`,
      `Something from ${d} has stayed with me. How are you now?`,
      `I\u2019ve been thinking about ${d}. Want to pick it up?`,
    ],
  },

  hi: {
    gt: "Imotara आपको याद कर रही है 💙",
    gb: [
      "कुछ दिन हो गए। आप कैसे हैं? जब भी तैयार हों, मैं यहाँ हूँ।",
      "आप कुछ दिनों से नहीं आए। एक पल की बात आपको हल्का कर सकती है।",
      "जब भी मन करे, मैं सुनने के लिए यहाँ हूँ।",
      "अपने आप से मिलने का यह अच्छा समय है। Imotara यहाँ है।",
    ],
    pt: "Imotara को याद है 💙",
    rb: (d) => [
      `${d} की एक बात मेरे मन में है।`,
      `${d} की बात मुझे याद है। अब कैसा लग रहा है?`,
      `${d} के बारे में सोच रही थी। बात करें?`,
    ],
  },

  bn: {
    gt: "Imotara আপনাকে মিস করছে 💙",
    gb: [
      "কয়েকদিন হয়ে গেল। আপনি কেমন আছেন? যখন প্রস্তুত, আমি এখানে আছি।",
      "কিছুদিন আসেননি। একটু কথা বললে মন হালকা হয়।",
      "যখন ইচ্ছে, আমি শুনতে এখানে আছি।",
      "নিজেকে একটু সময় দিন। Imotara এখানে আছে।",
    ],
    pt: "Imotara মনে রেখেছে 💙",
    rb: (d) => [
      `${d}-এর একটা কথা আমার মনে আছে।`,
      `${d}-এ যা বলেছিলে, মনে রয়ে গেছে। এখন কেমন লাগছে?`,
      `${d}-এর কথা ভাবছিলাম। একটু বলবে?`,
    ],
  },

  mr: {
    gt: "Imotara तुम्हाला आठवण करते 💙",
    gb: [
      "काही दिवस झाले. तुम्ही कसे आहात? जेव्हा तयार व्हाल, मी इथे आहे।",
      "काही दिवसांत आला नाहीत. एक क्षण बोललात तर मन हलके होईल।",
      "केव्हाही तयार व्हाल, मी ऐकायला इथे आहे।",
      "स्वतःशी बोलण्याची ही चांगली वेळ आहे. Imotara इथे आहे।",
    ],
    pt: "Imotara ला आठवतं 💙",
    rb: (d) => [
      `${d}ची एक गोष्ट माझ्या मनात आहे.`,
      `${d}चं बोलणं लक्षात राहिलं. आता कसं वाटतंय?`,
      `${d}बद्दल विचार करत होते. बोलूया?`,
    ],
  },

  ta: {
    gt: "Imotara உங்களை நினைக்கிறது 💙",
    gb: [
      "சில நாட்கள் ஆகிவிட்டன. நீங்கள் எப்படி இருக்கிறீர்கள்? தயாரானதும் நான் இங்கே இருக்கிறேன்.",
      "சில நாட்களாக வரவில்லை. ஒரு நிமிடம் பேசினால் மனம் லேசாகும்.",
      "எப்போது வேண்டுமானாலும், நான் கேட்க இங்கே இருக்கிறேன்.",
      "உங்களுக்காக கொஞ்சம் நேரம் ஒதுக்குங்கள். Imotara இங்கே இருக்கிறது.",
    ],
    pt: "Imotara நினைவில் வைத்திருக்கிறது 💙",
    rb: (d) => [
      `${d} அன்று பேசியது மனதில் இருக்கிறது.`,
      `${d} அன்றைய விஷயம் நினைவில் உள்ளது. இப்போது எப்படி இருக்கிறீர்கள்?`,
      `${d} பற்றி யோசித்துக் கொண்டிருந்தேன். பேசலாமா?`,
    ],
  },

  te: {
    gt: "Imotara మీకోసం ఆలోచిస్తోంది 💙",
    gb: [
      "కొన్ని రోజులు అయింది. మీరు ఎలా ఉన్నారు? సిద్ధంగా ఉన్నప్పుడు, నేను ఇక్కడ ఉన్నాను.",
      "కొన్ని రోజులుగా రాలేదు. కొంచెం మాట్లాడితే మనసు తేలికవుతుంది.",
      "ఎప్పుడైనా, నేను వినడానికి ఇక్కడ ఉన్నాను.",
      "మీ మనసుతో మాట్లాడే సమయం ఇది. Imotara ఇక్కడ ఉంది.",
    ],
    pt: "Imotara గుర్తు పట్టింది 💙",
    rb: (d) => [
      `${d} నాటి ఒక విషయం నా మనసులో ఉంది.`,
      `${d} నాడు చెప్పినది గుర్తుంది. ఇప్పుడు ఎలా ఉంది?`,
      `${d} గురించి ఆలోచిస్తున్నాను. మాట్లాడదామా?`,
    ],
  },

  gu: {
    gt: "Imotara તમને યાદ કરે છે 💙",
    gb: [
      "ઘણા દિવસ થઈ ગયા. તમે કેમ છો? જ્યારે તૈયાર હો, ત્યારે હું અહીં છું.",
      "થોડા દિવસથી આવ્યા નથી. થોડી વાત કરો, મન હળવું થઈ જશે.",
      "જ્યારે ઇચ્છો ત્યારે, સાંભળવા માટે હું અહીં છું.",
      "પોતાની સાથે સમય વિતાવો. Imotara અહીં છે.",
    ],
    pt: "Imotara ને યાદ છે 💙",
    rb: (d) => [
      `${d}ની એક વાત મારા મનમાં છે.`,
      `${d}ની વાત યાદ રહી ગઈ. અત્યારે કેવું લાગે છે?`,
      `${d} વિશે વિચારતી હતી. વાત કરીએ?`,
    ],
  },

  kn: {
    gt: "Imotara ನಿಮ್ಮನ್ನು ನೆನಪಿಸಿಕೊಳ್ಳುತ್ತಿದೆ 💙",
    gb: [
      "ಕೆಲವು ದಿನಗಳಾದವು. ನೀವು ಹೇಗಿದ್ದೀರಿ? ತಯಾರಾದಾಗ, ನಾನಿದ್ದೇನೆ.",
      "ಕೆಲವು ದಿನದಿಂದ ಬರಲಿಲ್ಲ. ಒಂದಿಷ್ಟು ಮಾತನಾಡಿದರೆ ಮನಸ್ಸು ಹಗುರವಾಗುತ್ತದೆ.",
      "ಯಾವಾಗ ಬೇಕಾದರೂ, ಕೇಳಲು ನಾನಿದ್ದೇನೆ.",
      "ನಿಮ್ಮ ಮನಸ್ಸಿನೊಂದಿಗೆ ಕಾಲ ಕಳೆಯಿರಿ. Imotara ಇಲ್ಲಿದೆ.",
    ],
    pt: "Imotara ನೆನಪಿಟ್ಟಿದೆ 💙",
    rb: (d) => [
      `${d} ದಿನದ ಒಂದು ವಿಷಯ ನನ್ನ ಮನಸ್ಸಿನಲ್ಲಿದೆ.`,
      `${d} ಹೇಳಿದ್ದು ನೆನಪಿದೆ. ಈಗ ಹೇಗನಿಸುತ್ತಿದೆ?`,
      `${d} ಬಗ್ಗೆ ಯೋಚಿಸುತ್ತಿದ್ದೆ. ಮಾತಾಡೋಣವೇ?`,
    ],
  },

  ml: {
    gt: "Imotara നിങ്ങളെ ഓർക്കുന്നു 💙",
    gb: [
      "കുറച്ചു ദിവസങ്ങളായി. നിങ്ങൾ എങ്ങനെ ഉണ്ട്? തയ്യാറായ നേരത്ത്, ഞാൻ ഇവിടെ ഉണ്ട്.",
      "കുറച്ചു ദിവസമായി കണ്ടിട്ട്. ഒന്നു സംസാരിച്ചാൽ മനസ്സ് ഹൃദ്യമാകും.",
      "എപ്പോൾ വേണമെങ്കിലും, കേൾക്കാൻ ഞാൻ ഇവിടെ ഉണ്ട്.",
      "സ്വയം ഒന്ന് ശ്രദ്ധിക്കാനുള്ള നേരം. Imotara ഇവിടെ ഉണ്ട്.",
    ],
    pt: "Imotara ഓർക്കുന്നു 💙",
    rb: (d) => [
      `${d} പറഞ്ഞ ഒരു കാര്യം മനസ്സിലുണ്ട്.`,
      `${d} പറഞ്ഞത് ഓർമ്മയിലുണ്ട്. ഇപ്പോൾ എങ്ങനെയുണ്ട്?`,
      `${d} കുറിച്ച് ആലോചിക്കുകയായിരുന്നു. സംസാരിക്കാമോ?`,
    ],
  },

  pa: {
    gt: "Imotara ਤੁਹਾਨੂੰ ਯਾਦ ਕਰ ਰਹੀ ਹੈ 💙",
    gb: [
      "ਕੁਝ ਦਿਨ ਹੋ ਗਏ। ਤੁਸੀਂ ਕਿਵੇਂ ਹੋ? ਜਦੋਂ ਤਿਆਰ ਹੋਵੋ, ਮੈਂ ਇੱਥੇ ਹਾਂ।",
      "ਕੁਝ ਦਿਨਾਂ ਤੋਂ ਨਹੀਂ ਆਏ। ਥੋੜੀ ਗੱਲ ਕਰੋ, ਮਨ ਹਲਕਾ ਹੋ ਜਾਵੇਗਾ।",
      "ਜਦੋਂ ਚਾਹੋ, ਸੁਣਨ ਲਈ ਮੈਂ ਇੱਥੇ ਹਾਂ।",
      "ਆਪਣੇ ਆਪ ਨਾਲ ਸਮਾਂ ਬਿਤਾਓ। Imotara ਇੱਥੇ ਹੈ।",
    ],
    pt: "Imotara ਨੂੰ ਯਾਦ ਹੈ 💙",
    rb: (d) => [
      `${d} ਦੀ ਇੱਕ ਗੱਲ ਮੇਰੇ ਮਨ ਵਿੱਚ ਹੈ।`,
      `${d} ਦੀ ਗੱਲ ਯਾਦ ਰਹੀ। ਹੁਣ ਕਿਵੇਂ ਲੱਗ ਰਿਹਾ ਹੈ?`,
      `${d} ਬਾਰੇ ਸੋਚ ਰਹੀ ਸੀ। ਗੱਲ ਕਰੀਏ?`,
    ],
  },

  or: {
    gt: "Imotara ଆପଣଙ୍କୁ ମନ ପକାଉଛି 💙",
    gb: [
      "କିଛି ଦିନ ହୋଇଗଲା। ଆପଣ କେମିତି ଅଛନ୍ତି? ଯେତେବେଳେ ପ୍ରସ୍ତୁତ, ମୁଁ ଏଠି ଅଛି।",
      "କିଛି ଦିନ ହେଲା ଆସୁ ନାହଁ। ଥୋଡ଼ା ଆଲୋଚନା ଓ ମନ ହାଲୁକା ହେବ।",
      "ଯେତେବେଳେ ଇଚ୍ଛା ହୁଏ, ଶୁଣିବ ପ୍ରସ୍ତୁତ।",
      "ନିଜ ସହ ଅଳ୍ପ ସମୟ କଟାନ୍ତୁ। Imotara ଏଠି ଅଛି।",
    ],
    pt: "Imotara ମନେ ଅଛି 💙",
    rb: (d) => [
      `${d} ର ଗୋଟିଏ କଥା ମୋ ମନରେ ଅଛି।`,
      `${d} ରେ କହିଥିବା କଥା ମନେ ଅଛି। ଏବେ କେମିତି ଲାଗୁଛି?`,
      `${d} ବିଷୟରେ ଭାବୁଥିଲି। କଥା ହେବା?`,
    ],
  },

  ar: {
    gt: "Imotara تفتقدك 💙",
    gb: [
      "مرّت أيام. كيف حالك؟ أنا هنا في أي وقت تحتاجني.",
      "لم تزر منذ بضعة أيام. لحظة للحديث تستطيع أن تخفّف عنك الكثير.",
      "متى ما كنت مستعدًا، أنا هنا للاستماع.",
      "خصّص لنفسك لحظة. Imotara هنا.",
    ],
    pt: "Imotara تتذكر 💙",
    rb: (d) => [
      `هناك شيء من يوم ${d} ما زلت أفكر فيه.`,
      `ما قلته يوم ${d} بقي في بالي. كيف حالك الآن؟`,
      `كنت أفكر في يوم ${d}. نتحدث؟`,
    ],
  },

  ur: {
    gt: "Imotara آپ کو یاد کر رہی ہے 💙",
    gb: [
      "کچھ دن ہو گئے۔ آپ کیسے ہیں؟ جب بھی تیار ہوں، میں یہاں ہوں۔",
      "کچھ دنوں سے نہیں آئے۔ تھوڑی بات کریں، دل ہلکا ہو جائے گا۔",
      "جب چاہیں، سننے کے لیے میں یہاں ہوں۔",
      "اپنے ساتھ وقت گزاریں۔ Imotara یہاں ہے۔",
    ],
    pt: "Imotara کو یاد ہے 💙",
    rb: (d) => [
      `${d} کی ایک بات میرے ذہن میں ہے۔`,
      `${d} کو جو کہا تھا، یاد رہ گیا۔ اب کیسا لگ رہا ہے؟`,
      `${d} کے بارے میں سوچ رہی تھی۔ بات کریں؟`,
    ],
  },

  ru: {
    gt: "Imotara скучает по вам 💙",
    gb: [
      "Прошло несколько дней. Как вы себя чувствуете? Я здесь, когда будете готовы.",
      "Вас не было несколько дней. Одна беседа может облегчить душу.",
      "Когда будете готовы, я здесь, чтобы выслушать.",
      "Уделите себе минуту. Imotara здесь.",
    ],
    pt: "Imotara помнит 💙",
    rb: (d) => [
      `Есть кое-что с ${d}, о чём я думаю.`,
      `То, что вы сказали в ${d}, осталось со мной. Как вы сейчас?`,
      `Я думала о ${d}. Поговорим?`,
    ],
  },

  zh: {
    gt: "Imotara 在想念你 💙",
    gb: [
      "已经好几天了。你还好吗？随时准备好了，我在这里。",
      "你有几天没来了。说说话，心里会轻松一些。",
      "无论何时，我都在这里倾听你。",
      "给自己一点时间。Imotara 在这里。",
    ],
    pt: "Imotara 还记得 💙",
    rb: (d) => [
      `${d}的一件事我一直记着。`,
      `${d}你说的话我还记得。现在感觉怎么样？`,
      `我一直在想${d}的事。要聊聊吗？`,
    ],
  },

  ja: {
    gt: "Imotara があなたを思っています 💙",
    gb: [
      "しばらく経ちましたね。お元気ですか？いつでも準備ができたら、ここにいます。",
      "数日ぶりです。少し話すと、気持ちが楽になりますよ。",
      "いつでも、聴いています。",
      "自分自身と向き合う時間を。Imotara はここにいます。",
    ],
    pt: "Imotara は覚えています 💙",
    rb: (d) => [
      `${d}のことが、ずっと心に残っています。`,
      `${d}に話してくれたこと、覚えています。今はどうですか？`,
      `${d}のこと、考えていました。少し話しませんか。`,
    ],
  },

  es: {
    gt: "Imotara te echa de menos 💙",
    gb: [
      "Han pasado unos días. ¿Cómo estás? Aquí estoy cuando estés listo/a.",
      "Llevas unos días sin venir. Un momento de conversación puede aliviar mucho.",
      "Cuando estés listo/a, aquí estoy para escucharte.",
      "Tómate un momento para ti. Imotara está aquí.",
    ],
    pt: "Imotara recuerda 💙",
    rb: (d) => [
      `Hay algo del ${d} en lo que he estado pensando.`,
      `Algo del ${d} se me quedó. ¿Cómo estás ahora?`,
      `He estado pensando en el ${d}. ¿Hablamos?`,
    ],
  },

  fr: {
    gt: "Imotara pense à vous 💙",
    gb: [
      "Quelques jours ont passé. Comment allez-vous ? Je suis là quand vous êtes prêt(e).",
      "Vous n'êtes pas venu(e) depuis quelques jours. Un moment de partage peut faire beaucoup de bien.",
      "Quand vous êtes prêt(e), je suis là pour vous écouter.",
      "Prenez un moment pour vous. Imotara est là.",
    ],
    pt: "Imotara se souvient 💙",
    rb: (d) => [
      `Il y a quelque chose de ${d} auquel je repense.`,
      `Quelque chose de ${d} m\u2019est resté. Comment allez-vous maintenant ?`,
      `Je repensais à ${d}. On en parle ?`,
    ],
  },

  de: {
    gt: "Imotara denkt an dich 💙",
    gb: [
      "Ein paar Tage sind vergangen. Wie geht es dir? Ich bin hier, wenn du bereit bist.",
      "Du warst ein paar Tage nicht da. Ein kurzes Gespräch kann sehr helfen.",
      "Wann immer du möchtest, bin ich zum Zuhören da.",
      "Gönn dir einen Moment. Imotara ist für dich da.",
    ],
    pt: "Imotara erinnert sich 💙",
    rb: (d) => [
      `Da ist etwas von ${d}, worüber ich nachgedacht habe.`,
      `Etwas von ${d} ist mir geblieben. Wie geht es Ihnen jetzt?`,
      `Ich habe an ${d} gedacht. Wollen wir reden?`,
    ],
  },

  pt: {
    gt: "Imotara está com saudades de você 💙",
    gb: [
      "Já faz alguns dias. Como você está? Estou aqui quando estiver pronto/a.",
      "Você não veio há alguns dias. Uma conversa rápida pode aliviar muito.",
      "Quando estiver pronto/a, estou aqui para ouvir.",
      "Reserve um momento para você. Imotara está aqui.",
    ],
    pt: "Imotara se lembra 💙",
    rb: (d) => [
      `Há algo de ${d} em que tenho pensado.`,
      `Algo de ${d} ficou comigo. Como está agora?`,
      `Tenho pensado em ${d}. Conversamos?`,
    ],
  },

  id: {
    gt: "Imotara merindukanmu 💙",
    gb: [
      "Sudah beberapa hari. Bagaimana kabarmu? Aku di sini kapan pun kamu siap.",
      "Kamu sudah beberapa hari tidak datang. Sedikit bicara bisa meringankan hati.",
      "Kapan pun kamu siap, aku di sini untuk mendengarkan.",
      "Luangkan waktu sejenak untuk dirimu. Imotara ada di sini.",
    ],
    pt: "Imotara ingat 💙",
    rb: (d) => [
      `Ada sesuatu dari hari ${d} yang masih saya pikirkan.`,
      `Sesuatu dari ${d} masih terasa. Bagaimana kabarmu sekarang?`,
      `Saya memikirkan ${d}. Mau cerita?`,
    ],
  },

  he: {
    gt: "Imotara מתגעגעת אליך 💙",
    gb: [
      "עברו כמה ימים. איך אתה/את? אני כאן כשתהיה/תהיי מוכן/ה.",
      "לא ביקרת כמה ימים. שיחה קצרה יכולה להקל הרבה.",
      "כשתהיה/תהיי מוכן/ה, אני כאן להקשיב.",
      "תן/תני לעצמך רגע. Imotara כאן.",
    ],
    pt: "Imotara זוכרת 💙",
    rb: (d) => [
      `יש משהו מ${d} שאני עדיין חושבת עליו.`,
      `משהו מ${d} נשאר איתי. איך את/ה מרגיש/ה עכשיו?`,
      `חשבתי על ${d}. רוצה לדבר?`,
    ],
  },
};

/** Returns strings for the given lang, falling back to English. */
export function getNudgeLang(lang: string | undefined | null): NudgeLang {
  if (!lang) return NUDGE_STRINGS.en;
  // Handle locale variants like "en-IN", "zh-TW" — use the base code
  const base = lang.split(/[-_]/)[0].toLowerCase();
  return NUDGE_STRINGS[base] ?? NUDGE_STRINGS.en;
}

/** Pick a random item from an array. */
export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}
