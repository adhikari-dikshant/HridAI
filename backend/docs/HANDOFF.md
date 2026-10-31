# HANDOFF — HridAI Backend

> **Every AI assistant: read this first, and update it before you stop.**
> Keep "Current state" and "Next task" accurate; append to the Session log (newest first). Keep it short.

## Current state

- **Phase:** **B0 and B1 done.** The full v1 API, including patient profiles and neck recordings, runs in mock mode locally: 232 tests pass (18 need the Firestore emulator, 3 need cloud settings), ruff is clean, and `scripts/smoke_test.ps1` passed against a live server. Next phase is **B2** (`PLAN.md` §3).
- **Built and tested on Firebase emulators, not on real Google Cloud:** Firebase login, Firestore and Cloud Storage. Gemini is **not built yet** (templates are used).
- **Dockerfile:** written but **never built**, because Docker Desktop would not start in this session. Build it locally before the first deploy.
- **Review:** `docs/REVIEW.md` lists 38 findings. Non-contract ones are applied to `PLAN.md`, `SPEC.md` and the HTML.
- **Still open, needs the app developer:** `/health` path (finding 2; DEPLOY.md already expects it), app minimum 10 s (10), confidence rescale (14), keep last accepted recording (33), contract edge cases (34), over-limit status (20, proposed 429), Android `audioSource: 'unprocessed'` (35).
- **Still open, needs the user:** Google's Generative AI health terms (23); legal review before real users (27).
- **Deploy:** use `docs/DEPLOY.md`. It has not been run yet.
- **Repo (`c:\wamp64\www\HridAi`)** contains: `README.md`, `heart-screening-context.html` (canonical cross-team context), `backend/` (this folder: AI entry files + `docs/`, `.env.example`, `.gitignore`, `README.md`).
- `frontend/` (Expo app) is in the repo and follows the current contract. Firebase phone login is in the code. The Phone provider and the Android app are not set up in Firebase yet, and `frontend/google-services.json` is needed before any Android build.
- **Live:** image `2324492` runs on Cloud Run (`hridai-demo-2026`, `backend/deploy/prod.env.yaml`) with the real model, Firebase login, Firestore and Cloud Storage. `dev:` tokens get 401. No real login has reached it yet, so a full screening against Firestore and Storage is still untested.
- Cloud resources: project `hridai-demo-2026` has Firebase, Cloud Run, Artifact Registry, Firestore (asia-south1), bucket `hridai-demo-2026-data` and service account `heartscreen-api`. Gemini is not set up, so explanations use templates.
- Model: **trained on Colab, `cardiophon-ft-0.1`, in `backend/models/` (gitignored), and wired in.** With `MOCK_INFERENCE=false` + `MOCK_QUALITY=false` the API runs ffmpeg decode, real quality checks and ONNX inference. Quality limits are set from CirCor only: 75% of CirCor test recordings pass, and `too_noisy` catches fan hum and voice in synthetic tests. They still need tuning on phone recordings. Firebase, Firestore and Gemini are still not built, so this runs only with `ENV=local|staging`. Test split, MV + AV, 129 patients: sensitivity 0.917, specificity 0.448, AUC 0.872, threshold 0.0165. Only 24 positives, and val AUC was 0.70, so treat these as rough. Backend preprocessing reproduces the Colab golden logit exactly. CirCor only: not valid for adults or phones.

## Next task

1. Tell the app developer that `frontend/` has moved to the current contract and confirm field names against SPEC §2 (last B1 item). `POST /v1/screenings/{id}/reports` is called by the app but not built on the backend, so report upload fails against a real server until B9 (stretch) adds it. The step can be skipped.
2. **B2 — deploy the mock**: needs the user to install `gcloud`, create the Google Cloud project and enable billing (`DEPLOY.md` steps 1–6). Write the Dockerfile from `DEPLOY.md` step 6 and build it with Docker running.
3. **Test phone recordings** through the real pipeline and tune `CHEST_LIMITS` in `quality.py`. Tell the app developer that `confidence` now means distance from the threshold (`REVIEW.md` finding 14, applied). `demo/` has two CirCor samples for the demo. After changing `audio_config.py`, `audio.py` or `features.py`, run `python ml/build_notebook.py`; a test fails otherwise.
4. CardioPHON licence: the user chose to use it for a 2-day private demo and email the authors later. No licence was found, and BYOL-A's licence is evaluation-only, so ask before any wider use.

## Key decisions so far

| Date | Decision | Why |
|------|----------|-----|
| 2026-10-31 | Backend lives in `backend/` at repo root (matches ctx §14 layout) | user request |
| 2026-10-31 | Adapters behind protocols: `DATA_BACKEND=memory\|firestore`, `AUTH_MODE=dev\|firebase`, `MOCK_INFERENCE`, `MOCK_QUALITY` | run and test with zero credentials; unblock app dev |
| 2026-10-31 | Phase order: scaffold → mock API → deploy mock → auth/persistence → audio/quality → inference → Gemini → harden → stretch | app team unblocked first, mocks replaced one by one |
| 2026-10-31 | Validation errors return **400** `invalid_request` in the SPEC envelope (override FastAPI's 422) | contract says 400 for bad input |
| 2026-10-31 | Other users' screenings return **404** (not 403) | contract; don't leak existence |
| 2026-10-31 | Model artifact contract proposed in `SPEC.md` §4.4 (`[N,1,64,T]` + `model_meta.json` + optional `fusion.json`; format superseded below) | needs confirmation by the Model trial (also Pranav) |
| 2026-10-31 | ONNX Runtime instead of TorchScript; model baked into the image; version and threshold in `model_meta.json` | TorchScript is deprecated; smaller image; can't disagree with the model. Grad-CAM (B9) now needs a separate plan |
| 2026-10-31 | Gemini through Vertex AI with `gemini-3.5-flash`, no API key | data handling; no secret to manage |
| 2026-10-31 | Metadata fusion off for MVP; rejected audio not kept; 30-day audio retention; `ENV=staging` added | `REVIEW.md` findings 15, 25, 26, 3 |
| 2026-10-31 | Multiple patient profiles: `/v1/patients` CRUD, screenings take `patient_id`, and each screening keeps a snapshot without the label. Breaking contract change, approved by the user | One account (ASHA worker, family) screens many people |
| 2026-10-31 | New location `NK` (neck beside the larynx): stored and quality-checked, never classified. An `NK` upload never changes the screening status or clears a result | No labelled neck data exists for the model; neck messages never say to press harder because of carotid pressure risk |
| 2026-10-31 | Patient list sorts on an internal `last_activity_at`, set on create and on new screening | `last_screening_at` is null for new patients, which would sort them last and let `limit` cut them off |
| 2026-10-31 | `GET /v1/screenings?patient_id=` returns 404 `patient_not_found` for a patient that isn't yours, not an empty list | Same rule as other ownership checks |
| 2026-10-31 | Cross-assistant context: `AGENTS.md` (canonical) + `CLAUDE.md`, `GEMINI.md`, `.cursor/rules/backend.mdc` pointing to it | user wants to resume in multiple AI assistants |

### B0/B1 decisions to confirm

| Decision | Why | Cost if wrong |
|----------|-----|---------------|
| `/health` added alongside the contract's `/healthz` | `DEPLOY.md` needs it; additive, app doesn't call health | Remove one route |
| Generic error codes `not_found`, `method_not_allowed` added | Contract had no code for unknown routes; additive | App ignores them |
| `GET /v1/screenings/{id}` returns the analyze response under `analysis` (null until completed) | Contract says "the analyze response if completed" without a shape | Small app + schema change |
| Accepted and rejected recordings use two response models, not `response_model_exclude_none` | `exclude_none` would drop the required `heart_rate_bpm: null` | None |
| Re-upload replaces the old recording even if the new one is rejected | Contract's "replaces"; `REVIEW.md` finding 33 is still open | A failed retake loses a good recording until agreed |
| Unclear `abnormal_probability` is still the max; `heart_rate_bpm` is the rounded mean of known rates | Contract requires a number and doesn't define the aggregate | One-line change |
| Added `LOCAL_DATA_DIR` setting | Non-root container can only write to `/tmp` | None |
| Test client dep is `httpx2`, not `httpx` | Starlette deprecated `httpx` in `TestClient` | None |
| `/docs` is off in prod; `/openapi.json` stays on | Docs aren't needed publicly; the schema isn't sensitive | Hide it with one setting |

**New additive items to tell the app developer:** `/health`, the two generic error codes, and the `analysis` field. Hindi in `errors.py`, `messages.py` and `templates.py` is drafted and needs native-speaker review.

Open backend defaults are listed in `PLAN.md` §6; ctx-level open decisions (app name, track, members 3–4, 2 vs 4 locations, CardioPHON vs CNN) are in the HTML §19.

## Gotchas / things to remember

- The user is on **Windows + PowerShell**; give PowerShell commands (`.venv\Scripts\Activate.ps1`, `$env:VAR="x"`).
- Android can't record WAV → uploads are **m4a/AAC 44.1 kHz mono**; ffmpeg is mandatory (local + Docker).
- Hindi messages for most quality issue codes are not in the context doc yet — draft them, flag for native-speaker review.
- `message_en`/`message_hi` must be omitted on accepted recordings (not `null`).
- Never use the word "diagnosis" except in the disclaimer's negation ("not a medical diagnosis").
- CirCor data is pediatric and stethoscope-recorded: performance on adult phone audio is unproven — state as limitation, don't claim accuracy from team recordings.

## Original conversation context (session 1)

The user (Pranav Soni, backend/ML owner) asked, in an Antigravity session:

> "create a new backend dir and then draft a complete plan to create the backend of this project and make sure to include this chat's context in the backend dir so i can resume the development in multiple ai coding assistants."

What the assistant did: read `heart-screening-context.html` in full (project spec: overview, team, scope, architecture, stack, user flow, recording spec, API contract, data model, audio pipeline, ML, Gemini, result logic, repo layout, deployment, privacy, demo, build plan, open decisions), then created this `backend/` folder with:

- `AGENTS.md` — canonical instructions for all AI assistants (rules, read order, session protocol)
- `CLAUDE.md`, `GEMINI.md`, `.cursor/rules/backend.mdc` — thin pointers to `AGENTS.md` for Claude Code, Gemini CLI/Antigravity, Cursor
- `docs/PLAN.md` — goals, architecture, target layout, phased checklist B0–B9, testing, risks, open defaults
- `docs/SPEC.md` — backend extract of the context doc (API contract, data model, pipeline, Gemini, result logic, config, deploy, privacy)
- `docs/HANDOFF.md` — this file
- `README.md`, `.env.example`, `.gitignore`

No application code was written; the user asked for a plan only.

## Session log (newest first)

### 2026-11-01 — Session 9 — health summary
- Added `health_summary` to the analyze response, an additive contract change the user asked for. It's built from the patient snapshot on every read, so nothing new is stored and older completed screenings get it too. It never touches the label, and the model never sees BMI.
- BMI uses WHO adult ranges, with no category under 18. A BMI outside 10–80 is hidden as a typing mistake. India often uses lower cut-offs, so a clinician should confirm which ranges to show.
- Suggestions are fixed text, not Gemini. Chest pain or fainting puts a doctor first and drops the walking and weight tips. Wording and Hindi need clinical and native-speaker review.
- The app shows a Health summary card on the result screen, including from history. Its mock has a shorter version of the rules.
- Deployed the real backend. The old memory data is gone. The next step is the Phone provider, then the APK and one full screening.

### 2026-11-01 — Session 8 — phone login and recording flow
- Added Firebase phone login (`@react-native-firebase`), because the Firebase JS SDK flow needs a web reCAPTCHA. Phone numbers stay in Firebase Auth, never in Firestore, logs or Gemini; consent text, the HTML and SPEC now say so. No backend code or API change.
- Added a 404 screen, session-lost screen, backend error messages, local playback, a move-on path after 2 failed tries, a 3-second room noise check (`NOISY_ROOM_DB` is a guess and only warns), vibration and voice cues, a pre-recording urgent warning and saved language. Reports stay hidden until the backend has that endpoint. Local recordings are deleted after analyze, on a new screening, on leaving and at app start.
- Fixed a blocker: `microphonePermission: false` under `expo-image-picker` removed `RECORD_AUDIO` from the whole Android app.
- Checked in a browser with a temporary fake recorder and a web login stand-in. A throwaway prebuild confirmed the Android config. Not tested: real SMS or Firebase login, a Gradle build, real mic, audible playback, vibration, spoken cues or the real noise level, because this PC has no Android SDK.

### 2026-10-31 — Session 7 — frontend moved to the current contract
- Pulled `frontend/` and moved it to the v1 contract: types, client and mock, a new Patients screen, profile vs per-screening symptoms in the form, the neck step (light touch, skip, stop-if-dizzy, no "press" wording), per-patient history and delete, and `analysis` nested in `ScreeningDetail`. No backend code changed.
- Added `EXPO_PUBLIC_DEV_UID`, which sends `Bearer dev:<uid>` to a local `AUTH_MODE=dev` backend. Firebase login in the app is still to do.
- Checked the web build against a live mock API: first-run flow, create, pre-fill, partial `PATCH`, history, result, and patient delete through the API. Recording was not run, because the test browser has no mic; uploads were sent directly. The delete-patient dialog was not run either, because `Alert` does nothing on web. Both need a phone test.

### 2026-10-31 — Session 6 — scalability audit
- Wrote `docs/SCALABILITY_AUDIT.md` against `dc537b4`. Load-tested the real pipeline on 2 laptop cores with the memory adapters: about 228 screenings/min with no network waits and 0 failures. Firestore, Storage and Firebase client code did not run under load (no emulators here), so cloud figures are estimates until its §11 test runs.
- Headline: about 12,000 screenings a day once this branch is deployed, about 6,000 after Gemini at concurrency 4, and about 12,000 again at concurrency 10. Nothing is deployed yet, so today's running number is 0.
- The model is about 10% of CPU. `DEPLOY.md`'s reason for concurrency 4 is wrong, but don't raise it until a CPU limiter covers `quality.check`, features and the model call. No app code or deploy settings changed. Load-test scripts were not added to the repo.

### 2026-10-31 — Session 6 — Docker and cloud adapters
- Added Dockerfile, deploy env files, Firestore rules and indexes, Firebase token verification, `FirestoreRepository` and `GCSBlobStore`, on branch `feat/backend-cloud`.
- Contract tests run the same checks on memory and emulator stores. They caught recording order differing between stores, and Firestore lock contention causing a 500. Both fixed.
- Added the `owner_uid` + `created_at` index, which the all-patients history query needs. Check real indexes after first deploy: emulators do not enforce them.

### 2026-10-31 — Session 5 — real model in the API
- Added safe ffmpeg decode, real quality checks, `OnnxClassifier` and the confidence rescale, test-first. Trained model ran on 244 real CirCor test recordings through the API code: 183 passed quality, and of those 24 of 30 murmur recordings were flagged, as were 68 of 153 without a murmur.
- Heart-rate search is 30–220 bpm, and a rate above 180 falls back to the full beat when one is found, so `heart_rate_out_of_range` mostly catches slow rates. CirCor has no bpm labels, so bpm is checked on synthetic audio only.
- `SPEC.md` lists three noise measures; the code uses two (beat contrast and mains hum).

### 2026-10-31 — Session 5 — patient profiles + neck recording
- Added `/v1/patients`, `patient_id` on screenings, and the `NK` location, matching the updated HTML. SPEC, `openapi.json` and the smoke test match. Not committed.
- New in the code: `app/api/patients.py`, `app/services/patient_service.py`, `tests/test_patients.py`. `InMemoryRepository` holds patients, so B3 must add them to the Firestore repository, including the two composite indexes in SPEC §3.
- B4 must add separate neck quality thresholds. `MockQuality` treats `NK` like any chest spot.
- Neck Hindi text in `messages.py` is drafted and needs native-speaker review. The neck placement instruction needs a doctor's review before real users.

### 2026-10-31 — Session 4 — training notebook
- Confirmed the checkpoint is encoder-only, so a classifier must be trained. ONNX export works on the real encoder at any length.
- Audio plan moved to CardioPHON's settings (4 kHz, whole recording, 60–2,000 Hz). SPEC, PLAN and the HTML are updated. `audio_config.py`, `audio.py` and `features.py` added; `features.py` matches nnAudio.
- Notebook tested end to end on 120 patients with real data. Those numbers are too small to quote.

### 2026-10-31 — Session 3 — B0 + B1
- Built the scaffold and full v1 mock API test-first, on branch `feat/backend-mock-api`. Not committed.
- Tests, lint, `docs/openapi.json` and the live smoke test all pass. ffmpeg is still not installed locally; B1 doesn't need it, B4 does.
- Reviewed by the author only, no independent review yet.
- Checked CardioPHON: weights linked, no licence found.
- Next: see "Next task".

### 2026-10-31 — Session 2 — plan review + deploy guide
- Reviewed all plans against current Google docs and numeric tests of SPEC's constants. Wrote `docs/REVIEW.md`.
- Wrote `docs/DEPLOY.md` (PowerShell, Vertex AI for Gemini, dedicated service account, image-based deploys). Not run: no code yet, `gcloud` not installed, Docker daemon was off.
- README deploy section now points to `DEPLOY.md`. No code, no cloud resources touched. Nothing committed.
- Applied the non-contract findings to `PLAN.md` and `SPEC.md`; aligned `.env.example` and the `AGENTS.md` stack line. Contract findings left for the app developer.
- Updated the HTML to match, leaving its API contract sections unchanged, so `SPEC.md` no longer needs a differences section.
- Next: agree the open contract items, then B0 + Model trial.

### 2026-10-31 — Session 1 (Antigravity) — planning
- Created `backend/` with plan, spec, handoff and multi-assistant entry files.
- No code, no cloud resources touched.
- Next: B0 scaffold.

