# HridAI Backend: Plan Review

> Reviewed 2026-10-31: `PLAN.md`, `SPEC.md`, `HANDOFF.md`, `README.md`, `AGENTS.md`, `.env.example` and `../../heart-screening-context.html` (ctx).
> No backend code exists yet, so this reviews the design, not an implementation.
> **Status:** all non-contract findings are applied to `PLAN.md`, `SPEC.md` and `heart-screening-context.html` (2026-10-31). **Still open:** contract findings 2, 10, 14, 33 and 34, which need agreement with the app developer (`AGENTS.md` rule 2); finding 23, which is a legal question; the app-side part of 35; and the over-limit status for 20.

## Verdict

The architecture is right for this project: keep it. The problems are in the details. Several would fail at deploy or demo time, and some of the scoring logic would give misleading results. The deploy commands in the docs are unsafe as written, so use [DEPLOY.md](DEPLOY.md) instead.

### Keep as planned

| Decision | Why it is right |
|----------|-----------------|
| Cloud Run in `asia-south1`, scale to zero | Standard for a bursty API. Near-zero idle cost |
| Model in the container, no Vertex endpoint | An endpoint bills while idle and adds a network hop for a small CPU model |
| Synchronous `/analyze`, no queue | A few seconds of work. Queues would add failure modes with no benefit |
| Upload through the API, not signed URLs | Files are ≤ 5 MB and the app needs the quality result in the same response |
| Firestore + Cloud Storage, backend owns all writes | Simple security model that scales without tuning |
| Adapters behind `Protocol`, mock-first phases | Tests run offline and the app developer is unblocked early |
| Classical DSP only, reject bad audio | Correct, and defensible for a medical-adjacent product |
| Shared preprocessing, split by patient, golden test | The right defences against the most common ML failures |
| Gemini never classifies, template fallback | The result survives a Gemini outage |

## How findings were checked

- **Tested:** ran SPEC's constants in a throwaway script (librosa, scipy, ffmpeg 7.1). Signals were synthetic, so these prove the logic, not real-world tuning.
- **Docs:** checked against current Google, PyTorch, PhysioNet and Expo documentation and the CardioPHON paper. Sources are at the end.
- **Reasoned:** design analysis, not run.

## Must fix

### Deployment

**1. The documented deploy can go live with dev auth (Docs + Reasoned).**
SPEC §8 and ctx §15 set no `ENV`, `AUTH_MODE` or `DATA_BACKEND`, and PLAN B0 makes the defaults `AUTH_MODE=dev` and `DATA_BACKEND=memory`. Deployed that way, `Authorization: Bearer dev:anything` is accepted on a public URL and data is held in memory. None of the three commands sets `--service-account` either, so Cloud Run falls back to the Compute Engine default account, which Google warns may hold Editor. None sets `--max-instances`, so nothing caps a traffic or cost spike.
*Fix:* set `ENV=prod` in the Dockerfile so staging must opt out, refuse to start if `ENV=prod` with dev auth, memory storage or any mock, and use the commands in DEPLOY.md.

**2. `/healthz` is on a path Cloud Run tells you to avoid (Docs). Contract.**
Cloud Run's known-issues page says some paths ending in `z` are reserved and recommends avoiding all of them. B2's acceptance test calls `/healthz` on the public URL.
*Fix:* serve `/health` and keep `/healthz` for local use. The app doesn't call it (ctx §6), so the impact is small. The docs don't say `/healthz` itself fails, so confirm on the first deploy.

**3. B2 needs a mode the plan does not have (Reasoned).**
B2 deploys before Firestore exists, so it needs dev auth and memory storage, but dev auth is refused when `ENV=prod` and `ENV` only allows `local | prod`. Memory storage also breaks across instances and is lost whenever the instance scales down.
*Fix:* add `ENV=staging`, deploy the mock with `--max-instances=1`, and tell the app developer that data can vanish.

**4. Least privilege is too broad (Docs).**
`roles/storage.objectAdmin` should be bound on the bucket, not the project. `sa.json` is a long-lived key and is unnecessary.
*Fix:* use `gcloud auth application-default login` locally. Add the token-creator role only when heatmaps (B9) need signed URLs.

### Audio pipeline

**5. Decoding m4a through stdin can silently return nothing (Tested).**
B4 pipes ffmpeg's output, and it's natural to pipe the input too. With a default-muxed m4a (moov atom at the end), stdin decoding returned **exit code 0 and 0 bytes**. With a temp file it decoded fully. Whether phone files are laid out this way is unknown, so don't depend on it.
*Fix:* write the upload to a temp file, and treat empty output as `unsupported_audio`.

**6. ffmpeg is parsing untrusted files (Reasoned).**
*Fix:* add `-protocol_whitelist file`, restrict input formats, cap the duration with `-t 35`, and keep the subprocess timeout. The backend must enforce ctx §7's 30 s maximum, since a 5 MB file can decode to far more audio than that.

**7. `too_noisy` will not catch a fan or a talking person (Tested).**
The rule measures energy in 25–400 Hz against total, but hum and voice sit inside that band:

| Signal | Ratio on raw 44.1 kHz | Ratio after resample + bandpass |
|--------|----------------------|---------------------------------|
| Clean heartbeat | 0.998 | 1.0000 |
| Fan hum 10× louder | **1.000** | 1.0000 |
| Voice-like tone 10× louder | 0.874 | 0.9994 |

The fan case scores as clean as the real heartbeat, so B4's acceptance test ("rejected with `too_noisy` with a fan on") cannot pass. After filtering, the ratio is about 1 for everything.
*Fix:* compare energy at S1/S2 with energy between beats, and add a mains-hum measure at 50/100/150 Hz, the autocorrelation peak strength, and spectral flatness. Tune on the ~20 phone recordings.

**8. SPEC normalizes before the quality check (Reasoned).**
Step 6 peak-normalizes and step 7 checks quality. After normalization, `too_quiet` is measuring the wrong thing, because the signal's level was just changed.
*Fix:* compute clipping on the decoded signal and RMS before normalization.

**9. `heart_rate_out_of_range` can never fire (Tested).**
The peak search is limited to 40–180 bpm, so every estimate falls in range.
*Fix:* search 30–220 bpm and then apply the range check.

**10. An 8 s recording is rejected as too short (Reasoned). Contract.**
ctx §7 sets a hard minimum of 8 s, but the rule is ≥ 8 s after trimming 2 s.
*Fix:* make the app's minimum 10 s.

**11. About half the log-mel bands are empty (Tested).**
The signal is bandpassed to 400 Hz but mels run to 800 Hz. **33 of 64 bands sit above 400 Hz and hold 0.002% of the energy.** Set `fmax=400`, or raise the bandpass if the model wants more range. Decide this together with finding 12.

### Model

**12. The model contract was written before checking CardioPHON (Docs). Do this first.**
SPEC §4.4 assumes `[N,1,64,251]` at 2 kHz. The paper describes CardioPHON as built on BYOL-A, which takes **96×64** log-mel inputs. Its quality model is a separate classical classifier built at **1 kHz**, so ctx's "CardioPHON quality head" isn't something you can simply plug in. The repository page did not show a license or weights, and the paper itself is CC BY-NC-ND. Listen2YourHeart (ctx §21) is a different project, and appears to use TensorFlow with 2 kHz, 5 s windows.
*Fix:* run ctx's one-day CardioPHON trial **before** B4 and B5 freeze any constants. Confirm the weights, license, sample rate and input shape. Let `model_meta.json` declare the full preprocessing, and fall back to the small CNN if the trial stalls.

**13. Threshold is tuned at the wrong level (Reasoned).**
Taking the max across locations raises the abnormal score as locations are added, and the app needs 1 accepted recording but pushes for 2, while CirCor has up to 4. A threshold tuned on 4 won't deliver sensitivity ≥ 0.85 on 2.
*Fix:* tune `T` on the final fused screening-level score, using MV + AV only, and test the 1-recording case separately.

**14. Confidence is misleading around the threshold (Tested). Contract.**

| p | Label | Confidence | Shown as |
|---|-------|------------|----------|
| 0.30 | normal | 0.70 | Medium |
| 0.34 | normal | 0.66 | Medium |
| 0.36 | needs_checkup | 0.36 | **Low** |
| 0.59 | needs_checkup | 0.59 | **Low** |

With `T=0.35`, a p of 0.59 is well past the threshold yet shows Low, and a score just below the threshold shows more confidence than one well above it.
*Fix:* rescale around `T`, for example `0.5 + 0.5*(p-T)/(1-T)` above and `0.5 + 0.5*(T-p)/T` below. The field stays the same; only its meaning changes. The ctx §13 rule must be updated too. Calibrate probabilities on validation data before relying on these bands.

**15. Metadata fusion is likely to mislead (Reasoned).**
CirCor is ages 0–21, so an adult's age and weight are extrapolation. PhysioNet 2016 has little demographic data, so "missing" flags can act as a dataset identifier, letting the model learn the data source instead of the heart sound.
*Fix:* ship audio-only for the MVP (`used_patient_data=false`). Add fusion only if it wins on held-out data with the missing flags removed.

**16. Training labels are coarser than the plan assumes (Docs).**
CirCor's Murmur label is per patient ("detected in at least one" recording), so a recording from a clean site inherits Present. Only 60% of CirCor is public, so ctx's 1,568 patients overstates what you can use.
*Fix:* use the `Murmur locations` field to label per site. Add a phone channel to augmentation (high-pass, AAC round trip), since training data is stethoscope audio.

### Reliability and safety

**17. `analyzing` can stick forever (Reasoned).**
If an instance crashes or the 60 s timeout hits mid-analysis, the status stays `analyzing` and every retry gets 409. The app's 45 s timeout makes retries likely. Two instances can also start the same analysis.
*Fix:* set the status in a Firestore transaction with `analysis_started_at`, and treat it as expired after 90 s.

**18. Sync clients and CPU work will block or oversubscribe (Reasoned).**
Firestore, GCS and token verification are sync clients. Called from `async def` routes, they block the event loop. The plan covers CPU work only. Separately, `set_num_threads(2)` with concurrency 4 means up to 8 threads on 2 vCPUs.
*Fix:* use plain `def` routes, one thread per inference, and a semaphore of 2 around inference.

**19. The upload limit is checked too late (Reasoned).**
Starlette parses the multipart body before your handler runs, and Cloud Run's `/tmp` uses instance memory.
*Fix:* reject on `Content-Length` in middleware and also count bytes while reading.

**20. "No rate limiting" leaves Gemini spend open (Reasoned).**
Anonymous sign-in is free for anyone, so a Bearer token does not prove the caller is your app.
*Fix:* add a per-uid daily limit in Firestore, `--max-instances`, and a budget alert. App Check is verifiable from Python, but no Expo-specific path was confirmed, so treat it as post-MVP.

**21. The banned-word filter rejects the good case (Reasoned).**
B6 bans `diagnos`, but ctx's own sample explanation says "This is not a diagnosis." Most good outputs would fall back to the template, and you would see it only in logs.
*Fix:* ban phrases such as "you have" and "diagnosed with", and allow "not a diagnosis".

**22. Use Gemini through Vertex AI, not an API key (Docs).**
Free-tier Gemini API data can be used to improve Google's products and read by human reviewers, and Google says not to submit sensitive data to it. Vertex AI doesn't train on your data without permission, needs no API key because it uses the service account, and supports a regional endpoint. It also earns the Google-tech marks and works with the same `google-genai` SDK.
*Fix:* use Vertex with `gemini-3.5-flash`. It's listed for `asia-south1`, and shutdown is no earlier than 2027-05-19. Newer Flash models are flagged short-term. Google notes that regional endpoints alone don't guarantee in-region processing.

**23. Google's terms restrict this use (Docs). Your decision.**
Google Cloud's Generative AI terms bar use "for clinical purposes" or "as a substitute for professional medical advice", and uses needing regulatory clearance. The Gemini API terms have a similar restriction. A hackathon demo is low risk, but get legal advice before real patients use it. Templates remain a working fallback if you ever need to remove Gemini.

**24. Report images break the "no identifiers" rule (Reasoned, B9 only).**
Photos of reports usually show names and phone numbers, which would be stored in GCS and sent to Gemini. Report text can also carry prompt injection.
*Fix:* treat this as a privacy decision before building B9. Add consent wording, delete the image after summarizing, and pass the summary through the same output checks.

### Privacy

**25. Rejected audio is kept beyond what consent says (Reasoned).**
PLAN §6 keeps rejected recordings for tuning, but consent says data is stored "to give you a result".
*Fix:* delete them, or add this purpose to the consent text. Use team recordings for tuning.

**26. "Delete leaves nothing behind" is false by default (Docs).**
New buckets have 7-day soft delete, so deleted audio stays recoverable for a week.
*Fix:* create the bucket with `--soft-delete-duration=0` and add a 30-day lifecycle rule as a backstop.

**27. Anonymous identity weakens deletion and consent (Reasoned).**
Reinstalling the app loses the uid, so the user can no longer delete their data. An ASHA worker's phone also mixes many patients under one uid, and `age_years` of 0 means a minor can't consent for themselves. DPDP Rules were notified in November 2025, with phases on 14 Nov 2026 and 14 May 2027; sources conflict on when the children's consent rule starts, and health-provider exemptions may apply. This needs legal review before any real use.
*For the demo:* retention limit covers lost uids, and the consent screen should name a guardian for minors.

## Should fix

| # | Finding | Fix |
|---|---------|-----|
| 28 | TorchScript is deprecated by PyTorch (Docs). The full torch stack installed at 865 MB against 244 MB for ONNX Runtime (Tested, Windows). Import time improved only ~2–3 s (9–11 s vs 7–8 s), so this mainly saves size, not cold start | Export to ONNX, drop torch and librosa from runtime, and write mel filters in numpy/scipy. Trade-off: Grad-CAM (B9) needs torch, so it would be precomputed or dropped |
| 29 | Downloading the model to `/tmp` at startup slows cold starts and uses RAM | Bake it into the image, so the code and model version together |
| 30 | `TARGET_SR`, `MODEL_VERSION` and `DECISION_THRESHOLD` as env vars can disagree with the model, and `TARGET_SR` forks a constant (against rule 5) | Move all three to `model_meta.json` |
| 31 | `requirements.txt` plus `pyproject.toml` means two dependency lists | Use `uv.lock`, export for Docker, and pin the base image |
| 32 | `.gitignore` lists `models/`. Google's docs don't clearly say whether gcloud applies it when `.gcloudignore` is missing, so a baked model could be left out of the upload | Commit a `.gcloudignore` (DEPLOY.md) and check with `gcloud meta list-files-for-upload` |
| 33 | "Replaces" (SPEC §2) conflicts with "latest accepted per location" (PLAN §6): a bad retake could erase a good recording | Keep the last accepted recording until a new one is accepted **(Contract)** |
| 34 | Dead or unclear contract cases: `unclear` when no recording reached analyze (409 happens first), `status: "failed"` in the type though B5 returns 500, and `per_location` audio vs fused score | Agree wording with the app developer **(Contract)** |
| 35 | Android's default mic source may apply noise suppression, which conflicts with rule 4 | Set `audioSource: 'unprocessed'` in expo-audio. It falls back if unavailable. No iOS measurement mode is documented |
| 36 | No monitoring planned | Add a budget alert, 5xx log alert and uptime check (DEPLOY.md) |
| 37 | FastAPI validation errors can include request values | Never log the raw error body, since it can hold patient fields |
| 38 | Duplicate ID lengths: `scr_8f2k1x` in SPEC, 10 characters in PLAN §6 | Use 10 and update the examples |

## Checked and not a problem

- **Heart-rate doubling:** I suspected autocorrelation would lock onto the S1–S2 gap. It didn't: 60–120 bpm all came back exact across S2 strengths. Still check this on real recordings, where S2 can be stronger.
- **Window size:** 5 s at hop 40 gives 251 frames, as SPEC says.
- **File size:** 5 MB and 10 MB uploads are fine on Cloud Run.

## Suggested order of work

1. **Now:** run the CardioPHON trial (12), since it decides findings 11 and 28 and the contract in SPEC §4.4.
2. **B0:** build in findings 1, 3, 18, 19, 31.
3. **B2:** follow DEPLOY.md, and confirm finding 2.
4. **B3:** findings 17, 20, 26.
5. **B4:** findings 5–11.
6. **B5 and B6:** findings 13–15, 21, 22.
7. **Before any real user:** findings 23, 24, 25, 27.

Team decisions are needed on findings 2, 10, 14, 33 and 34.

## Sources

- [Cloud Run known issues](https://docs.cloud.google.com/run/docs/known-issues) · [service identity](https://docs.cloud.google.com/run/docs/securing/service-identity) · [`gcloud run deploy`](https://docs.cloud.google.com/sdk/gcloud/reference/run/deploy)
- [gcloudignore](https://docs.cloud.google.com/sdk/gcloud/reference/topic/gcloudignore) · [Cloud Storage soft delete](https://docs.cloud.google.com/storage/docs/soft-delete)
- [Gemini API terms](https://ai.google.dev/gemini-api/terms) · [Vertex AI data governance](https://docs.cloud.google.com/vertex-ai/generative-ai/docs/data-governance) · [Google Cloud service terms](https://cloud.google.com/terms/service-terms) · [model locations](https://docs.cloud.google.com/gemini-enterprise-agent-platform/resources/locations) · [model lifecycle](https://firebase.google.com/docs/ai-logic/models)
- [CardioPHON paper](https://arxiv.org/abs/2511.04533) · [CardioPHON repo](https://git.lih.lu/vdespotovic/cardiophon) · [Listen2YourHeart](https://github.com/aristotelisballas/listen2yourheart) · [CirCor dataset](https://physionet.org/content/circor-heart-sound/)
- [TorchScript deprecation notice](https://docs.pytorch.org/docs/stable/jit_language_reference.html) · [App Check for custom backends](https://firebase.google.com/docs/app-check/custom-resource-backend) · [Expo Audio](https://docs.expo.dev/versions/latest/sdk/audio/)
- DPDP phases: [Tribune](https://www.tribuneindia.com/news/business/govt-notifies-digital-personal-data-protection-rules-rollout-in-phases-specified-obligations-for-data-fiduciaries) · [AZB summary](https://www.azbpartners.com/?p=87811)
