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

const execFileAsync = promisify(execFile);

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const DB_PATH = process.env.DB_PATH ?? "./data/app.db";

const fastify = Fastify({ logger: true });

fastify.register(cors, {
  origin: true,
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
});
fastify.register(multipart);

// ── Whisper pipeline (cached after first load) ──────────────────────────────
type WhisperOutput = { text: string } | Array<{ text: string }>;
type WhisperPipeline = (input: Float32Array) => Promise<WhisperOutput>;

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

// Mark a session as complete
fastify.patch<{ Params: SessionParams }>(
  '/sessions/:sessionId/complete',
  async (request, _reply) => {
    const { sessionId } = request.params;
    const completedAt = new Date().toISOString();
    return new Promise<{ completed_at: string }>((resolve, reject) => {
      db.run(
        'UPDATE sessions SET completed_at = ? WHERE id = ?',
        [completedAt, sessionId],
        (err: Error | null) => {
          if (err) return reject(err);
          resolve({ completed_at: completedAt });
        },
      );
    });
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
    const result = await transcriber(audioData);
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