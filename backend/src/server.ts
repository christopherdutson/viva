import Fastify from "fastify";
import sqlite3 from "sqlite3";
import fs from "node:fs";
import path from "node:path";
import cors from '@fastify/cors';

const PORT = parseInt(process.env.PORT ?? "3000", 10);
const DB_PATH = process.env.DB_PATH ?? "./data/app.db";

const fastify = Fastify({ logger: true });

fastify.register(cors, {
  origin: true,
  methods: ["GET", "POST", "OPTIONS"],
});

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

const shutdown = async () => {
  fastify.log.info('Shutting down...');
  await fastify.close();
  db.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

fastify.listen({ port: PORT, host: '0.0.0.0' });