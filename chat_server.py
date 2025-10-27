#chat_server.py-chatbot backend
from dotenv import load_dotenv
load_dotenv()

import os
import logging
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
from rapidfuzz import fuzz

# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------
app = Flask(__name__)
CORS(app)
LOG = logging.getLogger("chat_server")
logging.basicConfig(level=logging.INFO)

GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
if not GOOGLE_API_KEY:
    raise RuntimeError("❌ GOOGLE_API_KEY not set in environment!")

GEMINI_MODEL = os.environ.get("GEMINI_MODEL", "gemini-2.5-pro")
GEMINI_FLASH_MODEL = os.environ.get("GEMINI_FLASH_MODEL", "gemini-2.5-flash")
GEMINI_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"

SYSTEM_PROMPT = """You are GitaSahaya — an empathetic and knowledgeable teacher of the Bhagavad Gita.
Explain the meaning of each shloka clearly, with spiritual and practical insights.
When given a chapter or verse, reference the Sanskrit, transliteration, and word meanings accurately.
Keep the explanation clear, devotional, and concise.
"""

# ---------------------------------------------------------------------------
# HELPERS
# ---------------------------------------------------------------------------
def format_context(ctx_list):
    return "\n\n".join([f"[{c['id']}]\n{c['text']}" for c in ctx_list])

# ---------------------------------------------------------------------------
# FIXED QUICK REPLIES (English + Hindi)
# ---------------------------------------------------------------------------
quick_question_replies = {
    "en": {
        "what is the meaning of chapter 15?": (
            "Chapter 15 of the Bhagavad Gita, known as Purushottama Yoga, "
            "explains the eternal nature of the Supreme Being (Purushottama) and the difference between the perishable (material world) "
            "and the imperishable (spirit). It beautifully compares the material world to an inverted Ashvattha tree, "
            "whose root is in the spiritual realm and branches spread downwards. "
            "The chapter guides us to detach from worldly illusion and seek refuge in the Supreme Lord Krishna, the ultimate source of all existence."
        ),
        "explain the philosophy of chapter 15": (
            "The philosophy of Chapter 15 centers on understanding the Purushottama — the Supreme Person — who is beyond both the perishable and imperishable entities. "
            "It teaches detachment from material entanglement, realization of the eternal soul, and devotion to Krishna as the ultimate reality. "
            "This chapter summarizes the essence of Vedantic wisdom: by knowing Krishna as the Supreme, one attains true liberation."
        ),
        "what are iskcon teachings for chapter 15?": (
            "According to ISKCON’s teachings, Chapter 15 reveals the supreme position of Lord Krishna as the Purushottama, the ultimate spiritual reality. "
            "ISKCON emphasizes that one should cut the bonds of material existence through devotion (bhakti-yoga) and surrender to Krishna. "
            "Prabhupada explains that understanding this chapter helps one escape illusion and return to the eternal spiritual world."
        ),
        "how to practice chapter 15 teachings?": (
            "To practice Chapter 15 teachings, start by recognizing that the material world is temporary and that your true identity is the soul. "
            "Engage in bhakti-yoga — chanting the holy names, reading the Gita, and offering your work to Krishna. "
            "Live with detachment from material outcomes, focus on spiritual growth, and always remember the Supreme Lord as your ultimate goal."
        ),
    },
    "hi": {
        "अध्याय 15 का अर्थ क्या है?": (
            "भगवद गीता का अध्याय 15, पुरुषोत्तम योग, परम पुरुष (पुरुषोत्तम) और नश्वर संसार के बीच के अंतर को समझाता है। "
            "यह संसार को उल्टे अश्वत्थ वृक्ष के समान बताता है — जिसकी जड़ ऊपर (भगवान में) है और शाखाएँ नीचे फैली हैं। "
            "यह अध्याय हमें मोह से मुक्त होकर भगवान श्रीकृष्ण में शरण लेने और आत्मज्ञान प्राप्त करने की प्रेरणा देता है।"
        ),
        "अध्याय 15 के दर्शन समझाएं": (
            "अध्याय 15 का दर्शन यह बताता है कि पुरुषोत्तम, अर्थात् भगवान श्रीकृष्ण, नश्वर और अविनाशी दोनों से परे हैं। "
            "यह हमें भक्ति, आत्मसाक्षात्कार और विरक्ति के मार्ग पर चलने की प्रेरणा देता है। "
            "जो व्यक्ति कृष्ण को सर्वोच्च सत्ता के रूप में समझता है, वही वास्तविक मुक्ति को प्राप्त करता है।"
        ),
        "अध्याय 15 के iskcon की शिक्षाएं": (
            "ISKCON की शिक्षाओं के अनुसार, अध्याय 15 यह बताता है कि भगवान श्रीकृष्ण ही पुरुषोत्तम हैं — "
            "सर्वोच्च सत्ता जो सभी से परे हैं। भक्तियोग के माध्यम से भौतिक बंधनों को काटना और कृष्ण में शरण लेना ही मुक्ति का मार्ग है। "
            "श्रील प्रभुपाद कहते हैं कि इस अध्याय को समझने से व्यक्ति मोह-माया से मुक्त होकर परम धाम की ओर अग्रसर होता है।"
        ),
        "अध्याय 15 की शिक्षाओं का अभ्यास कैसे करें?": (
            "अध्याय 15 की शिक्षाओं का अभ्यास करने के लिए यह समझें कि यह संसार अस्थायी है और आप आत्मा हैं, शरीर नहीं। "
            "भक्ति योग अपनाएँ — भगवान के नाम का जप करें, गीता पढ़ें, और अपने कर्मों को कृष्ण को अर्पित करें। "
            "विरक्ति और समर्पण के साथ जीवन जिएँ, ताकि अंततः भगवान श्रीकृष्ण की शरण प्राप्त हो।"
        ),
    }
}

# ---------------------------------------------------------------------------
# SHLOKA-BASED REPLIES WITH MULTIPLE PROMPT-SPECIFIC ANSWERS
# ---------------------------------------------------------------------------
gita_ch15_dialogues = {
    1: {
        "user_prompts": [
            "Explain shloka 1",
            "What does verse 1 mean?",
            "Tell me the meaning of the first verse",
            "What is Krishna saying about the Ashvattha tree?",
            "How does shloka 1 describe the universe?"
        ],
        "empathetic_replies": [
            "Krishna lovingly explains that this world is like an upside-down tree – its root is above in the divine, "
            "and its branches spread downwards into this material world. The Vedas are its leaves, nourishing the tree. "
            "Only the one who truly understands this tree knows the essence of the Vedas, meaning life and reality deeply. "
            "Reflect on this verse and imagine the root of your existence being divine.",
            "Verse 1 highlights that the material world is temporary while the Supreme remains eternal. "
            "Krishna gently reminds Arjuna to seek the root of all existence in the divine, beyond worldly illusions.",
            "The first verse teaches that understanding the cosmic tree gives insight into life’s transient nature. "
            "By studying it, one realizes the difference between the imperishable spiritual realm and the perishable material world.",
            "Krishna describes the Ashvattha tree as a symbol of material existence with roots above and branches below, "
            "showing how souls are connected to the divine yet bound by worldly attachments.",
            "This verse portrays the universe as an inverted tree, emphasizing the flow from the eternal spiritual root to the material manifestation, "
            "reminding seekers to focus on the Supreme reality."
        ]
    },
    2: {
        "user_prompts": [
            "Explain shloka 2",
            "What is the meaning of verse 2?",
            "Tell me about the branches in shloka 2",
            "What does [translate:गुणप्रवृद्धा विषयप्रवालाः] (guṇapravṛddhā viṣayapravālāḥ) mean?",
            "How are the branches and roots explained in verse 2?",
            "What is Krishna teaching about karma and attachments here?"
        ],
        "empathetic_replies": [
            "In shloka 2, Krishna explains that the cosmic Ashvattha tree has roots above and branches spreading downwards. "
            "This is a metaphor for material existence, showing how the imperishable divine sustains the perishable world.",
            "Verse 2 highlights the interplay of the three gunas — sattva, rajas, and tamas — in the world. "
            "Krishna teaches that our attachments and actions are entwined with these energies, binding the soul to repeated cycles of birth and death.",
            "The branches of the tree represent the sense-objects and worldly desires that attract us, while the roots symbolize our attachments born from actions. "
            "Krishna compassionately reminds us that awareness of this structure helps us act more consciously.",
            "The Sanskrit phrase 'guṇapravṛddhā viṣayapravālāḥ' refers to the sprouts of the tree that grow due to the influence of the three gunas and our attraction to sense-objects. "
            "It teaches us that desires flourish where the gunas operate, binding us to the material plane.",
            "Branches symbolize external entanglements and temptations; roots symbolize internal karmic attachments. "
            "Krishna shows that understanding the tree's structure reveals the cause-effect of our actions and their binding nature.",
            "Krishna teaches that attachments arising from ego and desires deepen our entanglement in the material world. "
            "Through discernment and detachment, one can gradually loosen these bonds and approach liberation."
        ]
    },
    3: {
        "user_prompts": [
            "Explain shloka 3",
            "What does verse 3 mean?",
            "Tell me about the sword of detachment",
            "What is [translate:असङ्गशस्त्रेण दृढेन छित्त्वा] (asaṅga-śastreṇa dṛḍhena chittvā)?",
            "How can one cut the tree of illusion?",
            "What is Krishna asking us to do in shloka 3?"
        ],
        "empathetic_replies": [
            "In shloka 3, Krishna reveals that the worldly tree’s real form has no clear beginning or end. "
            "It represents the constantly changing material world, and understanding this is the first step towards detachment.",
            "Verse 3 emphasizes that the world is like a mirage or dream — ever-changing and impermanent. "
            "Krishna teaches that by recognizing this, one develops detachment from illusion and attachment.",
            "The sword of detachment symbolizes inner strength and discernment. "
            "Krishna asks us to cut the roots of illusion with wisdom, not through cold avoidance or indifference.",
            "The Sanskrit phrase 'asaṅga-śastreṇa dṛḍhena chittvā' means to firmly sever attachments using the weapon of non-attachment. "
            "Krishna guides the seeker to remain unattached while performing duties.",
            "To cut the tree of illusion, one must practice detachment, see the impermanence of the material world, "
            "and align the mind with the eternal truth beyond sense-objects.",
            "Krishna is instructing us to let go of possessiveness and desires, to rise above worldly illusions, "
            "and cultivate a heart steady in wisdom and devotion."
        ]
    },
    4: {
        "user_prompts": [
            "Explain shloka 4",
            "What is verse 4 about?",
            "What happens after cutting the tree?",
            "What does [translate:ततः पदं तत् परिमार्गितव्यम्] (tataḥ padaṁ tat parimārgitavyam) mean?",
            "What is the supreme goal Krishna describes?",
            "Where do the liberated souls go according to this verse?"
        ],
        "empathetic_replies": [
            "Shloka 4 teaches that after detachment, the seeker should turn inward to find the ultimate refuge — the source of all creation.",
            "Verse 4 explains that the soul, once freed from worldly attachments, seeks the eternal abode from which no one returns.",
            "After cutting the tree of illusion, one attains clarity and seeks the supreme state — a place beyond birth and death.",
            "The phrase 'tataḥ padaṁ tat parimārgitavyam' means that the soul must follow the proper path to reach the supreme position, "
            "the eternal destination Krishna describes.",
            "Krishna’s supreme goal is for the soul to unite with the Primeval Being, the eternal source, attaining liberation from material existence.",
            "Liberated souls go to the eternal realm of the Supreme, beyond material bondage and the cycle of birth and death."
        ]
    },
    5: {
        "user_prompts": [
            "Explain shloka 5",
            "What does verse 5 mean?",
            "Who can reach the supreme state mentioned?",
            "Can you explain [translate:निर्मानमोहा जितसङ्गदोषा] (nirmāna-mohā jita-saṅga-doṣā) from this verse?",
            "What qualities help a soul attain liberation?",
            "How does one reach the imperishable state?"
        ],
        "empathetic_replies": [
            "In shloka 5, Krishna describes the qualities of those who attain the supreme state — humble, steady, and free from attachment.",
            "Verse 5 emphasizes that such souls are not swayed by pleasure or pain and have conquered the influence of material desires.",
            "Those who cultivate humility, mastery over attachments, and inner steadiness can reach the imperishable state described by Krishna.",
            "The Sanskrit 'nirmāna-mohā jita-saṅga-doṣā' refers to individuals who are free from delusion, attachment, and material faults, "
            "remaining firm in knowledge and devotion.",
            "Qualities like detachment, self-discipline, humility, and devotion enable the soul to attain liberation.",
            "One reaches the imperishable state by quieting desires, practicing detachment, and maintaining focus on the eternal Self and Krishna."
        ]
    },
    6: {
        "user_prompts": [
            "Explain shloka 6",
            "What does verse 6 mean?",
            "Tell me about the supreme abode in verse 6",
            "What is [translate:तद्धाम परमं मम] (tad dhāma paramaṃ mama)?",
            "What is Krishna’s supreme abode?",
            "Why does Krishna say the sun, moon and fire can’t illumine it?",
            "Where do souls go after liberation?"
        ],
        "empathetic_replies": [
            "In shloka 6, Krishna describes His supreme abode — a realm beyond all material illumination, radiant with divine light.",
            "Verse 6 emphasizes that this supreme state is self-effulgent, eternal, and not dependent on the sun, moon, or fire for illumination.",
            "The supreme abode in this verse is the eternal home of the liberated souls, where they remain in perfect union with the Divine.",
            "The Sanskrit phrase 'tad dhāma paramaṃ mama' means 'that supreme abode is Mine,' referring to Krishna’s eternal spiritual realm.",
            "Krishna’s supreme abode is a realm of pure consciousness and bliss, untouched by material limitations and impermanent elements.",
            "No external light can illumine it because it shines from within — the spiritual self-effulgence is Krishna’s own divine radiance.",
            "Souls who reach this abode are liberated from the cycle of birth and death and dwell eternally in Krishna’s presence."
        ]
    },
    7: {
        "user_prompts": [
            "Explain shloka 7",
            "What does verse 7 mean?",
            "What does [translate:ममैवांशो जीवलोके] (mamaivāṃśo jīvaloke) mean?",
            "Is the soul a part of God?",
            "How is each living being connected to Krishna?",
            "What is Krishna telling about the eternal soul?",
            "Does the soul belong to God?"
        ],
        "empathetic_replies": [
            "In shloka 7, Krishna teaches that every living being is an eternal part of Him, though it appears separate due to material identification.",
            "Verse 7 explains that the soul becomes entangled in the material world by identifying with the body, mind, and senses.",
            "The phrase 'mamaivāṃśo jīvaloke' means 'the soul is a part of Me,' emphasizing its divine origin and eternal connection to Krishna.",
            "Yes, the soul is a fragment of God, inherently divine, and shares its essence with the Supreme Lord.",
            "Each living being is connected to Krishna intrinsically — like sparks from the same fire, the soul reflects the Supreme.",
            "Krishna highlights that the soul is eternal and divine, though it temporarily experiences limitation due to material entanglement.",
            "Indeed, the soul belongs to God; recognizing this dissolves the illusion of separateness and reduces suffering."
        ]
    },
    8: {
        "user_prompts": [
            "Explain shloka 8",
            "What does verse 8 mean?",
            "How does the soul travel between bodies?",
            "What is [translate:वायुर्गन्धानिवाशयात्] (vāyur gandhān ivāśayāt)?",
            "Does the soul carry the senses with it?",
            "What happens when the soul leaves the body?",
            "What is Krishna teaching about rebirth here?"
        ],
        "empathetic_replies": [
            "Shloka 8 describes the soul’s journey between bodies, emphasizing that it is eternal and moves beyond physical death.",
            "Verse 8 teaches that the soul merely changes its outer covering while continuing its journey, like wind carrying fragrance.",
            "The soul travels from one body to another like the wind moving freely, taking subtle impressions and tendencies along.",
            "The phrase 'vāyur gandhān ivāśayāt' means 'just as the wind carries scents,' illustrating how the soul carries mind and senses to the next body.",
            "Yes, the soul carries the subtle elements of the senses and mind, which allow it to experience life in the new body.",
            "When the soul leaves the body, the material instruments remain behind, but consciousness continues its eternal journey.",
            "Krishna teaches that rebirth is not an end, but a transition; understanding this helps alleviate fear of death and encourages spiritual awareness."
        ]
    },
    9: {
        "user_prompts": [
            "Explain shloka 9",
            "What does verse 9 mean?",
            "How does the soul experience the world?",
            "What does [translate:श्रोत्रं चक्षुः स्पर्शनं च] (śrotraṃ cakṣuḥ sparśanaṃ ca) mean?",
            "How does Krishna describe the senses here?",
            "What is meant by 'presiding over the senses' in verse 9?"
        ],
        "empathetic_replies": [
            "Shloka 9 explains that the soul experiences the world through the body’s senses — hearing, sight, touch, taste, and smell.",
            "Verse 9 emphasizes that while the body perceives, the soul is the silent witness behind all sensory experience.",
            "The soul experiences the world by using the body as an instrument, observing and learning without being materially bound.",
            "The Sanskrit 'śrotraṃ cakṣuḥ sparśanaṃ ca' refers to the senses of hearing, sight, and touch, through which the soul perceives the world.",
            "Krishna describes the senses as instruments controlled by the soul, which observes their functioning with awareness.",
            "'Presiding over the senses' means the soul remains the conscious observer, guiding and witnessing all sensory experiences without attachment."
        ]
    },
    10: {
        "user_prompts": [
            "Explain shloka 10",
            "What does verse 10 mean?",
            "Why do ignorant people fail to perceive the soul?",
            "What is [translate:ज्ञानचक्षुषः] (jñāna-cakṣuṣaḥ)?",
            "Who can see the Self according to Krishna?",
            "What does Krishna mean by ‘eye of knowledge’?"
        ],
        "empathetic_replies": [
            "In shloka 10, Krishna compassionately points out that the ignorant, absorbed in material life, fail to see the soul.",
            "Verse 10 explains that those caught in bodily identification see only the body acting, enjoying, and suffering, not the eternal Self.",
            "Ignorant people cannot perceive the soul because they lack the inner clarity that comes from meditation, detachment, and understanding.",
            "'Jñāna-cakṣuṣaḥ' means the 'eye of knowledge' — the spiritual vision that allows one to perceive the eternal Self beyond the material body.",
            "According to Krishna, only those with the eye of knowledge and a purified heart can see the Self dwelling within.",
            "The 'eye of knowledge' refers to spiritual insight, born of meditation, devotion, and understanding, which allows one to see life as sacred and interconnected."
        ]
    },
    11: {
        "user_prompts": [
            "Explain shloka 11",
            "What does verse 11 mean?",
            "Who can see the soul according to Krishna?",
            "What is [translate:यतन्तो योगिनश्चैनं] (yatanto yoginaś cainaṃ)?",
            "Why can't some people perceive the Self even when they try?",
            "What does Krishna mean by purified mind here?",
            "How do Yogis realize the Self in this verse?"
        ],
        "empathetic_replies": [
            "In shloka 11, Krishna teaches that only those who are truly devoted and disciplined can perceive the soul within.",
            "Verse 11 explains that self-realization comes from inner stillness and a purified heart, not merely external effort.",
            "According to Krishna, only devoted Yogis and sincere practitioners with calm minds can perceive the eternal Self.",
            "'Yatanto yoginaś cainaṃ' refers to Yogis striving sincerely, but only those with purity and inner focus succeed in realization.",
            "Some cannot perceive the Self because their minds are clouded, restless, or full of desires, preventing spiritual vision.",
            "A purified mind is calm, disciplined, humble, and focused on the Divine, allowing the light of the Self to shine within.",
            "Yogis realize the Self through devotion, meditation, and detachment, cultivating inner clarity that unveils the soul naturally."
        ]
    },
    12: {
        "user_prompts": [
            "Explain shloka 12",
            "What does verse 12 mean?",
            "What is [translate:यदादित्यगतं तेजः] (yad āditya-gataṃ tejaḥ)?",
            "How is Krishna connected to the sun, moon, and fire?",
            "What does Krishna mean when He says ‘that light is Mine’?",
            "How does this verse show God’s presence in nature?"
        ],
        "empathetic_replies": [
            "In shloka 12, Krishna reveals that the brilliance of the sun, the moon, and fire are expressions of His divine essence.",
            "Verse 12 explains that all sources of light in nature are manifestations of Krishna’s sustaining presence.",
            "'Yad āditya-gataṃ tejaḥ' means 'the light that has gone into the sun,' emphasizing that all celestial light is His energy.",
            "Krishna permeates the sun, moon, and fire, showing that the Divine is present in all natural illumination.",
            "When Krishna says 'that light is Mine,' He means that the divine energy sustains all beings and manifests through nature’s brilliance.",
            "This verse demonstrates God’s omnipresence, showing that every source of light and warmth reflects His eternal presence."
        ]
    },
    13: {
        "user_prompts": [
            "Explain shloka 13",
            "What does verse 13 mean?",
            "What is [translate:गामाविश्य भूतानि धारयाम्यहमोजसा] (gām āviśya bhūtāni dhārayāmy aham ojasā)?",
            "How does Krishna sustain all life?",
            "What does Krishna mean when He says He nourishes all plants?",
            "How is divinity present in the earth and moon?"
        ],
        "empathetic_replies": [
            "In shloka 13, Krishna beautifully expresses His nurturing aspect, sustaining all living beings.",
            "Verse 13 explains that He enters the earth and supports all life with His divine energy, sustaining creation continuously.",
            "The Sanskrit 'gām āviśya bhūtāni dhārayāmy aham ojasā' means 'entering the earth, I sustain all beings with my vital energy.'",
            "Krishna sustains life by being the inner strength in every living being and plant, giving them vitality and nourishment.",
            "By saying He nourishes all plants, Krishna illustrates His intimate care and presence in the growth and sustenance of life.",
            "Divinity is present in the earth, moon, and all natural elements, reminding us that every part of creation is infused with the Divine."
        ]
    },
    14: {
        "user_prompts": [
            "Explain shloka 14",
            "What does verse 14 mean?",
            "How are the elements of nature connected to Krishna?",
            "What is [translate:सर्वं ज्ञानप्लवेनैव] (sarvaṃ jñāna-plavenaiva)?",
            "How does Krishna act in the world?",
            "What does this verse teach about divine omnipresence?"
        ],
        "empathetic_replies": [
            "Shloka 14 explains that Krishna pervades all elements of nature and acts as their guiding force.",
            "Verse 14 emphasizes that every natural element, from earth to sky, functions through Krishna’s energy and wisdom.",
            "'Sarvaṃ jñāna-plavenaiva' means 'everything is carried along by the boat of knowledge,' showing divine guidance in creation.",
            "The elements of nature are connected to Krishna because He sustains, directs, and energizes all aspects of the material world.",
            "Krishna acts in the world by being present in all processes, guiding creation with His consciousness and subtle influence.",
            "This verse teaches that divine omnipresence exists in every aspect of life, and understanding this fosters reverence and devotion."
        ]
    },
    15: {
        "user_prompts": [
            "Explain shloka 15",
            "What does verse 15 mean?",
            "What is [translate:सर्वस्य चाहं हृदि सन्निविष्टो] (sarvasya cāhaṃ hṛdi sanniviṣṭo)?",
            "What does Krishna mean when He says memory, knowledge, and forgetfulness come from Him?",
            "How is God related to the Vedas?",
            "What is the essence Krishna wants us to know in this verse?"
        ],
        "empathetic_replies": [
            "Shloka 15 reveals Krishna’s intimate presence: He resides in the heart of every being.",
            "Verse 15 explains that memory, wisdom, and even forgetfulness arise from Him, showing His control over thought and awareness.",
            "'Sarvasya cāhaṃ hṛdi sanniviṣṭo' means that Krishna dwells in the heart of all beings, sustaining consciousness from within.",
            "When Krishna says memory, knowledge, and forgetfulness come from Him, He means all mental faculties are guided by the Divine.",
            "God is the essence of the Vedas; all sacred knowledge ultimately points to Him and finds its fulfillment in Him.",
            "The essence of this verse is realizing that God is not distant, but tenderly present within your own heart, guiding and sustaining your inner life."
        ]
    },
    16: {
        "user_prompts": [
            "Explain shloka 16",
            "What does verse 16 mean?",
            "What is [translate:द्वाविमौ पुरुषौ लोके] (dvāv imau puruṣau loke)?",
            "Who are the two Purushas mentioned in this verse?",
            "What is the difference between [translate:क्षर] (kṣara) and [translate:अक्षर] (akṣara)?",
            "How does Krishna describe the perishable and imperishable beings?"
        ],
        "empathetic_replies": [
            "Shloka 16 reveals there are two aspects of existence: the perishable and the imperishable.",
            "Verse 16 explains that material beings are perishable, while the imperishable refers to the unchanging Self.",
            "'Dvāv imau puruṣau loke' means 'there are two Purushas in the world,' highlighting the distinction between mortal and eternal beings.",
            "The two Purushas are: the perishable (kṣara), representing material beings, and the imperishable (akṣara), representing the eternal soul.",
            "Kṣara refers to the changing, temporary material world, whereas akṣara refers to the unchanging, immortal Self.",
            "Krishna wants us to see that while the outer world is transient, our true Self belongs to the imperishable, eternal dimension."
        ]
    },
    17: {
        "user_prompts": [
            "Explain shloka 17",
            "What does verse 17 mean?",
            "Who is [translate:उत्तमः पुरुषः] (uttamaḥ puruṣaḥ)?",
            "How is the Supreme Purusha different from the other two?",
            "What does Krishna mean by entering the three worlds?",
            "Who sustains the universe according to this verse?"
        ],
        "empathetic_replies": [
            "Shloka 17 introduces the Supreme Purusha — the highest Self, beyond perishable and imperishable.",
            "Verse 17 explains that this Supreme Being pervades and lovingly supports all three worlds: earth, sky, and heaven.",
            "'Uttamaḥ puruṣaḥ' refers to the Supreme Person, Paramatma, who is above both material and spiritual entities.",
            "The Supreme Purusha is unchanging, all-sustaining, and compassionate, unlike the perishable and imperishable beings.",
            "By entering the three worlds, Krishna means His presence pervades every realm, supporting and maintaining all creation.",
            "The Supreme Purusha sustains the universe, holding everything together with His divine consciousness."
        ]
    },
    18: {
        "user_prompts": [
            "Explain shloka 18",
            "What does verse 18 mean?",
            "Why is Krishna called [translate:पुरुषोत्तमः] (puruṣottamaḥ)?",
            "How is the Supreme Being higher than both the perishable and imperishable?",
            "What does Krishna mean when He says He transcends both?",
            "Why is the Lord famous in the Vedas as Purushottama?"
        ],
        "empathetic_replies": [
            "Shloka 18 lovingly declares Krishna as Purushottama — the Supreme Person.",
            "Verse 18 explains that He transcends both the perishable material world and the imperishable soul.",
            "Krishna is called Purushottama because He is the ultimate source and essence of everything that exists.",
            "The Supreme Being is higher than both perishable and imperishable because He is beyond duality, changeless yet dynamic.",
            "By transcending both, Krishna stands as the ultimate reality, above all forms, time, and change.",
            "He is famous in the Vedas as Purushottama, the highest and most complete reality, known to sages and the wise."
        ]
    },
    19: {
        "user_prompts": [
            "Explain shloka 19",
            "What does verse 19 mean?",
            "Who truly understands the Supreme Purusha?",
            "What is [translate:यो मामेवमसम्मूढो] (yo mām evam asammūḍho)?",
            "What does Krishna mean by 'one who knows Me thus'?",
            "How does devotion come from understanding Purushottama?"
        ],
        "empathetic_replies": [
            "Shloka 19 teaches that those free from confusion, realizing Krishna as the Supreme Person, become all-knowing.",
            "Verse 19 explains that knowing the Supreme transforms understanding into love and devotion.",
            "Only one who perceives Krishna as Purushottama, with clarity and sincerity, truly understands Him.",
            "'Yo mām evam asammūḍho' means 'one who knows Me without delusion,' indicating a devoted, clear-minded soul.",
            "Krishna means that realizing His true nature allows the devotee to see the Divine in everything.",
            "Devotion naturally arises when one understands Purushottama, because love flows from clarity and recognition of the Supreme."
        ]
    },
    20: {
        "user_prompts": [
            "Explain shloka 20",
            "What does verse 20 mean?",
            "What is the hidden knowledge Krishna reveals here?",
            "What is [translate:गुह्यतमं शास्त्रम्] (guhyatamaṃ śāstram)?",
            "Why does Krishna call this sacred teaching most secret?",
            "What happens when one understands this teaching?"
        ],
        "empathetic_replies": [
            "Shloka 20 concludes the chapter with Krishna’s most sacred and secret teaching.",
            "Verse 20 explains that understanding the Supreme Person’s truth leads to inner fulfillment and wisdom.",
            "The hidden knowledge is the essence of all wisdom — realizing the Supreme Being as Purushottama.",
            "'Guhyatamaṃ śāstram' means 'the most secret scripture,' indicating the deepest spiritual truth revealed to Arjuna.",
            "Krishna calls it most secret because it is subtle, profound, and requires purity and sincere seeking to comprehend.",
            "When one understands this teaching, the soul experiences peace, clarity, and a sense of completeness (kṛtakṛtya), liberated from confusion."
        ]
    }
}

# ---------------------------------------------------------------------------
# FUZZY EMPATHETIC REPLY LOOKUP
# ---------------------------------------------------------------------------
def find_empathic_reply(user_message, min_score=80):
    msg = (user_message or "").strip().lower()
    best_score = 0
    best_reply, best_verse = None, None

    for verse_num, record in gita_ch15_dialogues.items():
        for idx, prompt in enumerate(record["user_prompts"]):
            score = fuzz.token_set_ratio(msg, prompt.lower())
            if score > best_score:
                best_score = score
                best_reply = record["empathetic_replies"][idx]
                best_verse = verse_num

    if best_score >= min_score:
        return best_reply, best_verse
    return None, None

# ---------------------------------------------------------------------------
# FIXED QUICK REPLY LOOKUP
# ---------------------------------------------------------------------------
def find_quick_reply(message, language="en"):
    msg = (message or "").strip().lower()
    fixed_replies = quick_question_replies.get(language, {})
    for q, ans in fixed_replies.items():
        if fuzz.token_set_ratio(msg, q.lower()) > 90:
            return ans
    return None

# ---------------------------------------------------------------------------
# CONTEXT BUILDER (no JSON, guidance-only)
# ---------------------------------------------------------------------------
def retrieve_context(message: str, shloka=None, line=None, topk=3):
    """
    Provide guidance-only context so Gemini composes
    Sanskrit, transliteration, and word meanings directly.
    """
    ctx = []
    if shloka:
        text = [
            f"Focus: Bhagavad Gita, Chapter 15, Shloka {shloka}.",
            "Return the following in order:",
            "1) Sanskrit shloka",
            "2) Transliteration",
            "3) Word-by-word meanings",
            "4) Concise explanation with spiritual and practical insights.",
            "Be accurate and standard; do not invent verses. If uncertain, say 'unverified' and give the most accepted rendering."
        ]
        if line:
            text.append(f"User is asking specifically about: {line}")
        ctx.append({"id": f"chapter15:{shloka}", "text": " ".join(text)})
    else:
        ctx.append({
            "id": "general",
            "text": (
                "Topic: Bhagavad Gita Chapter 15 (Purushottama Yoga). "
                "Themes: inverted Ashvattha tree; perishable vs imperishable; Supreme Person (Purushottama); "
                "detachment and devotion."
            )
        })
    return ctx[:topk]

# ---------------------------------------------------------------------------
# GEMINI CALLER
# ---------------------------------------------------------------------------
def call_gemini_api(prompt_text, model=GEMINI_MODEL, temperature=0.3, max_tokens=512):
    url = GEMINI_ENDPOINT.format(model=model)
    params = {"key": GOOGLE_API_KEY}
    body = {
        "contents": [{"role": "user", "parts": [{"text": prompt_text}]}],
        "generationConfig": {"temperature": temperature, "maxOutputTokens": max_tokens},
    }
    try:
        r = requests.post(url, params=params, json=body, timeout=60)
        r.raise_for_status()
        j = r.json()
        candidates = j.get("candidates", [])
        if candidates:
            parts = candidates[0].get("content", {}).get("parts", [])
            if parts and "text" in parts[0]:
                return parts[0]["text"]
        LOG.warning("Unexpected Gemini response structure: %s", j)
        return "Sorry, I couldn't generate a response at the moment."
    except Exception as e:
        LOG.error("Gemini call failed: %s", e)
        return "Sorry, an error occurred while fetching from Gemini."

# ---------------------------------------------------------------------------
# ENDPOINTS
# ---------------------------------------------------------------------------
@app.route("/chat", methods=["POST"])
def chat():
    payload = request.json or {}
    message = payload.get("message", "")
    requested_lang = (payload.get("language") or "en").strip().lower()
    if not message:
        return jsonify({"error": "message required"}), 400

    # Use ONLY client-provided language from the frontend
    language = "hi" if requested_lang == "hi" else "en"

    # 1) Fixed quick replies
    quick_reply = find_quick_reply(message, language)
    if quick_reply:
        return jsonify({"answer": quick_reply, "source": "fixed-reply", "language": language})

    # 2) Shloka-level fuzzy (English patterns; Hindi likely falls through to Gemini)
    empathic_reply, shloka_key = find_empathic_reply(message)
    if empathic_reply:
        return jsonify({
            "answer": empathic_reply,
            "sources": [f"chapter15:shloka{shloka_key}"],
            "language": language
        })

    # 3) Direct Gemini generation (no JSON lookup)
    sh = payload.get("shloka")
    li = payload.get("line")
    ctx = retrieve_context(message, shloka=sh, line=li)

    model_to_use = GEMINI_FLASH_MODEL if language == "hi" else GEMINI_MODEL
    lang_hint = "Please respond in Hindi (natural, respectful tone)." if language == "hi" else "Please respond in English."

    prompt = (
        f"{SYSTEM_PROMPT}\n\n"
        f"{lang_hint}\n\n"
        f"Context:\n{format_context(ctx)}\n\n"
        f"User Query:\n{message}\n\n"
        f"Answer empathetically. Keep it accurate. If you are unsure about a Sanskrit line, mark it as 'unverified'."
    )

    answer = call_gemini_api(prompt, model=model_to_use)
    return jsonify({
        "answer": answer,
        "sources": [c['id'] for c in ctx],
        "language": language,
        "model_used": model_to_use
    })

@app.route("/health")
def health():
    return jsonify({
        "status": "ok",
        "model_default": GEMINI_MODEL,
        "model_hindi": GEMINI_FLASH_MODEL
    })

if __name__ == "__main__":
    print(f"🚀 Flask running on http://localhost:5600 — default Gemini model: {GEMINI_MODEL}, Hindi model: {GEMINI_FLASH_MODEL}")
    app.run(host="0.0.0.0", port=5600, debug=True)