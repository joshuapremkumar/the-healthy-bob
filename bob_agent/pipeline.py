"""The Patient → Agent → Doctor → Agent → Patient pipeline."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Sequence
from uuid import uuid4

from audio.stt import SidecarTranscriptSTT, SpeechToText
from audio.tts import PlaceholderWavTTS, TextToSpeech
from bob_agent.clinician import Clinician, SampleClinician
from bob_agent.config import (
    DEFAULT_OUTPUT_DIR,
    DOCTOR_LANGUAGE,
    SAMPLE_DIR,
)
from bob_agent.models import (
    DoctorAnalysis,
    DoctorPacket,
    ExtractedDocument,
    PatientIntake,
    PatientMessage,
    PipelineResult,
    Transcript,
    to_jsonable,
    utc_now,
)
from bob_agent.prompts import DOCTOR_BRIEF_USER_TEMPLATE
from documents.extractor import DocumentExtractor, LabReportExtractor
from translation.translator import MockTranslator, Translator


def _short_id() -> str:
    return uuid4().hex[:8].upper()


def build_doctor_packet(
    *,
    intake: PatientIntake,
    transcript: Transcript,
    documents: Sequence[ExtractedDocument],
    patient_voice_english: str,
    packet_id: str | None = None,
) -> DoctorPacket:
    """Create a sourced clinical brief for the clinician."""
    findings = tuple(finding for document in documents for finding in document.findings)
    sources = tuple(document.source_path for document in documents)

    review_focus: list[str] = []
    for finding in findings:
        detail = f" ({finding.reference})" if finding.reference else ""
        review_focus.append(f"Review {finding.label}: {finding.flag} — {finding.value}{detail}")
    review_focus.append("Confirm medication allergies before prescribing.")
    review_focus.append("Consider interpreter / health-literacy review for patient understanding.")

    findings_text = "\n".join(
        f"- {finding.label}: {finding.value} [{finding.flag}] (source: {finding.source_line})"
        for finding in findings
    ) or "- No structured findings extracted."

    agent_prompt = DOCTOR_BRIEF_USER_TEMPLATE.format(
        patient_name=intake.patient_name,
        patient_id=intake.patient_id,
        patient_language=intake.preferred_language,
        clinician_language=DOCTOR_LANGUAGE,
        symptoms=patient_voice_english,
        findings=findings_text,
        sources=", ".join(sources) or "none",
    )

    return DoctorPacket(
        packet_id=packet_id or f"PKT-{_short_id()}",
        patient_id=intake.patient_id,
        patient_name=intake.patient_name,
        patient_language=intake.preferred_language,
        clinician_language=DOCTOR_LANGUAGE,
        reported_symptoms=transcript.text,
        patient_voice_english=patient_voice_english,
        extracted_findings=findings,
        source_documents=sources,
        suggested_review_focus=tuple(review_focus),
        agent_prompt=agent_prompt,
        generated_at=utc_now(),
    )


class BobBridge:
    """Orchestrate the full multilingual voice-first loop."""

    def __init__(
        self,
        stt: SpeechToText | None = None,
        extractor: DocumentExtractor | None = None,
        translator: Translator | None = None,
        clinician: Clinician | None = None,
        tts: TextToSpeech | None = None,
    ) -> None:
        self.stt = stt or SidecarTranscriptSTT()
        self.extractor = extractor or LabReportExtractor()
        self.translator = translator or MockTranslator()
        self.clinician = clinician or SampleClinician(SAMPLE_DIR / "doctor_prescription.txt")
        self.tts = tts or PlaceholderWavTTS()

    def run(
        self, intake: PatientIntake, output_dir: Path | None = None
    ) -> PipelineResult:
        """Run the demo from sample audio + document files."""
        transcript = self.stt.transcribe(
            intake.voice_transcript_path, intake.preferred_language
        )
        documents = tuple(
            self.extractor.extract(path, f"DOC-{index:02d}")
            for index, path in enumerate(intake.document_paths, start=1)
        )
        return self._process(intake, transcript, documents, Path(output_dir or DEFAULT_OUTPUT_DIR))

    def run_from_text(
        self,
        *,
        transcript_text: str,
        language: str,
        document_texts: Sequence[str] = (),
        patient_id: str = "API-PATIENT",
        patient_name: str = "API Patient",
        output_dir: Path | None = None,
    ) -> PipelineResult:
        """Run the same loop from in-memory text (used by the API)."""
        if not transcript_text.strip():
            raise ValueError("transcript_text must not be empty")

        transcript = Transcript(
            text=transcript_text.strip(),
            language=language,
            confidence=1.0,
            source="api:text",
        )
        documents = tuple(
            self.extractor.extract_text(text, f"DOC-{index:02d}", source="api:text")
            for index, text in enumerate(document_texts, start=1)
        )
        intake = PatientIntake(
            patient_id=patient_id,
            patient_name=patient_name,
            preferred_language=language,
            voice_transcript_path=Path("api-transcript.txt"),
            document_paths=tuple(),
            audio_path=None,
        )
        return self._process(intake, transcript, documents, Path(output_dir or DEFAULT_OUTPUT_DIR))

    def _process(
        self,
        intake: PatientIntake,
        transcript: Transcript,
        documents: Sequence[ExtractedDocument],
        output_dir: Path,
    ) -> PipelineResult:
        output_dir.mkdir(parents=True, exist_ok=True)

        # 1–2. Voice + documents → clinician language.
        patient_voice_english = self.translator.translate(
            transcript.text, transcript.language, DOCTOR_LANGUAGE
        )
        packet = build_doctor_packet(
            intake=intake,
            transcript=transcript,
            documents=documents,
            patient_voice_english=patient_voice_english,
        )

        # 3. Clinician review.
        analysis: DoctorAnalysis = self.clinician.review(packet)

        # 4. Clinician language → patient's mother tongue + speech.
        patient_text = self.translator.translate(
            analysis.patient_facing_text(), DOCTOR_LANGUAGE, intake.preferred_language
        )
        audio_path = self.tts.synthesize(
            patient_text,
            intake.preferred_language,
            output_dir / f"06_patient_brief_{intake.preferred_language}.wav",
        )
        message = PatientMessage(
            language=intake.preferred_language,
            text=patient_text,
            audio_path=audio_path,
            source_packet_id=packet.packet_id,
        )

        artifacts = self._write_artifacts(
            output_dir=output_dir,
            transcript=transcript,
            documents=documents,
            packet=packet,
            analysis=analysis,
            message=message,
            language=intake.preferred_language,
        )

        return PipelineResult(
            intake=intake,
            transcript=transcript,
            documents=tuple(documents),
            doctor_packet=packet,
            doctor_analysis=analysis,
            patient_message=message,
            artifacts=artifacts,
        )

    @staticmethod
    def _write_artifacts(
        *,
        output_dir: Path,
        transcript: Transcript,
        documents: Sequence[ExtractedDocument],
        packet: DoctorPacket,
        analysis: DoctorAnalysis,
        message: PatientMessage,
        language: str,
    ) -> dict[str, Path]:
        artifacts: dict[str, Path] = {}

        patient_voice = output_dir / "01_patient_voice.txt"
        patient_voice.write_text(
            f"[{transcript.language}] {transcript.text}\n", encoding="utf-8"
        )
        artifacts["patient_voice"] = patient_voice

        extracted = output_dir / "02_extracted_documents.json"
        _write_json(extracted, [to_jsonable(document) for document in documents])
        artifacts["extracted_documents"] = extracted

        doctor_packet_path = output_dir / "03_doctor_packet.json"
        _write_json(doctor_packet_path, packet)
        artifacts["doctor_packet"] = doctor_packet_path

        clinician_analysis = output_dir / "04_clinician_analysis.json"
        _write_json(clinician_analysis, analysis)
        artifacts["clinician_analysis"] = clinician_analysis

        patient_brief = output_dir / f"05_patient_brief_{language}.txt"
        patient_brief.write_text(message.text, encoding="utf-8")
        artifacts["patient_brief"] = patient_brief

        if message.audio_path:
            artifacts["patient_audio"] = message.audio_path
        return artifacts


def _write_json(path: Path, payload: object) -> None:
    path.write_text(
        json.dumps(to_jsonable(payload), ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


__all__ = ["BobBridge", "build_doctor_packet"]
