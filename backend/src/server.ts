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
  methods: ["GET", "POST", "OPTIONS"],
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

// create table if it doesn't exist

db.run(`
CREATE TABLE IF NOT EXISTS recordings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  transcript TEXT,
  result TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)
`);

fastify.post('/recording', async (request, reply) => {
  const payload = request.body as any;

  if (!payload || typeof payload.transcript !== 'string' || typeof payload.result !== 'string') {
    return reply.status(400).send({
      error: 'Invalid request body. Must include `transcript` and `result` strings.',
    });
  }

  const { transcript, result } = payload;

  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO recordings (transcript, result) VALUES (?, ?)`,
      [transcript, result],
      function (err: any) {
        if (err) return reject(err);

        resolve({
          id: this.lastID,
          transcript,
          result,
        });
      }
    );
  });
});

fastify.get('/recordings', async (request, reply) => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM recordings', (err: any, rows: any) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
});

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