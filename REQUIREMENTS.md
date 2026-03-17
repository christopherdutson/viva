// ALL INSTRUCTIONS

Viva — Oral Examination Engine
Scenario
Oral examinations (vivas) are one of the oldest and most rigorous forms of assessment. A
student faces an examiner, answers questions aloud, and is evaluated on the depth and
accuracy of their understanding. Your task is to build a modern, software-powered version of
this process.
The domain is distributed systems — specifically Chapter 8 ("The Trouble with Distributed
Systems") of Martin Kleppmann's Designing Data-Intensive Applications. You'll build a full-stack
application where a student speaks their answers, audio is transcribed locally, an LLM extracts
structured concept data, and results are displayed on a dashboard.

Your Mission
Build a complete, working oral examination application. The student opens the app, sees a
question, records their spoken answer, and moves through three questions. Behind the scenes,
the app transcribes speech locally, sends transcripts to an LLM for structured concept
extraction, computes scores, and presents everything on a results dashboard.
- Time cap: 16 hours of active development
- Tech stack: Your choice — any language, framework, or database

Requirements
Area Minimum Requirements
Exam UI Display one question at a time. Record audio
in-browser with start/stop controls. Provide
playback so the student can review before
submitting. Manage session flow across all
three questions.

Local Speech-to-Text Transcribe audio using a small model running 
locally (e.g., Whisper tiny, base, or
equivalent). No cloud speech-to-text APIs

Area Minimum Requirements

— the model must run on your machine.
Document your model choice and why you
picked it.

LLM Structured Extraction Send each transcript to an LLM API (use your
own API key — any provider) to extract
structured concept data matching the schema
defined below. Target 75% accuracy on
concept extraction (defined in detail below).
Database & Persistence Store exam sessions, questions, transcripts,
extraction results, and scores. Include
database migrations in your repo. The app
should survive a restart without losing data.
Results Dashboard Show the full transcript for each answer.
Display per-concept extraction results
(detected/not detected). Show pass/fail
indicators per question and overall. Provide a
session history view listing past exam
attempts.

API / Server Expose RESTful (or equivalent) endpoints
connecting the UI to transcription, LLM
extraction, scoring, and persistence layers.

The Three Exam Questions
Each question targets specific concepts from DDIA Chapter 8. The concept rubric defines what
the LLM extraction must identify from the student's spoken answer.
Question 1: Quorum Decisions & Fencing Tokens
"Explain how distributed systems use quorum-based decisions to handle
node failures, and describe the role of fencing tokens in preventing split-brain
scenarios."

# Concept Description
1 Quorum definition A quorum requires

agreement from a majority of
nodes (more than half)
2 Overlap guarantee Any two quorums must share
at least one node, ensuring
consistency

3 Leader election Quorum voting can determine

which node acts as
leader/primary
4 Split-brain problem Multiple nodes may
incorrectly believe they are
the leader simultaneously
5 Fencing token definition A monotonically increasing
number issued with each
lock/lease grant

6 Token validation Resources reject operations
carrying an older fencing
token

7 Lock vs. lease Leases are time-bounded
locks that expire
automatically

8 Failure tolerance A system with n nodes can
tolerate up to (n-1)/2 failures
with quorum

Concepts in this question: 8

Question 2: Byzantine Faults vs. Crash Faults
"Compare Byzantine faults with crash faults in distributed systems. Under
what conditions might a system need Byzantine fault tolerance, and why do
most practical systems only handle crash faults?"

# Concept Description
1 Crash fault definition A node fails by stopping — it
either works correctly or
doesn't respond at all
2 Byzantine fault definition A node may behave
arbitrarily: sending conflicting
messages, lying, or acting
maliciously

3 Byzantine use cases Required in adversarial
environments (blockchain,
aerospace, multi-party
computation)

4 Crash fault assumption Most datacenter systems
assume nodes are honest but
may crash

5 Cost of BFT Byzantine fault tolerance
requires significantly more
communication rounds and
nodes (typically 3f+1 to
tolerate f faults)
6 Trust boundary Byzantine tolerance is
needed when participants
don't fully trust each other
7 Practical simplification Crash-fault models are
simpler to reason about and
more efficient in trusted
environments

8 Real-world tradeoff Systems choose their fault
model based on the threat
model and operational
environment

Concepts in this question: 8

Question 3: System Models, Safety & Liveness
"Describe the main system models for timing assumptions in distributed
systems. Then explain the difference between safety and liveness properties,
and give an example of each in the context of a distributed database."
# Concept Description
1 Synchronous model All messages arrive within a
known, bounded time;
processes respond within a
known time

2 Asynchronous model No timing assumptions —
messages can be delayed
arbitrarily, no clocks available

3 Partially synchronous model System behaves
synchronously most of the
time but occasionally
exceeds bounds

4 Practical relevance Partial synchrony is the most
realistic model for real-world
distributed systems
5 Safety property definition Something bad never
happens — if violated, the
violation occurred at a
specific point in time
6 Liveness property definition Something good eventually
happens — the system
makes progress

7 Safety example Example: uniqueness (no two
nodes hold the same lock),
consistency (no conflicting
reads)

8 Liveness example Example: availability (every
request eventually gets a
response), termination
(algorithm eventually
decides)

TypeScript
# Concept Description
9 Safety–liveness tension Distributed algorithms must
satisfy both, but they can
conflict under network
partitions

10 Crash-recovery model Nodes may crash and restart,
losing in-memory state but
retaining durable storage
11 Fail-stop vs. fail-recovery Fail-stop nodes never come
back; fail-recovery nodes
may rejoin after crashing
12 Model as abstraction System models let algorithm
designers prove correctness
properties under stated
assumptions

Concepts in this question: 12

Structured Data Schema
Your LLM extraction must produce data conforming to these interfaces (adapt to your language
as needed):

interface ConceptExtraction {
conceptId: number; // Matches the # from the rubric table
conceptName: string; // e.g., "Quorum definition"
detected: boolean; // Was this concept present in the answer?
confidence: number; // 0.0 to 1.0
evidence: string; // Quote or paraphrase from the transcript
supporting detection
}
interface QuestionAssessment {
questionNumber: number; // 1, 2, or 3
questionText: string; // The full question prompt
transcript: string; // Raw transcription of the student's answer

concepts: ConceptExtraction[];
score: number; // Concepts detected / total concepts for this
question
passed: boolean; // score >= 0.75
}
interface VivaSession {
id: string; // Unique session identifier
startedAt: string; // ISO 8601
completedAt: string; // ISO 8601
questions: QuestionAssessment[];
overallScore: number; // Total concepts detected / 28
passed: boolean; // All three questions passed (each >= 75%)
}

The 75% Accuracy Target
Accuracy is defined per-question using precision and recall on concept extraction:
- Precision: Of the concepts your system marks as detected: true, at least 75%
must be genuinely present in the spoken answer
- Recall: Of the concepts actually discussed in the spoken answer, your system must
detect at least 75%
To demonstrate this:
1. Record yourself answering each of the three questions (use the app itself)
2. Manually annotate which concepts you actually covered
3. Compare your manual annotations against the system's extractions
4. Include at least 3 self-test recordings (one per question minimum) in your repo with the
annotations
This is a test of your prompt engineering — not of speech recognition. If transcription is
reasonably accurate, the LLM extraction quality should be the primary variable.

Non-Functional Expectations
- Type safety — Use typed languages or strict mode; avoid any / untyped escape
hatches
- Error handling — Graceful failures for microphone access, transcription errors, LLM
API failures, database connectivity
- Tests — At least one happy-path integration or end-to-end test covering the record →
transcribe → extract → score → display flow
- Git hygiene — Frequent commits with meaningful messages that tell the story of your
development process
- Clean code — Readable, well-organized, consistent formatting
- Containerized — We will evaluate your app by cloning the repo and running it in a
containerized environment. Include a Dockerfile or docker-compose.yml that
builds and starts the full application (including the local STT model). A fresh docker
compose up should be all that's needed beyond providing API keys via environment
variables.

Deliverables
Your submission is a single GitHub repository containing:
1. Source code — Complete, runnable application
2. Dockerfile / docker-compose.yml — We will clone your repo and run docker
compose up to evaluate it. The container(s) must start the full application, including the
local STT model. The only manual step should be providing API keys via a .env file.
3. README.md — Setup instructions (environment variables, how to run via Docker, any
one-time setup steps)
4. PROCESS.md — Detailed development journal (see below)
5. Self-test recordings — At least 3 recordings with manual annotations demonstrating
the 75% accuracy target
6. Demo video — Under 5 minutes showing the full flow: answering questions, viewing
results, browsing session history



Evaluation Rubric
Category Weight What We're Looking For
Audio Recording &
Playback

15% Clean in-browser recording,
playback review, reliable
audio capture across the
session flow

Local Speech-to-Text 15% Working local transcription,
reasonable accuracy,
documented model choice
and tradeoffs

Category Weight What We're Looking For
LLM Integration & Prompt
Engineering

20% Structured extraction
matching the schema, 75%
accuracy target met, effective
prompt design

Database Design &
Persistence

15% Sensible schema, migrations,
data survives restarts,
session history works
Results Dashboard 15% Transcript display,

per-concept results, pass/fail
indicators, session history
navigation

Code Quality &
Architecture

10% Clean separation of
concerns, type safety, error
handling, test coverage
PROCESS.md Quality 10% Thoroughness, honesty,
clarity of reasoning,
completeness of the six
required sections