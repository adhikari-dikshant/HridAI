# HridAI Backend Spec (v1)

> Backend-focused extract of `../../heart-screening-context.html` (last updated 31 Oct 2026). **If they conflict, the HTML wins**; fix this file.
> Section numbers in brackets, e.g. [ctx §8], point to the HTML.

## 1. Product summary [ctx §1, §3]

- Phone records heart sounds (phone mic or ₹500 stethoscope + collar mic) → backend checks quality → AI classifies as **Normal / Needs check-up / Recording unclear** + confidence + heart rate → Gemini explains in **Hindi + English** → user can share with a doctor.
- Users: ASHA workers, PHCs/rural clinics, families, telemedicine doctors.
- Hackathon bonus for Google tech → Gemini, Firebase, Cloud Run, (optional) Vertex AI.
- **Screening, not diagnosis**, everywhere.
- MVP: consent + patient info, 2 locations (MV + AV) × 15 s, server quality check, classification, bpm, Gemini EN/HI, history, Cloud Run.
- Stretch: 4 locations, Grad-CAM heatmap, report upload + summary, share PDF/link, waveform with S1/S2.

## 2. API contract [ctx §8]

### Conventions

- All routes under `/v1` except `GET /healthz`.
- Every `/v1` call: `Authorization: Bearer <Firebase ID token>`, verified with `firebase_admin.auth.verify_id_token`. Users only see their own screenings.
- JSON `snake_case`, timestamps ISO 8601 UTC (`2026-11-02T10:15:00Z`), IDs strings (prefix + 10 characters; examples below are shortened).
- Language `"en" | "hi"`. User-facing messages returned in both (`message_en`, `message_hi`).
- `MOCK_INFERENCE=true` → fixed realistic results.

### Error envelope

```json
{ "error": { "code": "screening_not_found", "message_en": "This screening does not exist.", "message_hi": "यह जाँच मौजूद नहीं है।" } }
```

| Status | When | Suggested codes |
|--------|------|-----------------|
| 400 | Bad input (missing field, invalid location) | `invalid_request`, `consent_required` |
| 401 | Missing / invalid Firebase token | `unauthorized` |
| 404 | Screening not found **or not yours** | `screening_not_found` |
| 409 | Wrong state | `no_accepted_recordings`, `analysis_in_progress` |
| 413 | File too large | `file_too_large` |
| 415 | Unsupported file type | `unsupported_media_type`, `unsupported_audio` |
| 500 | Server error (log has request id) | `internal_error` |

A recording that **fails quality is not an error**: 200 with `"accepted": false`.

### `GET /healthz`

```json
{ "status": "ok", "model_version": "cardiophon-ft-0.1", "mock": false }
```

### `POST /v1/screenings` → 201

```jsonc
// request
{
  "language": "hi",
  "consent": { "accepted": true, "version": "v1" },
  "patient": {
    "age_years": 34,                 // required, 0-110
    "sex": "male",                   // required: male | female | other
    "height_cm": 172,                // optional
    "weight_kg": 70,                 // optional
    "symptoms": ["breathlessness"],  // optional: chest_pain | breathlessness | palpitations | fatigue | fainting | swelling
    "known_conditions": []           // optional: hypertension | diabetes | known_heart_disease | other
  }
}
// 201
{
  "screening_id": "scr_8f2k1x",
  "status": "awaiting_recordings",
  "required_locations": ["MV", "AV"],
  "optional_locations": ["PV", "TV"],
  "created_at": "2026-11-02T10:15:00Z"
}
```

### `POST /v1/screenings/{screening_id}/recordings` → 200

`multipart/form-data`. Re-uploading the same location **replaces** the previous recording for that location.

| Field | Value |
|-------|-------|
| `file` | binary; `audio/m4a`, `audio/mp4`, `audio/x-m4a`, `audio/wav`; max 5 MB |
| `location` | `MV` \| `AV` \| `PV` \| `TV` |
| `source` | `phone_mic` \| `stethoscope_mic` |
| `duration_ms` | e.g. `15000` |
| `platform` | `ios` \| `android` |

```jsonc
// accepted
{
  "recording_id": "rec_31ab", "location": "MV", "accepted": true,
  "quality": { "score": 0.82, "duration_s": 14.6, "heart_rate_bpm": 78, "issues": [] },
  "screening_status": "ready"
}
// rejected
{
  "recording_id": "rec_31ac", "location": "AV", "accepted": false,
  "quality": { "score": 0.21, "duration_s": 14.9, "heart_rate_bpm": null, "issues": ["too_noisy"] },
  "message_en": "Too much background noise. Turn off the fan and record again.",
  "message_hi": "पीछे की आवाज़ बहुत ज़्यादा है। पंखा बंद करके दोबारा रिकॉर्ड करें।",
  "screening_status": "awaiting_recordings"
}
```

| Issue code | Meaning | Message (EN) |
|------------|---------|--------------|
| `too_short` | < 8 s after trimming | Recording was too short. Hold still for the full 15 seconds. |
| `too_quiet` | Signal below floor | Heartbeat was too faint. Press the phone more firmly on bare skin. |
| `clipping` | Signal saturated | Sound was distorted. Hold the phone steady without rubbing. |
| `too_noisy` | Too much energy outside heart band | Too much background noise. Turn off the fan and record again. |
| `no_heartbeat_detected` | No periodic beat | We couldn't hear a heartbeat. Check the position on the chest guide. |
| `heart_rate_out_of_range` | Rate outside 40–180 bpm | Reading was unclear. Please record again. |

> Hindi messages for issues other than `too_noisy` are **not yet written** in the context doc — draft them in `app/core/messages.py` and get a native speaker to review.

### `POST /v1/screenings/{screening_id}/reports` (stretch) → 200

Multipart `file`: `image/jpeg` | `image/png` | `application/pdf`, max 10 MB. Upload before analyze. Never used by the classifier.

```json
{ "report_id": "rep_77c", "summary_en": "ECG report from March 2025 noted normal sinus rhythm.", "summary_hi": "मार्च 2025 की ECG रिपोर्ट में सामान्य हृदय गति बताई गई है।" }
```

### `POST /v1/screenings/{screening_id}/analyze` → 200

No body. Runs model + Gemini. Needs ≥ 1 accepted recording, else 409 `no_accepted_recordings`. App timeout 45 s.

```jsonc
{
  "screening_id": "scr_8f2k1x",
  "status": "completed",
  "result": {
    "label": "needs_checkup",              // normal | needs_checkup | unclear
    "confidence": 0.81,
    "abnormal_probability": 0.81,          // fused
    "heart_rate_bpm": 76,
    "per_location": [
      { "location": "MV", "abnormal_probability": 0.81, "quality_score": 0.82, "heatmap_url": null },
      { "location": "AV", "abnormal_probability": 0.44, "quality_score": 0.77, "heatmap_url": null }
    ],
    "used_patient_data": true,
    "model_version": "cardiophon-ft-0.1"
  },
  "explanation": { "en": "...", "hi": "..." },
  "report_summaries": [],
  "disclaimer": {
    "en": "This is an AI screening tool, not a medical diagnosis. Always consult a doctor.",
    "hi": "यह एक AI स्क्रीनिंग टूल है, मेडिकल निदान नहीं। हमेशा डॉक्टर से सलाह लें।"
  },
  "completed_at": "2026-11-02T10:18:40Z"
}
```

### `GET /v1/screenings/{screening_id}` → 200
Full screening: patient, recordings (no audio bytes), status, and the analyze response if completed.

### `GET /v1/screenings?limit=20` → 200
```json
{ "items": [ { "screening_id": "scr_8f2k1x", "created_at": "...", "status": "completed", "label": "needs_checkup" } ] }
```

### `DELETE /v1/screenings/{screening_id}` → 204
Deletes screening, recordings and reports (Firestore + Storage).

### Status machine

`awaiting_recordings` → `ready` (≥ 1 accepted) → `analyzing` → `completed` | `failed`

### Shared TypeScript types (the app copies these; Pydantic must match)

```ts
export type Lang = "en" | "hi";
export type Location = "MV" | "AV" | "PV" | "TV";
export type Label = "normal" | "needs_checkup" | "unclear";
export type QualityIssue = "too_short" | "too_quiet" | "clipping" | "too_noisy"
  | "no_heartbeat_detected" | "heart_rate_out_of_range";
export interface Quality { score: number; duration_s: number; heart_rate_bpm: number | null; issues: QualityIssue[]; }
export interface RecordingResponse {
  recording_id: string; location: Location; accepted: boolean; quality: Quality;
  message_en?: string; message_hi?: string; screening_status: string;
}
export interface AnalyzeResponse {
  screening_id: string; status: "completed" | "failed";
  result: {
    label: Label; confidence: number; abnormal_probability: number; heart_rate_bpm: number | null;
    per_location: { location: Location; abnormal_probability: number; quality_score: number; heatmap_url: string | null }[];
    used_patient_data: boolean; model_version: string;
  };
  explanation: Record<Lang, string>;
  report_summaries: { report_id: string; summary_en: string; summary_hi: string }[];
  disclaimer: Record<Lang, string>;
  completed_at: string;
}
```

Note: `message_en`/`message_hi` are **omitted** (not `null`) on accepted recordings → use `response_model_exclude_none` or a dedicated model.

## 3. Data model [ctx §9]

### Firestore

```text
screenings/{screening_id}
  owner_uid, created_at, updated_at, status, language
  analysis_started_at                            // internal lock, expires after 90 s; never returned by the API
  consent { accepted, version, accepted_at }
  patient { age_years, sex, height_cm, weight_kg, symptoms[], known_conditions[] }
  result  { ...same as analyze "result" }        // after analyze
  explanation { en, hi }
  model_version

screenings/{screening_id}/recordings/{recording_id}
  location, source, platform, storage_path, duration_s,
  accepted, quality { score, heart_rate_bpm, issues[] }, created_at

screenings/{screening_id}/reports/{report_id}
  storage_path, mime_type, summary_en, summary_hi, created_at
```

### Cloud Storage

```text
gs://<bucket>/screenings/{screening_id}/recordings/{recording_id}.m4a   // original
gs://<bucket>/screenings/{screening_id}/recordings/{recording_id}.wav   // converted, 2 kHz mono
gs://<bucket>/screenings/{screening_id}/reports/{report_id}.{jpg|png|pdf}
gs://<bucket>/screenings/{screening_id}/heatmaps/{location}.png         // stretch
gs://<project>-ml/models/{model_version}/                               // separate bucket; runtime has no access
```

- Security rules: **deny all client reads/writes**; only Admin SDK. The buckets use uniform access and public access prevention.
- Data bucket: soft delete off, so `DELETE` really deletes audio; 30-day lifecycle rule on `screenings/` as a backstop.
- Rejected recordings: metadata only, audio deleted after the quality check.
- Heatmaps via short-lived signed URLs.
- **No names, phone numbers, addresses or exact DOB.**

## 4. Audio pipeline [ctx §10, §11]

One module `app/services/audio.py`, constants in one config object, identical in training and inference. Values are **starting values**.

| Step | What | Starting value |
|------|------|----------------|
| 1. Decode | ffmpeg → mono float32 PCM, from a temp file (not stdin), hardened | `ffmpeg -protocol_whitelist file -t 35 -i in.m4a -ac 1 -f f32le pipe:1`; empty output = `unsupported_audio` |
| 2. Trim | drop first/last 1 s | 1.0 s each side |
| 3. Resample | single rate | `TARGET_SR = 2000` (PhysioNet 2016 = 2 kHz, CirCor = 4 kHz; use pretrained model's rate if different) |
| 4. Bandpass | Butterworth, zero-phase (`butter` + `sosfiltfilt`) | order 4, 25–400 Hz |
| 5. Spike removal | Schmidt et al. | optional |
| 6. Quality check | below, before normalizing so level checks see the real signal | reject → `accepted: false` |
| 7. Normalize | peak normalize | divide by max abs |
| 8. Segment | fixed windows | 5 s, 2.5 s hop, drop last partial |
| 9. Features | log-mel per window | `n_fft=256`, `hop_length=40` (20 ms), `n_mels=64`, `fmin=20`, `fmax=400` (provisional until the model trial; 800 left 33 of 64 bands empty after the 400 Hz filter); `log(1e-6 + S)`; per-window standardization |

Audio past 35 s is not decoded. This enforces ctx §7's 30 s maximum without a new error code.

### 4.1 Quality rules (all must pass)

- Duration ≥ 8 s after trim → `too_short`
- Share of decoded samples with |x| ≥ 0.99 < 1% → `clipping`
- RMS of filtered signal, before normalization, above floor (tune) → `too_quiet`
- All of these above threshold (tune) → `too_noisy`: energy at S1/S2 vs energy between beats, low mains hum at 50/100/150 Hz, low spectral flatness. Don't use a 25–400 Hz energy ratio: fan hum and voice sit inside that band, so a fan scored the same as a clean recording.
- Envelope (Hilbert or homomorphic) → autocorrelation → peak searched over 30–220 bpm. Weak peak → `no_heartbeat_detected`; rate outside 40–180 bpm → `heart_rate_out_of_range`. Gives `heart_rate_bpm`.
- CardioPHON's quality model is a separate classical classifier built at 1 kHz. Add it to `quality.score` only if the model trial shows it's usable.
- Tune on: dataset good recordings, dataset unclear recordings, ~20 consented team phone recordings (quiet / fan / talking).

### 4.2 Model and aggregation

- Main: fine-tuned CardioPHON (arXiv 2511.04533), subject to the model trial (`PLAN.md` §3); fallback: small CNN / general pretrained audio CNN. Export **ONNX** `model.onnx`, CPU inference with ONNX Runtime (PyTorch has deprecated TorchScript). Version string like `cardiophon-ft-0.1`.
- Window → recording: **mean** of window probabilities.
- Recording → screening: **max** over locations.
- Late fusion: **off for MVP**, so `used_patient_data=false`. CirCor covers ages 0–21, so adult inputs are extrapolation, and missing flags can act as a dataset identifier. Add it only if it beats audio-only on held-out data with missing flags removed. If used: logistic regression / small MLP on `[audio_probability, age_years, sex, height_cm, weight_kg, bmi]`; missing → training medians.
- Threshold `T` chosen on validation for **sensitivity ≥ 0.85** on the final screening-level score, using MV + AV only (max depends on how many locations are used), and checked for the 1-recording case. Stored as `threshold` in `model_meta.json`, e.g. 0.35.

### 4.3 Datasets (owned by ml/, listed for context)

PhysioNet/CinC 2016 (normal vs abnormal, 2 kHz) and CirCor DigiScope 2022 (pediatric, 4 locations, 4 kHz, murmur Present/Absent/Unknown; Unknown → excluded from classifier, used as quality negatives). Split **by patient** 70/15/15, seed fixed, lists in `ml/splits/`.

- Only 60% of CirCor is public (about 940 of 1,568 patients by estimate). Check the real count after download.
- CirCor's Murmur label is per patient. Label recordings per site using the `Murmur locations` field.
- Augment with a phone channel (high-pass, AAC round trip), because training data is stethoscope audio.

### 4.4 Model artifact contract (backend proposal, confirm with the model trial)

Files are baked into the image. The input shape below is provisional: the CardioPHON paper describes 96×64 inputs.

- `models/model.onnx` — input `float32 [N, 1, 64, T]` log-mel windows (T = 5 s / 20 ms = 251 frames); output `[N]` (or `[N,1]`) abnormal logit.
- `models/model_meta.json` — `{ "model_version", "output": "logit"|"probability", "threshold", "target_sr", "n_mels", "frames", "fmin", "fmax" }`; backend validates against `audio_config.py` at startup and refuses to start on a mismatch. This is the only source for the version and threshold.
- `models/fusion.json` (optional) — `{ "features": [...], "coef": [...], "intercept": x, "medians": {...} }`.

## 5. Gemini [ctx §12]

- Two jobs only: (1) explain the model result in plain Hindi + English; (2) summarize uploaded reports (image/PDF).
- Called through **Vertex AI** in `asia-south1` with the service account, no API key. Vertex doesn't train on this data without permission; the free Gemini API tier may, and it can be read by human reviewers.
- Flash-class model, exact ID pinned in `GEMINI_MODEL` (`gemini-3.5-flash`: stable, listed for `asia-south1`, shutdown no earlier than 2027-05-19). Temperature 0.2, JSON output, 15 s timeout.
- Fallback to fixed template text per label on any failure. Result never depends on Gemini.
- Send only: age, sex, symptoms, label, probabilities, bpm, locations, report summary. No identifiers.
- Output filter bans phrases such as "you have" and "diagnosed with". It must allow "not a diagnosis".
- Report photos can show names and phone numbers, so report upload needs a privacy decision before it's built (`PLAN.md` B9).

### Explanation prompt (starting version)

```text
SYSTEM:
You explain the output of a heart sound SCREENING tool to a non-medical person in India.
Rules:
- This is not a diagnosis. Never name a disease as certain. Never say "you have".
- Use simple words. Max 3 short sentences per language.
- If label is "needs_checkup": calmly recommend seeing a doctor soon. Do not cause panic.
- If label is "unclear": ask them to record again in a quiet place, or see a doctor.
- If label is "normal": say no unusual sound was found, and that a doctor visit is still advised if they have symptoms.
- If symptoms include chest_pain or fainting, always advise seeing a doctor promptly, whatever the label.
- Return JSON only: {"en": "...", "hi": "..."}. Hindi in Devanagari.

USER:
{ "label": "needs_checkup", "abnormal_probability": 0.81, "heart_rate_bpm": 76,
  "per_location": [{"location": "MV", "abnormal_probability": 0.81}],
  "patient": {"age_years": 34, "sex": "male", "symptoms": ["breathlessness"]},
  "report_summary": null }
```

### Report summary prompt

```text
Summarize this medical report for a screening app. Return JSON:
{"summary_en": "...", "summary_hi": "...", "report_type": "ecg|echo|blood_test|prescription|other", "date": "YYYY-MM or null"}
Max 2 sentences each. Only state what is written in the report. Do not add advice or diagnosis.
If the image is not a medical report, return report_type "other" and say so.
```

## 6. Result logic [ctx §13]

| Label | Rule | Headline EN / HI |
|-------|------|------------------|
| `unclear` | No accepted recording reached analyze, or all accepted have quality score < 0.5 | Recording unclear · रिकॉर्डिंग साफ़ नहीं है |
| `needs_checkup` | `abnormal_probability ≥ T` | Please get a check-up · कृपया डॉक्टर से जाँच कराएँ |
| `normal` | `abnormal_probability < T` | No unusual sound found · कोई असामान्य आवाज़ नहीं मिली |

- `confidence` = `p` for needs_checkup, `1 − p` for normal. App shows High ≥ 0.8, Medium 0.6–0.8, Low < 0.6. (For `unclear`, backend default: confidence = mean quality score — confirm.)
- Disclaimer always included. Share text: label + bpm + date + disclaimer, no identifiers.

## 7. Configuration [ctx §14]

| Variable | Example / default | Notes |
|----------|-------------------|-------|
| `ENV` | `local` \| `staging` \| `prod` | backend addition; Dockerfile sets `prod` |
| `GCP_PROJECT` | `heartscreen-abc` | |
| `STORAGE_BUCKET` | `heartscreen-abc-data` | |
| `GOOGLE_GENAI_USE_VERTEXAI` | `true` | SDK setting |
| `GOOGLE_CLOUD_PROJECT` | `heartscreen-abc` | SDK setting |
| `GOOGLE_CLOUD_LOCATION` | `asia-south1` | SDK setting |
| `GEMINI_MODEL` | `gemini-3.5-flash` | |
| `GEMINI_TIMEOUT_S` | `15` | backend addition |
| `MODEL_PATH` | `/srv/models/model.onnx` | baked into the image |
| `FUSION_PATH` | unset | backend addition; optional |
| `MOCK_INFERENCE` | `true` \| `false` | |
| `MOCK_QUALITY` | `true` until B4 | backend addition |
| `MOCK_SCENARIO` | `cycle` | backend addition |
| `DATA_BACKEND` | `memory` \| `firestore` | backend addition |
| `AUTH_MODE` | `dev` \| `firebase` | backend addition; `dev` forbidden in prod |
| `CORS_ORIGINS` | `*` locally, empty in prod | backend addition; native apps don't use CORS |

Model version, threshold and sample rate come from `model_meta.json`, not env vars, so they can't disagree with the model. Local cloud access uses `gcloud auth application-default login`, not a key file.

## 8. Deployment [ctx §15]

Full steps and commands are in `DEPLOY.md`.

- Cloud Run `asia-south1`, 2 vCPU, 4 GiB, concurrency 4, timeout 60 s, `--cpu-boost`, `--max-instances=3`. **Min instances 1 on demo day**, 0 after.
- `python:3.11-slim-bookworm` + ffmpeg + ONNX Runtime; load model once at startup.
- Dedicated service account with least privilege; no Gemini key, because Vertex AI uses that account.
- One inference thread each, at most 2 inferences at once.
- Logs: request id, screening id, durations, model version. **Never patient data or audio.**

## 9. Privacy [ctx §16]

Consent before any data (store version + timestamp) · minimum data · delete endpoint removes all audio and reports · spirit of India's DPDP Act 2023 · delete hackathon data after the event · team test recordings only with consent and never used to claim accuracy · audio retained at most 30 days · rejected audio not kept · legal review before real users, covering minors' consent and Google's Generative AI health restrictions.

