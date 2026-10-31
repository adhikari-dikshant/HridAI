from app.schemas import Label, Location, QualityIssue

# Hindi other than too_noisy is drafted and needs native-speaker review.
ISSUE_MESSAGES: dict[QualityIssue, tuple[str, str]] = {
    QualityIssue.too_short: (
        "Recording was too short. Hold still for the full 15 seconds.",
        "रिकॉर्डिंग बहुत छोटी थी। पूरे 15 सेकंड तक स्थिर रहें।",
    ),
    QualityIssue.too_quiet: (
        "Heartbeat was too faint. Press the phone more firmly on bare skin.",
        "धड़कन बहुत धीमी सुनाई दी। फ़ोन को खुली त्वचा पर और मज़बूती से दबाएँ।",
    ),
    QualityIssue.clipping: (
        "Sound was distorted. Hold the phone steady without rubbing.",
        "आवाज़ बिगड़ गई थी। फ़ोन को बिना रगड़े स्थिर रखें।",
    ),
    QualityIssue.too_noisy: (
        "Too much background noise. Turn off the fan and record again.",
        "पीछे की आवाज़ बहुत ज़्यादा है। पंखा बंद करके दोबारा रिकॉर्ड करें।",
    ),
    QualityIssue.no_heartbeat_detected: (
        "We couldn't hear a heartbeat. Check the position on the chest guide.",
        "हमें धड़कन सुनाई नहीं दी। छाती के चित्र में सही जगह देखें।",
    ),
    QualityIssue.heart_rate_out_of_range: (
        "Reading was unclear. Please record again.",
        "रिकॉर्डिंग साफ़ नहीं थी। कृपया दोबारा रिकॉर्ड करें।",
    ),
}

# Firm pressure on the carotid artery can cause fainting, so neck messages never say to press.
NECK_ISSUE_MESSAGES: dict[QualityIssue, tuple[str, str]] = {
    QualityIssue.too_quiet: (
        "Heartbeat was too faint. Move the phone a little, keeping a light touch. "
        "Do not press harder.",
        "धड़कन बहुत धीमी सुनाई दी। फ़ोन को थोड़ा खिसकाएँ और हल्के से ही रखें। ज़ोर से न दबाएँ।",
    ),
    QualityIssue.no_heartbeat_detected: (
        "We couldn't hear a heartbeat. Check the position on the neck guide.",
        "हमें धड़कन सुनाई नहीं दी। गर्दन के चित्र में सही जगह देखें।",
    ),
}

DISCLAIMER = {
    "en": "This is an AI screening tool, not a medical diagnosis. Always consult a doctor.",
    "hi": "यह एक AI स्क्रीनिंग टूल है, मेडिकल निदान नहीं। हमेशा डॉक्टर से सलाह लें।",
}


def issue_message(issue: QualityIssue, location: Location) -> tuple[str, str]:
    if location == Location.NK and issue in NECK_ISSUE_MESSAGES:
        return NECK_ISSUE_MESSAGES[issue]
    return ISSUE_MESSAGES[issue]


HEADLINES: dict[Label, dict[str, str]] = {
    Label.unclear: {"en": "Recording unclear", "hi": "रिकॉर्डिंग साफ़ नहीं है"},
    Label.needs_checkup: {"en": "Please get a check-up", "hi": "कृपया डॉक्टर से जाँच कराएँ"},
    Label.normal: {"en": "No unusual sound found", "hi": "कोई असामान्य आवाज़ नहीं मिली"},
}
