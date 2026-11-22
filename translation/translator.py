"""Two-way mock translation with curated demo phrases.

The phrasebook covers the synthetic sample transcript and sample clinician note
for Tamil, Hindi, Spanish, French, and Arabic. Anything else returns a clearly
labeled fallback string. Replace :class:`MockTranslator` with a real provider
while keeping the same ``translate`` signature.
"""

from __future__ import annotations

from typing import Protocol, runtime_checkable

from bob_agent.prompts import FALLBACK_TRANSLATION_LABEL
from translation.languages import LANGUAGES

PATIENT_EN = (
    "I have had fever and throat pain for two days. I took paracetamol, but the "
    "fever has not gone down. I have a blood test report. Please look at it and advise me."
)

PATIENT_TA = (
    "எனக்கு இரண்டு நாட்களாக காய்ச்சல், தொண்டை வலி உள்ளது. நான் பாராசிடமோல் "
    "சாப்பிட்டேன், ஆனால் காய்ச்சல் குறையவில்லை. என்னிடம் ரத்த பரிசோதனை "
    "அறிக்கை உள்ளது. தயவுசெய்து அதைப் பார்த்து எனக்கு அறிவுரை தருங்கள்."
)

PATIENT_HI = (
    "मुझे दो दिनों से बुखार और गले में दर्द है। मैंने पैरासिटामोल ली, लेकिन "
    "बुखार नहीं उतरा। मेरे पास रक्त परीक्षण की रिपोर्ट है। कृपया उसे देखकर मुझे सलाह दें।"
)

PATIENT_ES = (
    "Tengo fiebre y dolor de garganta desde hace dos días. Tomé paracetamol, "
    "pero la fiebre no bajó. Tengo un informe de análisis de sangre. "
    "Por favor, revíselo y déme consejos."
)

PATIENT_FR = (
    "J'ai de la fièvre et mal à la gorge depuis deux jours. J'ai pris du "
    "paracétamol, mais la fièvre n'est pas tombée. J'ai un rapport d'analyse "
    "de sang. Merci de le consulter et de me conseiller."
)

PATIENT_AR = (
    "لدي حمى وألم في الحلق منذ يومين. تناولت الباراسيتامول ولكن الحمى لم "
    "تنخفض. لدي تقرير تحليل دم. يرجى الاطلاع عليه وإعطائي النصيحة."
)

DOCTOR_EN = "\n".join(
    [
        "Doctor's note for you:",
        "Assessment: Upper respiratory infection; review red flags.",
        "Plan: Continue paracetamol for fever, warm saline gargles, fluids and rest.",
        "Medicine: Amoxicillin 500 mg three times daily for 5 days (if no allergy and clinician confirms).",
        "Follow-up: Review in 3 days or sooner if breathing difficulty, persistent high fever, or worsening symptoms.",
        "Safety: Complete the course; do not self-medicate antibiotics.",
    ]
)

DOCTOR_TA = "\n".join(
    [
        "மருத்துவரின் குறிப்பு:",
        "மதிப்பீடு: மேல் சுவாசப் பாதை நோய்; அபாய அறிகுறிகளைக் கவனிக்கவும்.",
        "திட்டம்: காய்ச்சலுக்கு பாராசிடமோல் தொடரலாம், வெதுவெதுப்பான உப்பு நீரால் தொண்டை கொப்பளிக்கவும், திரவங்கள் மற்றும் ஓய்வு எடுக்கவும்.",
        "மருந்து: அமோக்ஸிசிலின் 500 மி.கி நாளுக்கு மூன்று முறை 5 நாட்களுக்கு (ஒவ்வாமை இல்லை என மருத்துவர் உறுதி செய்தால் மட்டும்).",
        "மறுபரிசீலனை: 3 நாட்களில் அல்லது சுவாசிப்பதில் சிரமம், நீடித்த அதிக காய்ச்சல், அல்லது அறிகுறிகள் மோசமடைந்தால் உடனே வரவும்.",
        "பாதுகாப்பு: மருந்தின் முழு கோர்ஸையும் முடிக்கவும்; நீங்களே ஆண்டிபயாடிக் எடுத்துக்கொள்ள வேண்டாம்.",
    ]
)

DOCTOR_HI = "\n".join(
    [
        "डॉक्टर का नोट:",
        "मूल्यांकन: ऊपरी श्वसन संक्रमण; लाल झंडों की समीक्षा करें।",
        "योजना: बुखार के लिए पैरासिटामोल जारी रखें, गुनगुने नमकीन पानी से गारगल करें, तरल पदार्थ और आराम लें।",
        "दवा: एमोक्सिसिलिन 500 मिलीग्राम दिन में तीन बार 5 दिनों के लिए (केवल तब जब डॉक्टर पुष्टि करें कि एलर्जी नहीं है)।",
        "फॉलो-अप: 3 दिनों में या सांस लेने में कठिनाई, लगातार तेज बुखार, या लक्षण बिगड़ने पर जल्दी आएं।",
        "सुरक्षा: पूरा कोर्स पूरा करें; स्वयं एंटीबायॉटिक न लें।",
    ]
)

DOCTOR_ES = "\n".join(
    [
        "Nota del médico:",
        "Evaluación: Infección respiratoria alta; revisar signos de alarma.",
        "Plan: Continuar paracetamol para la fiebre, hacer gárgaras con agua salada tibia, hidratarse y descansar.",
        "Medicamento: Amoxicilina 500 mg tres veces al día durante 5 días (solo si el médico confirma que no hay alergia).",
        "Seguimiento: Revisión en 3 días o antes si hay dificultad para respirar, fiebre alta persistente o empeoramiento.",
        "Seguridad: Complete el tratamiento; no tome antibióticos por su cuenta.",
    ]
)

DOCTOR_FR = "\n".join(
    [
        "Note du médecin :",
        "Évaluation : Infection respiratoire haute ; surveiller les signes d'alerte.",
        "Plan : Continuer le paracétamol pour la fièvre, faire des gargarismes à l'eau salée tiède, boire des liquides et se reposer.",
        "Médicament : Amoxicilline 500 mg trois fois par jour pendant 5 jours (uniquement si le médecin confirme l'absence d'allergie).",
        "Suivi : Révision dans 3 jours ou plus tôt en cas de difficulté respiratoire, fièvre élevée persistante ou aggravation.",
        "Sécurité : Terminez le traitement ; ne prenez pas d'antibiotiques sans avis médical.",
    ]
)

DOCTOR_AR = "\n".join(
    [
        "ملاحظة الطبيب:",
        "التقييم: التهاب الجهاز التنفسي العلوي؛ مراجعة علامات الخطر.",
        "الخطة: الاستمرار على الباراسيتامول للحمى، والغرغرة بماء دافئ مالح، وشرب السوائل والراحة.",
        "الدواء: أموكسيسيلين 500 ملغ ثلاث مرات يومياً لمدة 5 أيام (فقط إذا أكد الطبيب عدم وجود حساسية).",
        "المتابعة: مراجعة بعد 3 أيام أو قبل ذلك عند صعوبة التنفس أو استمرار حرارة عالية أو تفاقم الأعراض.",
        "السلامة: أكمل دورة العلاج؛ لا تتناول مضادات حيوية من تلقاء نفسك.",
    ]
)

PHRASE_BOOK: dict[tuple[str, str], dict[str, str]] = {
    ("ta", "en"): {PATIENT_TA: PATIENT_EN},
    ("hi", "en"): {PATIENT_HI: PATIENT_EN},
    ("es", "en"): {PATIENT_ES: PATIENT_EN},
    ("fr", "en"): {PATIENT_FR: PATIENT_EN},
    ("ar", "en"): {PATIENT_AR: PATIENT_EN},
    ("en", "ta"): {DOCTOR_EN: DOCTOR_TA},
    ("en", "hi"): {DOCTOR_EN: DOCTOR_HI},
    ("en", "es"): {DOCTOR_EN: DOCTOR_ES},
    ("en", "fr"): {DOCTOR_EN: DOCTOR_FR},
    ("en", "ar"): {DOCTOR_EN: DOCTOR_AR},
}


@runtime_checkable
class Translator(Protocol):
    """Translate text between language codes."""

    def translate(self, text: str, source: str, target: str) -> str: ...


class MockTranslator:
    """Deterministic phrasebook translator for the hackathon demo."""

    def translate(self, text: str, source: str, target: str) -> str:
        if source == target:
            return text
        key = text.strip()
        translated = PHRASE_BOOK.get((source, target), {}).get(key)
        if translated:
            return translated
        language = LANGUAGES.get(target, {}).get("native", target)
        return f"[{language} · {FALLBACK_TRANSLATION_LABEL}] {text}"


def translate(text: str, source: str, target: str) -> str:
    """Module-level convenience wrapper around :class:`MockTranslator`."""
    return MockTranslator().translate(text, source, target)


__all__ = [
    "Translator",
    "MockTranslator",
    "translate",
    "PATIENT_EN",
    "PATIENT_TA",
    "PATIENT_HI",
    "PATIENT_ES",
    "DOCTOR_EN",
    "DOCTOR_TA",
    "DOCTOR_HI",
    "DOCTOR_ES",
]
