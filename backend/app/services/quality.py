from typing import Protocol

from app.schemas import Location, Quality, QualityIssue

MIN_DURATION_MS = 8000

_MOCK_BPM = {Location.MV: 78, Location.AV: 74, Location.PV: 76, Location.TV: 76}


class QualityChecker(Protocol):
    def check(self, data: bytes, location: Location, duration_ms: int) -> Quality: ...


class MockQuality:
    """Accepts anything long enough. Replaced by the real checks in B4."""

    def check(self, data: bytes, location: Location, duration_ms: int) -> Quality:
        duration_s = round(duration_ms / 1000, 1)
        if duration_ms < MIN_DURATION_MS:
            return Quality(
                score=0.21,
                duration_s=duration_s,
                heart_rate_bpm=None,
                issues=[QualityIssue.too_short],
            )
        return Quality(
            score=0.82,
            duration_s=duration_s,
            heart_rate_bpm=_MOCK_BPM[location],
            issues=[],
        )
