# Demo walkthrough

## Run it

```bash
python -m bob_agent.demo --language ta
```

## What you will see

1. **Patient intake** — Anitha speaks in Tamil and shares a lab report.
2. **Speech-to-text** — the mock STT reads `patient_voice.txt`.
3. **Document extraction** — `WBC`, `Neutrophils`, and `CRP` are flagged `HIGH`.
4. **Translation + structure** — the Tamil voice becomes an English clinical brief.
5. **Doctor packet** — source lines and suggested review focus are shown.
6. **Clinician analysis** — the sample prescription is parsed into structured fields.
7. **Patient brief** — the note is rendered in Tamil and a placeholder WAV is written.

## Outputs

See `demo_output/` after a run:

```text
01_patient_voice.txt
02_extracted_documents.json
03_doctor_packet.json
04_clinician_analysis.json
05_patient_brief_ta.txt
06_patient_brief_ta.wav
```

## Try another language

```bash
python -m bob_agent.demo --language hi
python -m bob_agent.demo --language es
python -m bob_agent.demo --list-languages
```

Languages without a curated phrasebook produce a clearly labeled fallback translation. That is intentional: it makes the gap visible rather than silently inventing clinical content.
