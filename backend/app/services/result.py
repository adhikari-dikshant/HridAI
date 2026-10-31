from dataclasses import dataclass

from app.schemas import Label, Location

MIN_QUALITY = 0.5


@dataclass(frozen=True)
class LocationScore:
    location: Location
    abnormal_probability: float
    quality_score: float


def distance_from_threshold(probability: float, threshold: float) -> float:
    """Confidence in the label: 0.5 at the threshold, rising to 1 at either end of the scale."""
    if probability >= threshold:
        return 0.5 + 0.5 * (probability - threshold) / (1 - threshold)
    return 0.5 + 0.5 * (threshold - probability) / threshold


def build_result(
    scores: list[LocationScore],
    heart_rates: list[int | None],
    threshold: float,
    model_version: str,
) -> dict:
    probability = max(score.abnormal_probability for score in scores)
    qualities = [score.quality_score for score in scores]

    if all(quality < MIN_QUALITY for quality in qualities):
        label = Label.unclear
        confidence = sum(qualities) / len(qualities)
    else:
        label = Label.needs_checkup if probability >= threshold else Label.normal
        confidence = distance_from_threshold(probability, threshold)

    known_rates = [rate for rate in heart_rates if rate is not None]
    return {
        "label": label,
        "confidence": round(confidence, 2),
        "abnormal_probability": round(probability, 2),
        "heart_rate_bpm": round(sum(known_rates) / len(known_rates)) if known_rates else None,
        "per_location": [
            {
                "location": score.location,
                "abnormal_probability": round(score.abnormal_probability, 2),
                "quality_score": round(score.quality_score, 2),
                "heatmap_url": None,
            }
            for score in scores
        ],
        "used_patient_data": False,
        "model_version": model_version,
    }
