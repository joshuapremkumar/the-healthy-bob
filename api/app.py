"""Optional HTTP API wrapping the same pipeline as the CLI demo.

Run with:

    uvicorn api.app:app --reload

Then open http://127.0.0.1:8000/docs
"""

from __future__ import annotations

from pathlib import Path

from bob_agent.config import API_OUTPUT_DIR, APP_NAME, APP_VERSION
from bob_agent.models import to_jsonable
from bob_agent.pipeline import BobBridge
from translation.languages import LANGUAGES

try:
    from fastapi import FastAPI, HTTPException
    from pydantic import BaseModel, Field
except ImportError as exc:  # pragma: no cover - only hit without optional deps
    raise SystemExit(
        "API dependencies are missing. Run: python -m pip install -r requirements.txt"
    ) from exc

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    description="Assistive multilingual voice-first healthcare bridge. Clinician review required.",
)

bridge = BobBridge()


class BridgeRequest(BaseModel):
    transcript: str = Field(..., description="Patient's words in their preferred language")
    language: str = Field("ta", description="Patient language code, e.g. ta, hi, es")
    documents: list[str] = Field(default_factory=list, description="Raw text of shared documents")
    patient_id: str = "API-PATIENT"
    patient_name: str = "API Patient"
    output_dir: str | None = None


class BridgeResponse(BaseModel):
    packet_id: str
    patient_language: str
    clinician: str
    patient_text: str
    patient_audio_path: str | None
    doctor_packet: dict
    clinician_analysis: dict
    artifacts: dict[str, str]
    disclaimer: str


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "app": APP_NAME, "version": APP_VERSION}


@app.get("/v1/languages")
def languages() -> dict:
    return LANGUAGES


@app.post("/v1/bridge", response_model=BridgeResponse)
def run_bridge(payload: BridgeRequest) -> BridgeResponse:
    if payload.language not in LANGUAGES:
        raise HTTPException(status_code=400, detail=f"Unsupported language: {payload.language}")

    output_dir = Path(payload.output_dir) if payload.output_dir else API_OUTPUT_DIR
    try:
        result = bridge.run_from_text(
            transcript_text=payload.transcript,
            language=payload.language,
            document_texts=payload.documents,
            patient_id=payload.patient_id,
            patient_name=payload.patient_name,
            output_dir=output_dir,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return BridgeResponse(
        packet_id=result.doctor_packet.packet_id,
        patient_language=result.patient_message.language,
        clinician=result.doctor_analysis.clinician,
        patient_text=result.patient_message.text,
        patient_audio_path=str(result.patient_message.audio_path)
        if result.patient_message.audio_path
        else None,
        doctor_packet=to_jsonable(result.doctor_packet),
        clinician_analysis=to_jsonable(result.doctor_analysis),
        artifacts={key: str(value) for key, value in result.artifacts.items()},
        disclaimer="Assistive demo only; clinician review required. Not a standalone diagnosis or certified interpreter.",
    )
