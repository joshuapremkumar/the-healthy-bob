"""Text-to-speech interface and a clearly labeled demo backend.

:class:`PlaceholderWavTTS` writes:

* ``<output>.txt`` — the readable localized message
* ``<output>.wav`` — a short, quiet tone sequence that marks where real speech
  would be generated

Replace the backend with IBM Text to Speech (or another TTS engine) for real
natural speech. The pipeline only depends on the :class:`TextToSpeech` protocol.
"""

from __future__ import annotations

import math
import wave
from pathlib import Path
from typing import Protocol, runtime_checkable


@runtime_checkable
class TextToSpeech(Protocol):
    """Synthesize speech audio for a localized message."""

    def synthesize(self, text: str, language: str, output_path: Path) -> Path: ...


class PlaceholderWavTTS:
    """Create a small placeholder WAV plus a readable text sidecar."""

    def __init__(self, sample_rate: int = 22050, beep_seconds: float = 0.12):
        self.sample_rate = sample_rate
        self.beep_seconds = beep_seconds

    def synthesize(self, text: str, language: str, output_path: Path) -> Path:
        output_path = Path(output_path)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        text_path = output_path.with_suffix(".txt")
        text_path.write_text(
            f"[{language}] {text}\n\n"
            "NOTE: this .txt sidecar is the readable patient brief. The .wav "
            "file is a labeled placeholder, not real synthesized speech.\n",
            encoding="utf-8",
        )

        self._write_placeholder_wav(output_path)
        return output_path

    def _write_placeholder_wav(self, output_path: Path) -> None:
        frames = int(self.sample_rate * self.beep_seconds)
        gap = frames // 2
        with wave.open(str(output_path), "wb") as wav:
            wav.setnchannels(1)
            wav.setsampwidth(2)
            wav.setframerate(self.sample_rate)
            chunks: list[bytes] = []
            for tone_index, _ in enumerate((0, 1, 2)):
                chunk = bytearray()
                for i in range(frames):
                    envelope = min(1.0, i / (frames * 0.15), (frames - i) / (frames * 0.25))
                    value = int(
                        2200 * envelope * math.sin(2 * math.pi * (440 + tone_index * 110) * i / self.sample_rate)
                    )
                    chunk.extend(value.to_bytes(2, "little", signed=True))
                chunks.append(bytes(chunk))
                chunks.append(b"\x00\x00" * gap)
            wav.writeframes(b"".join(chunks))


__all__ = ["TextToSpeech", "PlaceholderWavTTS"]
