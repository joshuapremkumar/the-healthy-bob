"""Shared data contracts for the Healthy Bob pipeline.

The dataclasses are intentionally small and dependency-free so the demo can run
with only the Python standard library. Use :func:`to_jsonable` before writing any
of them to JSON (it converts ``Path`` values to strings).
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field, is_dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def utc_now() -> str:
    """Return an ISO-8601 UTC timestamp."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def to_jsonable(value: Any) -> Any:
    """Recursively convert dataclasses and Paths into JSON-safe values."""
    if is_dataclass(value) and not isinstance(value, type):
        return {key: to_jsonable(item) for key, item in asdict(value).items()}
    if isinstance(value, Path):
        return str(value)
    if isinstance(value, dict):
        return {str(key): to_jsonable(item) for key, item in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [to_jsonable(item) for item in value]
    return value


@dataclass(frozen=True)
class Finding:
    """A structured observation extracted from a clinical document."""

    label: str
    value: str
    flag: str
    reference: str = ""
    source_line: str = ""


@dataclass(frozen=True)
class Transcript:
    """Result of a speech-to-text pass."""

    text: str
    language: str
    confidence: float
    source: str


@dataclass(frozen=True)
class ExtractedDocument:
    """A parsed patient-shared document."""

    document_id: str
    kind: str
    raw_text: str
    findings: tuple[Finding, ...]
    source_path: str


@dataclass(frozen=True)
class PatientIntake:
    """What the patient provides at the start of the loop."""

    patient_id: str
    patient_name: str
    preferred_language: str
    voice_transcript_path: Path
    document_paths: tuple[Path, ...] = field(default_factory=tuple)
    audio_path: Path | None = None


@dataclass(frozen=True)
class DoctorPacket:
    """The sourced clinical brief handed to the clinician."""

    packet_id: str
    patient_id: str
    patient_name: str
    patient_language: str
    clinician_language: str
    reported_symptoms: str
    patient_voice_english: str
    extracted_findings: tuple[Finding, ...]
    source_documents: tuple[str, ...]
    suggested_review_focus: tuple[str, ...]
    agent_prompt: str
    generated_at: str


@dataclass(frozen=True)
class DoctorAnalysis:
    """Clinician-authored assessment, plan, prescription, and follow-up."""

    packet_id: str
    clinician: str
    assessment: str
    plan: str
    prescription: str
    follow_up: str
    safety_notes: str
    reviewed_at: str

    def patient_facing_text(self) -> str:
        """Render a patient-friendly source string for translation + TTS."""
        return "\n".join(
            [
                "Doctor's note for you:",
                f"Assessment: {self.assessment}",
                f"Plan: {self.plan}",
                f"Medicine: {self.prescription}",
                f"Follow-up: {self.follow_up}",
                f"Safety: {self.safety_notes}",
            ]
        )


@dataclass(frozen=True)
class PatientMessage:
    """The localized text + audio returned to the patient."""

    language: str
    text: str
    audio_path: Path | None
    source_packet_id: str


@dataclass(frozen=True)
class PipelineResult:
    """Everything produced by one end-to-end run."""

    intake: PatientIntake
    transcript: Transcript
    documents: tuple[ExtractedDocument, ...]
    doctor_packet: DoctorPacket
    doctor_analysis: DoctorAnalysis
    patient_message: PatientMessage
    artifacts: dict[str, Path]

    def to_dict(self) -> dict[str, Any]:
        """Return a JSON-safe summary of the run."""
        return to_jsonable(self)
