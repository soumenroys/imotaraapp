// src/lib/ai/orchestrator/mythologyEngine.ts
//
// World mythology engine — offline/rule-based path.
// Covers 7 cultural traditions. Selection is language-aware:
//   - Indian languages (hi, bn, ta, te, etc.) → Indian 70%, world 30%
//   - Other languages → own culture 60%, Indian 35%, other 5%
//   - Indonesian (id) → Indian primary (deep Hindu/Buddhist cultural influence)
//   - English (en) → Indian primary (Imotara is an Indian product)
//
// For LLM paths, the chat-reply system prompt handles mythology natively
// with full language and cultural awareness.
//
// Offline injection is English-only (stories are in English).
// Callers apply the language-gate; this engine only handles cultural selection.

export type MythSignal = "sad" | "anxious" | "angry" | "tired";

type CulturePool = Record<MythSignal, readonly string[]>;

// ─────────────────────────────────────────────────────────────────────────────
// INDIAN  (Mahabharata, Ramayana, Gita, Puranas, Jataka, Panchatantra, Upanishads)
// ─────────────────────────────────────────────────────────────────────────────
// ✅ CHECKED 23 Oct 2026, story by story. Removed: 8 that are not in the texts
// they name (a "mother crow", "two oxen" and "turtle" Jataka; a Panchatantra
// "deer and its reflection"; Rama sleepless before Lanka; Yashodhara bowing;
// Vikramaditya's vanishing gifts; Viswamitra and "a woman's food"). Corrected
// 10 wrong details (Vikarna DID speak for Draupadi; Gandhari kept her
// blindfold; Dasharatha's "three days"; Dhruva met Narada and saw Vishnu…).
// ➕ 26 Oct 2026: added Kisa Gotami, Angulimala (MN 86), Bhai Kanhaiya, Guru Nanak
// ('Nanak dukhia sab sansar', GGS p. 954), Kabir's 'Dheere dheere re mana', and
// Thirukkural 314 and 621 — every one checked against its named source.
// ⛔ These are now handed to the cloud as the ONLY stories it may tell
// (verifiedStoriesFor) — a line added here is a line every user may hear.
const INDIAN: CulturePool = {
    sad: [
        "In the Mahabharata, Karna was born with divine armor fused to his skin — a gift of the sun god — yet abandoned by his mother at birth and raised by a charioteer. He was mocked again and again for his birth, though he was the equal of any warrior there. He kept showing up anyway — loyal, generous, and whole — not because the world was fair, but because that was who he chose to be.",

        "There is the story of Savitri in the ancient texts, who followed Death itself into the forest when it came for her husband. She did not beg for miracles — she simply refused to stop walking, and answered Death's questions so wisely that it eventually relented. Her love did not need permission to be powerful.",

        "A Buddhist story tells of Kisagotami, who carried her dead child from door to door asking for medicine, until the Buddha asked her to bring a mustard seed from a house where no one had ever died. She went from house to house, and slowly she understood — grief is not punishment; it is the price of having loved.",

        "In the Ramayana, Sita was exiled into the forest by the very person she had stood beside through every trial. She raised her sons alone, in silence, and when she was finally asked to prove herself again — she chose the earth instead. Her dignity was never contingent on being believed.",

        "In the Ramayana, King Dasharatha sent his beloved son Rama into exile, bound by a promise made years before, and died of grief soon after. He had the power of a king, but not the power to undo a single word — a reminder that love and control are not the same thing.",

        "In the devotional tradition, Radha's devotion to Krishna was marked as much by his absence as his presence. The longing itself was considered sacred — not a wound to be healed, but a form of connection that does not require the other person to be in the room.",

        "In the Bhagavata Purana, King Bharata gave up his kingdom for the forest — and then became deeply attached to an orphaned deer he had raised. When he died, his last thought was of the deer. The story is not a punishment; it is an acknowledgment that what we carry with us stays, and that tenderness is never wasted even when misplaced.",

        "In the Upanishads, young Nachiketa sat at the door of Yama for three days — no food, no shelter, no assurance the door would ever open. When Death returned and offered riches to abandon his question, Nachiketa refused. Grief, he understood, could become a doorway to something real.",

        "In the Mahabharata, Draupadi was dragged to the court and humiliated before her husbands, her elders, and the whole assembly. Her elders sat silent; only young Vikarna spoke up for her, and he was shouted down. She did not collapse — she asked one sharp question that no one in that hall could answer, and that silence became her proof. Her dignity did not depend on their response.",

        "In the Mahabharata, Kunti carried for her entire life the knowledge that Karna — the great warrior on the opposing side — was her firstborn son. She had abandoned him as a young woman and could never claim him. On the eve of war, she finally told him. He listened, and still refused to switch sides. They both bore the weight of it. Some things cannot be undone — only held.",


        "In the Buddhist texts, Kisa Gotami came to the Buddha carrying her dead child, begging for medicine. He asked her to bring a mustard seed from any house where no one had ever died. She went from door to door and found no such house. She understood that she was not alone in her loss — and she buried her child and became a nun.",

        "Guru Nanak wrote, in a line preserved in the Guru Granth Sahib: 'Nanak dukhia sab sansar' — 'Nanak, the whole world is in sorrow.' He was not saying sorrow is small. He was saying no one carries it alone.",
        ],

    anxious: [
        "In the Bhagavad Gita, Arjuna — the finest warrior in the world — sat down in the middle of the battlefield and could not lift his bow. He was not afraid of dying; he was overwhelmed by everything that could go wrong, everyone he might hurt. Krishna sat with him in that moment. What followed was not a battle cry — it was a careful, honest conversation about fear and action.",

        "In the Ramayana, before Hanuman leaped across the ocean to Lanka, he paused — uncertain whether his body could carry him that far. It was Jambavan, the wise elder, who reminded him: you have forgotten your own strength. Hanuman had always had it. He just needed someone to say it out loud.",

        "In the Puranas, young Prahlada refused to stop his devotion even as his own father threatened him with fire, serpents, and war elephants. He was not brave because he knew nothing could harm him. He was brave because he had decided that fear of consequences would not govern his choices.",

        "A young boy named Dhruva, hurt by his stepmother's words, walked alone into the forest to seek Vishnu — at five years old, with no map and no certainty. The sage Narada met him on the way and taught him to meditate, and Dhruva stayed with it until Vishnu appeared before him. His courage was not certainty. It was simply not turning back.",

        "In the Puranas, the gods and demons churned the cosmic ocean in search of the nectar of immortality. Before the nectar came, the ocean released a terrible poison that threatened everything. Shiva drank it and held it in his throat, turning blue. What you fear emerging from the depths may not be the end — it may be calling for a different kind of courage.",

        "A Jataka tale tells of a hare who heard the sound of a falling fruit and ran, convinced the world was ending. Hundreds of animals heard him and ran too — a stampede of borrowed fear. The Bodhisattva came down from a hill and asked the hare to trace where it started. It ended at a single fallen fruit.",

        "In the Mahabharata, Yudhishthira reached a lake to drink and was stopped by a Yaksha who asked: what is the greatest wonder in the world? Yudhishthira answered — every day, people die, and yet those who remain live as if they will not. Not denial. Just presence, in the face of the unknown.",

        "The sage Viswamitra had worked for decades toward a goal he was not certain he could reach, knowing that Indra would send obstacles. He sat still. Every test came, and he sat still, until even Brahma acknowledged him. He had no guarantee. He had patience.",

        "In the Katha Upanishad, young Nachiketa waited at Death's gate for three days. When Yama returned and offered him palaces and pleasures to drop his question, Nachiketa refused. He had come for one thing, and no discomfort had changed that. Sometimes the truest kind of courage is just not moving.",

        "In a Buddhist story, Ananda — the Buddha's closest disciple — worked for decades but could not reach enlightenment while the Buddha was alive. The night after the Buddha passed, Ananda sat alone with his grief and his effort. In that night, he let go of the effort itself — and arrived.",

        "Kabir wrote: 'Dheere dheere re mana, dheere sab kuch hoye; maali seenche sau ghada, ritu aaye phal hoye' — 'Slowly, slowly, O mind; everything happens in its own time. The gardener may pour a hundred pots of water, but the fruit comes only in its season.'",

        "The Thirukkural, the Tamil book of wisdom by Thiruvalluvar, says (verse 621): when trouble comes, laugh — nothing overcomes trouble like it. Not because the trouble is small, but because a mind that can still smile is not beaten by it.",
    ],

    angry: [
        "In the Puranas, Parashurama was so consumed by rage after his father's death that he vowed to rid the world of warriors — and did so, again and again, for twenty-one generations. He had strength and cause. But the anger never filled what had been taken. After the wars ended, he went to the mountains alone. Sometimes anger is the last wall between us and the grief beneath it.",

        "Vishwamitra was a powerful king who attacked a sage's hermitage out of pride, lost, and burned with rage. He chose to transform that fire — not by suppressing it, but by turning it into tapas, into discipline, into decades of quiet work. He did not become a sage by losing his intensity. He became one by learning to direct it.",

        "In the Mahabharata, Duryodhana refused every peace offer, every chance to avert war. Not because he lacked intelligence — but because his anger had become his identity. To accept peace would have meant accepting that the Pandavas had a right to exist alongside him. He chose war over that. Not all anger leads there, but unexamined anger always costs something.",

        "In the Puranas, the goddess Kali was summoned from Durga's wrath to destroy a demon that multiplied from every drop of blood. She consumed everything in her fury — until Shiva lay down beneath her feet. Feeling him there, she stopped. Even in divine anger, there is a moment when something beneath it calls it back.",

        "In the Mahabharata, Bhima swore terrible oaths after Draupadi's humiliation — oaths that took thirteen years of exile to fulfill. His anger was real and just. But the years between the oath and the fulfillment cost him, cost everyone. The anger was not wrong. The question was: what does it do while it waits?",

        "After the war at Kurukshetra, Gandhari — who had worn a blindfold for decades to share her husband's blindness — turned to Krishna and cursed him. Her grief was vast, her anger completely understandable. Krishna accepted the curse without argument. Even when anger is entirely justified, it can outlast its original purpose.",

        "In the Mahabharata, Drona was struck with grief when he was told — falsely — that his son had died. He dropped his weapons. He was killed in that unguarded moment. What looked like defeat was actually grief so large it had nowhere to go but down. Anger and grief are close neighbors.",

        "In the Puranas, Indra insulted his own teacher, Brihaspati, out of pride — and found himself stripped of his kingdom. He wandered in shame for years before he earned it back through devotion. The humbling was not punishment. It was the only way his pride could dissolve enough for him to grow.",

        "In the Puranas, when Sati died and Shiva carried her body across the world in grief and rage, the universe trembled. It was Vishnu who quietly cut the body away piece by piece so Shiva could eventually set it down. Some griefs are so vast they look like anger — and they need the world to patiently take pieces until breathing becomes possible again.",

        "In the Katha Upanishad, Nachiketa was given to Yama by his own father in a burst of rage. Nachiketa stood at Death's gate without bitterness — and when Yama returned, he asked not for revenge but for wisdom. He had every right to anger. He chose something else.",


        "The Thirukkural (verse 314) says that the way to answer those who harm you is to do them good, so that they feel ashamed of what they did — and then to forget both the harm and the good.",

        "In Sikh tradition, during the battles at Anandpur, Bhai Kanhaiya carried water to every wounded soldier — including the enemy's. When this was reported to Guru Gobind Singh, Kanhaiya said he saw no friend or foe, only the same light in every face. The Guru gave him ointment so he could dress their wounds too.",

        "In the Majjhima Nikaya, Angulimala was a feared bandit. When he chased the Buddha, he could not catch him though the Buddha only walked, and he shouted, 'Stop!' The Buddha answered: 'I have stopped, Angulimala — you stop too.' Angulimala laid down his weapons and became a monk.",
        ],

    tired: [
        "In the Ramayana, Rama lived fourteen years in the forest — not as punishment, but because he chose his father's honor over his own comfort. He did not count the days. He tended to the days that were actually there, one at a time, and eventually those days became a kingdom.",

        "In the Puranas, the gods and demons churned the great ocean for a very long time before anything of value emerged. The churning required everyone to keep pulling, even when nothing was visible. The nectar of immortality could not have appeared earlier. Some things only come after enormous, sustained effort.",

        "In the Mahabharata, Ekalavya was turned away by Drona as a student. So he built a clay statue of Drona in the forest and taught himself — practicing every day, with no teacher, no encouragement, no witness. He became a master. Not because someone showed up for him. Because he kept showing up for himself.",

        "In the Mahabharata, the Pandavas spent twelve years in exile and then one full year in disguise — each living a smaller, hidden version of their life. Yudhishthira's discipline was not heroic in the way songs describe. It was simply: one day, then the next, then the next.",

        "In the Katha Upanishad, young Nachiketa waited at the door of Yama's palace for three days — no food, no water, no assurance the door would open. He did not leave. He did not bargain. He simply stayed. Sometimes what looks like waiting is actually a form of deep, quiet courage.",

        "In the Ramayana, when Hanuman could not identify which herb would heal Lakshmana, he lifted the entire mountain and carried it. He had been awake, in battle, in danger — but none of that stopped him from doing what needed to be done. He did not do it with ease. He did it.",

        "Siddhartha sat under the Bodhi tree resolved not to rise, facing every storm of the mind — doubt, desire, fear, despair. He did not get up and try again later. He stayed until the sitting itself became something different. Exhaustion was part of the path, not a sign that the path was wrong.",

        "In the old texts, Shravan Kumar carried his elderly, blind parents on a pilgrimage across India in a bamboo pole, stopping at every sacred site so they could fulfill their wishes. He did not make it a hardship to speak of. He made it something to complete. Sometimes devotion is just that — doing the thing, day after day.",

        "Drona, before he became the greatest weapons teacher of his age, lived in such poverty that his young son once cried because there was no milk. He mixed flour in water and gave it to the boy as milk. From that moment, he decided he would learn what he needed to learn — not for fame, but to give his son something real. Exhaustion was not the end of the story.",

        "In the Mahabharata, Vidura — the wisest man in Hastinapura — spent his entire life advising a court that did not listen. He knew what would happen. He said it clearly, again and again. He was ignored. He served anyway. There is a tiredness that comes not from effort but from caring deeply in a place that does not care back. He kept caring anyway.",

        ],
};

// ─────────────────────────────────────────────────────────────────────────────
// GREEK / ROMAN + EUROPEAN FABLES (es, pt, fr, de)
// ─────────────────────────────────────────────────────────────────────────────
// ✅ CHECKED 26 Oct 2026, story by story (as INDIAN on 23 Oct). Corrected:
// Achilles did NOT refuse to fight after Patroclus died (he returned to battle);
// Perseus used Athena's polished SHIELD, not "a mirror". Removed: a Hera line
// that asserted more than the myths say. Added: Aesop, La Fontaine, Andersen,
// Seneca, Epictetus and the Prodigal Son (Luke 15).
const GREEK_ROMAN: CulturePool = {
    sad: [
        "In Greek mythology, Orpheus descended into the Underworld to bring back his beloved Eurydice, and his music moved even its rulers to let her go — on one condition: he must not look back until they reached the light. He looked, and lost her again. The story has lasted for millennia because grief makes us reach for what we cannot hold.",

        "When Persephone was taken into the Underworld, her mother Demeter grieved so deeply that the earth stopped growing. The seasons came to mirror that grief — winter while they are apart, spring when Persephone returns. Even in the oldest stories, mourning has its season, and spring still comes.",

        "In the Iliad, when Achilles learned that his companion Patroclus had been killed, the greatest warrior among the Greeks poured dust over his head, wept, and would not eat. The poem does not treat his grief as weakness; it shows how much he had loved.",

        "In the Gospel of Luke, a younger son wastes his inheritance far from home. Starving, he walks back, rehearsing an apology. While he is still far off, his father sees him, runs to him and embraces him before he can finish. Some homecomings are kinder than the speech we prepare for them.",

        "In Hans Christian Andersen's tale, a cygnet hatched among ducklings is mocked as ugly and driven away. He survives a hard winter alone. In spring he sees swans on the water, bows his head expecting to be driven off — and sees in the water that he is a swan himself. Being out of place is not the same as being wrong.",
    ],

    anxious: [
        "In Greek myth, Perseus was sent to bring back the head of Medusa, whose gaze turned people to stone. He did not look at her directly — he watched her reflection in a polished shield. Some fears cannot be faced head-on; they can be approached another way.",

        "Above the temple of Apollo at Delphi were carved the words 'Know thyself.' Not 'know the future' — know yourself. Worry asks what will happen; the old inscription points to who we are while it happens.",

        "Seneca, the Roman philosopher, wrote to his friend Lucilius: 'There are more things likely to frighten us than there are to crush us; we suffer more often in imagination than in reality.' He was not dismissing fear — only asking how much of it has actually arrived.",

        "Epictetus, who was born into slavery, began his handbook with one distinction: some things are within our power, and some are not. Our opinions, choices and responses are ours; much of the rest is not. He thought peace begins by sorting the two.",

        "In Aesop's fable, a hare mocks a tortoise for being slow, and the tortoise challenges him to a race. The hare runs far ahead, then lies down to sleep. The tortoise keeps plodding and crosses the line first. Steady steps can carry further than anxious sprints.",
    ],

    angry: [
        "The Iliad opens with one word: 'Rage.' Achilles' anger at Agamemnon keeps him out of the fighting while the Greeks suffer, and in the end it costs him his dearest friend. He had been wronged. But the anger burned far more than he meant it to.",

        "In Aesop's fable, the North Wind and the Sun argue over who is stronger and agree to a test: whoever makes a traveller take off his cloak wins. The harder the Wind blows, the tighter the man holds it. Then the Sun shines gently, and the man takes it off himself. Force often hardens what warmth can open.",

        "In Euripides' play, Medea is abandoned by Jason after giving up everything for him. Her fury is understandable — and the tragedy shows what it costs when that fury is allowed to destroy even what she loved. The play asks when righteous anger begins consuming its own.",

        "Prometheus gave fire to humanity against Zeus's will and was chained to a rock, where an eagle came every day to eat his liver. The myth remembers him not for his anger but for what he was willing to bear for the people he cared about.",
    ],

    tired: [
        "In Greek myth, Heracles was set twelve labours — not as glory, but as penance. Each seemed impossible. He did not finish them all at once; he finished them one after another.",

        "Atlas was condemned to hold up the sky. When Heracles needed the golden apples, he took the sky on his own shoulders for a while so Atlas could go and fetch them. Even the strongest burden can be shared, if only for a time.",

        "In the Odyssey, Penelope waited twenty years for Odysseus. To hold off the suitors, she promised to choose one when she finished weaving a shroud — and each night she secretly unravelled the day's work. Endurance in that story is not one great act but a long run of quiet, ordinary ones.",

        "In La Fontaine's fable, a mighty oak pities a reed for bending in every breeze. Then a storm comes. The reed bends and survives; the oak, which will not bend, is torn up by the roots. Giving way for a while is not the same as giving up.",

        "Albert Camus wrote about Sisyphus, condemned to push a stone up a hill forever and watch it roll down again. He ended: 'One must imagine Sisyphus happy.' Not because the work ends, but because the one doing it can choose how to meet it.",
    ],
};

// ─────────────────────────────────────────────────────────────────────────────
// CHINESE / TAOIST / CONFUCIAN (zh)
// ─────────────────────────────────────────────────────────────────────────────
// ✅ CHECKED 26 Oct 2026. Corrected: the Yellow Emperor's dream (Liezi) — the
// old line invented that he "recognized what was already there". Quotes from
// Zhuangzi are marked as paraphrase. Added: Yu Gong (Liezi), Mencius 6B:15,
// Analects 15.24.
const CHINESE: CulturePool = {
    sad: [
        "When Zhuangzi's wife died, his friend Huizi found him drumming on a bowl and singing. Huizi was shocked. Zhuangzi explained that at first he had grieved like anyone — then he thought about how she had come from formlessness into life, and now had gone on, like the turning of the seasons. It is not a story about not caring. It is about finding a way to carry it.",

        "In Chinese legend, the Weaver Girl and the Cowherd were separated by the Milky Way and may meet only once a year, on the seventh night of the seventh month, when magpies form a bridge between the stars. The distance never ended their love.",

        "Standing by a river, Confucius said: 'It flows on like this, never ceasing, day or night.' Time moves, and so does what we feel; nothing stays in one form forever.",

        "A Chinese fable tells of an old man near the border whose horse ran away. His neighbours called it bad luck. 'Who knows?' he said. The horse came back with a fine wild horse. 'Good luck!' 'Who knows?' His son broke his leg riding it. 'Bad luck!' 'Who knows?' Then war came, and the son was spared from the army. A loss is not always only a loss.",
    ],

    anxious: [
        "Zhuangzi dreamed he was a butterfly, fluttering happily, not knowing he was Zhuangzi. Then he woke — and could not be sure whether he was Zhuangzi who had dreamed of a butterfly, or a butterfly now dreaming it was Zhuangzi. It is an old invitation to hold our certainties a little more lightly.",

        "In Zhuangzi, Cook Ding carved an ox so skilfully that his knife stayed sharp for nineteen years. He said he no longer saw the whole ox, but followed its natural spaces — and when he came to a hard place, he slowed down and went carefully. Hard places are not met by force but by attention.",

        "The Tao Te Ching says that nothing in the world is softer or weaker than water, yet nothing is better at overcoming the hard and strong. Water does not fight the stone. It keeps going.",

        "In the Liezi, an old man named Yu Gong began digging away two mountains that blocked his door. A neighbour laughed: he would die before finishing. Yu Gong replied that his sons would carry on, and their sons after them, while the mountains would never grow taller. A task too big for one day can still be begun today.",
    ],

    angry: [
        "Confucius listed things a wise person keeps in mind; one of them is: when angry, think of the trouble it may bring. Not to deny the anger — to see where it leads before following it.",

        "In Zhuangzi, a man crossing a river is bumped by an empty boat, and he is not angry at all. If someone were in that boat, he would shout and curse. The boat is the same; only the story he tells about it changes. Much anger lives in that story.",

        "Confucius was asked for one word to guide a whole life. He answered: reciprocity — 'Do not impose on others what you would not want for yourself.' It is a simple test to bring into any argument.",

        "In Zhuangzi, Duke Huan was reading the words of ancient sages when a wheelwright told him he was reading only the leftovers of dead men. The Duke was furious and demanded an explanation. The wheelwright said that the real skill of his own craft lived in his hands and could not be put into words. Sometimes what angers us is how much cannot be said.",
    ],

    tired: [
        "The Tao Te Ching says the Way does nothing, yet nothing is left undone. It does not praise laziness; it describes not forcing, not pushing against the grain — and how much can settle on its own when we stop.",

        "In Zhuangzi, a carpenter passes a huge old tree and calls it useless — its wood is good for nothing. That night the tree appears in his dream and says that useful trees are cut down young; it has lived so long precisely because no one could use it. Rest is not uselessness.",

        "Mencius wrote that when Heaven is about to give someone a great task, it first tests their mind with suffering, works their body with toil, and leaves them in want — to strengthen what is weak in them. Hard seasons are not proof that we have failed.",

        "The Tao Te Ching speaks of the valley spirit that never dies. A valley endures because it receives rather than resists. Some tiredness comes from holding too tightly.",
    ],
};

// ─────────────────────────────────────────────────────────────────────────────
// ISLAMIC / SUFI / PERSIAN (ar, ur)
// ─────────────────────────────────────────────────────────────────────────────
// ✅ CHECKED 26 Oct 2026 — the most corrected pool. REMOVED as misattributed or
// unsourced: "Yesterday I was clever…" (not in Rumi), "the sun never says to the
// earth 'you owe me'" (Ladinsky, not Hafez), "I have lived on the lip of
// insanity" (a loose modern rendering), "Be empty of worrying… prison"
// (same), the "gift I do not accept" story (it is the Buddha's — now in
// JAPANESE_ZEN), the Prophet and the woman throwing rubbish (no hadith source),
// and invented Nasruddin "tiger" and dervish "river" stories. ADDED: Qur'an
// (Ya'qub 12:18/12:86, 94:5-6), authentic hadith on anger, Musa and Khidr
// (18:60-82), Saadi's Bani Adam.
const ISLAMIC_SUFI: CulturePool = {
    sad: [
        "In the Qur'an, when the prophet Ya'qub was told his son Yusuf was lost, he answered, 'Beautiful patience' — and years later, grieving still, he said: 'I only complain of my grief and sorrow to God.' Patience in that story is not the absence of sorrow. It is where the sorrow is carried.",

        "The Masnavi of Rumi opens with the voice of a reed flute, cut from its reed bed, lamenting its separation. Everyone parted from their source, it says, longs to return. Longing is not a fault to fix; it shows what we belong to.",

        "When Rumi's beloved companion, Shams of Tabriz, disappeared, Rumi's grief poured into thousands of verses — so many that the great collection of his lyric poems is named after Shams. Grief can become the very thing that speaks.",

        "Saadi wrote in the Gulistan that human beings are members of one body, made from one essence; when one member is in pain, the others cannot rest. You are not as alone in your pain as it feels.",
    ],

    anxious: [
        "The Qur'an says, and says twice: 'Indeed, with hardship comes ease. Indeed, with hardship comes ease.' Not after the hardship — with it. Even inside a hard time, some ease is already there.",

        "A man asked the Prophet whether he should tie his camel or trust in God. He answered: 'Tie it, and trust in God.' Do what is yours to do — then let go of what is not.",

        "Rumi wrote in the Masnavi that past and future veil God from our sight, and told the reader to burn them both. Worry lives in the future; the only place we can actually stand is now.",

        "A Mulla Nasruddin story: a neighbour found Nasruddin searching the ground under a street lamp and helped him look for his lost key. After a long time he asked where exactly it had fallen. 'In the house,' said Nasruddin. 'Then why look here?' 'Because there is more light here.' We often search where it is easy rather than where the answer is.",
    ],

    angry: [
        "The Prophet said: 'The strong man is not the one who overcomes others by his strength; the strong man is the one who controls himself when angry.' Strength, in that saying, is measured inward.",

        "The Prophet also advised that when one becomes angry while standing, one should sit down, and if the anger does not leave, lie down. Even the body can be used to slow the moment between feeling and acting.",

        "In the Qur'an, Musa travels with a wise servant of God, Khidr, who does things that seem wrong — damaging a boat, rebuilding a wall for people who refused them food. Musa protests each time. Only at the end does Khidr explain the hidden reasons. Not everything that angers us is what it first appears.",

        "Ibrahim ibn Adham was a king of Balkh who left his throne for a life of simplicity and devotion. The Sufis remembered him not for what he had, but for what he was willing to set down.",
    ],

    tired: [
        "In the Qur'an, the prophet Ayyub lost his health, his wealth and his family, and called out to God that harm had touched him. He was restored. The Sufis hold him up not as someone who never suffered, but as someone who kept calling out through it.",

        "In Edward FitzGerald's version of Omar Khayyam's Rubaiyat, the world is a battered caravanserai — an inn on the road, with doorways of night and day, where travellers stop and then move on. We are not meant to carry everything forever; there are places to rest on the way.",

        "Sabr, patience, is one of the great virtues in Islamic teaching — not passive waiting, but steadily continuing without bitterness while a hard time lasts.",
    ],
};

// ─────────────────────────────────────────────────────────────────────────────
// NORSE (world-cycle slot only — no language's own tradition)
// ─────────────────────────────────────────────────────────────────────────────
// ✅ CHECKED 26 Oct 2026. Corrected: Baldur (Loki guided the blind god Höðr's
// hand; Odin "knowing the story wasn't over" was invented), Freyja's tears are
// red gold (not "jewelry"), Fimbulwinter (three winters — "even the gods were
// tired" was invented). Added: Hávamál 23 and 76.
// ⛔ Kept apart from RUSSIAN: when both shared one pool, a Russian reply called
//    a Russian fairy tale "Norwegian" (measured on a preview, 26 Oct).
const NORSE: CulturePool = {
    sad: [
        "In Norse myth, Baldur was so loved that his mother Frigg made every thing in the world promise never to harm him — every thing except the small mistletoe. Loki made a dart of it and guided the blind god Höðr to throw it, and Baldur died. All things were asked to weep him back, and nearly all of them did.",

        "In Norse myth, the goddess Freyja wept for her absent husband Óðr as she travelled in search of him, and her tears turned to red gold. Love that misses someone leaves something precious behind.",

        "The Hávamál, the old Norse sayings of the High One, says that cattle die and kinsmen die, and we too shall die — but one thing never dies: the good name of the dead. What a person was to others does not vanish with them.",
    ],

    anxious: [
        "The Hávamál, the old Norse sayings of the High One, says the foolish man lies awake all night, turning everything over; when morning comes he is worn out, and his trouble is just as it was.",

        "In Norse myth, three Norns sit at the roots of the world tree and shape the fates of all beings. The Norse did not imagine they could control everything — they cared about how one met what came.",

        "In the Hávamál, Odin tells how he hung on the windswept tree for nine nights, wounded by a spear, without bread or drink, and at the end took up the runes. Knowledge, in that poem, comes through enduring something hard.",
    ],

    angry: [
        "In the Völsunga saga, Sigurd killed the dragon Fafnir not by charging at it, but by digging a pit on its path and waiting. Strength guided by a plan did what rage could not.",

        "In Norse myth, Loki begins as a clever trickster who helps the gods out of trouble. His story darkens until his deeds can no longer be undone. The myths seem to ask when cleverness and resentment cross a line that cannot be uncrossed.",
    ],

    tired: [
        "Norse myth tells of Fimbulwinter — three winters in a row with no summer between, before the world's great ending and renewal. Even the myths that imagine the world's end imagine it beginning again.",

        "In Norse myth, the world tree Yggdrasil holds the nine worlds, while a serpent gnaws at its root and deer bite its branches. It suffers more than anyone knows, the poem says — and it still stands.",
    ],
};

// ─────────────────────────────────────────────────────────────────────────────
// RUSSIAN (ru)
// ─────────────────────────────────────────────────────────────────────────────
// ✅ CHECKED 26 Oct 2026. Every line names its source as Russian, so a reply
// cannot pass it off as another tradition's. Tales from Afanasyev's collection
// (Vasilisa the Beautiful, the Turnip), the byliny (Ilya Muromets), Pushkin's
// "Tale of the Fisherman and the Fish", Tolstoy's "Three Questions" and
// "A Spark Neglected Burns the House", Chekhov's "Misery", Dostoevsky's
// "The Brothers Karamazov" (epilogue), and common Russian proverbs.
const RUSSIAN: CulturePool = {
    sad: [
        "In Russian fairy tales, the hero often loses what he loves and must travel 'beyond thrice-nine lands' to find it again. The tales never promise the road will be easy. They begin with someone setting out anyway.",

        "In Anton Chekhov's story 'Misery', the old cab driver Iona has lost his son, and all evening he tries to tell his passengers about it. Nobody listens. At last he tells the whole story to his little horse. Chekhov understood how much a grieving person needs simply to be heard.",

        "At the end of Dostoevsky's 'The Brothers Karamazov', Alyosha stands with a group of boys after the funeral of their friend Ilyusha and tells them that one good memory, kept from childhood, may be the best education of all — and may one day save a person. Grief and love, he says, keep us kind.",
    ],

    anxious: [
        "A Russian proverb says: 'The morning is wiser than the evening.' In the old Russian fairy tales, when the hero is given an impossible task at night, he is told to go to sleep — and in the morning the way looks different.",

        "In the Russian fairy tale 'Vasilisa the Beautiful', the girl's dying mother gives her a small doll. Whenever Vasilisa is set an impossible task — even by the witch Baba Yaga — she feeds the doll and tells it her troubles, and it says: 'Go to sleep. The morning is wiser than the evening.'",

        "In Leo Tolstoy's story 'Three Questions', a king wants to know the right time to act, the most important person, and the most important thing to do. He learns the answer through what happens to him: the most important time is now; the most important person is the one you are with; the most important thing is to do them good.",

        "A Russian proverb says: 'The eyes are afraid, but the hands do the work.' A task that looks impossible from outside gets smaller once the hands begin.",
    ],

    angry: [
        "In Tolstoy's 'Three Questions', a man who came to harm the king is wounded, and the king — not knowing who he is — tends his wound. The man becomes his friend. Kindness given in the moment turned an enemy around.",

        "In Tolstoy's story 'A Spark Neglected Burns the House', two peasant neighbours begin quarrelling over a single egg. Each insult answers the last, until one of them sets fire to the other's barn — and the fire takes the whole village. Tolstoy shows how small an anger is when it starts, and how hard it is to stop once it spreads.",

        "In Pushkin's 'Tale of the Fisherman and the Fish', an old man's wife keeps demanding more from the magic golden fish — a new trough, a house, a palace, a throne. Each wish only makes her angrier. In the end she is back where she began, beside her broken trough.",

        "A Russian proverb says: 'A word is not a sparrow — once it flies out, you will not catch it.' Words said in anger cannot be called back.",
    ],

    tired: [
        "A Russian proverb says: 'The slower you go, the further you'll get.' Tiredness is sometimes a sign that we have been running at a pace no one could keep.",

        "In the Russian folk tale 'The Turnip', the grandfather cannot pull the giant turnip out alone. The grandmother joins him, then the granddaughter, the dog, the cat — and only when the little mouse adds its strength does the turnip come out. No one was meant to pull alone.",

        "In the Russian byliny, the hero Ilya Muromets could not walk and sat at home on the stove for thirty-three years before his strength came to him. The old songs did not count those years as wasted.",
    ],
};

// ─────────────────────────────────────────────────────────────────────────────
// JAPANESE / ZEN / BUDDHIST (ja)
// ─────────────────────────────────────────────────────────────────────────────
// ✅ CHECKED 26 Oct 2026. Removed as unsourced: a monk "weeping because he
// weeps", a Zen "mirror" story, a duplicate archery line and a duplicate "chop
// wood". Added: Ryōkan's moon, "fall seven times, stand up eight", kintsugi,
// Urashima Tarō, and the Buddha's refused insult (Akkosa Sutta).
const JAPANESE_ZEN: CulturePool = {
    sad: [
        "Japanese aesthetics has a phrase, mono no aware — the gentle sadness of seeing that things pass. Cherry blossoms are loved partly because they fall so soon. Not all grief is a wound; some of it is love noticing time.",

        "In the Kojiki, Izanagi went down to the land of the dead to bring back his wife Izanami. She asked him not to look at her. He lit a light, saw how death had changed her, and fled. The old story asks what love owes the dead — and what it owes the living.",

        "Kintsugi is the Japanese craft of mending broken pottery with lacquer and gold. The cracks are not hidden; they become part of the bowl's beauty. Being broken and being mended can both be part of a life.",

        "In the Japanese tale, the fisherman Urashima Tarō stays in the palace under the sea for what feels like three years. When he returns home, everyone he knew is gone; centuries have passed. It is an old story about how time and loss can surprise us — and how much the people around us mattered.",
    ],

    anxious: [
        "A Zen story: a professor visited the master Nan-in to ask about Zen. Nan-in served tea, and kept pouring after the cup was full. 'It is overflowing!' the professor said. 'Like this cup,' said Nan-in, 'you are full of your own opinions. How can I show you anything unless you first empty your cup?'",

        "A proud samurai asked the Zen master Hakuin whether heaven and hell were real. Hakuin mocked him until the samurai drew his sword in rage. 'Here open the gates of hell,' said Hakuin. The samurai understood, sheathed his sword and bowed. 'Here open the gates of heaven.' The difference was one breath.",

        "A Japanese proverb says: 'Fall down seven times, get up eight.' It does not promise we will not fall.",

        "Zen students work with koans, such as Hakuin's 'What is the sound of one hand?' They are not solved by thinking harder. Some worries are like that too — they loosen when we stop trying to think our way out of them.",
    ],

    angry: [
        "In a Buddhist sutta, a man insulted the Buddha to his face. The Buddha asked him: if you offer food to a guest and the guest does not take it, to whom does the food belong? 'To me,' the man said. 'Then I do not accept your abuse,' said the Buddha. 'It stays with you.'",

        "A Zen story: one night a thief broke into the hut of the poet-monk Ryōkan and found nothing to steal. Ryōkan gave him his own clothes. When the thief had gone, Ryōkan sat looking at the moon and wished he could have given him that too. Even after being wronged, he looked for what was still beautiful.",

        "A folk story is told of a monk who kept lifting a drowning scorpion out of the water and kept being stung. Asked why, he said: stinging is the scorpion's nature; helping is mine. Why give up my nature because of its?",
    ],

    tired: [
        "The Zen layman Pang said his miraculous power was simply this: carrying water and chopping firewood. Ordinary work, done fully, was the practice itself.",

        "In Japanese poetry and painting, bamboo is admired because it bends under heavy snow and springs back when the snow slides off. It does not refuse the weight; it lets it pass.",

        "Wabi-sabi is the Japanese way of finding beauty in what is simple, worn and imperfect — the chipped bowl, the old path. Tiredness, too, can be the mark of something given fully.",
    ],
};

// ─────────────────────────────────────────────────────────────────────────────
// JEWISH / TALMUDIC (he)
// ─────────────────────────────────────────────────────────────────────────────
// ✅ CHECKED 26 Oct 2026. Corrected: Joseph is in GENESIS (the old line said
// "the Mahabharata"); Miriam's Well (it followed the Israelites in Miriam's
// merit — "wherever songs were sung" was invented). Removed as unsourced: a
// Baal Shem Tov quote, a Talmudic "tell it three times" story, and the Golem
// that "could not observe Shabbat". Added: Psalm 34:18, Psalm 30:5,
// Ecclesiastes 3:1, gam zu l'tova (Taanit 21a), Rabbi Tarfon (Avot 2:16).
const JEWISH: CulturePool = {
    sad: [
        "The Psalms say: 'The Lord is near to the brokenhearted, and saves those who are crushed in spirit.' The tradition does not tell the broken-hearted to hurry up and heal; it tells them they are not alone.",

        "In the Book of Ruth, Naomi lost her husband and both her sons, and urged her daughter-in-law Ruth to go back to her own people. Ruth answered: 'Where you go, I will go; where you lodge, I will lodge; where you die, I will die.' Jewish tradition holds her up as a model of chesed — loving-kindness.",

        "The Book of Lamentations is grief set down after the destruction of Jerusalem. It does not make the loss small or explain it away. The tradition kept it in scripture and reads it every year. Grief was considered worth keeping.",

        "A Psalm says: 'Weeping may stay for the night, but joy comes in the morning.' Night is real, and it is not the whole of the day.",
    ],

    anxious: [
        "A midrash tells that when the Israelites stood at the Red Sea with the Egyptian army behind them, the sea did not part until one man, Nachshon, walked into the water up to his nose. Sometimes the way opens only after the first step.",

        "Hillel taught: 'If I am not for myself, who will be for me? If I am only for myself, what am I? And if not now, when?' Three questions that bring a person back to the present moment.",

        "Rabbi Nachman of Breslov taught that the whole world is a very narrow bridge, and the main thing is not to be afraid. He did not say the bridge is wide.",

        "Ecclesiastes says: 'To every thing there is a season, and a time to every purpose under heaven' — a time to weep and a time to laugh, a time to mourn and a time to dance. Whatever season this is, it is a season.",
    ],

    angry: [
        "The Book of Proverbs says: 'One who is slow to anger is better than a warrior, and one who rules their spirit than one who takes a city.' Mastering anger was counted among the hardest victories.",

        "In Genesis, Joseph was sold into slavery by his own brothers. Years later, when they stood before him in Egypt without recognizing him, he wept — and in the end he forgave them. What was done to him was real; what he chose to do next was his own.",

        "When Moses came down from Sinai and found the people worshipping a golden calf, he broke the tablets. The Talmud records the view that God approved of what he did. Jewish tradition did not pretend that anger is never right.",
    ],

    tired: [
        "In the Book of Kings, the prophet Elijah, exhausted after a great struggle, sat under a broom tree and asked to die: 'It is enough.' An angel touched him and said, 'Arise and eat, for the journey is too great for you.' He was given bread and water, and he slept again. No lecture. Just food and rest.",

        "The Talmud tells of Nachum Ish Gamzu, who met every misfortune with the words 'gam zu l'tova' — 'this too is for the good.' It was not denial; it was a refusal to let the hard moment have the last word.",

        "Rabbi Tarfon taught: 'It is not your duty to finish the work, but neither are you free to walk away from it.' You do not have to finish everything today.",

        "Shabbat, the day of rest, is among the Ten Commandments themselves. In Jewish tradition, rest is not a reward for finishing everything — it is part of how a life is made whole.",
    ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Culture registry
// ─────────────────────────────────────────────────────────────────────────────
type CultureKey = "indian" | "greek_roman" | "chinese" | "islamic_sufi" | "norse" | "russian" | "japanese_zen" | "jewish";

const CULTURE_POOLS: Record<CultureKey, CulturePool> = {
    indian:       INDIAN,
    greek_roman:  GREEK_ROMAN,
    chinese:      CHINESE,
    islamic_sufi: ISLAMIC_SUFI,
    norse:        NORSE,
    russian:      RUSSIAN,
    japanese_zen: JAPANESE_ZEN,
    jewish:       JEWISH,
};

// Non-Indian cultures in a fixed cycle order for "other world" slot
const WORLD_CULTURES: readonly CultureKey[] = [
    "greek_roman", "chinese", "islamic_sufi", "norse", "russian", "japanese_zen", "jewish",
];

// Language → primary culture
// Indian languages + en + id → "indian" (id has deep Hindu/Buddhist cultural influence via Wayang)
const LANG_PRIMARY: Record<string, CultureKey> = {
    hi: "indian",  bn: "indian",  mr: "indian", ta: "indian", te: "indian",
    gu: "indian",  pa: "indian",  kn: "indian", ml: "indian", or: "indian",
    en: "indian",  id: "indian",
    ur: "islamic_sufi",
    ar: "islamic_sufi",
    zh: "chinese",
    es: "greek_roman", pt: "greek_roman",
    fr: "greek_roman", de: "greek_roman",
    ru: "russian",
    ja: "japanese_zen",
    he: "jewish",
};

// ─────────────────────────────────────────────────────────────────────────────
// Public API
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Returns a contextually relevant mythology story for the given signal and language.
 *
 * Cultural priority:
 *   - Indian/Indonesian/English users: 70% Indian, 30% world (promotes Indian mythology)
 *   - Other users: 60% own culture, 35% Indian, 5% other world culture
 *
 * Frequency: ~1 in 10 emotional turns ((seed >>> 9) % 10 === 0)
 * Seed bit-window: >>>9 (avoids collision with storyEngine >>>7)
 *
 * Callers on rule-based offline paths apply an English-language gate before calling
 * (stories are in English).
 */
export function buildMythologyStory(
    signal: string,
    lang: string,
    seed: number,
): string | null {
    // ~1 in 10 turns
    if ((seed >>> 9) % 10 !== 0) return null;

    const primaryCulture = LANG_PRIMARY[lang] ?? "indian";
    const isIndianPrimary = primaryCulture === "indian";

    // Use bit-window 13 for culture selection (avoids collision with >>>9, >>>11)
    const cultureChoice = (seed >>> 13) % 10;

    let culture: CultureKey;
    if (isIndianPrimary) {
        // 70% Indian, 30% world — promotes Indian mythology globally
        if (cultureChoice < 7) {
            culture = "indian";
        } else {
            culture = WORLD_CULTURES[seed % WORLD_CULTURES.length]!;
        }
    } else {
        // 60% own culture, 35% Indian, 5% another world culture
        if (cultureChoice < 6) {
            culture = primaryCulture;
        } else if (cultureChoice < 9) {
            culture = "indian"; // promote Indian globally
        } else {
            const others = WORLD_CULTURES.filter(c => c !== primaryCulture);
            culture = others[seed % others.length]!;
        }
    }

    const pool = CULTURE_POOLS[culture][signal as MythSignal];
    if (!pool || pool.length === 0) {
        // Fallback to Indian
        const fallback = INDIAN[signal as MythSignal];
        if (!fallback || fallback.length === 0) return null;
        return fallback[seed % fallback.length]!;
    }

    return pool[seed % pool.length]!;
}

const SIGNAL_THEME: Record<MythSignal, string> = {
    sad: "sadness, grief, loss, loneliness",
    anxious: "worry, fear, overwhelm, doubt",
    angry: "anger, unfairness, resentment",
    tired: "tiredness, burnout, long effort, feeling not enough",
};

/**
 * 🔑 THE ONLY STORIES THE CLOUD MAY TELL, for English and the Indian languages.
 *
 * 🔴 22 Oct 2026: told to use mythology "generously" from memory, the model
 * invented episodes and sayings in most emotional replies — and a sentence
 * telling it to be accurate did not help (measured: 15 of 15 replies still
 * told a story, most with invented detail). It cannot tell what it remembers
 * from what it makes up. So it now CHOOSES from checked text instead.
 *
 * Two stories per feeling, rotated by seed, so the model picks the one that fits
 * (or none) without us guessing the feeling from words in 22 languages.
 * Stories whose figure was already used this session are skipped.
 *
 * Every language gets its own tradition's checked pool (26 Oct 2026); the
 * return type still allows null so a future unchecked pool can opt out.
 */
export function verifiedStoriesFor(
    lang: string,
    seed: number,
    alreadyUsed: readonly string[] = [],
): { theme: string; text: string }[] | null {
    // ✅ 26 Oct 2026: EVERY language now gets its own tradition's CHECKED pool.
    // Until then only English + the Indian languages did; Arabic, Urdu, Chinese,
    // Japanese, the European languages, Russian and Hebrew fell back to stories
    // told from memory — the path where episodes and quotes get invented.
    const pools = CULTURE_POOLS[LANG_PRIMARY[lang] ?? "indian"];
    const used = alreadyUsed.map((u) => u.toLowerCase());
    const out: { theme: string; text: string }[] = [];
    (Object.keys(pools) as MythSignal[]).forEach((signal, k) => {
        const pool = pools[signal].filter((t) => !used.some((u) => u && t.toLowerCase().includes(u)));
        // ⚠️ TWO per feeling: with one, grief over a father was handed King
        // Bharata's deer as its only "sad" story — true, but a poor fit.
        for (let j = 0; j < Math.min(2, pool.length); j++)
            out.push({ theme: SIGNAL_THEME[signal], text: pool[(seed + k * 7 + j * 5) % pool.length]! });
    });
    return out;
}
