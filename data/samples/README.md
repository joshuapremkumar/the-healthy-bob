# Synthetic sample data

All files in this folder are **fictional** and exist only so the demo runs immediately.

| File | Role | Notes |
|---|---|---|
| `patient_voice.wav` | Audio placeholder | Short generated tone sequence; not real speech. |
| `patient_voice.txt` | Transcript sidecar | Canonical Tamil patient utterance used by the mock STT. |
| `lab_report.txt` | Patient-shared document | CBC + CRP with `HIGH` flags for the extractor. |
| `doctor_prescription.txt` | Clinician output sample | Parsed by `SampleClinician` into the analysis. |

Do not use these values for clinical decisions. Replace them with consented, de-identified data only in a governed environment.
