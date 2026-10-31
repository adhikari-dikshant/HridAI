from typing import Protocol

from app.schemas import Label, Symptom

_URGENT_SYMPTOMS = {Symptom.chest_pain, Symptom.fainting}

# Hindi here is drafted and needs native-speaker review.
_TEMPLATES: dict[Label, dict[str, str]] = {
    Label.normal: {
        "en": (
            "No unusual sound was found in this recording. This is not a diagnosis. "
            "If you have symptoms, please see a doctor."
        ),
        "hi": (
            "इस रिकॉर्डिंग में कोई असामान्य आवाज़ नहीं मिली। यह निदान नहीं है। "
            "अगर आपको कोई लक्षण हैं, तो कृपया डॉक्टर से मिलें।"
        ),
    },
    Label.needs_checkup: {
        "en": (
            "The recording had a sound pattern that may need a check-up. "
            "This is not a diagnosis. Please visit a doctor soon."
        ),
        "hi": (
            "रिकॉर्डिंग में ऐसी आवाज़ मिली जिसकी जाँच ज़रूरी हो सकती है। "
            "यह निदान नहीं है। कृपया जल्द डॉक्टर से मिलें।"
        ),
    },
    Label.unclear: {
        "en": (
            "We could not get a clear result from this recording. "
            "Please record again in a quiet place, or see a doctor."
        ),
        "hi": (
            "इस रिकॉर्डिंग से साफ़ नतीजा नहीं मिला। "
            "कृपया शांत जगह पर दोबारा रिकॉर्ड करें या डॉक्टर से मिलें।"
        ),
    },
}

_URGENT_ADVICE = {
    "en": "Because of your symptoms, please see a doctor promptly.",
    "hi": "आपके लक्षणों को देखते हुए, कृपया जल्द से जल्द डॉक्टर से मिलें।",
}


class Explainer(Protocol):
    def explain(self, label: Label, symptoms: list[str]) -> dict[str, str]: ...


class TemplateExplainer:
    def explain(self, label: Label, symptoms: list[str]) -> dict[str, str]:
        explanation = dict(_TEMPLATES[label])
        if _URGENT_SYMPTOMS.intersection(symptoms):
            for lang, advice in _URGENT_ADVICE.items():
                explanation[lang] = f"{explanation[lang]} {advice}"
        return explanation
