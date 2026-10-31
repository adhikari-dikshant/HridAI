# HridAI Backend (`heartscreen-api`)

FastAPI service for the HridAI heart sound **screening** app: recording quality check, heart rate, screening classification, and Gemini explanations in Hindi + English. Deployed on Google Cloud Run.

> Status: **mock API working locally** (B0, B1 done). See [docs/PLAN.md](docs/PLAN.md). AI assistants: start at [AGENTS.md](AGENTS.md).

## Docs

| File | Purpose |
|------|---------|
| [AGENTS.md](AGENTS.md) | Rules + session protocol for AI coding assistants |
| [docs/HANDOFF.md](docs/HANDOFF.md) | Current state, next task, decisions, session log |
| [docs/PLAN.md](docs/PLAN.md) | Phased build plan and checklist |
| [docs/SPEC.md](docs/SPEC.md) | API contract, data model, audio pipeline, Gemini, result logic |
| [docs/REVIEW.md](docs/REVIEW.md) | Review of the plan: findings to apply, with evidence |
| [docs/DEPLOY.md](docs/DEPLOY.md) | Step-by-step Google Cloud deployment |
| [../heart-screening-context.html](../heart-screening-context.html) | Canonical cross-team context (wins on conflicts) |

## Run locally (Windows / PowerShell)

```powershell
cd backend
py -3.11 -m venv .venv
.venv\Scripts\Activate.ps1
pip install -r requirements.txt -r requirements-dev.txt
winget install Gyan.FFmpeg            # ffmpeg must be on PATH
Copy-Item .env.example .env           # defaults: memory backend, dev auth, mock inference
uvicorn app.main:app --reload --port 8000
```

Test: `pytest` · Lint: `ruff check .` · Full flow against a running server (needs PowerShell 7): `./scripts/smoke_test.ps1`

Firestore, login and Storage tests need the Firebase emulators (Java 21 and `firebase-tools`). Start them with project `demo-hridai`, set `FIRESTORE_EMULATOR_HOST`, `FIREBASE_AUTH_EMULATOR_HOST`, `STORAGE_EMULATOR_HOST` and `TEST_STORAGE_BUCKET`, then run `pytest` and `pytest -m cloud`. Without them those tests are skipped.

After changing the API, run `python -m scripts.export_openapi` and share `docs/openapi.json` with the app developer. After changing dependencies, run:

```powershell
uv lock
uv export --no-dev --no-emit-project --no-hashes -o requirements.txt
uv export --only-dev --no-emit-project --no-hashes -o requirements-dev.txt
```

Dev auth (local only): send `Authorization: Bearer dev:<any-uid>`.
Phone on the same Wi-Fi: run with `--host 0.0.0.0` and use your LAN IP in `EXPO_PUBLIC_API_BASE_URL`.

## Deploy

Follow [docs/DEPLOY.md](docs/DEPLOY.md).

