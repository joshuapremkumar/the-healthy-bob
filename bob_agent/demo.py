"""One-command, offline end-to-end demo.

Usage:
    python -m bob_agent.demo --language ta
    python -m bob_agent.demo --list-languages
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from bob_agent.config import DEFAULT_OUTPUT_DIR, DEFAULT_PATIENT_LANGUAGE, SAMPLE_DIR
from bob_agent.models import PatientIntake
from bob_agent.pipeline import BobBridge
from translation.languages import LANGUAGES, language_label
from ui.console import banner, paint, print_doctor_packet, print_patient_message, print_section


def build_sample_intake(language: str = DEFAULT_PATIENT_LANGUAGE) -> PatientIntake:
    """Build the synthetic patient intake used by the demo."""
    audio = SAMPLE_DIR / "patient_voice.wav"
    lab_report = SAMPLE_DIR / "lab_report.txt"
    return PatientIntake(
        patient_id="PAT-2041",
        patient_name="Anitha R.",
        preferred_language=language,
        voice_transcript_path=audio,
        document_paths=(lab_report,),
        audio_path=audio,
    )


def list_languages() -> None:
    print("Supported demo languages:")
    for code, info in LANGUAGES.items():
        print(f"  {code:<3} {language_label(code):<38} {info['accent']}")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run The Healthy Bob end-to-end demo.")
    parser.add_argument(
        "--language",
        "-l",
        default=DEFAULT_PATIENT_LANGUAGE,
        choices=sorted(LANGUAGES),
        help="Patient's preferred language code (default: ta)",
    )
    parser.add_argument(
        "--output-dir",
        "-o",
        type=Path,
        default=DEFAULT_OUTPUT_DIR,
        help=f"Where to write demo artifacts (default: {DEFAULT_OUTPUT_DIR})",
    )
    parser.add_argument(
        "--list-languages",
        action="store_true",
        help="Print supported languages and exit",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    # Windows consoles often default to cp1252; emojis and Indic scripts need UTF-8.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")
        except (AttributeError, ValueError):  # pragma: no cover - unusual streams
            pass

    args = parse_args(argv)
    if args.list_languages:
        list_languages()
        return 0

    print(banner())
    intake = build_sample_intake(args.language)
    bridge = BobBridge()

    print_section("1️⃣ PATIENT INTAKE", "pink")
    print(paint(f"Patient: {intake.patient_name} ({intake.patient_id})", "pink"))
    print(paint(f"Language: {language_label(intake.preferred_language)}", "pink"))
    print(paint(f"Voice note: {intake.voice_transcript_path.name}", "pink"))
    print(paint(f"Shared documents: {', '.join(p.name for p in intake.document_paths)}", "pink"))

    result = bridge.run(intake, output_dir=args.output_dir)

    print_doctor_packet(result.doctor_packet)

    print_section("3️⃣ CLINICIAN ANALYSIS", "green")
    analysis = result.doctor_analysis
    print(paint(f"Clinician: {analysis.clinician}", "green"))
    print(paint(f"Assessment: {analysis.assessment}", "green"))
    print(paint(f"Plan: {analysis.plan}", "green"))
    print(paint(f"Prescription: {analysis.prescription}", "green"))
    print(paint(f"Follow-up: {analysis.follow_up}", "green"))

    print_patient_message(result.patient_message)

    print_section("✅ ARTIFACTS", "cyan")
    for name, path in result.artifacts.items():
        print(f"  {name:<20} {path}")

    print(
        paint(
            "\nAssistive demo only — clinician review required. "
            "Not a standalone diagnosis or certified interpreter.\n",
            "red",
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
