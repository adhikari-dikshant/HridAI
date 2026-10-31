# HridAI Backend: Scalability Audit

> Audited 2026-10-31 at commit `dc537b4` on `feat/backend-cloud`. Covers everything in `backend/`, plus the planned deployment in `DEPLOY.md`.
> No application code was changed. The load tests ran on a laptop, not on Google Cloud.

## 1. The answer

**Plan on 12,000 screenings a day, or about 450 people screening at the same moment, once this branch is deployed with the settings in `DEPLOY.md`.** Adding Gemini at the same settings cuts that to about **6,000 a day**. Raising concurrency from 4 to 10 when Gemini goes in brings it back to about **12,000**. From there it can grow to about 40,000 a day by raising the instance limit.

**Right now the running number is 0**, because nothing is deployed. The code can start in production, but the image has never been built and the cloud code has only run on emulators. Real patients also need the licence and legal items in §10 closed first, whatever the capacity.

| Stage | Screenings/day | People at once | Peak screenings/min | Confidence |
|-------|---------------|----------------|---------------------|------------|
| **Now** | **0** | 0 | n/a | Certain: not deployed |
| Mock staging (`DEPLOY.md` Stage A, 1 instance) | About 1,000 in total, then it crashes | Team only | n/a | Medium |
| **This branch deployed, templates only** (3 instances, concurrency 4) | **About 12,000** | 450 | 150 | Medium |
| **+ Gemini, same settings** | **About 6,000** | 240 | 80 | Medium |
| **+ Gemini, concurrency 10** | **About 12,000** | 450 | 150 | Medium |
| 10 instances | About 40,000 | 1,500 | 500 | Low: extrapolated |
| 30 instances | About 120,000 | 4,500 | 1,500 | Low: extrapolated |
| 100 instances (default project limit) | About 400,000 | 15,000 | 5,000 | Low: needs Gemini, vCPU and Firebase limits confirmed |

Rough people count at 5 screenings per active health worker per day: 6,000 a day is about 1,200 active workers, and 12,000 a day is about 2,400.

Treat every estimate here as a planning figure until the test in §11 runs on real Cloud Run. Per-instance throughput could land 30–40% either side, depending on real cloud CPU speed and on the cloud client libraries, which could not be measured here.

## 2. What stops growth at each level

| Reached | What stops you | Fix |
|---------|----------------|-----|
| 0 | Nothing deployed, and the cloud code is unproven on real Google Cloud | Build the image, deploy Stage B, run §11 |
| 80 screenings/min with Gemini | Concurrency 4 fills up waiting on Gemini, with about 80% of CPU unused | Concurrency 10, plus one CPU limiter (findings 3, 5) |
| 150 screenings/min | `--max-instances=3` | Raise it when traffic needs it, with rate limits on first (findings 7, 8) |
| About 1,500–5,000 screenings/min | Outside limits: Gemini quota, regional vCPU quota, Firebase sign-up limit per IP | Confirm in the console, request increases (§9) |
| Any level | Licence, legal and clinical limits, which no code change solves | §10 |

**The biggest surprise:** the model is not the bottleneck. It uses only about 10% of the CPU in a screening. Most CPU goes to ffmpeg and the quality checks, and once Gemini is in, most waiting will be on Gemini.

## 3. How this was measured

The tests ran the real FastAPI app under one uvicorn worker, with real ffmpeg, the real quality checks and the real `model.onnx`. Requests came over HTTP from a separate load generator.

- **Hardware:** Intel i5-13420H, with the server pinned to 2 P-cores to stand in for 2 vCPU. The load generator ran on the other cores.
- **Flow:** create patient, create screening, upload MV, AV and NK, analyze, fetch the result. Each simulated user repeats this with no pause.
- **Audio:** the CirCor demo clip encoded as AAC, 44.1 kHz mono, matching what Android sends. 15 s is the app's auto-stop length, and 30 s is the maximum.
- **Length:** 30–40 s per scenario.
- **Timing:** the branch changed mid-audit. The two key scenarios were rerun on `dc537b4` and matched: 238 versus 225 screenings/min, and 48 versus 48 with simulated waits.

**Evidence labels:** **Measured** means run here. **Simulated** means the real app plus assumed network waits. **Calculated** means worked out from those. **Docs** means from provider pages. **Reasoned** means from reading the code.

**What this does not prove:**

- Load tests used the in-memory and local-disk adapters. Firestore, Cloud Storage and Firebase client code did not run under load, because the Firebase emulators aren't installed here (no Firebase CLI, and Java 8 instead of 21). Their network waits are assumed, and their CPU cost is not counted.
- Gemini isn't built, so its time is an assumption.
- Nothing ran on Linux, in Docker or on Cloud Run. Docker's daemon was off.
- No real slow mobile networks, TLS, or real phone recordings were used.
- Runs were short, so slow memory leaks would not show. Memory figures are Windows working set for the server process, and exclude ffmpeg and temp files.
- Laptop P-cores are faster than a typical cloud vCPU. The capacity maths assumes cloud is 2× slower, which is an assumption, not a measurement.

## 4. Measured results

### Cost of each stage (one core, one request at a time)

| Recording | Decode | Quality checks | Features | Model | Upload total | Analyze per spot |
|-----------|--------|----------------|----------|-------|--------------|------------------|
| 10 s | 245 ms | 25 ms | 1 ms | 14 ms | 273 ms | 15 ms |
| 15 s | 277 ms | 78 ms | 3 ms | 25 ms | 360 ms | 28 ms |
| 30 s | 356 ms | 201 ms | 7 ms | 46 ms | 565 ms | 53 ms |
| 35 s | 386 ms | 113 ms | 9 ms | 55 ms | 509 ms | 63 ms |

Decode timings on Windows varied between runs (98 ms versus 245 ms for the 10 s clip) and include process start-up, which is usually cheaper on Linux. The 35 s quality time is lower than 30 s because that clip exits the checks earlier.

### Compute only, no network waits (15 s clip, 2 cores)

| Users at once | Screenings/min | Upload p95 | Analyze p95 | `/health` p95 | Errors |
|---------------|----------------|------------|-------------|---------------|--------|
| 1 | 72 | 318 ms | 127 ms | 7 ms | 0 |
| 2 | 159 | 279 ms | 139 ms | 10 ms | 0 |
| 4 | 227 | 396 ms | 163 ms | 9 ms | 0 |
| 8 | 229 | 779 ms | 328 ms | 15 ms | 0 |
| 12 | 223 | 1.19 s | 589 ms | 33 ms | 0 |
| 40 | 210 | 3.94 s | 3.99 s | 699 ms | 0 |

**Saturation is about 228 screenings/min on 2 laptop cores**, or about 0.53 core-seconds per screening. Above 4 users throughput stays flat and latency climbs.

### Simulated cloud waits (Simulated, 15 s clip, 2 laptop cores)

Assumed waits: Firestore 15 ms per operation, Cloud Storage 60 ms per write and 40 ms per read. Gemini varies as shown. These waits use no CPU but hold a request slot.

| Gemini wait | Concurrency | Screenings/min | Upload p95 | Analyze p95 | Peak memory |
|-------------|-------------|----------------|------------|-------------|-------------|
| None (templates, this branch) | 4 | **126** | 583 ms | 357 ms | 315 MB |
| None (templates, this branch) | 10 | 226 | 930 ms | 495 ms | 414 MB |
| 3 s | 1 | 13 | 442 ms | 3.33 s | 250 MB |
| 3 s | 4 | **48** | 617 ms | 3.35 s | 281 MB |
| 3 s | 8 | 90 | 867 ms | 3.41 s | 330 MB |
| 3 s | 10 | **110** | 955 ms | 3.46 s | 402 MB |
| 3 s | 12 | 125 | 1.24 s | 3.48 s | 440 MB |
| 3 s | 20 | 165 | 1.71 s | 3.80 s | 561 MB |
| 15 s (timeout on every call) | 4 | **14** | 587 ms | 15.3 s | 290 MB |

With Gemini at concurrency 4, only 48 of the 228 screenings/min the CPU can do get used. Throughput rises almost in line with concurrency. The 15 s row covers few screenings because each takes so long, so read it as a rough figure.

### More CPU in one instance (15 s clip)

| Cores | Users at once | Screenings/min | Gain |
|-------|---------------|----------------|------|
| 1 | 4 | 105 | |
| 2 | 4 | 227 | 2.2× |
| 4 | 8 | 391 | 1.7× |

Going from 2 to 4 cores gives less than double, because all Python work shares one worker. Adding instances will likely beat buying bigger ones.

### Recording length and memory (2 cores, concurrency as shown)

| Clip | Users at once | Screenings/min | Peak memory | Analyze p95 |
|------|---------------|----------------|-------------|-------------|
| Idle server | 0 | n/a | 190 MB | n/a |
| 15 s | 4 | 225 | 296 MB | 160 ms |
| 30 s | 4 | 129 | 433 MB | 325 ms |
| 30 s | 12 | 126 | 804 MB | 1.3 s |
| 30 s | 40 | 125 | 1,467 MB | 11.2 s |

Memory follows concurrency and clip length, and it stayed well under the planned 4 GiB. At 30 s clips and 40 users, `/health` p95 rose to 988 ms.

### Thread cap

| Setting | Screenings/min | Analyze p50 |
|---------|----------------|-------------|
| `OMP_NUM_THREADS=1` | 225 | 129 ms |
| Not set | 157 | 346 ms |

### In-memory repository

| Records | Memory growth | Get one | List for one owner |
|---------|---------------|---------|--------------------|
| 1,000 | 3 MB | 0.03 ms | 0.24 ms |
| 10,000 | 25 MB | 0.03 ms | 0.78 ms |
| 100,000 | 269 MB | 0.03 ms | 8.5 ms |

### Other measurements

- **Storage per screening:** 1.03 MB with the real pipeline (3 originals + 2 converted WAVs), and 2.16 MB for 30 s clips.
- **Start-up to healthy:** 5.4–8.6 s, most of it Python imports. The model itself loads in under 0.1 s.
- **Cloud client libraries:** another 1.5 s of import time and about 20 MB of memory.
- **Failures:** 0 failed requests in all 24 scenarios.

## 5. How the capacity numbers were worked out

Calculated, using these assumptions. Change one and rerun the sums.

| Input | Value | Source |
|-------|-------|--------|
| Cloud CPU versus laptop P-core | 2× slower (try 1.5–3×) | Assumption, replace after §11 |
| Retakes | 1.33 uploads per accepted recording | 75% of CirCor recordings pass quality. Phones may be worse |
| Upload share of CPU | 86% | Measured |
| Gemini wait | 3 s, 15 s when it times out | Assumption |
| Time to do one screening in person | 3 minutes | Assumption, from 3 spots × (15 s + 3 s countdown) plus moving the phone |
| Daily pattern | Peak minute = daily total ÷ 80 | 25% of the day in the peak hour, then 3× burst |

**CPU per screening:** 0.53 × (0.86 × 1.33 + 0.14) × 2 = **1.36 vCPU-seconds**. A 2 vCPU instance tops out at 88/min. At the 60% CPU target that is **about 50/min**.

**Slot time per screening:**

| Part | Templates | With Gemini |
|------|-----------|-------------|
| Uploads: (230 ms × 2 + 180 ms) × 3 × 1.33 | 2.55 s | 2.55 s |
| Analyze: 104 ms × 2, plus network waits | 0.42 s | 3.42 s |
| Everything else | 0.11 s | 0.11 s |
| **Total** | **3.1 s** | **6.1 s** |

**Per instance, limited by whichever runs out first:**

| Setup | Slots allow | At 70% slot use | CPU allows at 60% | Plan on |
|-------|-------------|-----------------|-------------------|---------|
| Templates, concurrency 4 | 78/min | 54/min | 50/min | **50/min** |
| Gemini, concurrency 4 | 39/min | 27/min | 50/min | **27/min** |
| Gemini, concurrency 10 | 98/min | 69/min | 50/min | **50/min** |

**To totals:** instances × per-instance rate gives peak per minute. Multiply by 80 for screenings a day, and by 3 for people at once.

## 6. Findings

### Blockers

| # | Finding | Where | Fix |
|---|---------|-------|-----|
| 1 | **The cloud path is unproven (Reasoned).** Firebase, Firestore and Cloud Storage passed on emulators only, the Dockerfile has never been built, and no cloud project exists. Real permissions, latency and SDK CPU are all still unknown, and this is the biggest risk to every number here | `Dockerfile`, `docs/DEPLOY.md` | Build the image, deploy Stage B to a staging project, run §11 |
| 2 | **Gemini isn't built, and adding it halves capacity (Simulated).** Each analyze goes from about 0.4 s to about 3.4 s of slot time, so one instance falls from 126 to 48 screenings/min in the simulation | `app/api/deps.py:61` | Ship it together with findings 3, 4 and 5 |

### High: these set the real number

| # | Finding | Where | Fix | Gain |
|---|---------|-------|-----|------|
| 3 | **Concurrency 4 is based on a wrong assumption (Simulated).** `DEPLOY.md` says inference is CPU-bound, but the model is about 10% of CPU. With Gemini at concurrency 4, slots fill up on waits and 79% of CPU capacity sits unused | `docs/DEPLOY.md:192`, `docs/SPEC.md:431` | Use concurrency 10 when Gemini ships, after finding 5 | About 2× |
| 4 | **A Gemini slowdown cuts capacity to a third (Simulated).** At the planned 15 s timeout, throughput fell from 48 to 14 screenings/min. Requests still succeed through the template, but queues build | `docs/SPEC.md:356`, future `gemini.py` | Timeout of 8 s, plus a circuit breaker that uses templates for 60 s after repeated failures | Survives an outage |
| 5 | **Most CPU work has no limit (Measured).** The semaphore covers only the model call. ffmpeg, the quality checks and feature extraction are unbounded, so raising concurrency alone risks CPU overload. At 40 users `/health` p95 reached 988 ms | `app/services/model.py:92`, `app/services/screening_service.py:114` | One CPU limiter sized to vCPUs around `quality.check`, features and the model call. Add a wait timeout | Makes finding 3 safe |
| 6 | **Firestore and Storage calls have no explicit timeout (Reasoned).** They rely on library defaults, which can outlast a useful response. A Google slowdown could hold every slot until Cloud Run's 60 s limit | `app/services/firestore_repository.py:38`, `app/services/storage.py:24` | Pass explicit timeouts, about 10 s for Firestore and 20 s for Storage, and map failures to a clean error | Limits damage |
| 7 | **The app doesn't handle a full service (Docs + Reasoned).** At the instance cap Cloud Run returns its own 429 or 500, outside our error format. Clients can retry straight away and make it worse | `docs/DEPLOY.md:194`, app client | Agree retry with exponential backoff with the app developer. Add it to `SPEC.md` §2 | Clean overload |
| 8 | **One token can take the whole service (Reasoned).** Anonymous sign-in is free, and there's no rate limit yet. A loop of 12 uploads fills all slots at the planned settings, and once Gemini ships each screening spends money | `docs/PLAN.md:261` | Build the B8 per-uid limit before raising instances. Add App Check after MVP | Protects cost |

### Medium

| # | Finding | Where | Fix |
|---|---------|-------|-----|
| 9 | **Mock staging dies after about 1,000 screenings (Calculated).** Stage A keeps audio on the instance's disk, which is memory on Cloud Run. Any restart wipes everything, which `DEPLOY.md` already warns about | `deploy/staging.env.yaml:7` | Keep it team-only and short-lived. Use a real staging project for §11 |
| 10 | **The thread cap only exists in the image (Measured).** Without it throughput drops 30%. `Dockerfile:4` sets it, but the local run steps don't, so local timing looks worse than production | `README.md:28` | Add `OMP_NUM_THREADS=1` to `.env.example`. Also set `OPENBLAS_NUM_THREADS=1` in the Dockerfile |
| 11 | **30 s recordings cost about twice as much as 15 s (Measured).** Throughput drops from 225 to 129/min. The backend decodes up to 35 s | `app/services/decode.py:13` | Keep the app's 15 s auto-stop. Consider decoding only the first 20 s, which needs an ML check first |
| 12 | **4 GiB looks oversized (Measured).** Peak was 433 MB at concurrency 4 and 804 MB at 12, before ffmpeg, temp files and cloud SDK use under load | `docs/DEPLOY.md:185` | Start with 2 GiB and lower only after §11 |
| 13 | **Each analyze reads all of a patient's screenings (Reasoned).** `_refresh_last_screening` loads every one to find the latest. With Firestore, each is a billed read, and cost grows with each return visit | `app/services/screening_service.py:282` | On analyze, set `last_screening_at` directly. On delete, query only the latest |
| 14 | **Upload steps aren't atomic (Reasoned).** The old recording is deleted before the new one is saved, and status is updated separately. A crash or double tap can lose or duplicate a recording, and more instances make that more likely | `app/services/screening_service.py:129` | Use a Firestore batch or transaction, and delete old blobs last |
| 15 | **Scale-from-zero makes someone wait (Measured + Reasoned).** Start-up was about 6 s here and will be longer on cloud | `docs/DEPLOY.md:185` | Keep minimum instances at 1 during working hours once real users arrive |
| 16 | **Logs can't show where time goes (Reasoned).** There are total request times only, with no split for decode, model, Firestore or Gemini | `app/core/logging.py:92` | Log stage durations as allowed numbers only, and record `gemini_fallback` |
| 17 | **No repeatable load test in the repo (Reasoned).** The PLAN B8 test isn't built, and this audit's scripts were throwaway | `docs/PLAN.md:264` | Add a script before the §11 test |

### Low

| # | Finding | Fix |
|---|---------|-----|
| 18 | Deleting a patient deletes every screening and blob one at a time in a single request: `app/services/patient_service.py:55`. A long history could reach the 60 s limit | Fine for now. Move to a background job if histories grow |
| 19 | In-memory lists scan all records under one lock: `app/services/repository.py:75`, `:100`. At 100,000 records that's 8.5 ms | None. Only staging uses it |
| 20 | Bigger instances scale less well (1.7× from 2 to 4 cores) | Stay on 2 vCPU. Test 1 vCPU during §11, since 1 core gave half the throughput |

### Unknown until tested

Slow rural networks may matter more than anything above. A 222 KB upload takes about 18 s at 100 kbps. If Cloud Run counts that whole time against a request slot, concurrency 4 would fill up far sooner than §1 assumes. Its docs don't say whether it buffers the request first, so §11 tests this.

### What already works well

- Plain `def` routes run in the thread pool, so blocking work doesn't stop the server. `/health` stayed under 35 ms up to 12 users.
- Zero failures at 40 users, with latency rising instead of errors.
- The upload limit and ffmpeg's duration cap bound the cost of a bad file.
- The ONNX model is small and fast, at 15–55 ms per recording.
- The analysis lock uses a Firestore transaction with a 90 s lease, so it works across instances.
- Firestore rules, composite indexes and the `ENV=prod` safety checks are in place.
- Random IDs have about 50 bits, which is plenty at these volumes.

## 7. What to do, in order

| Step | Work | Unlocks |
|------|------|---------|
| 1 | Build the image, create the cloud project, deploy Stage B (finding 1) | A running service |
| 2 | Run §11 with the load script (finding 17) | **Real numbers, about 12,000 a day if they hold** |
| 3 | CPU limiter, cloud timeouts, per-uid limit, stage timings (findings 5, 6, 8, 16) | Safe to raise limits |
| 4 | Gemini with an 8 s timeout and circuit breaker, plus concurrency 10 and 2 GiB (findings 2, 3, 4, 12) | Keeps about 12,000 a day with explanations |
| 5 | Agree 429 handling with the app developer (finding 7) | Clean overload |
| 6 | Raise `--max-instances`, min instances 1 in working hours (finding 15) | **About 40,000 a day** |
| 7 | Confirm quotas (§9) | Beyond that |

Settings for step 4. Don't apply them before the CPU limiter exists.

```powershell
gcloud run deploy heartscreen-api --image=$IMAGE --region=$R --service-account=$SA --allow-unauthenticated --env-vars-file=backend/deploy/prod.env.yaml --cpu=2 --memory=2Gi --concurrency=10 --timeout=60 --cpu-boost --min-instances=0 --max-instances=3
```

## 8. Cost

Calculated. Gemini and Cloud Run rates come from third-party listings, and Google's pricing pages couldn't be read directly, so confirm them in the calculator. Excludes free tiers, logging and support. Dollars only.

| Item | Per screening | Basis |
|------|---------------|-------|
| Gemini | About $0.0039 | 500 input + 350 output tokens (assumed) at $1.50 and $9.00 per million |
| Cloud Run | $0.00008–0.00045 | Busy versus quiet instance, 2 vCPU + 2 GiB, Tier 2 rates |
| Cloud Storage | About $0.00005 | 5 writes, 1 MB kept for 30 days |
| Firestore | About $0.00002 | About 23 reads and 12 writes, counted from the code path |
| **Total** | **About $0.0045**, or about $0.0005 with templates only | |

| Screenings/day | Screenings/month | Templates only | With Gemini |
|----------------|------------------|----------------|-------------|
| 1,000 | 30,000 | About $15 | About $135 |
| 6,000 | 180,000 | About $90 | About $810 |
| 12,000 | 360,000 | About $180 | About $1,620 |
| 40,000 | 1.2 million | About $600 | About $5,400 |
| 400,000 | 12 million | About $6,000 | About $54,000 |

- **Gemini is about 85% of the cost and over half of slot time.** It's the most expensive part of the system on both counts.
- **Options to cut it (product decision):** use a cheaper Flash model, or cache explanations by label, age band, sex and symptoms instead of exact probabilities and bpm. Caching makes explanations less personal, so review it clinically first.
- **The $20 budget alert at `DEPLOY.md:73` fires at about 4,400 screenings with Gemini.** It only notifies, and doesn't stop spending.
- **`DEPLOY.md:286` says `asia-south1` is Tier 1, and the cost tables here assume Tier 2.** The only direct evidence found is a 2021 archive, so confirm it. The `$1.30/day` idle figure at `DEPLOY.md:291` may change with the answer.

## 9. Outside limits (Docs)

| Limit | Value | Risk |
|-------|-------|------|
| Cloud Run instances | 100 per project and region by default, can be raised | Reached at about 400,000 screenings/day |
| Cloud Run regional vCPU | Depends on region, not published | **Check the console before passing 30 instances** |
| Cloud Run per instance | 8 vCPU, 32 GiB, 1,000 concurrent requests | No issue |
| Firebase new accounts | **100 per hour per IP** | **Real risk.** Indian mobile carriers often put many users behind one IP. The page doesn't say if anonymous sign-up counts, so test it. Scheduled increases are available |
| Firebase anonymous accounts | 100 million | No issue |
| Firebase token exchange | 18,000 per minute per project | No issue at these volumes |
| Firestore free tier | 50,000 reads and 20,000 writes per day | Free up to about 1,700 screenings/day |
| Firestore document size | 1 MiB | No issue. Documents are small |
| Gemini on Vertex AI | Not confirmed | **Check this before passing 500/min.** That's over 8 calls per second, and quota here is the most likely surprise |

## 10. Limits no code change solves

These stop real-world growth at any technical capacity. All are already noted in `HANDOFF.md`.

- **Model licence:** no CardioPHON licence was found, and BYOL-A's is evaluation-only. Current use is agreed only for a private demo.
- **Referrals:** test specificity is 0.448, so about half of people without a murmur get flagged. At 12,000 screenings a day that could mean thousands of referrals daily, which is a clinical capacity question.
- **Model validity:** it was trained on children's stethoscope audio, so results on adult phone recordings are unproven.
- **Legal:** Google's terms restrict clinical use (`REVIEW.md` finding 23), and DPDP review is pending (finding 27).

## 11. Test this after the first deploy

These replace the assumptions in §5. Allow half a day. Use staging data only, with real Firestore and Cloud Storage, and real Gemini once it's built.

1. Run one screening at a time for 5 minutes. Compare with the laptop figures to get the real cloud CPU factor.
2. Ramp to 4, 8, 12 and 20 at once on one instance, with `--max-instances=1`. Record throughput, CPU, memory and p95.
3. Hold 80% of the best stable rate for 30 minutes to catch memory growth.
4. Cross `--max-instances` on purpose, and record what the client sees and how long requests wait.
5. Upload at 100 kbps with four clients, and see if a fifth request starts a new instance. This settles the slow-network question.
6. Once Gemini is in, point it at an invalid model or a blocked route, and confirm that fallback holds capacity.
7. Sign up 150 anonymous users from one IP to test the Firebase limit.
8. Time a cold start with `--min-instances=0`.
9. Check Gemini quota and regional vCPU quota in the console, and the `asia-south1` tier on the pricing page.

**Pass mark:** analyze p95 under 15 s (PLAN G5), upload p95 under 3 s, 5xx under 0.1%, memory under 80%, CPU under 70%.

## Sources

- [Cloud Run quotas](https://docs.cloud.google.com/run/quotas) · [max instances](https://docs.cloud.google.com/run/docs/configuring/max-instances) · [concurrency](https://docs.cloud.google.com/run/docs/about-concurrency) · [troubleshooting](https://docs.cloud.google.com/run/docs/troubleshooting) · [pricing](https://cloud.google.com/run/pricing)
- [Firebase Auth limits](https://firebase.google.com/docs/auth/limits) · [Firestore quotas](https://firebase.google.com/docs/firestore/quotas) · [Firestore pricing](https://cloud.google.com/firestore/pricing) · [Cloud Storage pricing](https://cloud.google.com/storage/pricing)
- Cloud Run tier rates: [Cloud Run pricing catalog (third party)](https://www.economize.cloud/resources/gcp/pricing/cloud-run/). Gemini rates: [third-party pricing tracker](https://www.llmreference.com/model/gemini-3.5-flash/gcp-vertex-ai) · [Vertex AI pricing](https://cloud.google.com/vertex-ai/generative-ai/pricing)
