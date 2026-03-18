import { test, expect, Page } from '@playwright/test';

const SESSION_ID = 'test-session-123';

// Q1 rubric concept names (8 concepts)
const Q1_CONCEPT_NAMES = [
  'Quorum definition',
  'Majority quorum',
  'Read/write quorum overlap',
  'Node failure handling',
  'Fencing tokens',
  'Split-brain prevention',
  'Epoch numbers',
  'Lock expiry problem',
];

// Q2 rubric concept names (8 concepts)
const Q2_CONCEPT_NAMES = [
  'Crash fault definition',
  'Byzantine fault definition',
  'Arbitrary behaviour',
  'Trust assumptions',
  'BFT cost',
  'Practical systems rationale',
  'Blockchain example',
  'Crash fault tolerance sufficiency',
];

// Q3 rubric concept names (12 concepts)
const Q3_CONCEPT_NAMES = [
  'Synchronous model',
  'Partially synchronous model',
  'Asynchronous model',
  'Timing assumption tradeoffs',
  'Safety definition',
  'Liveness definition',
  'Safety vs liveness distinction',
  'Safety example',
  'Liveness example',
  'FLP impossibility relevance',
  'Consensus impossibility in async',
  'Real system design implication',
];

function buildConcepts(names: string[], questionAssessmentId: number) {
  return {
    concepts: names.map((conceptName, i) => ({
      conceptId: i + 1,
      conceptName,
      detected: true,
      confidence: 0.9,
      evidence: 'Student mentioned this.',
    })),
    score: 1.0,
    passed: true,
    questionAssessmentId,
  };
}

const Q1_EXTRACTION = buildConcepts(Q1_CONCEPT_NAMES, 1);
const Q2_EXTRACTION = buildConcepts(Q2_CONCEPT_NAMES, 2);
const Q3_EXTRACTION = buildConcepts(Q3_CONCEPT_NAMES, 3);

const SESSION_DETAIL = {
  id: SESSION_ID,
  started_at: '2026-01-01T00:00:00.000Z',
  completed_at: '2026-01-01T01:00:00.000Z',
  overall_score: 1.0,
  passed: 1,
  questions: [
    {
      id: 1,
      question_number: 1,
      question_text: 'Explain how distributed systems use quorum-based decisions...',
      transcript: 'I talked about quorums and fencing tokens.',
      score: 1.0,
      passed: 1,
      concepts: [],
    },
    {
      id: 2,
      question_number: 2,
      question_text: 'Compare Byzantine faults...',
      transcript: 'Byzantine faults involve arbitrary behavior...',
      score: 1.0,
      passed: 1,
      concepts: [],
    },
    {
      id: 3,
      question_number: 3,
      question_text: 'Describe the main system models...',
      transcript: 'There are synchronous and asynchronous models...',
      score: 1.0,
      passed: 1,
      concepts: [],
    },
  ],
};

async function mockRoutes(page: Page) {
  // POST /sessions — create session
  await page.route('**/sessions', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: SESSION_ID, started_at: '2026-01-01T00:00:00.000Z' }),
      });
    } else {
      // GET /sessions — results list
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }
  });

  // POST /sessions/:id/questions — save question (returns id: 1 for all)
  await page.route(`**/${SESSION_ID}/questions`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ id: 1 }),
    });
  });

  // POST /transcribe
  await page.route('**/transcribe', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        transcript: 'I explained quorums and fencing tokens in distributed systems.',
      }),
    });
  });

  // POST /sessions/:id/questions/1/extract
  await page.route(`**/${SESSION_ID}/questions/1/extract`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(Q1_EXTRACTION),
    });
  });

  // POST /sessions/:id/questions/2/extract
  await page.route(`**/${SESSION_ID}/questions/2/extract`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(Q2_EXTRACTION),
    });
  });

  // POST /sessions/:id/questions/3/extract
  await page.route(`**/${SESSION_ID}/questions/3/extract`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(Q3_EXTRACTION),
    });
  });

  // PATCH /sessions/:id/complete
  await page.route(`**/${SESSION_ID}/complete`, async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ completed_at: '2026-01-01T01:00:00.000Z' }),
    });
  });

  // GET /sessions/:id — session detail
  await page.route(`**/${SESSION_ID}`, async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SESSION_DETAIL),
      });
    } else {
      await route.continue();
    }
  });
}

async function mockMediaAPIs(page: Page) {
  await page.addInitScript(() => {
    // Replace getUserMedia with a fake that returns an empty MediaStream
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: {
        getUserMedia: async (_constraints: MediaStreamConstraints) => {
          return new MediaStream();
        },
      },
    });

    // Replace MediaRecorder with a minimal stub
    class FakeMediaRecorder extends EventTarget {
      static isTypeSupported(type: string): boolean {
        return type === 'audio/webm;codecs=opus';
      }

      mimeType = 'audio/webm;codecs=opus';
      state: RecordingState = 'inactive';
      ondataavailable: ((event: BlobEvent) => void) | null = null;
      onstop: ((event: Event) => void) | null = null;
      onerror: ((event: Event) => void) | null = null;

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      constructor(_stream: MediaStream, _options?: MediaRecorderOptions) {
        super();
      }

      start(_timeslice?: number): void {
        this.state = 'recording';
      }

      stop(): void {
        this.state = 'inactive';
        // Fire ondataavailable with a tiny audio blob
        const blob = new Blob([new Uint8Array([0, 1, 2, 3])], { type: 'audio/webm' });
        const dataEvent = new Event('dataavailable') as BlobEvent;
        Object.defineProperty(dataEvent, 'data', { value: blob });
        if (this.ondataavailable) {
          this.ondataavailable(dataEvent);
        }
        // Fire onstop
        const stopEvent = new Event('stop');
        if (this.onstop) {
          this.onstop(stopEvent);
        }
      }

      pause(): void {
        this.state = 'paused';
      }

      resume(): void {
        this.state = 'recording';
      }

      requestData(): void {}
    }

    // Override the global MediaRecorder
    (window as unknown as Record<string, unknown>)['MediaRecorder'] = FakeMediaRecorder;
  });
}

async function recordAnswer(page: Page) {
  await page.getByRole('button', { name: 'Start Recording' }).click();
  // Short delay so recording state renders
  await page.waitForTimeout(100);
  await page.getByRole('button', { name: 'Stop Recording' }).click();
}

test.describe('Happy path — full exam flow', () => {
  test.beforeEach(async ({ page }) => {
    await mockRoutes(page);
    await mockMediaAPIs(page);
  });

  test('completes all three questions and shows results', async ({ page }) => {
    await page.goto('/exam');

    // Question 1 — only wait for transcript (no per-question score any more)
    await recordAnswer(page);
    await expect(page.getByText('Transcript')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Next Question' }).click();

    // Question 2
    await recordAnswer(page);
    await expect(page.getByText('Transcript')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Next Question' }).click();

    // Question 3 — clicking Finish triggers grading
    await recordAnswer(page);
    await expect(page.getByText('Transcript')).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Finish' }).click();

    // Grading screen appears then resolves to completion
    await expect(page.getByText('Grading your exam…')).toBeVisible({ timeout: 5000 });
    await expect(
      page.getByText('All questions answered and submitted.'),
    ).toBeVisible({ timeout: 15000 });

    // Navigate to results
    await page.getByRole('button', { name: 'View Results' }).click();

    // Results page should show overall score
    await expect(page.locator('.overall-score')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('.overall-score')).toContainText('100%');
    await expect(page.locator('.badge.passed').first()).toBeVisible();
  });
});
