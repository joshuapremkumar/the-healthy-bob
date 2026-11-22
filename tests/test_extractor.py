from __future__ import annotations

import unittest

from bob_agent.config import SAMPLE_DIR
from documents.extractor import LabReportExtractor


class LabReportExtractorTests(unittest.TestCase):
    def test_extracts_flagged_findings_with_sources(self) -> None:
        document = LabReportExtractor().extract(SAMPLE_DIR / "lab_report.txt", "DOC-01")

        self.assertEqual(document.kind, "lab_report")
        highs = [finding for finding in document.findings if finding.flag == "HIGH"]
        self.assertEqual(len(highs), 3)
        self.assertTrue(any("WBC" in finding.label for finding in highs))
        self.assertTrue(all(finding.source_line for finding in highs))
        self.assertTrue(any("4.0-11.0" in finding.reference for finding in highs))

    def test_prescription_sample_is_detected_as_clinician_note(self) -> None:
        document = LabReportExtractor().extract(
            SAMPLE_DIR / "doctor_prescription.txt", "DOC-01"
        )
        self.assertEqual(document.kind, "clinician_note")


if __name__ == "__main__":
    unittest.main()
