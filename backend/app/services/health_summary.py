from app.schemas import BmiCategory, HealthSummary, Label, Lang, PatientSnapshot, Symptom

_URGENT_SYMPTOMS = {Symptom.chest_pain, Symptom.fainting}

_ADULT_AGE = 18
# WHO adult cut-offs. Children need age-based charts, so they get the number only.
_HEALTHY_FROM = 18.5
_OVERWEIGHT_FROM = 25
_OBESE_FROM = 30
# Outside this, the height or weight was almost certainly mistyped.
_LOWEST_BMI = 10
_HIGHEST_BMI = 80

# General advice only: no medicines, doses or disease names.
# Each entry is (English, Hindi). Hindi here is drafted and needs native-speaker review.
_SEE_DOCTOR_PROMPTLY = (
    "Chest pain or fainting needs a doctor promptly. Please do not wait.",
    "सीने में दर्द या बेहोशी में जल्द से जल्द डॉक्टर को दिखाएँ। इंतज़ार न करें।",
)
_TAKE_RESULT_TO_DOCTOR = (
    "Take this result to a doctor for a check-up.",
    "यह नतीजा लेकर डॉक्टर से जाँच कराएँ।",
)
_SYMPTOMS_NEED_DOCTOR = (
    "Please see a doctor about your symptoms, whatever this result says.",
    "नतीजा कुछ भी हो, अपने लक्षणों के लिए डॉक्टर से मिलें।",
)
_RECORD_AGAIN = (
    "Record again in a quiet place for a clearer result.",
    "साफ़ नतीजे के लिए शांत जगह पर दोबारा रिकॉर्ड करें।",
)
_SYMPTOM_WATCH: dict[Symptom, tuple[str, str]] = {
    Symptom.breathlessness: (
        "If breathlessness gets worse, see a doctor soon.",
        "साँस फूलना बढ़े तो जल्द डॉक्टर को दिखाएँ।",
    ),
    Symptom.palpitations: (
        "If your heart often feels like it is racing, tell your doctor.",
        "अगर धड़कन अक्सर तेज़ लगे, तो डॉक्टर को बताएँ।",
    ),
    Symptom.fatigue: (
        "If tiredness does not go away, tell your doctor.",
        "अगर थकान ठीक न हो, तो डॉक्टर को बताएँ।",
    ),
    Symptom.swelling: (
        "If swelling gets worse, see a doctor soon.",
        "सूजन बढ़े तो जल्द डॉक्टर को दिखाएँ।",
    ),
}
_KEEP_CHECK_UPS = (
    "Keep up your regular check-ups for your known conditions.",
    "पहले से चल रही बीमारी के लिए नियमित जाँच कराते रहें।",
)
_BALANCED_WEIGHT = (
    "Balanced meals and regular activity can help you reach a healthy weight.",
    "संतुलित भोजन और नियमित गतिविधि से वज़न ठीक रखने में मदद मिल सकती है।",
)
_BMI_ADVICE: dict[BmiCategory, tuple[str, str]] = {
    BmiCategory.underweight: (
        "Regular, balanced meals can help. Ask a doctor if your weight keeps falling.",
        "नियमित और संतुलित भोजन मदद कर सकता है। वज़न घटता रहे तो डॉक्टर से पूछें।",
    ),
    BmiCategory.overweight: _BALANCED_WEIGHT,
    BmiCategory.obese: _BALANCED_WEIGHT,
}
_DAILY_HABITS = (
    "A short daily walk and less salt in food can help, unless your doctor has said otherwise.",
    "रोज़ थोड़ा चलना और खाने में कम नमक मदद कर सकता है, अगर डॉक्टर ने मना न किया हो।",
)


def _bmi(height_cm: float | None, weight_kg: float | None) -> float | None:
    if height_cm is None or weight_kg is None:
        return None
    bmi = round(weight_kg / (height_cm / 100) ** 2, 1)
    return bmi if _LOWEST_BMI <= bmi <= _HIGHEST_BMI else None


def _bmi_category(bmi: float | None, age_years: int) -> BmiCategory | None:
    if bmi is None or age_years < _ADULT_AGE:
        return None
    if bmi < _HEALTHY_FROM:
        return BmiCategory.underweight
    if bmi < _OVERWEIGHT_FROM:
        return BmiCategory.healthy
    if bmi < _OBESE_FROM:
        return BmiCategory.overweight
    return BmiCategory.obese


def _doctor_advice(label: Label, patient: PatientSnapshot) -> tuple[str, str] | None:
    if _URGENT_SYMPTOMS.intersection(patient.symptoms):
        return _SEE_DOCTOR_PROMPTLY
    if label == Label.needs_checkup:
        return _TAKE_RESULT_TO_DOCTOR
    if patient.symptoms:
        return _SYMPTOMS_NEED_DOCTOR
    if label == Label.unclear:
        return _RECORD_AGAIN
    return None


def _suggestions(
    label: Label, patient: PatientSnapshot, category: BmiCategory | None
) -> list[tuple[str, str]]:
    advice = _doctor_advice(label, patient)
    suggestions = [advice] if advice else []
    suggestions += [_SYMPTOM_WATCH[s] for s in patient.symptoms if s in _SYMPTOM_WATCH]
    if patient.known_conditions:
        suggestions.append(_KEEP_CHECK_UPS)

    # Walking and weight tips are wrong for someone who needs a doctor first, or for a child.
    if patient.age_years >= _ADULT_AGE and not _URGENT_SYMPTOMS.intersection(patient.symptoms):
        if category in _BMI_ADVICE:
            suggestions.append(_BMI_ADVICE[category])
        suggestions.append(_DAILY_HABITS)
    return suggestions


def build_health_summary(patient: PatientSnapshot, label: Label) -> HealthSummary:
    """Extra information beside the result. It never changes the result."""
    bmi = _bmi(patient.height_cm, patient.weight_kg)
    category = _bmi_category(bmi, patient.age_years)
    suggestions = _suggestions(label, patient, category)
    return HealthSummary(
        bmi=bmi,
        bmi_category=category,
        symptoms=patient.symptoms,
        known_conditions=patient.known_conditions,
        suggestions={
            Lang.en: [english for english, _ in suggestions],
            Lang.hi: [hindi for _, hindi in suggestions],
        },
    )
