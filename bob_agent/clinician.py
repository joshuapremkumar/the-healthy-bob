"""Clinician review step (mock implementation).

Replace :class:`SampleClinician` with a real review UI or API. The protocol is
the only contract the pipeline depends on.
"""

from __future__ import annotations

from pathlib import Path
from typing import Protocol, runtime_checkable

from bob_agent.models import DoctorAnalysis, DoctorPacket, utc_now

_FIELD_MAP = {
    "CLINICIAN": "clinician",
    "ASSESSMENT": "assessment",
    "PLAN": "plan",
    "PRESCRIPTION": "prescription",
    "FOLLOW-UP": "follow_up",
    "COUNSELLING": "safety_notes",
}


@runtime_checkable
class Clinician(Protocol):
    """Review a doctor packet and return a structured analysis."""

    def review(self, packet: DoctorPacket) -> DoctorAnalysis: ...


class SampleClinician:
    """Demo clinician that parses the synthetic prescription sample."""

    def __init__(self, prescription_path: Path):
        self.prescription_path = Path(prescription_path)

    def review(self, packet: DoctorPacket) -> DoctorAnalysis:
        if not self.prescription_path.exists():
            raise FileNotFoundError(f"Prescription sample not found: {self.prescription_path}")

        values: dict[str, str] = {}
        for line in self.prescription_path.read_text(encoding="utf-8").splitlines():
            if ":" not in line:
                continue
            key, value = line.split(":", 1)
            field_name = _FIELD_MAP.get(key.strip().upper())
            if field_name:
                values[field_name] = value.strip()

        missing = [name for name in _FIELD_MAP.values() if not values.get(name)]
        if missing:
            raise ValueError(f"Prescription sample is missing fields: {', '.join(missing)}")

        return DoctorAnalysis(
            packet_id=packet.packet_id,
            clinician=values["clinician"],
            assessment=values["assessment"],
            plan=values["plan"],
            prescription=values["prescription"],
            follow_up=values["follow_up"],
            safety_notes=values["safety_notes"],
            reviewed_at=utc_now(),
        )


__all__ = ["Clinician", "SampleClinician"]
