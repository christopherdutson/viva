import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock @xenova/transformers before any app imports so sharp native bindings
// are never loaded during testing.
vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn().mockResolvedValue(vi.fn()),
}));

import sqlite3 from 'sqlite3';
import type { FastifyInstance } from 'fastify';
import Anthropic from '@anthropic-ai/sdk';
import { buildApp, initDb } from '../app.js';
import { getRubric } from '../rubrics.js';

// Helper to create a fresh in-memory DB for each test
async function createTestDb(): Promise<sqlite3.Database> {
  const db = new sqlite3.Database(':memory:');
  await initDb(db);
  return db;
}

// Mock Anthropic client factory
function mockAnthropicWithConcepts(concepts: object[]): Anthropic {
  return {
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({ concepts }) }],
      }),
    },
  } as unknown as Anthropic;
}

// ── POST /sessions ────────────────────────────────────────────────────────────

describe('POST /sessions', () => {
  let db: sqlite3.Database;
  let app: FastifyInstance;

  beforeEach(async () => {
    db = await createTestDb();
    app = buildApp(db, undefined, { logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('creates a session and returns id and started_at', async () => {
    const res = await app.inject({ method: 'POST', url: '/sessions' });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ id: string; started_at: string }>();
    expect(typeof body.id).toBe('string');
    expect(body.id.length).toBeGreaterThan(0);
    expect(body.started_at).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/); // ISO 8601
  });
});

// ── GET /sessions ─────────────────────────────────────────────────────────────

describe('GET /sessions', () => {
  let db: sqlite3.Database;
  let app: FastifyInstance;

  beforeEach(async () => {
    db = await createTestDb();
    app = buildApp(db, undefined, { logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('returns empty array when no sessions exist', async () => {
    const res = await app.inject({ method: 'GET', url: '/sessions' });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual([]);
  });

  it('returns completed sessions and excludes incomplete ones', async () => {
    const created = await app.inject({ method: 'POST', url: '/sessions' });
    const { id } = created.json<{ id: string }>();

    // Incomplete session — should not appear in results
    await app.inject({ method: 'POST', url: '/sessions' });

    await app.inject({ method: 'PATCH', url: `/sessions/${id}/complete` });

    const res = await app.inject({ method: 'GET', url: '/sessions' });
    expect(res.statusCode).toBe(200);
    const body = res.json<Array<{ id: string; question_count: number }>>();
    expect(body).toHaveLength(1);
    expect(body[0]!.id).toBe(id);
    expect(body[0]!.question_count).toBe(0);
  });
});

// ── GET /sessions/:sessionId ──────────────────────────────────────────────────

describe('GET /sessions/:sessionId', () => {
  let db: sqlite3.Database;
  let app: FastifyInstance;

  beforeEach(async () => {
    db = await createTestDb();
    app = buildApp(db, undefined, { logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('returns 404 for unknown session ID', async () => {
    const res = await app.inject({ method: 'GET', url: '/sessions/nonexistent-id' });
    expect(res.statusCode).toBe(404);
  });

  it('returns session detail with empty questions array for a newly created session', async () => {
    const createRes = await app.inject({ method: 'POST', url: '/sessions' });
    const { id } = createRes.json<{ id: string }>();

    const res = await app.inject({ method: 'GET', url: `/sessions/${id}` });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ id: string; questions: unknown[] }>();
    expect(body.id).toBe(id);
    expect(body.questions).toEqual([]);
  });
});

// ── POST /sessions/:sessionId/questions ───────────────────────────────────────

describe('POST /sessions/:sessionId/questions', () => {
  let db: sqlite3.Database;
  let app: FastifyInstance;
  let sessionId: string;

  beforeEach(async () => {
    db = await createTestDb();
    app = buildApp(db, undefined, { logger: false });
    await app.ready();
    const createRes = await app.inject({ method: 'POST', url: '/sessions' });
    sessionId = createRes.json<{ id: string }>().id;
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('returns 400 if questionNumber is invalid (e.g. 5)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/sessions/${sessionId}/questions`,
      payload: { questionNumber: 5, questionText: 'Q', transcript: 'answer' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 if transcript is missing', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/sessions/${sessionId}/questions`,
      payload: { questionNumber: 1, questionText: 'Q' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('saves a question and returns { id }', async () => {
    const rubric = getRubric(1)!;
    const res = await app.inject({
      method: 'POST',
      url: `/sessions/${sessionId}/questions`,
      payload: {
        questionNumber: 1,
        questionText: rubric.questionText,
        transcript: 'Quorum means majority agreement among nodes.',
      },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ id: number }>();
    expect(typeof body.id).toBe('number');
  });
});

// ── PATCH /sessions/:sessionId/complete ───────────────────────────────────────

describe('PATCH /sessions/:sessionId/complete', () => {
  let db: sqlite3.Database;
  let app: FastifyInstance;

  beforeEach(async () => {
    db = await createTestDb();
    app = buildApp(db, undefined, { logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('returns 404 for unknown session', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: '/sessions/nonexistent-id/complete',
    });
    expect(res.statusCode).toBe(404);
  });

  it('marks session completed with passed=0 when no extractions', async () => {
    const createRes = await app.inject({ method: 'POST', url: '/sessions' });
    const { id } = createRes.json<{ id: string }>();

    const res = await app.inject({
      method: 'PATCH',
      url: `/sessions/${id}/complete`,
    });
    expect(res.statusCode).toBe(200);
    const body = res.json<{ completed_at: string }>();
    expect(typeof body.completed_at).toBe('string');

    // Verify the session now shows completed_at and passed=0
    const detailRes = await app.inject({ method: 'GET', url: `/sessions/${id}` });
    const detail = detailRes.json<{ completed_at: string | null; passed: number | null }>();
    expect(detail.completed_at).not.toBeNull();
    expect(detail.passed).toBe(0);
  });
});

// ── Deferred grading: passed/overall_score computed live after /complete ──────
//
// The real app completes a session before running extractions. These tests verify
// that GET /sessions and GET /sessions/:id derive passed and overall_score from
// live concept_extractions data rather than the stale stored columns.

describe('overall_score and passed reflect deferred grading (grading runs after /complete)', () => {
  let db: sqlite3.Database;
  let app: FastifyInstance;

  beforeEach(async () => {
    db = await createTestDb();
    app = buildApp(db, undefined, { logger: false });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  /** Create session → save Q1 → complete → extract Q1 (grading after completion). */
  async function setupDeferredSession(allDetected: boolean): Promise<string> {
    const createRes = await app.inject({ method: 'POST', url: '/sessions' });
    const { id } = createRes.json<{ id: string }>();
    const rubric = getRubric(1)!;

    await app.inject({
      method: 'POST',
      url: `/sessions/${id}/questions`,
      payload: {
        questionNumber: 1,
        questionText: rubric.questionText,
        transcript: 'Quorum means majority agreement among nodes.',
      },
    });

    // Complete BEFORE grading (simulates the real deferred-grading flow).
    await app.inject({ method: 'PATCH', url: `/sessions/${id}/complete` });

    // Rebuild app with a mocked Anthropic client, then run extraction.
    const mockConcepts = rubric.concepts.map((c) => ({
      conceptId: c.id,
      conceptName: c.name,
      detected: allDetected,
      confidence: allDetected ? 0.9 : 0.1,
      evidence: 'evidence',
    }));
    await app.close();
    app = buildApp(db, mockAnthropicWithConcepts(mockConcepts), { logger: false });
    await app.ready();

    await app.inject({ method: 'POST', url: `/sessions/${id}/questions/1/extract` });

    return id;
  }

  it('GET /sessions: shows passed=1 and overall_score=1 when all concepts detected', async () => {
    const id = await setupDeferredSession(true);

    const res = await app.inject({ method: 'GET', url: '/sessions' });
    const list = res.json<Array<{ id: string; overall_score: number; passed: number }>>();
    const session = list.find((s) => s.id === id)!;
    expect(session.overall_score).toBe(1);
    expect(session.passed).toBe(1);
  });

  it('GET /sessions: shows passed=0 and overall_score=0 when no concepts detected', async () => {
    const id = await setupDeferredSession(false);

    const res = await app.inject({ method: 'GET', url: '/sessions' });
    const list = res.json<Array<{ id: string; overall_score: number; passed: number }>>();
    const session = list.find((s) => s.id === id)!;
    expect(session.overall_score).toBe(0);
    expect(session.passed).toBe(0);
  });

  it('GET /sessions/:id: shows passed=1 and overall_score=1 when all concepts detected', async () => {
    const id = await setupDeferredSession(true);

    const res = await app.inject({ method: 'GET', url: `/sessions/${id}` });
    const detail = res.json<{ overall_score: number; passed: number }>();
    expect(detail.overall_score).toBe(1);
    expect(detail.passed).toBe(1);
  });

  it('GET /sessions/:id: shows passed=0 and overall_score=0 when no concepts detected', async () => {
    const id = await setupDeferredSession(false);

    const res = await app.inject({ method: 'GET', url: `/sessions/${id}` });
    const detail = res.json<{ overall_score: number; passed: number }>();
    expect(detail.overall_score).toBe(0);
    expect(detail.passed).toBe(0);
  });

  it('passed=0 when one question fails even if overall_score >= 0.75', async () => {
    // Q1 passes (all 8 concepts detected), Q2 fails (0 of 8 detected).
    // overall_score = 8/16 = 0.5 — but even if it were above 0.75, passed must be 0
    // because all questions must individually pass.
    const createRes = await app.inject({ method: 'POST', url: '/sessions' });
    const { id } = createRes.json<{ id: string }>();

    for (const qNum of [1, 2] as const) {
      const rubric = getRubric(qNum)!;
      await app.inject({
        method: 'POST',
        url: `/sessions/${id}/questions`,
        payload: { questionNumber: qNum, questionText: rubric.questionText, transcript: 'answer' },
      });
    }

    await app.inject({ method: 'PATCH', url: `/sessions/${id}/complete` });

    // Q1: all detected (passes). Q2: none detected (fails).
    const mockQ1 = getRubric(1)!.concepts.map((c) => ({
      conceptId: c.id, conceptName: c.name, detected: true, confidence: 0.9, evidence: 'e',
    }));
    const mockQ2 = getRubric(2)!.concepts.map((c) => ({
      conceptId: c.id, conceptName: c.name, detected: false, confidence: 0.1, evidence: 'e',
    }));

    await app.close();
    app = buildApp(db, mockAnthropicWithConcepts(mockQ1), { logger: false });
    await app.ready();
    await app.inject({ method: 'POST', url: `/sessions/${id}/questions/1/extract` });

    await app.close();
    app = buildApp(db, mockAnthropicWithConcepts(mockQ2), { logger: false });
    await app.ready();
    await app.inject({ method: 'POST', url: `/sessions/${id}/questions/2/extract` });

    const listRes = await app.inject({ method: 'GET', url: '/sessions' });
    const list = listRes.json<Array<{ id: string; passed: number }>>();
    expect(list.find((s) => s.id === id)!.passed).toBe(0);

    const detailRes = await app.inject({ method: 'GET', url: `/sessions/${id}` });
    expect(detailRes.json<{ passed: number }>().passed).toBe(0);
  });
});

// ── POST /sessions/:sessionId/questions/:questionNumber/extract ───────────────

describe('POST /sessions/:sessionId/questions/:questionNumber/extract', () => {
  let db: sqlite3.Database;
  let app: FastifyInstance;
  let sessionId: string;

  beforeEach(async () => {
    db = await createTestDb();
    app = buildApp(db, undefined, { logger: false });
    await app.ready();
    const createRes = await app.inject({ method: 'POST', url: '/sessions' });
    sessionId = createRes.json<{ id: string }>().id;
  });

  afterEach(async () => {
    await app.close();
    db.close();
  });

  it('returns 404 if question assessment does not exist yet', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/sessions/${sessionId}/questions/1/extract`,
    });
    expect(res.statusCode).toBe(404);
  });

  it('returns extraction result with concepts, score, passed using a mocked Anthropic client', async () => {
    const rubric = getRubric(1)!;

    // Save a question assessment first
    await app.inject({
      method: 'POST',
      url: `/sessions/${sessionId}/questions`,
      payload: {
        questionNumber: 1,
        questionText: rubric.questionText,
        transcript: 'Quorum means majority agreement among nodes to ensure consistency.',
      },
    });

    // Build mock concepts — all detected: true for question 1's rubric
    const mockConcepts = rubric.concepts.map((c) => ({
      conceptId: c.id,
      conceptName: c.name,
      detected: true,
      confidence: 0.9,
      evidence: 'Detected in student answer.',
    }));

    // Rebuild the app with a mocked Anthropic client
    await app.close();
    app = buildApp(db, mockAnthropicWithConcepts(mockConcepts), { logger: false });
    await app.ready();

    const res = await app.inject({
      method: 'POST',
      url: `/sessions/${sessionId}/questions/1/extract`,
    });
    expect(res.statusCode).toBe(200);

    interface ExtractionResponse {
      questionAssessmentId: number;
      concepts: Array<{ conceptId: number; detected: boolean; confidence: number }>;
      score: number;
      passed: boolean;
    }
    const body = res.json<ExtractionResponse>();
    expect(typeof body.questionAssessmentId).toBe('number');
    expect(Array.isArray(body.concepts)).toBe(true);
    expect(body.concepts).toHaveLength(rubric.concepts.length);
    expect(body.score).toBe(1);
    expect(body.passed).toBe(true);
  });
});
