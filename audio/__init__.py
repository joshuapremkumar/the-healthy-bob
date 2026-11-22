"""Speech interfaces and mock backends for the Healthy Bob demo."""

from audio.stt import SidecarTranscriptSTT, SpeechToText
from audio.tts import PlaceholderWavTTS, TextToSpeech

__all__ = [
    "SpeechToText",
    "SidecarTranscriptSTT",
    "TextToSpeech",
    "PlaceholderWavTTS",
]
