import sqlite3 from 'sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { initDb, buildApp } from './app.js';

const PORT = parseInt(process.env.PORT ?? '3000', 10);
const DB_PATH = process.env.DB_PATH ?? './data/app.db';

const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new sqlite3.Database(DB_PATH);

await initDb(db);

const app = buildApp(db);

const shutdown = async () => {
  app.log.info('Shutting down...');
  await app.close();
  db.close();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

await app.listen({ port: PORT, host: '0.0.0.0' });
