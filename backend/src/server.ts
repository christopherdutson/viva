import Fastify from "fastify";
import sqlite3 from "sqlite3";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { pipeline } from '@xenova/transformers';
import Anthropic from '@anthropic-ai/sdk';
import { getRubric } from './rubrics.js';

const execFileAsync = promisify(execFile);

const anthropic = new Anthropic();

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const DB_PATH = process.env.DB_PATH ?? "./data/app.db";

const fastify = Fastify({ logger: true });

fastify.register(cors, {
  origin: true,
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
});
fastify.register(multipart, {
  limits: { fileSize: 50 * 1024 * 1024 }, // 50 MB — well above any realistic recording
});

// ── Whisper pipeline (cached after first load) ──────────────────────────────
type WhisperOutput = { text: string } | Array<{ text: string }>;
type WhisperPipelineOptions = { chunk_length_s?: number; stride_length_s?: number };
type WhisperPipeline = (input: Float32Array, options?: WhisperPipelineOptions) => Promise<WhisperOutput>;

let whisperPipeline: WhisperPipeline | null = null;

async function getWhisperPipeline(): Promise<WhisperPipeline> {
  if (!whisperPipeline) {
    const model = process.env.WHISPER_MODEL ?? 'Xenova/whisper-base.en';
    fastify.log.info(`Loading Whisper model: ${model}`);
    whisperPipeline = await pipeline('automatic-speech-recognition', model) as unknown as WhisperPipeline;
    fastify.log.info('Whisper model loaded');
  }
  return whisperPipeline;
}

// Ensure the directory for the database exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');
  db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id           TEXT PRIMARY KEY,
      started_at   TEXT NOT NULL,
      completed_at TEXT,
      overall_score REAL,
      passed       INTEGER
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS question_assessments (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id      TEXT NOT NULL REFERENCES sessions(id),
      question_number INTEGER NOT NULL,
      question_text   TEXT NOT NULL,
      transcript      TEXT NOT NULL,
      score           REAL,
      passed          INTEGER
    )
  `);
  db.run(`
    CREATE TABLE IF NOT EXISTS concept_extractions (
      id                     INTEGER PRIMARY KEY AUTOINCREMENT,
      question_assessment_id INTEGER NOT NULL REFERENCES question_assessments(id),
      concept_id             INTEGER NOT NULL,
      concept_name           TEXT NOT NULL,
      detected               INTEGER NOT NULL,
      confidence             REAL NOT NULL,
      evidence               TEXT NOT NULL
    )
  `);
});

interface SaveQuestionBody {
  questionNumber: number;
  questionText: string;
  transcript: string;
}

interface SessionParams {
  sessionId: string;
}

// Create a new exam session
fastify.post('/sessions', async (_request, _reply) => {
  const id = randomUUID();
  const startedAt = new Date().toISOString();
  return new Promise<{ id: string; started_at: string }>((resolve, reject) => {
    db.run(
      'INSERT INTO sessions (id, started_at) VALUES (?, ?)',
      [id, startedAt],
      (err: Error | null) => {
        if (err) return reject(err);
        resolve({ id, started_at: startedAt });
      },
    );
  });
});

// Save a transcribed question assessment
fastify.post<{ Params: SessionParams; Body: SaveQuestionBody }>(
  '/sessions/:sessionId/questions',
  async (request, reply) => {
    const { sessionId } = request.params;
    const { questionNumber, questionText, transcript } = request.body;

    if (![1, 2, 3].includes(questionNumber)) {
      return reply.status(400).send({ error: 'questionNumber must be 1, 2, or 3' });
    }
    if (!questionText || typeof questionText !== 'string') {
      return reply.status(400).send({ error: 'questionText is required' });
    }
    if (!transcript || typeof transcript !== 'string') {
      return reply.status(400).send({ error: 'transcript is required' });
    }

    return new Promise<{ id: number }>((resolve, reject) => {
      db.run(
        `INSERT INTO question_assessments
           (session_id, question_number, question_text, transcript)
         VALUES (?, ?, ?, ?)`,
        [sessionId, questionNumber, questionText, transcript],
        function (err: Error | null) {
          if (err) return reject(err);
          resolve({ id: this.lastID });
        },
      );
    });
  },
);

// List all sessions with question counts
interface SessionRow {
  id: string;
  started_at: string;
  completed_at: string | null;
  overall_score: number | null;
  passed: number | null;
  question_count: number;
}

// Get full session detail with question assessments and concept extractions
interface SessionDetailQuestion {
  id: number;
  question_number: number;
  question_text: string;
  transcript: string;
  score: number | null;
  passed: number | null;
  concepts: Array<{
    concept_id: number;
    concept_name: string;
    detected: number;
    confidence: number;
    evidence: string;
  }>;
}

interface SessionDetail {
  id: string;
  started_at: string;
  completed_at: string | null;
  overall_score: number | null;
  passed: number | null;
  questions: SessionDetailQuestion[];
}

fastify.get<{ Params: SessionParams }>('/sessions/:sessionId', async (request, reply) => {
  const { sessionId } = request.params;

  interface SessionBaseRow {
    id: string; started_at: string; completed_at: string | null;
    overall_score: number | null; passed: number | null;
  }
  const session = await new Promise<SessionBaseRow | null>((resolve, reject) => {
    db.get(
      'SELECT id, started_at, completed_at, overall_score, passed FROM sessions WHERE id = ?',
      [sessionId],
      (err: Error | null, row: SessionBaseRow | undefined) => {
        if (err) return reject(err);
        resolve(row ?? null);
      },
    );
  });

  if (!session) return reply.status(404).send({ error: 'Session not found' });

  interface QARow {
    id: number; question_number: number; question_text: string;
    transcript: string; score: number | null; passed: number | null;
  }
  const assessments = await new Promise<QARow[]>((resolve, reject) => {
    db.all(
      `SELECT id, question_number, question_text, transcript, score, passed
       FROM question_assessments WHERE session_id = ? ORDER BY question_number`,
      [sessionId],
      (err: Error | null, rows: QARow[]) => {
        if (err) return reject(err);
        resolve(rows);
      },
    );
  });

  interface CERow {
    question_assessment_id: number; concept_id: number; concept_name: string;
    detected: number; confidence: number; evidence: string;
  }
  const assessmentIds = assessments.map((a) => a.id);
  const extractions = assessmentIds.length > 0
    ? await new Promise<CERow[]>((resolve, reject) => {
        db.all(
          `SELECT question_assessment_id, concept_id, concept_name, detected, confidence, evidence
           FROM concept_extractions
           WHERE question_assessment_id IN (${assessmentIds.map(() => '?').join(',')})
           ORDER BY concept_id`,
          assessmentIds,
          (err: Error | null, rows: CERow[]) => {
            if (err) return reject(err);
            resolve(rows);
          },
        );
      })
    : [];

  const questions: SessionDetailQuestion[] = assessments.map((a) => ({
    ...a,
    concepts: extractions.filter((e) => e.question_assessment_id === a.id),
  }));

  const detail: SessionDetail = { ...session, questions };
  return detail;
});

// List all sessions with question counts
fastify.get('/sessions', async (_request, _reply) => {
  return new Promise<SessionRow[]>((resolve, reject) => {
    db.all(
      `SELECT s.id, s.started_at, s.completed_at, s.overall_score, s.passed,
              COUNT(q.id) AS question_count
       FROM sessions s
       LEFT JOIN question_assessments q ON q.session_id = s.id
       GROUP BY s.id
       ORDER BY s.started_at DESC`,
      (err: Error | null, rows: SessionRow[]) => {
        if (err) return reject(err);
        resolve(rows);
      },
    );
  });
});

// Mark a session as complete and compute overall score
fastify.patch<{ Params: SessionParams }>(
  '/sessions/:sessionId/complete',
  async (request, reply) => {
    const { sessionId } = request.params;
    const completedAt = new Date().toISOString();

    // Compute overall score from concept extractions
    interface ScoreRow { total_detected: number; total_concepts: number }
    const scoreRow = await new Promise<ScoreRow>((resolve, reject) => {
      db.get(
        `SELECT
           SUM(CASE WHEN ce.detected = 1 THEN 1 ELSE 0 END) AS total_detected,
           COUNT(ce.id) AS total_concepts
         FROM concept_extractions ce
         JOIN question_assessments qa ON ce.question_assessment_id = qa.id
         WHERE qa.session_id = ?`,
        [sessionId],
        (err: Error | null, row: ScoreRow) => {
          if (err) return reject(err);
          resolve(row);
        },
      );
    });

    // All 3 questions must individually pass for overall pass
    interface PassRow { all_passed: number }
    const passRow = await new Promise<PassRow>((resolve, reject) => {
      db.get(
        `SELECT MIN(COALESCE(passed, 0)) AS all_passed
         FROM question_assessments
         WHERE session_id = ?`,
        [sessionId],
        (err: Error | null, row: PassRow) => {
          if (err) return reject(err);
          resolve(row);
        },
      );
    });

    const totalDetected = scoreRow.total_detected ?? 0;
    const totalConcepts = scoreRow.total_concepts ?? 0;
    const overallScore = totalConcepts > 0 ? totalDetected / totalConcepts : null;
    const passed = passRow.all_passed === 1 ? 1 : 0;

    return new Promise<{ completed_at: string }>((resolve, reject) => {
      db.run(
        'UPDATE sessions SET completed_at = ?, overall_score = ?, passed = ? WHERE id = ?',
        [completedAt, overallScore, passed, sessionId],
        function (err: Error | null) {
          if (err) return reject(err);
          if (this.changes === 0) {
            void reply.status(404).send({ error: 'Session not found' });
            reject(new Error('Session not found'));
          } else {
            resolve({ completed_at: completedAt });
          }
        },
      );
    });
  },
);

// ── LLM concept extraction ───────────────────────────────────────────────────

interface ExtractParams {
  sessionId: string;
  questionNumber: string;
}

interface ConceptExtractionInput {
  conceptId: number;
  conceptName: string;
  detected: boolean;
  confidence: number;
  evidence: string;
}

interface AssessmentRow {
  id: number;
  transcript: string;
}

interface ExtractionResult {
  questionAssessmentId: number;
  concepts: ConceptExtractionInput[];
  score: number;
  passed: boolean;
}

fastify.post<{ Params: ExtractParams }>(
  '/sessions/:sessionId/questions/:questionNumber/extract',
  async (request, reply) => {
    const { sessionId } = request.params;
    const questionNumber = parseInt(request.params.questionNumber, 10);

    if (![1, 2, 3].includes(questionNumber)) {
      return reply.status(400).send({ error: 'questionNumber must be 1, 2, or 3' });
    }

    const rubric = getRubric(questionNumber);
    if (!rubric) {
      return reply.status(400).send({ error: 'Invalid question number' });
    }

    // Look up the question assessment
    const assessment = await new Promise<AssessmentRow | null>((resolve, reject) => {
      db.get(
        'SELECT id, transcript FROM question_assessments WHERE session_id = ? AND question_number = ?',
        [sessionId, questionNumber],
        (err: Error | null, row: AssessmentRow | undefined) => {
          if (err) return reject(err);
          resolve(row ?? null);
        },
      );
    });

    if (!assessment) {
      return reply.status(404).send({ error: 'Question assessment not found' });
    }

    // Call Claude to extract concepts
    const conceptList = rubric.concepts
      .map((c) => `${c.id}. ${c.name}: ${c.description}`)
      .join('\n');

    fastify.log.info({ transcriptLength: assessment.transcript?.length, questionNumber, conceptCount: rubric.concepts.length }, 'Starting LLM extraction');

    let extractedConcepts: ConceptExtractionInput[];
    try {
      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        system: 'You are an expert examiner evaluating oral exam answers about distributed systems. Always respond with valid JSON only — no markdown, no explanation, just the JSON object.',
        messages: [
          {
            role: 'user',
            content: `Evaluate this student answer against the rubric concepts below.

QUESTION: "${rubric.questionText}"

STUDENT'S ANSWER (transcribed from speech):
"${assessment.transcript}"

RUBRIC CONCEPTS TO EVALUATE:
${conceptList}

Instructions:
- Evaluate every concept in the rubric
- Be generous: mark detected=true if the student touches on the idea even imperfectly or with different terminology
- Provide evidence from the transcript for each concept (a direct quote or paraphrase)
- Use confidence 0.9+ when clearly stated, 0.6–0.9 when implied or partial, below 0.6 when very uncertain

Respond with this exact JSON structure:
{"concepts":[{"conceptId":1,"conceptName":"...","detected":true,"confidence":0.9,"evidence":"..."},...]}`,
          },
        ],
      });

      const textBlock = message.content.find(
        (b): b is Anthropic.TextBlock => b.type === 'text',
      );
      if (!textBlock) {
        throw new Error('LLM did not return a text response');
      }

      const jsonText = textBlock.text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();
      const raw = JSON.parse(jsonText) as { concepts: ConceptExtractionInput[] };
      extractedConcepts = raw.concepts;
    } catch (err) {
      fastify.log.error(err, 'LLM extraction failed');
      return reply.status(500).send({ error: 'Concept extraction failed' });
    }

    // Persist extractions and compute score
    const detectedCount = extractedConcepts.filter((c) => c.detected).length;
    const score = extractedConcepts.length > 0 ? detectedCount / extractedConcepts.length : 0;
    const passed = score >= 0.75 ? 1 : 0;

    await new Promise<void>((resolve, reject) => {
      db.serialize(() => {
        // Remove any prior extractions for this assessment (idempotent retry)
        db.run(
          'DELETE FROM concept_extractions WHERE question_assessment_id = ?',
          [assessment.id],
          (err: Error | null) => { if (err) reject(err); },
        );

        for (const c of extractedConcepts) {
          db.run(
            `INSERT INTO concept_extractions
               (question_assessment_id, concept_id, concept_name, detected, confidence, evidence)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [assessment.id, c.conceptId, c.conceptName, c.detected ? 1 : 0, c.confidence, c.evidence],
            (err: Error | null) => { if (err) reject(err); },
          );
        }

        db.run(
          'UPDATE question_assessments SET score = ?, passed = ? WHERE id = ?',
          [score, passed, assessment.id],
          (err: Error | null) => {
            if (err) reject(err);
            else resolve();
          },
        );
      });
    });

    const result: ExtractionResult = {
      questionAssessmentId: assessment.id,
      concepts: extractedConcepts,
      score,
      passed: passed === 1,
    };

    return result;
  },
);

fastify.post('/transcribe', async (request, reply) => {
  const upload = await request.file();
  if (!upload) {
    return reply.status(400).send({ error: 'No audio file provided' });
  }

  const tmpId = randomUUID();
  const webmPath = path.join(os.tmpdir(), `${tmpId}.webm`);
  const rawPath  = path.join(os.tmpdir(), `${tmpId}.raw`);

  try {
    await fsp.writeFile(webmPath, await upload.toBuffer());

    // Convert WebM/Opus → raw 32-bit float PCM at 16 kHz mono.
    // @xenova/transformers requires a Float32Array in Node.js — it cannot
    // load audio from a file path because AudioContext is unavailable.
    await execFileAsync('ffmpeg', [
      '-y', '-i', webmPath,
      '-ar', '16000', '-ac', '1',
      '-f', 'f32le', rawPath,
    ]);

    const rawBuffer = await fsp.readFile(rawPath);
    const audioData = new Float32Array(
      rawBuffer.buffer,
      rawBuffer.byteOffset,
      rawBuffer.byteLength / Float32Array.BYTES_PER_ELEMENT,
    );

    const transcriber = await getWhisperPipeline();
    // chunk_length_s enables long-form transcription by splitting audio into
    // overlapping 30-second windows — without this Whisper silently truncates
    // at its context window (~30 s).
    const result = await transcriber(audioData, { chunk_length_s: 30, stride_length_s: 5 });
    const output = Array.isArray(result) ? result[0] : result;
    const transcript = (output?.text ?? '').trim();

    return { transcript };
  } catch (err) {
    fastify.log.error(err, 'Transcription failed');
    return reply.status(500).send({ error: 'Transcription failed' });
  } finally {
    await fsp.unlink(webmPath).catch(() => undefined);
    await fsp.unlink(rawPath).catch(() => undefined);
  }
});

const shutdown = async () => {
  fastify.log.info('Shutting down...');
  await fastify.close();
  db.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

fastify.listen({ port: PORT, host: '0.0.0.0' });