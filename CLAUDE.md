## Project
Viva is an oral examination engine for distributed systems (DDIA Chapter 8). Students record spoken answers, audio is transcribed locally, an LLM extracts structured concept data, and results are shown on a dashboard.

Full requirements and concept rubrics are in [REQUIREMENTS.md](REQUIREMENTS.md). The TypeScript interfaces defined there are the source of truth for all data shapes.

## Tech Stack
- **Frontend:** Angular (in `/frontend`)
- **Backend:** Node.js + Fastify (in `/backend`)
- **Database:** SQLite
- **Speech-to-text:** Local Whisper model (no cloud STT)
- **LLM:** Claude API (Anthropic)
- **Container:** Docker Compose

## Working Rules
- Only implement the feature explicitly requested — nothing more.
- Never change the database schema without asking first.
- Always use TypeScript strict mode; no `any` types.
- Use sleek, custom styling — not default browser CSS. Keep UI simple and clean.
- Run `npm run build` in the relevant workspace before marking a task done.
- One feature at a time, as instructed.

## Feature Status
- [x] Docker Compose scaffold
- [x] Angular frontend shell
- [x] Fastify backend placeholder
- [x] Audio recording UI (start/stop/playback)
- [x] Session flow across 3 questions
- [ ] Local Whisper transcription endpoint
- [ ] LLM concept extraction endpoint
- [ ] SQLite persistence (sessions, transcripts, scores)
- [ ] Results dashboard (per-concept, pass/fail, session history)

## Environment
- API keys are in `.env` (not committed). See `.env.example` for required vars.
- Docker Compose should start the full app — a fresh `docker compose up` (plus env vars) is the target deploy path.
- **Shell:** The user runs backend commands (npm install, npm run dev, etc.) from **WSL** (paths like `/mnt/c/...`), not Windows CMD/PowerShell or Git Bash. Any install instructions for system packages (e.g. `apt install ffmpeg`) should be for WSL/Linux, not Windows.
- The frontend is built from Git Bash or Windows — `npm run build` for the frontend uses the `/c/Users/...` path convention.
