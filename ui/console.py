"""Small ANSI helpers that keep the CLI demo colorful and scannable."""

from __future__ import annotations

import sys

from bob_agent.config import APP_NAME, APP_VERSION
from bob_agent.models import DoctorPacket, PatientMessage
from translation.languages import language_label

_ANSI = {
    "pink": "\033[95m",
    "blue": "\033[94m",
    "cyan": "\033[96m",
    "green": "\033[92m",
    "yellow": "\033[93m",
    "purple": "\033[35m",
    "red": "\033[91m",
    "bold": "\033[1m",
    "reset": "\033[0m",
}


def paint(text: str, color: str) -> str:
    """Apply ANSI color only when stdout is a terminal."""
    if not sys.stdout.isatty():
        return text
    return f"{_ANSI.get(color, '')}{text}{_ANSI['reset']}"


def banner() -> str:
    return paint(f"\n🩺 {APP_NAME} v{APP_VERSION} — voice-first care bridge 💜\n", "bold")


def print_section(title: str, color: str = "cyan") -> None:
    print(paint(f"\n{'─' * 68}", color))
    print(paint(f" {title}", color))
    print(paint(f"{'─' * 68}", color))


def print_doctor_packet(packet: DoctorPacket) -> None:
    print_section("📋 DOCTOR PACKET", "green")
    print(paint(f"Packet: {packet.packet_id}", "green"))
    print(paint(f"Patient: {packet.patient_name} ({packet.patient_id})", "green"))
    print(paint(f"Preferred language: {language_label(packet.patient_language)}", "green"))
    print("\nTranslated patient voice:")
    print(paint(packet.patient_voice_english, "blue"))
    print("\nStructured findings:")
    for finding in packet.extracted_findings:
        mark = "🔴" if finding.flag == "HIGH" else "🟡" if finding.flag == "LOW" else "⚪"
        print(paint(f"  {mark} {finding.label}: {finding.value} [{finding.flag}]", "yellow"))
    print("\nSuggested review focus:")
    for item in packet.suggested_review_focus:
        print(paint(f"  • {item}", "green"))


def print_patient_message(message: PatientMessage) -> None:
    print_section(f"🔊 PATIENT BRIEF — {language_label(message.language)}", "pink")
    print(message.text)
    if message.audio_path:
        print(paint(f"\nAudio placeholder: {message.audio_path}", "purple"))
    print(paint("\nReminder: clinician review required; not a standalone diagnosis.", "red"))


__all__ = ["paint", "banner", "print_section", "print_doctor_packet", "print_patient_message"]
