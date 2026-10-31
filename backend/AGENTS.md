# AGENTS.md — HridAI Backend

> Entry point for **any AI coding assistant** (Antigravity, Claude Code, Cursor, Codex, Copilot, Gemini CLI, Windsurf, …) working in `backend/`.
> Read this file fully, then the files listed under "Read order". Keep them up to date as you work.

## What this is

HridAI (repo code-name `heartscreen`) is a phone-based **heart sound screening** app for rural India (hackathon: ABC – Aravali Build Championship, GDG Udaipur).
The React Native app records heart sounds. This **FastAPI backend** checks recording quality, classifies the result as `normal` / `needs_checkup` / `unclear`, estimates heart rate, and uses Gemini to explain the result in Hindi + English. Data lives in Firestore + Cloud Storage. It is deployed on Cloud Run (asia-south1).

Backend owner: **Pranav Soni** (backend, audio pipeline, ML, deployment).

## Read order (do this before writing code)

1. `docs/HANDOFF.md` — **current state, last session, next task.** Start here every session.
2. `docs/PLAN.md` — the full phased build plan and task checklist.
3. `docs/SPEC.md` — backend spec: API contract, data model, audio pipeline, Gemini, result logic.
4. `../heart-screening-context.html` — the canonical cross-team context doc (app + ML + backend). If something conflicts, **that file wins** until it is updated. `docs/SPEC.md` is a backend-focused extract of it.

## Non-negotiable rules

1. **Screening, never diagnosis.** Never write "diagnose", "detects disease", "you have X" in code, API messages, prompts, logs or docs. Use "screening", "pre-check", "may need a check-up".
2. **API contract is shared** with the mobile developer (`docs/SPEC.md` §2). Do not change request/response shapes without the user's explicit OK. Additive optional fields are allowed only if noted in `docs/HANDOFF.md`.
3. **Gemini never classifies.** It only explains a result our model already produced, and summarizes reports. The result must work with Gemini down (template fallback).
4. **No AI audio enhancement / denoising.** Classical DSP only. Bad audio is rejected, not fixed.
5. **One preprocessing module** (`app/services/audio.py` + `app/core/audio_config.py`) used by both inference and training. Never fork the constants.
6. **Never log patient data or audio.** Log request id, screening id, durations, model version only. Never send identifiers to Gemini.
7. **Backend owns all writes** to Firestore/Storage. Client security rules deny everything.
8. **Mock mode must always work**: `MOCK_INFERENCE=true` + in-memory/local adapters run with zero cloud credentials. The app team depends on it.
9. JSON keys `snake_case`, timestamps ISO 8601 UTC, IDs are prefixed strings (`scr_`, `rec_`, `rep_`).

## Tech stack

Python 3.11 · FastAPI · Uvicorn · Pydantic v2 + pydantic-settings · numpy / scipy · ffmpeg · ONNX Runtime (CPU) · firebase-admin (Auth + Firestore) · google-cloud-storage · google-genai (Vertex AI) · uv · pytest · ruff · Docker · Cloud Run. PyTorch and librosa are for `ml/` only, not the runtime.

## Dev environment notes

- The user develops on **Windows** (PowerShell, repo at `c:\wamp64\www\HridAi`). Give PowerShell commands; Docker/Cloud Run is Linux.
- ffmpeg must be on PATH locally (`winget install Gyan.FFmpeg`).
- Run: `uvicorn app.main:app --reload --port 8000` from `backend/` (see `README.md`).

## How to work (session protocol)

1. Read `docs/HANDOFF.md` → pick the **Next task**.
2. Work in small, tested increments. Tick the task in `docs/PLAN.md` when done (`- [x]`).
3. Run `ruff check .` and `pytest` before you stop.
4. **Before ending the session, update `docs/HANDOFF.md`**: current state, what you did, decisions made, gotchas, the next task. Add a dated entry to its Session log. This is how the next assistant resumes.
5. Record any decision that changes the plan in the Decisions log in `docs/HANDOFF.md` (and in `docs/PLAN.md` if it changes tasks).

