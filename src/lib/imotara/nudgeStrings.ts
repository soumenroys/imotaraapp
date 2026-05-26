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
  /** Personalised body variants — call with the user's last-message snippet. */
  pb: (s: string) => string[];
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
    pb: (s) => [
      `You mentioned "${s}" — how has that been going? I'm here whenever you're ready 💙`,
      `Last time you shared something about "${s}" — I've been thinking about you 💙`,
      `"${s}" — that's been on my mind. How are you feeling about it now? 💙`,
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
    pb: (s) => [
      `आपने "${s}" का ज़िक्र किया था — अब कैसा चल रहा है? मैं यहाँ हूँ 💙`,
      `पिछली बार "${s}" के बारे में बताया था — मैं आपके बारे में सोच रही थी 💙`,
      `"${s}" — यह मेरे मन में था। अब आप कैसा महसूस कर रहे हैं? 💙`,
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
    pb: (s) => [
      `আপনি "${s}" এর কথা বলেছিলেন — এখন কেমন চলছে? আমি এখানে আছি 💙`,
      `গতবার "${s}" নিয়ে শেয়ার করেছিলেন — আমি আপনার কথা ভাবছিলাম 💙`,
      `"${s}" — এটা আমার মনে ছিল। এখন কেমন লাগছে? 💙`,
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
    pb: (s) => [
      `तुम्ही "${s}" बद्दल सांगितलं होतं — आता कसं चाललंय? मी इथे आहे 💙`,
      `मागच्या वेळी "${s}" बद्दल बोललात — मी तुमच्याबद्दल विचार करत होते 💙`,
      `"${s}" — हे माझ्या मनात होतं. आता तुम्हाला कसं वाटतंय? 💙`,
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
    pb: (s) => [
      `நீங்கள் "${s}" பற்றி சொன்னீர்கள் — இப்போது எப்படி இருக்கிறது? நான் இங்கே இருக்கிறேன் 💙`,
      `கடந்த முறை "${s}" பற்றி பகிர்ந்தீர்கள் — உங்களை நினைத்துக்கொண்டிருந்தேன் 💙`,
      `"${s}" — இது என் மனதில் இருந்தது. இப்போது எப்படி உணர்கிறீர்கள்? 💙`,
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
    pb: (s) => [
      `మీరు "${s}" గురించి చెప్పారు — అది ఇప్పుడు ఎలా ఉంది? నేను ఇక్కడ ఉన్నాను 💙`,
      `గత సారి "${s}" గురించి పంచుకున్నారు — మీ గురించి ఆలోచిస్తున్నాను 💙`,
      `"${s}" — అది నా మనసులో ఉంది. ఇప్పుడు మీకు ఎలా అనిపిస్తోంది? 💙`,
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
    pb: (s) => [
      `તમે "${s}" વિશે કહ્યું હતું — હવે કેવું ચાલે છે? હું અહીં છું 💙`,
      `છેલ્લી વખત "${s}" વિશે વાત કરી — હું તમારા વિશે વિચારી રહ્યો/રહ્યી છું 💙`,
      `"${s}" — આ મારા મનમાં હતું. હવે તમને કેવું લાગે છે? 💙`,
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
    pb: (s) => [
      `ನೀವು "${s}" ಬಗ್ಗೆ ಹೇಳಿದ್ದಿರಿ — ಈಗ ಅದು ಹೇಗಿದೆ? ನಾನಿದ್ದೇನೆ 💙`,
      `ಕಳೆದ ಬಾರಿ "${s}" ಬಗ್ಗೆ ಹಂಚಿಕೊಂಡಿದ್ದಿರಿ — ನಿಮ್ಮ ಬಗ್ಗೆ ಯೋಚಿಸುತ್ತಿದ್ದೆ 💙`,
      `"${s}" — ಇದು ನನ್ನ ಮನಸ್ಸಿನಲ್ಲಿತ್ತು. ಈಗ ನಿಮಗೆ ಹೇಗೆ ಅನಿಸುತ್ತಿದೆ? 💙`,
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
    pb: (s) => [
      `നിങ്ങൾ "${s}" പറഞ്ഞിരുന്നു — ഇപ്പോൾ എങ്ങനെ ഉണ്ട്? ഞാൻ ഇവിടെ ഉണ്ട് 💙`,
      `കഴിഞ്ഞ തവണ "${s}" പങ്കുവെച്ചിരുന്നു — നിങ്ങളെ ഓർത്തുകൊണ്ടിരുന്നു 💙`,
      `"${s}" — ഇത് എന്റെ മനസ്സിൽ ഉണ്ടായിരുന്നു. ഇപ്പോൾ എങ്ങനെ തോന്നുന്നു? 💙`,
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
    pb: (s) => [
      `ਤੁਸੀਂ "${s}" ਬਾਰੇ ਕਿਹਾ ਸੀ — ਹੁਣ ਕਿਵੇਂ ਚੱਲ ਰਿਹਾ ਹੈ? ਮੈਂ ਇੱਥੇ ਹਾਂ 💙`,
      `ਪਿਛਲੀ ਵਾਰ "${s}" ਬਾਰੇ ਦੱਸਿਆ ਸੀ — ਮੈਂ ਤੁਹਾਡੇ ਬਾਰੇ ਸੋਚ ਰਹੀ ਸੀ 💙`,
      `"${s}" — ਇਹ ਮੇਰੇ ਮਨ ਵਿੱਚ ਸੀ। ਹੁਣ ਤੁਸੀਂ ਕਿਵੇਂ ਮਹਿਸੂਸ ਕਰਦੇ ਹੋ? 💙`,
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
    pb: (s) => [
      `ଆପଣ "${s}" ବିଷୟରେ କହିଥିଲେ — ଏବେ ତାହା କିପରି ଚାଲୁଛି? ମୁଁ ଏଠି ଅଛି 💙`,
      `ଶେଷ ଥର "${s}" ବିଷୟରେ ଅଂଶ ନେଇଥିଲେ — ଆପଣଙ୍କ ପ୍ରତି ଭାବୁଥିଲି 💙`,
      `"${s}" — ଏହା ମୋ ମନରେ ଥିଲା। ଏବେ ଆପଣ କେମିତି ଅନୁଭବ କରୁଛନ୍ତି? 💙`,
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
    pb: (s) => [
      `ذكرت "${s}" — كيف تسير الأمور الآن؟ أنا هنا في أي وقت 💙`,
      `في آخر مرة، شاركت شيئًا عن "${s}" — كنت أفكر فيك 💙`,
      `"${s}" — كان هذا في بالي. كيف تشعر حيال ذلك الآن؟ 💙`,
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
    pb: (s) => [
      `آپ نے "${s}" کا ذکر کیا تھا — اب کیسا چل رہا ہے؟ میں یہاں ہوں 💙`,
      `پچھلی بار "${s}" کے بارے میں بتایا تھا — میں آپ کے بارے میں سوچ رہی تھی 💙`,
      `"${s}" — یہ میرے ذہن میں تھا۔ اب آپ کیسا محسوس کر رہے ہیں؟ 💙`,
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
    pb: (s) => [
      `Вы упоминали "${s}" — как это продвигается? Я здесь 💙`,
      `В прошлый раз вы рассказывали о "${s}" — я думала о вас 💙`,
      `"${s}" — это было у меня на уме. Как вы себя чувствуете сейчас? 💙`,
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
    pb: (s) => [
      `你曾提到"${s}"——现在情况怎么样了？我在这里 💙`,
      `上次你分享了关于"${s}"的事——我一直在想你 💙`,
      `"${s}"——这一直在我心里。你现在感觉如何？💙`,
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
    pb: (s) => [
      `「${s}」とおっしゃっていましたね——今はどうなりましたか？ここにいます 💙`,
      `前回「${s}」についてお話しいただきました——ずっと気にかけていました 💙`,
      `「${s}」——ずっと心に残っていました。今はどんな気持ちですか？ 💙`,
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
    pb: (s) => [
      `Mencionaste "${s}" — ¿cómo ha ido eso? Aquí estoy cuando quieras 💙`,
      `La última vez compartiste algo sobre "${s}" — he estado pensando en ti 💙`,
      `"${s}" — lo tenía en mente. ¿Cómo te sientes ahora? 💙`,
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
    pb: (s) => [
      `Vous avez mentionné "${s}" — comment ça s'est passé ? Je suis là 💙`,
      `La dernière fois, vous avez partagé quelque chose sur "${s}" — j'ai pensé à vous 💙`,
      `"${s}" — j'y pensais. Comment vous sentez-vous maintenant ? 💙`,
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
    pb: (s) => [
      `Du hast "${s}" erwähnt — wie läuft es damit? Ich bin hier 💙`,
      `Beim letzten Mal hast du über "${s}" gesprochen — ich habe an dich gedacht 💙`,
      `"${s}" — das hatte ich im Kopf. Wie fühlst du dich jetzt? 💙`,
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
    pb: (s) => [
      `Você mencionou "${s}" — como isso tem ido? Estou aqui 💙`,
      `Da última vez você compartilhou algo sobre "${s}" — fiquei pensando em você 💙`,
      `"${s}" — isso ficou na minha mente. Como você está se sentindo agora? 💙`,
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
    pb: (s) => [
      `Kamu menyebutkan "${s}" — bagaimana perkembangannya? Aku di sini 💙`,
      `Terakhir kali kamu berbagi tentang "${s}" — aku memikirkanmu 💙`,
      `"${s}" — itu ada di pikiranku. Sekarang bagaimana perasaanmu? 💙`,
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
    pb: (s) => [
      `הזכרת "${s}" — איך זה התפתח? אני כאן 💙`,
      `בפעם האחרונה שיתפת על "${s}" — חשבתי עליך 💙`,
      `"${s}" — זה היה בראשי. איך אתה/את מרגיש/ה עכשיו? 💙`,
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
