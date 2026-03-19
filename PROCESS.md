1. Timeline

3-14-26  5:12pm  (2.5 hrs)
  - Initialised git repository and project structure (frontend/, backend/, docker/)
  - Created Angular frontend shell with routing and placeholder pages
  - Created Fastify backend with CORS and a health-check endpoint
  - Wired up Docker Compose to run the backend container
  - Confirmed full round-trip: browser → backend → response

3-17-26  8:20am  (2 hrs)
  - Added CLAUDE.md with project conventions, working rules, and environment notes
  - Built audio recording UI: start/stop controls, live timer, playback review, re-record
  - Implemented 3-question session flow with progress step indicators
  - Integrated local Whisper transcription via @xenova/transformers; required ffmpeg to
    convert browser WebM/Opus audio to raw 32-bit float PCM at 16 kHz for Whisper input
  - Added SQLite persistence: sessions and question_assessments tables
  - Built Angular services for sessions and transcription
  - Built results dashboard: session history list and per-session detail with per-concept
    breakdown, pass/fail badges, and full transcript display
  - Fixed a race condition where the results page showed "In Progress": examCompleted was
    being set before the PATCH /complete request resolved, so the user was navigating to
    stale data — fixed by awaiting completeSession() before setting the signal

3-17-26  11:50am  (2.25 hrs)
  - Added strict input validation on all backend endpoints (400 for invalid questionNumber,
    missing fields, out-of-range values)
  - Implemented LLM concept extraction endpoint using Claude API; initial approach used
    forced tool-use with a JSON schema
  - Debugged Anthropic 400: discovered thinking and tool_choice: {type: 'tool'} are
    mutually exclusive — removed thinking from the extraction call
  - Diagnosed persistent 500 errors on Q3 (12 concepts): tried removing
    additionalProperties from nested schema, bumped max_tokens — neither worked; switched
    from tool-use entirely to a plain JSON prompt and switched model from claude-opus-4-6
    to claude-sonnet-4-6, which resolved it; added markdown fence stripping before
    JSON.parse() since Sonnet wrapped output in ```json blocks despite instructions
  - Fixed long audio truncation (~20 s cutoff): Whisper's 30-second context window was
    only processing the first chunk; fixed by passing chunk_length_s: 30 and
    stride_length_s: 5 to the transcriber call to enable overlapping long-form mode
  - Fixed ANTHROPIC_API_KEY not being loaded: new Anthropic() reads process.env but .env
    was not being sourced — added --env-file=.env to the tsx dev script
  - Added .gitignore (covering .env, node_modules/, dist/, *.db) and .env.example
  - Added ExtractionService to Angular frontend; wired extraction status into exam UI as
    an independent section so transcription display is never blocked by analysis

3-17-26  8:47pm  (3 hrs)
  - Paused audio playback when navigating between questions (viewChildren + pauseAudio())
  - Added generation counter per question to cancel in-flight transcription/extraction
    when the user presses Re-record — prevents stale results from overwriting reset state
  - Made progress step circles clickable for direct question navigation
  - Added error handling improvements:
      · Session creation failure: shows a yellow warning banner ("answers will not be
        saved") rather than silently continuing with a null session ID
      · Question save failure: wrapped in its own try/catch so a failed persist does not
        surface as a transcription error
      · Page reload guard: beforeunload event warns the user if a recording is in progress
  - Refactored server.ts into buildApp(db, anthropicClient?) factory to enable testing
    without starting a real server or hitting external services
  - Added Vitest integration tests (12 tests) covering all backend routes using Fastify's
    inject() API with an in-memory SQLite database and a mocked Anthropic client
  - Added Playwright E2E happy path test: mocks MediaRecorder/getUserMedia in-browser and
    intercepts all API calls via page.route(); drives all 3 questions end-to-end
  - Ran mutation testing (4 mutations): found that the started_at assertion was too loose
    (typeof === 'string' passed with an empty string) — tightened to an ISO 8601 regex
  - Added 4 Playwright error-state tests: session creation failure, transcription 500,
    extraction 500 (transcript still visible, Next still enabled), and page reload
  - Added Exit Exam button: injects Angular Router and navigates to / on click; button
    appears alongside Previous/Next in the non-completed state
  - Added sessionStorage persistence so transcripts and scores survive a page reload:
  - Added 2 new Playwright E2E tests: "restores transcript after page reload" (verifies
    transcript, score, and Next enabled survive reload) and "exit exam button navigates
    to home page"; updated the previous reload test whose expectation was now inverted
  - Ran mutation testing (3 mutations): wrong navigate target caught by exit test;
    removing saveToStorage() and nulling transcript on restore both caught by the
    persistence test
  - Updated exam to only show scores at the end rather than grading immediately after each question 
  - Fixed bug where exiting exam and starting again would have old data left over
  - Fixed bug where exited exams showed up in results table as "In Progress"


2. Technical Decisions

Technologies I felt strongly about:

Angular (frontend) — Framework I am most familiar with and could iterate on most quickly. Simple to use and easy to set up.

Node.js (backend) — Keeps the stack in one language (TypeScript throughout) and I'm language I'm most comfortable with.

SQLite (database) — Lightweight, zero-config, file-based storage. Survives container
restarts without a separate database service. Seemed the best for a single-user exam tool.

Claude API / claude-sonnet-4-6 (LLM extraction) — claude-opus-4-6 was the first choice
but produced persistent 500 errors on Q3's 12-concept schema. claude-sonnet-4-6 was
reliable and fast. Using Claude for both development assistance and the LLM extraction
meant the prompt engineering iteration was fast, since I had direct insight into how the
model interprets instructions. I also considered using ChatGPT but could have resulted in slower prompt engineering.

Docker Compose — Required by the project spec. 

Technologies I felt less strongly about:

Fastify (backend framework) - From my research it's minimal, has good TypeScript support, and makes
writing integration tests more straightforward than vanilla js. Also considered Express.js which I think would have done just as well. Mainly looking for something lightweight.

Whisper via @xenova/transformers (speech-to-text) — Seemed to be commonly used and well documented. Chose whisper-base.en over whisper-tiny for better accuracy on technical
vocabulary (quorum, Byzantine, fencing token), and over whisper-large to keep inference
fast enough for a real-time feel within Docker's memory constraints.

Vitest (backend test framework) — Chose mainly for ease of use and speed. TypeScript-native with no extra config, built-in
assertions and mocking, and faster than Jest or Mocha. Works well with Fastify for testing.

Playwright (E2E test framework) — Good TypeScript support and seemed to have a simpler setup than Cypress for this use case.


3. Tools & Environment

Editor / IDE
  - VSCode with extensions: Claude Code, Docker, WSL, GitHub Repositories, GitHub Copilot Chat
  - Claude Code (primary development assistant throughout the project)
  - GitHub Copilot (used initaially during project setup to save Claude tokens)

Runtime & build tools
  - Node.js 20, npm workspaces
  - TypeScript 5
  - Angular CLI 19
  - tsx (TypeScript runner for the backend dev server)
  - ffmpeg (audio conversion: WebM/Opus → raw 32-bit float PCM for Whisper)

Key libraries
  - @xenova/transformers (local Whisper inference in Node.js)
  - @anthropic-ai/sdk (Claude API client)
  - fastify, @fastify/cors, @fastify/multipart
  - sqlite3
  - vitest, @playwright/test

Environment
  - Windows 11 with WSL2 (Ubuntu)
  - Docker Desktop for Windows
  - Git / GitHub


4. Resources Consulted

- Claude Code / Claude (primary): architecture decisions, implementation, debugging,
  test design, and prompt engineering for the extraction endpoint. Greatly reduced the need to reference other documentation.
- ChatGPT: initial brainstorming, tool selection, Docker setup guidance
- Anthropic API documentation: Needed for API key setup
- Docker official documentation: Dockerfile syntax, compose networking
- Stack Overflow: npm issues, git broken pipe, WSL path quirks


5. Challenges & Solutions

Docker setup — Docker took longer than expected to install. Attempting to install from
the WSL command line left out components needed to run the full stack. Switching to the
official Docker Desktop installer resolved it.

WSL / Windows path confusion — Claude Code initially generated Windows-style paths and
commands. After adding an explicit note to CLAUDE.md that the shell is WSL (Unix paths,
forward slashes), the generated commands became consistent and the back-and-forth stopped.

Anthropic API 500 errors on Q3 — The 12-concept schema for Question 3 caused persistent
InternalServerError responses from claude-opus-4-6 regardless of schema simplification
or max_tokens increases. Switching to claude-sonnet-4-6 and replacing the tool-use
approach with a plain JSON prompt resolved it immediately. Added markdown fence stripping
(```json ... ```) since Sonnet wrapped its output despite instructions to return raw JSON.

Long audio truncation — Recordings longer than ~20 seconds were silently cut off.
Whisper's context window is 30 seconds; without chunking options it processed only the
first window. Fixed by passing chunk_length_s: 30 and stride_length_s: 5 to enable
overlapping long-form transcription mode.

Session completion race condition — The results page showed "In Progress" for completed
sessions. The root cause was that examCompleted was being set before the async
PATCH /complete request resolved, so the user navigated to the results page before the
database was updated. Fixed by awaiting completeSession() inside an explicit loading
state before transitioning the UI.

Mutation testing gap — Mutation testing (deliberately breaking source code to verify
tests catch it) revealed that the started_at assertion was checking typeof === 'string',
which passed even when the field was an empty string. Tightened to a regex match against
the ISO 8601 format.


6. If You Had More Time
- Add spec files for each component
- Ensure docker works
- Make recordings
- Make compatible with mobile
- Do more extensive manual testing to find edge cases