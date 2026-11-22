"""Lightweight clinical document extraction.

The demo extractor recognizes ``HIGH`` / ``LOW`` flagged lab lines and keeps the
original line as a source reference so the clinician can verify each finding.
Real deployments should swap in OCR plus a validated extraction model.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Protocol, runtime_checkable

from bob_agent.models import ExtractedDocument, Finding

_REFERENCE_RE = re.compile(r"\(ref\s*([^)]+)\)", re.IGNORECASE)


@runtime_checkable
class DocumentExtractor(Protocol):
    """Turn a document into structured, sourced findings."""

    def extract(self, path: Path, document_id: str) -> ExtractedDocument: ...

    def extract_text(
        self, text: str, document_id: str, source: str, kind: str | None = None
    ) -> ExtractedDocument: ...


class LabReportExtractor:
    """Extract flagged values from a text lab report."""

    def extract(self, path: Path, document_id: str) -> ExtractedDocument:
        path = Path(path)
        text = path.read_text(encoding="utf-8")
        return self.extract_text(
            text=text,
            document_id=document_id,
            source=str(path),
            kind=self.detect_kind(text),
        )

    def extract_text(
        self,
        text: str,
        document_id: str,
        source: str,
        kind: str | None = None,
    ) -> ExtractedDocument:
        findings: list[Finding] = []
        for raw_line in text.splitlines():
            finding = self._parse_line(raw_line)
            if finding:
                findings.append(finding)
        return ExtractedDocument(
            document_id=document_id,
            kind=kind or self.detect_kind(text),
            raw_text=text.strip(),
            findings=tuple(findings),
            source_path=source,
        )

    @staticmethod
    def detect_kind(text: str) -> str:
        upper = text.upper()
        if "CBC" in upper or "COMPLETE BLOOD COUNT" in upper or "TEST:" in upper:
            return "lab_report"
        if "PRESCRIPTION:" in upper or "CLINICIAN:" in upper:
            return "clinician_note"
        return "clinical_document"

    @staticmethod
    def _parse_line(line: str) -> Finding | None:
        upper = line.upper()
        if "- HIGH" in upper:
            flag = "HIGH"
        elif "- LOW" in upper:
            flag = "LOW"
        else:
            return None

        left = re.split(r"\s+-\s+", line, maxsplit=1)[0].strip()
        reference_match = _REFERENCE_RE.search(left)
        reference = reference_match.group(1).strip() if reference_match else ""
        if ":" in left:
            label, value = left.split(":", 1)
        else:
            label, value = left, ""
        label = label.strip()
        value = _REFERENCE_RE.sub("", value).strip(" -")
        if not label:
            return None
        return Finding(
            label=label,
            value=value,
            flag=flag,
            reference=reference,
            source_line=line.strip(),
        )


class TextDocumentExtractor(LabReportExtractor):
    """Alias for generic text documents; uses the same line-based parser."""

    pass


__all__ = ["DocumentExtractor", "LabReportExtractor", "TextDocumentExtractor"]
