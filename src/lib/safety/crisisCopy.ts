// src/lib/safety/crisisCopy.ts
// The words on the crisis banner, in every language Imotara ships.
//
// This lived inline in app/chat/page.tsx, a 5,000-line client component, which
// meant the only test covering it had to regex-parse that page's source and
// carried a "did it move or get renamed?" error for when that inevitably
// broke. The strings themselves are unchanged — this is a move, not a rewrite.
//
// The phone numbers are NOT here. They come from the country helpers in
// crisisResources.ts and depend on where the person is, not what language they
// write in: an Indian user writing English still needs the Indian helpline.
//
// English is the fallback for an unknown language rather than an empty banner.
// Help in a language you may not read still beats no help.
//
// The mobile app carries the same 22 languages in its own crisisCopy.ts. The
// field shapes differ on purpose — web renders one inline banner, mobile a
// two-tier card — but the language coverage must not drift apart.

export type CrisisBanner = {
  /** Tier 2 — urgent, shown above the helpline numbers. */
  tier2: string;
  /** Tier 1 — gentle. */
  tier1: string;
  /** Link text for the crisis-resources link. */
  link: string;
};

export const CRISIS_BANNER_BY_LANG: Record<string, CrisisBanner> = {
  en: { tier2: "It sounds like you may be going through something really heavy right now. You don't have to face this alone —", tier1: "It sounds like things feel really hard right now. I'm listening. If it ever feels like too much,", link: "free crisis support is available 24/7" },
  hi: { tier2: "लगता है आप इस वक्त कुछ बहुत भारी झेल रहे हैं। आपको यह अकेले नहीं झेलना है —", tier1: "लगता है अभी चीज़ें बहुत कठिन लग रही हैं। मैं सुन रहा/रही हूँ। अगर यह बहुत ज़्यादा लगे,", link: "24/7 सहायता उपलब्ध है" },
  mr: { tier2: "वाटतंय तुम्ही आत्ता खूप जड काहीतरी सहन करत आहात. हे एकट्याने झेलण्याची गरज नाही —", tier1: "वाटतंय आत्ता सगळं खूप कठीण वाटतंय. मी ऐकतोय. खूप जड झालं तर,", link: "२४/७ मदत उपलब्ध आहे" },
  bn: { tier2: "মনে হচ্ছে তুমি এখন অনেক ভারী কিছুর মধ্যে দিয়ে যাচ্ছ। তোমাকে একা এটা বহন করতে হবে না —", tier1: "মনে হচ্ছে এখন সবকিছু অনেক কঠিন লাগছে। আমি শুনছি। যদি অনেক বেশি মনে হয়,", link: "২৪/৭ সহায়তা পাওয়া যাচ্ছে" },
  ta: { tier2: "நீங்கள் இப்போது மிகவும் கடினமான ஒன்றை சந்திக்கிறீர்கள் என்று தெரிகிறது. தனியாக எதிர்கொள்ள வேண்டியதில்லை —", tier1: "இப்போது எல்லாம் மிகவும் கஷ்டமாக உணர்கிறீர்கள் என்று தெரிகிறது. நான் கேட்கிறேன். மிகவும் அதிகமாக இருந்தால்,", link: "24/7 நெருக்கடி ஆதரவு கிடைக்கிறது" },
  te: { tier2: "మీరు ఇప్పుడు చాలా భారమైన ఏదో అనుభవిస్తున్నారు అనిపిస్తోంది. ఒంటరిగా భరించాల్సిన అవసరం లేదు —", tier1: "ఇప్పుడు అన్నీ చాలా కష్టంగా అనిపిస్తున్నాయి. నేను వింటున్నాను. ఎక్కువగా అనిపిస్తే,", link: "24/7 సహాయం అందుబాటులో ఉంది" },
  kn: { tier2: "ನೀವು ಈಗ ತುಂಬಾ ಭಾರವಾದ ಏನನ್ನೋ ಅನುಭವಿಸುತ್ತಿದ್ದೀರಿ. ಒಂಟಿಯಾಗಿ ಎದುರಿಸಬೇಕಾಗಿಲ್ಲ —", tier1: "ಈಗ ಎಲ್ಲವೂ ತುಂಬಾ ಕಷ್ಟ ಎನಿಸುತ್ತಿದೆ. ನಾನು ಕೇಳುತ್ತಿದ್ದೇನೆ. ತುಂಬಾ ಜಾಸ್ತಿ ಅನಿಸಿದರೆ,", link: "24/7 ಬೆಂಬಲ ಲಭ್ಯವಿದೆ" },
  ml: { tier2: "നിങ്ങൾ ഇപ്പോൾ വളരെ ഭാരമേറിയ ഒന്ന് അനുഭവിക്കുന്നുണ്ടെന്ന് തോന്നുന്നു. ഒറ്റയ്ക്ക് ഇതിനെ നേരിടേണ്ടതില്ല —", tier1: "ഇപ്പോൾ എല്ലാം വളരെ കഷ്ടമായി തോന്നുന്നുണ്ടെന്ന് തോന്നുന്നു. ഞാൻ കേൾക്കുന്നു. ഇത് കൂടുതലാകുന്നതായി തോന്നിയാൽ,", link: "24/7 പ്രതിസന്ധി സഹായം ലഭ്യമാണ്" },
  gu: { tier2: "લાગે છે તમે અત્યારે ઘણું ભારે સહન કરી રહ્યા છો. આ એકલા ઝેલવું ન પડે —", tier1: "લાગે છે અત્યારે બધું ઘણું અઘરું લાગી રહ્યું છે. હું સાંભળું છું. ઘણું વધારે લાગે તો,", link: "24/7 સહાય ઉપલબ્ધ છે" },
  pa: { tier2: "ਲੱਗਦਾ ਹੈ ਤੁਸੀਂ ਹੁਣ ਕੁਝ ਬਹੁਤ ਭਾਰਾ ਝੱਲ ਰਹੇ ਹੋ। ਇਹ ਇਕੱਲੇ ਝੱਲਣ ਦੀ ਲੋੜ ਨਹੀਂ —", tier1: "ਲੱਗਦਾ ਹੈ ਹੁਣ ਸਭ ਕੁਝ ਬਹੁਤ ਔਖਾ ਲੱਗ ਰਿਹਾ ਹੈ। ਮੈਂ ਸੁਣ ਰਿਹਾ/ਰਹੀ ਹਾਂ। ਜੇ ਬਹੁਤ ਜ਼ਿਆਦਾ ਲੱਗੇ,", link: "24/7 ਸਹਾਇਤਾ ਉਪਲਬਧ ਹੈ" },
  or: { tier2: "ମନେ ହୁଏ ଆପଣ ଏବେ ବହୁ ଭାରୀ କିଛି ସହୁଛନ୍ତି। ଏହାକୁ ଏକୁଟିଆ ଝେଲିବାର ଦରକାର ନାହିଁ —", tier1: "ମନେ ହୁଏ ଏବେ ସବୁ ବହୁ କଷ୍ଟ ଲାଗୁଛି। ମୁଁ ଶୁଣୁଛି। ଯଦି ଅତ୍ୟଧିକ ଲାଗେ,", link: "24/7 ସଂକଟ ସହାୟତା ଉପଲବ୍ଧ" },
  he: { tier2: "נראה שאתה עובר משהו כבד מאוד כרגע...", tier1: "נראה שהדברים מרגישים קשים מאוד כרגע...", link: "תמיכה בחינם זמינה 24/7" },
  ar: { tier2: "يبدو أنك تمر بشيء صعب جداً الآن...", tier1: "يبدو أن الأمور تبدو صعبة جداً الآن...", link: "الدعم المجاني متاح على مدار الساعة" },
  de: { tier2: "Es klingt, als würdest du gerade etwas sehr Schweres durchmachen...", tier1: "Es klingt, als wäre gerade alles sehr schwer...", link: "kostenlose Krisenunterstützung ist rund um die Uhr verfügbar" },
  ja: { tier2: "今、とても辛いことを経験されているようです...", tier1: "今、物事がとても辛く感じられているようです...", link: "24時間無料のサポートが利用できます" },
  // Added 2026-09-04 alongside UX-01. These seven shipped in the language
  // picker but fell through to English here — the same failure the mobile
  // crisis card had: recognised in your language, then helped in one you may
  // not read. Urdu counts twice, being one of the three RTL languages.
  ur: { tier2: "لگتا ہے آپ اس وقت کسی بہت بھاری چیز سے گزر رہے ہیں۔ آپ کو اس کا سامنا اکیلے نہیں کرنا —", tier1: "لگتا ہے ابھی سب کچھ بہت مشکل لگ رہا ہے۔ میں سن رہا ہوں۔ اگر کبھی یہ بہت زیادہ لگے،", link: "مفت مدد 24/7 دستیاب ہے" },
  es: { tier2: "Parece que estás pasando por algo muy difícil en este momento. No tienes que enfrentarlo solo —", tier1: "Parece que ahora mismo todo se siente muy difícil. Te escucho. Si en algún momento es demasiado,", link: "hay ayuda gratuita disponible las 24 horas" },
  fr: { tier2: "On dirait que tu traverses quelque chose de très lourd en ce moment. Tu n'as pas à l'affronter seul —", tier1: "On dirait que tout est très difficile en ce moment. Je t'écoute. Si jamais c'est trop,", link: "une aide gratuite est disponible 24h/24" },
  pt: { tier2: "Parece que você está passando por algo muito pesado agora. Você não precisa enfrentar isso sozinho —", tier1: "Parece que tudo está muito difícil agora. Estou aqui, ouvindo. Se em algum momento for demais,", link: "há ajuda gratuita disponível 24 horas por dia" },
  ru: { tier2: "Кажется, вы переживаете что-то очень тяжёлое прямо сейчас. Вам не нужно справляться с этим в одиночку —", tier1: "Кажется, сейчас всё очень трудно. Я слушаю. Если станет невыносимо,", link: "бесплатная помощь доступна круглосуточно" },
  zh: { tier2: "听起来你现在正经历一些非常沉重的事情。你不必独自面对 —", tier1: "听起来现在一切都很艰难。我在听。如果什么时候觉得撑不住了，", link: "24 小时免费援助随时都在" },
  id: { tier2: "Sepertinya kamu sedang melewati sesuatu yang sangat berat sekarang. Kamu tidak harus menghadapinya sendirian —", tier1: "Sepertinya semuanya terasa sangat berat sekarang. Aku mendengarkan. Kalau sewaktu-waktu terasa terlalu berat,", link: "bantuan gratis tersedia 24/7" },
};
