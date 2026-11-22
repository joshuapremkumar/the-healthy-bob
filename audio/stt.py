"""Speech-to-text interface and a demo backend.

The demo audio is a labeled placeholder. :class:`SidecarTranscriptSTT` reads a
``.txt`` file next to the audio file, which keeps the end-to-end flow runnable
without external services. Replace it with a real STT provider for production.
"""

from __future__ import annotations

from pathlib import Path
from typing import Protocol, runtime_checkable

from bob_agent.models import Transcript


@runtime_checkable
class SpeechToText(Protocol):
    """Convert audio into a transcript plus metadata."""

    def transcribe(self, audio_path: Path, language_hint: str) -> Transcript: ...


class SidecarTranscriptSTT:
    """Mock STT that reads ``<audio>.txt`` beside the sample audio file."""

    def __init__(self, sidecar_suffix: str = ".txt", confidence: float = 0.99):
        self.sidecar_suffix = sidecar_suffix
        self.confidence = confidence

    def transcribe(self, audio_path: Path, language_hint: str) -> Transcript:
        audio_path = Path(audio_path)
        sidecar = audio_path.with_suffix(self.sidecar_suffix)
        if not sidecar.exists():
            raise FileNotFoundError(
                f"No transcript sidecar found for {audio_path.name}. "
                f"Expected {sidecar.name}."
            )
        text = sidecar.read_text(encoding="utf-8").strip()
        if not text:
            raise ValueError(f"Transcript sidecar is empty: {sidecar}")
        return Transcript(
            text=text,
            language=language_hint,
            confidence=self.confidence,
            source=f"mock:stt:{sidecar.name}",
        )


__all__ = ["SpeechToText", "SidecarTranscriptSTT"]
