# Viva — Oral Examination Engine

A full-stack application for oral distributed-systems examinations. Students record spoken answers, audio is transcribed locally via Whisper, an LLM extracts structured concept data, and results are shown on a dashboard.

## Prerequisites

- Node.js 20+
- ffmpeg (required for audio conversion — `sudo apt install ffmpeg` on WSL/Linux)
- An [Anthropic API key](https://console.anthropic.com) with available credits

## Environment setup

Create `backend/.env` with your API key:

```
ANTHROPIC_API_KEY=sk-ant-...
```

The backend reads this file automatically on startup (`npm run dev`). Never commit `.env` — it is listed in `.gitignore`.

## Running locally

**Backend** (from WSL or Linux terminal):

```bash
cd backend
npm install
npm run dev        # starts on http://localhost:3000
```

**Frontend** (from any terminal):

```bash
cd frontend
npm install
ng serve           # starts on http://localhost:4200
```

## Running tests

**Backend integration tests** (from WSL — native bindings require Linux):

```bash
cd backend
npm test
```

**Frontend unit tests:**

```bash
cd frontend
npm test
```

**E2E tests** (Playwright — Chromium must be installed once before first run):

```bash
cd e2e
npm install
npx playwright install chromium
```

Then, with the backend running (`npm run dev` in a WSL terminal), run:

```bash
npx playwright test
```

The Playwright config starts the frontend dev server automatically.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Angular (standalone components, signals) |
| Backend | Node.js + Fastify |
| Database | SQLite |
| Speech-to-text | Whisper via `@xenova/transformers` (runs locally) |
| LLM | Claude API (`claude-sonnet-4-6`) |
| Container | Docker Compose |

## Database

The backend runs migrations automatically on startup — no manual setup needed. The SQLite database is stored at `backend/data/app.db` and persists across restarts (both locally and in Docker via a volume mount).

## Running with Docker

```bash
# Copy and fill in your API key
cp backend/.env.example backend/.env

docker compose up
```

The app will be available at `http://localhost:4200`.

> **First run:** Docker will download the Whisper model (~150 MB) on startup. This only happens once — the model is cached in a named volume (`whisper_cache`) and reused on subsequent starts.

If you have pulled new code and need to rebuild the images:

```bash
docker compose up --build
```
