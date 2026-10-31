# HridAI Backend Spec (v1)

> Backend-focused extract of `../../heart-screening-context.html` (last updated 31 Oct 2026). **If they conflict, the HTML wins**; fix this file.
> Section numbers in brackets, e.g. [ctx §8], point to the HTML.

## 1. Product summary [ctx §1, §3]

- Phone records heart sounds from the chest, plus one recording from the neck beside the larynx (phone mic or ₹500 stethoscope + collar mic) → backend checks quality → AI classifies as **Normal / Needs check-up / Recording unclear** + confidence + heart rate → Gemini explains in **Hindi + English** → user can share with a doctor.
- Users: ASHA workers, PHCs/rural clinics, families, telemedicine doctors.
- Hackathon bonus for Google tech → Gemini, Firebase, Cloud Run, (optional) Vertex AI.
- **Screening, not diagnosis**, everywhere.
- MVP: multiple patient profiles per account, consent + patient details, 2 chest locations (MV + AV) + 1 neck location (NK) × 15 s, server quality check, classification, bpm, Gemini EN/HI, per-patient history, Cloud Run.
- Neck audio (`NK`) is collected and quality-checked but **never classified**: the model has no labelled neck data. It does not affect the label, confidence, bpm or threshold.
- Stretch: 4 locations, Grad-CAM heatmap, report upload + summary, share PDF/link, waveform with S1/S2.

## 2. API contract [ctx §8]

### Conventions

- All routes under `/v1` except `GET /healthz`.
- Every `/v1` call: `Authorization: Bearer <Firebase ID token>`, verified with `firebase_admin.auth.verify_id_token`. Users only see their own patients and screenings.
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
| 404 | Patient or screening not found **or not yours** | `patient_not_found`, `screening_not_found` |
| 409 | Wrong state | `no_accepted_recordings`, `analysis_in_progress` |
| 413 | File too large | `file_too_large` |
| 415 | Unsupported file type | `unsupported_media_type`, `unsupported_audio` |
| 500 | Server error (log has request id) | `internal_error` |

A recording that **fails quality is not an error**: 200 with `"accepted": false`.

### `GET /healthz`

```json
{ "status": "ok", "model_version": "cardiophon-ft-0.1", "mock": false }
```

### `POST /v1/patients` → 201

The consent from the current flow is sent here too, so no data is stored before consent.

```jsonc
// request
{
  "consent": { "accepted": true, "version": "v1" },
  "label": "Papa",                   // required, 1-40 chars, trimmed. Nickname or code, not a full name
  "age_years": 34,                   // required, 0-110
  "sex": "male",                     // required: male | female | other
  "height_cm": 172,                  // optional
  "weight_kg": 70,                   // optional
  "known_conditions": []             // optional: hypertension | diabetes | known_heart_disease | other
}
// 201
{
  "patient_id": "pat_4d9q2m", "label": "Papa", "age_years": 34, "sex": "male",
  "height_cm": 172, "weight_kg": 70, "known_conditions": [],
  "last_screening_at": null,
  "created_at": "2026-11-02T10:14:00Z", "updated_at": "2026-11-02T10:14:00Z"
}
```

### `GET /v1/patients?limit=100` → 200

`{ "items": [Patient] }`, newest or most recently screened first. `limit` is 1–200. No server search; the app filters on the device.

### `GET /v1/patients/{patient_id}` → 200

One `Patient`.

### `PATCH /v1/patients/{patient_id}` → 200

Send only the fields that changed. Returns the updated `Patient`. Only `height_cm` and `weight_kg` can be cleared with `null`. Past screenings keep their snapshot.

### `DELETE /v1/patients/{patient_id}` → 204

Deletes the profile and all its screenings, recordings and reports (Firestore + Storage).

### `POST /v1/screenings` → 201

The backend copies the patient's current details into the screening as a snapshot. Symptoms belong to the screening, not the profile.

```jsonc
// request
{
  "language": "hi",
  "consent": { "accepted": true, "version": "v1" },
  "patient_id": "pat_4d9q2m",        // required; 404 patient_not_found if missing or not yours
  "symptoms": ["breathlessness"]     // optional: chest_pain | breathlessness | palpitations | fatigue | fainting | swelling
}
// 201
{
  "screening_id": "scr_8f2k1x",
  "patient_id": "pat_4d9q2m",
  "status": "awaiting_recordings",
  "required_locations": ["MV", "AV", "NK"],
  "optional_locations": ["PV", "TV"],
  "created_at": "2026-11-02T10:15:00Z"
}
```

`required_locations` is what the app should ask for. The hard rule for analyze is 1 accepted chest recording, so a skipped neck step never blocks a result.

### `POST /v1/screenings/{screening_id}/recordings` → 200

`multipart/form-data`. Re-uploading the same location **replaces** the previous recording for that location. An `NK` upload never changes the screening status and never clears a completed result.

| Field | Value |
|-------|-------|
| `file` | binary; `audio/m4a`, `audio/mp4`, `audio/x-m4a`, `audio/wav`; max 5 MB |
| `location` | `MV` \| `AV` \| `PV` \| `TV` \| `NK` |
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
| `too_quiet` | Signal below floor | Chest: Heartbeat was too faint. Press the phone more firmly on bare skin. Neck: Heartbeat was too faint. Move the phone a little, keeping a light touch. Do not press harder. |
| `clipping` | Signal saturated | Sound was distorted. Hold the phone steady without rubbing. |
| `too_noisy` | Too much energy outside heart band | Too much background noise. Turn off the fan and record again. |
| `no_heartbeat_detected` | No periodic beat | Chest: We couldn't hear a heartbeat. Check the position on the chest guide. Neck: We couldn't hear a heartbeat. Check the position on the neck guide. |
| `heart_rate_out_of_range` | Rate outside 40–180 bpm | Reading was unclear. Please record again. |

> Messages depend on `location`. The backend must never tell a user to press harder on the neck, in either language.
>
> Hindi messages for issues other than `too_noisy` are **not yet written** in the context doc — draft them in `app/core/messages.py` and get a native speaker to review.

### `POST /v1/screenings/{screening_id}/reports` (stretch) → 200

Multipart `file`: `image/jpeg` | `image/png` | `application/pdf`, max 10 MB. Upload before analyze. Never used by the classifier.

```json
{ "report_id": "rep_77c", "summary_en": "ECG report from March 2025 noted normal sinus rhythm.", "summary_hi": "मार्च 2025 की ECG रिपोर्ट में सामान्य हृदय गति बताई गई है।" }
```

### `POST /v1/screenings/{screening_id}/analyze` → 200

No body. Runs model + Gemini. Needs ≥ 1 accepted chest recording, else 409 `no_accepted_recordings`. App timeout 45 s. `per_location` and `heart_rate_bpm` cover chest spots only, so `NK` never appears here.

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
Full screening: `patient_id`, patient snapshot, recordings including `NK` (no audio bytes), status, and the analyze response if completed.

### `GET /v1/screenings?patient_id=pat_4d9q2m&limit=20` → 200

`patient_id` is optional; without it the list covers all of the user's patients. An unknown patient returns 404 `patient_not_found`.

```json
{ "items": [ { "screening_id": "scr_8f2k1x", "patient_id": "pat_4d9q2m", "created_at": "...", "status": "completed", "label": "needs_checkup" } ] }
```

### `DELETE /v1/screenings/{screening_id}` → 204
Deletes screening, recordings and reports (Firestore + Storage).

### Status machine

`awaiting_recordings` → `ready` (≥ 1 accepted chest recording) → `analyzing` → `completed` | `failed`

### Shared TypeScript types (the app copies these; Pydantic must match)

```ts
export type Lang = "en" | "hi";
export type ChestLocation = "MV" | "AV" | "PV" | "TV";
export type Location = ChestLocation | "NK";
export type Label = "normal" | "needs_checkup" | "unclear";
export type QualityIssue = "too_short" | "too_quiet" | "clipping" | "too_noisy"
  | "no_heartbeat_detected" | "heart_rate_out_of_range";
export interface Patient {
  patient_id: string; label: string; age_years: number; sex: "male" | "female" | "other";
  height_cm: number | null; weight_kg: number | null; known_conditions: string[];
  last_screening_at: string | null; created_at: string; updated_at: string;
}
export interface Quality { score: number; duration_s: number; heart_rate_bpm: number | null; issues: QualityIssue[]; }
export interface RecordingResponse {
  recording_id: string; location: Location; accepted: boolean; quality: Quality;
  message_en?: string; message_hi?: string; screening_status: string;
}
export interface AnalyzeResponse {
  screening_id: string; status: "completed" | "failed";
  result: {
    label: Label; confidence: number; abnormal_probability: number; heart_rate_bpm: number | null;
    per_location: { location: ChestLocation; abnormal_probability: number; quality_score: number; heatmap_url: string | null }[];
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
patients/{patient_id}
  owner_uid, label, age_years, sex, height_cm, weight_kg, known_conditions[]
  consent { accepted, version, accepted_at }
  last_screening_at                              // latest completed screening, or null
  last_activity_at                               // sort key, set on create and new screening; never returned
  created_at, updated_at

screenings/{screening_id}
  owner_uid, patient_id, created_at, updated_at, status, language
  analysis_started_at                            // internal lock, expires after 90 s; never returned by the API
  consent { accepted, version, accepted_at }
  patient { age_years, sex, height_cm, weight_kg, symptoms[], known_conditions[] }   // snapshot, no label
  result  { ...same as analyze "result" }        // after analyze
  explanation { en, hi }
  model_version

screenings/{screening_id}/recordings/{recording_id}
  location, source, platform, storage_path, duration_s,
  accepted, quality { score, heart_rate_bpm, issues[] }, created_at

screenings/{screening_id}/reports/{report_id}
  storage_path, mime_type, summary_en, summary_hi, created_at
```

Composite indexes needed: `patients` on `owner_uid` + `last_activity_at`; `screenings` on `owner_uid` + `patient_id` + `created_at`.

### Cloud Storage

```text
gs://<bucket>/screenings/{screening_id}/recordings/{recording_id}.m4a   // original
gs://<bucket>/screenings/{screening_id}/recordings/{recording_id}.wav   // converted, 4 kHz mono
gs://<bucket>/screenings/{screening_id}/reports/{report_id}.{jpg|png|pdf}
gs://<bucket>/screenings/{screening_id}/heatmaps/{location}.png         // stretch
gs://<project>-ml/models/{model_version}/                               // separate bucket; runtime has no access
```

- Security rules: **deny all client reads/writes**; only Admin SDK. The buckets use uniform access and public access prevention.
- Data bucket: soft delete off, so `DELETE` really deletes audio; 30-day lifecycle rule on `screenings/` as a backstop.
- Rejected recordings: metadata only, audio deleted after the quality check.
- Heatmaps via short-lived signed URLs.
- Profiles stay until the user deletes them. The 30-day rule applies to audio, not to profiles.
- **No phone numbers, addresses or exact DOB, and full names are not asked for.** The only free-text identifier is the patient `label`, a nickname or code. A user can still type a real name, so treat `label` as personal data: it stays out of logs, Gemini prompts, screening snapshots and share text.

## 4. Audio pipeline [ctx §10, §11]

One module `app/services/audio.py`, constants in one config object, identical in training and inference. Values are **starting values**.

| Step | What | Starting value |
|------|------|----------------|
| 1. Decode | ffmpeg → mono float32 PCM, from a temp file (not stdin), hardened | `ffmpeg -protocol_whitelist file -t 35 -i in.m4a -ac 1 -f f32le pipe:1`; empty output = `unsupported_audio` |
| 2. Trim | drop first/last 1 s | 1.0 s each side |
| 3. Resample | single rate | `sample_rate = 4000`, CardioPHON's rate (`config_4k.yaml`) |
| 4. Bandpass | Butterworth, zero-phase, **for quality checks only** | order 4, 25–400 Hz. The model gets unfiltered audio |
| 5. Spike removal | Schmidt et al. | optional |
| 6. Quality check | below, before normalizing so level checks see the real signal | reject → `accepted: false` |
| 7. Normalize | peak normalize | divide by max abs |
| 8. Features | log-mel of the whole recording, no windows | `n_fft=512`, `hop_length=160` (40 ms), `n_mels=64`, `fmin=60`, `fmax=2000`; `log(S + 1.19e-7)`; `(x + 4.1357055) / 2.863227` |

All values live in `app/core/audio_config.py`. `app/services/features.py` matches nnAudio, the library CardioPHON trained with, and a golden test guards this.

Audio past 35 s is not decoded. This enforces ctx §7's 30 s maximum without a new error code.

### 4.1 Quality rules (all must pass)

- Duration ≥ 8 s after trim → `too_short`
- Share of decoded samples with |x| ≥ 0.99 < 1% → `clipping`
- RMS of filtered signal, before normalization, above floor (tune) → `too_quiet`
- All of these above threshold (tune) → `too_noisy`: energy at S1/S2 vs energy between beats, low mains hum at 50/100/150 Hz, low spectral flatness. Don't use a 25–400 Hz energy ratio: fan hum and voice sit inside that band, so a fan scored the same as a clean recording.
- Envelope (Hilbert or homomorphic) → autocorrelation → peak searched over 30–220 bpm. Weak peak → `no_heartbeat_detected`; rate outside 40–180 bpm → `heart_rate_out_of_range`. Gives `heart_rate_bpm`.
- CardioPHON's quality model is a separate classical classifier built at 1 kHz. Add it to `quality.score` only if the model trial shows it's usable.
- Tune on: dataset good recordings, dataset unclear recordings, ~20 consented team phone recordings (quiet / fan / talking).

Neck recordings (`NK`): steps 1–6 run as normal, then processing stops; steps 7–8 and the model are skipped. Quality thresholds are stored per location type, because the neck adds breath sounds, swallowing and voice. Tune neck thresholds on ~20 consented team recordings (at rest, breathing heavily, swallowing, talking). No dataset covers this, so keep them loose until then and log the outcome counts.

### 4.2 Model and aggregation

- Main: frozen CardioPHON encoder (arXiv 2511.04533) plus a small classifier we train, in `ml/notebooks/train_cardiophon_head.ipynb`. The checkpoint holds only the encoder, so the classifier must be trained. Fallback: small CNN. Export **ONNX** `model.onnx`, CPU inference with ONNX Runtime (PyTorch has deprecated TorchScript). Version string like `cardiophon-ft-0.1`.
- Recording → site: **mean** when a site has several recordings. The backend keeps one per site.
- Site → screening: **max** over chest locations. `NK` is excluded.
- Late fusion: **off for MVP**, so `used_patient_data=false`. CirCor covers ages 0–21, so adult inputs are extrapolation, and missing flags can act as a dataset identifier. Add it only if it beats audio-only on held-out data with missing flags removed. If used: logistic regression / small MLP on `[audio_probability, age_years, sex, height_cm, weight_kg, bmi]`; missing → training medians.
- Threshold `T` chosen on validation for **sensitivity ≥ 0.85** on the final screening-level score, using MV + AV only (max depends on how many locations are used), and checked for the 1-recording case. Stored as `threshold` in `model_meta.json`, e.g. 0.35.

### 4.3 Datasets (owned by ml/, listed for context)

PhysioNet/CinC 2016 (normal vs abnormal, 2 kHz) and CirCor DigiScope 2022 (pediatric, 4 locations, 4 kHz, murmur Present/Absent/Unknown; Unknown → excluded from classifier, used as quality negatives). Split **by patient** 70/15/15, seed fixed, lists in `ml/splits/`.

- Only 60% of CirCor is public (about 940 of 1,568 patients by estimate). Check the real count after download.
- CirCor's Murmur label is per patient. Label recordings per site using the `Murmur locations` field.
- Augment with a phone channel (high-pass, AAC round trip), because training data is stethoscope audio.

### 4.4 Model artifact contract

Files are baked into the image. The notebook produces them in `hridai_model.zip`.

- `models/model.onnx` — input `log_mel`, `float32 [N, 1, 64, T]` with any `T` (40 ms per frame); output `logit`, `[N]` abnormal logit. Tested on the real encoder at 100–751 frames.
- `models/model_meta.json` — `{ "model_version", "output": "logit", "threshold", "sample_rate", "n_mels", "n_fft", "hop_length", "f_min", "f_max", "results" }`; backend validates against `audio_config.py` at startup and refuses to start on a mismatch. This is the only source for the version and threshold.
- `models/golden.npz` — preprocessed audio and its expected logit, for the backend's golden test.
- `models/fusion.json` (optional) — `{ "features": [...], "coef": [...], "intercept": x, "medians": {...} }`.

## 5. Gemini [ctx §12]

- Two jobs only: (1) explain the model result in plain Hindi + English; (2) summarize uploaded reports (image/PDF).
- Called through **Vertex AI** in `asia-south1` with the service account, no API key. Vertex doesn't train on this data without permission; the free Gemini API tier may, and it can be read by human reviewers.
- Flash-class model, exact ID pinned in `GEMINI_MODEL` (`gemini-3.5-flash`: stable, listed for `asia-south1`, shutdown no earlier than 2027-05-19). Temperature 0.2, JSON output, 15 s timeout.
- Fallback to fixed template text per label on any failure. Result never depends on Gemini.
- Send only: age, sex, symptoms, result label, probabilities, bpm, chest locations, report summary. No identifiers, including the patient `label` and `patient_id`.
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
| `unclear` | No accepted chest recording reached analyze, or all accepted chest recordings have quality score < 0.5 | Recording unclear · रिकॉर्डिंग साफ़ नहीं है |
| `needs_checkup` | `abnormal_probability ≥ T` | Please get a check-up · कृपया डॉक्टर से जाँच कराएँ |
| `normal` | `abnormal_probability < T` | No unusual sound found · कोई असामान्य आवाज़ नहीं मिली |

- `confidence` shows how far `p` is from `T`, because `T` is far from 0.5 (0.0165 for the current model): `0.5 + 0.5 × (p − T) / (1 − T)` for needs_checkup, `0.5 + 0.5 × (T − p) / T` for normal. So 0.5 means just at the threshold. App shows High ≥ 0.8, Medium 0.6–0.8, Low < 0.6. (For `unclear`, backend default: confidence = mean quality score — confirm.)
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
- Logs: request id, screening id, durations, model version. **Never patient data, profile labels or audio.**

## 9. Privacy [ctx §16]

Consent before any data (store version + timestamp) · consent is per screening, given by the person screened or their guardian · minimum data · delete endpoints remove all audio and reports, for one screening or a whole patient · neck recording is light touch only, skippable, with a stop-if-dizzy warning, and needs a doctor's review before real users · spirit of India's DPDP Act 2023 · delete hackathon data after the event · team test recordings only with consent and never used to claim accuracy · audio retained at most 30 days · rejected audio not kept · legal review before real users, covering minors' consent and Google's Generative AI health restrictions.

