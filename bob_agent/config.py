"""Paths and defaults shared by the demo, API, and tests."""

from pathlib import Path

ROOT: Path = Path(__file__).resolve().parents[1]
SAMPLE_DIR: Path = ROOT / "data" / "samples"
DOCS_DIR: Path = ROOT / "docs"
DEFAULT_OUTPUT_DIR: Path = ROOT / "demo_output"
API_OUTPUT_DIR: Path = ROOT / "api_output"

DOCTOR_LANGUAGE: str = "en"
DEFAULT_PATIENT_LANGUAGE: str = "ta"

APP_NAME: str = "The Healthy Bob"
APP_VERSION: str = "0.1.0"

__all__ = [
    "ROOT",
    "SAMPLE_DIR",
    "DOCS_DIR",
    "DEFAULT_OUTPUT_DIR",
    "API_OUTPUT_DIR",
    "DOCTOR_LANGUAGE",
    "DEFAULT_PATIENT_LANGUAGE",
    "APP_NAME",
    "APP_VERSION",
]
