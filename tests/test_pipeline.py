from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from bob_agent.demo import build_sample_intake
from bob_agent.pipeline import BobBridge
from translation.translator import (
    DOCTOR_EN,
    DOCTOR_HI,
    DOCTOR_TA,
    PATIENT_EN,
    PATIENT_HI,
    PATIENT_TA,
    MockTranslator,
)


class TranslatorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.translator = MockTranslator()

    def test_patient_mother_tongue_to_english(self) -> None:
        self.assertEqual(self.translator.translate(PATIENT_TA, "ta", "en"), PATIENT_EN)
        self.assertEqual(self.translator.translate(PATIENT_HI, "hi", "en"), PATIENT_EN)

    def test_doctor_note_back_to_mother_tongue(self) -> None:
        self.assertEqual(self.translator.translate(DOCTOR_EN, "en", "ta"), DOCTOR_TA)
        self.assertEqual(self.translator.translate(DOCTOR_EN, "en", "hi"), DOCTOR_HI)

    def test_identity_translation(self) -> None:
        self.assertEqual(self.translator.translate("hello", "en", "en"), "hello")

    def test_unknown_phrase_is_labeled(self) -> None:
        translated = self.translator.translate("unknown text", "en", "fr")
        self.assertIn("demo translation", translated)
        self.assertIn("unknown text", translated)


class PipelineTests(unittest.TestCase):
    def test_sample_demo_writes_artifacts(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            result = BobBridge().run(build_sample_intake("ta"), Path(tmp))

            self.assertEqual(result.doctor_packet.patient_language, "ta")
            self.assertEqual(result.doctor_packet.patient_voice_english, PATIENT_EN)
            self.assertEqual(result.patient_message.text, DOCTOR_TA)
            self.assertEqual(
                len([f for f in result.doctor_packet.extracted_findings if f.flag == "HIGH"]),
                3,
            )
            self.assertTrue(result.patient_message.audio_path)
            for artifact in result.artifacts.values():
                self.assertTrue(artifact.exists(), f"missing artifact: {artifact}")

    def test_run_from_text_without_documents(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            result = BobBridge().run_from_text(
                transcript_text=PATIENT_HI,
                language="hi",
                output_dir=Path(tmp),
            )
            self.assertEqual(result.doctor_packet.patient_voice_english, PATIENT_EN)
            self.assertEqual(result.patient_message.text, DOCTOR_HI)
            self.assertEqual(result.doctor_packet.extracted_findings, ())


if __name__ == "__main__":
    unittest.main()
