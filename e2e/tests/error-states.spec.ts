import { test, expect, Page } from '@playwright/test';

// ── Shared helpers ────────────────────────────────────────────────────────────

async function mockMediaAPIs(page: Page) {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: {
        getUserMedia: async () => new MediaStream(),
      },
    });

    class FakeMediaRecorder {
      static isTypeSupported(type: string) {
        return type === 'audio/webm;codecs=opus';
      }
      mimeType = 'audio/webm;codecs=opus';
      state: RecordingState = 'inactive';
      ondataavailable: ((e: { data: Blob }) => void) | null = null;
      onstop: (() => void) | null = null;

      start() { this.state = 'recording'; }
      stop() {
        this.state = 'inactive';
        const blob = new Blob([new Uint8Array(4)], { type: 'audio/webm' });
        this.ondataavailable?.({ data: blob });
        this.onstop?.();
      }
    }
    (window as unknown as { MediaRecorder: unknown }).MediaRecorder = FakeMediaRecorder;
  });
}

async function mockSession(page: Page) {
  await page.route('**/sessions', async (route) => {
    if (route.request().method() === 'POST') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'test-session', started_at: '2026-01-01T00:00:00.000Z' }),
      });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    }
  });
  await page.route('**/test-session/questions', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 1 }) });
  });
  await page.route('**/test-session/complete', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ completed_at: '2026-01-01T01:00:00.000Z' }) });
  });
}

async function mockTranscription(page: Page) {
  await page.route('**/transcribe', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ transcript: 'My answer about quorums.' }),
    });
  });
}

async function recordAnswer(page: Page) {
  await page.getByRole('button', { name: 'Start Recording' }).click();
  await page.waitForTimeout(100);
  await page.getByRole('button', { name: 'Stop Recording' }).click();
}

async function completeExam(page: Page) {
  // Record Q1
  await recordAnswer(page);
  await expect(page.getByText('Transcript')).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Next Question' }).click();

  // Record Q2
  await recordAnswer(page);
  await expect(page.getByText('Transcript')).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Next Question' }).click();

  // Record Q3
  await recordAnswer(page);
  await expect(page.getByText('Transcript')).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Finish' }).click();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Error states', () => {
  test('shows warning banner when session creation fails', async ({ page }) => {
    await mockMediaAPIs(page);

    // Make POST /sessions fail
    await page.route('**/sessions', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"Server error"}' });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      }
    });

    await page.goto('/exam');

    await expect(page.locator('.session-warning')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.session-warning')).toContainText('will not be saved');
  });

  test('shows transcription error and retry button when /transcribe returns 500', async ({ page }) => {
    await mockMediaAPIs(page);
    await mockSession(page);

    await page.route('**/transcribe', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Transcription service unavailable' }),
      });
    });

    await page.goto('/exam');
    await recordAnswer(page);

    // Error message and retry button should appear
    await expect(page.getByText('Transcription service unavailable')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();

    // Next button should be disabled while in error state
    await expect(page.getByRole('button', { name: 'Next Question' })).toBeDisabled();
  });

  test('shows grading error and retry button when /extract returns 500', async ({ page }) => {
    await mockMediaAPIs(page);
    await mockSession(page);
    await mockTranscription(page);

    // Q1 fails with a delay so the grading screen is visible; Q2 and Q3 succeed
    await page.route('**/questions/1/extract', async (route) => {
      await new Promise((r) => setTimeout(r, 300));
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Concept extraction failed' }),
      });
    });
    await page.route('**/questions/2/extract', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ concepts: [], score: 1.0, passed: true, questionAssessmentId: 2 }),
      });
    });
    await page.route('**/questions/3/extract', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ concepts: [], score: 1.0, passed: true, questionAssessmentId: 3 }),
      });
    });

    await page.goto('/exam');
    await completeExam(page);

    // Grading screen appears while Q1 is still pending
    await expect(page.getByText('Grading your exam…')).toBeVisible({ timeout: 5000 });

    // After Q1 fails: grading incomplete state with error details
    await expect(page.getByText('Grading incomplete')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Failed')).toBeVisible();
    await expect(page.getByText('Graded').first()).toBeVisible();

    // Retry button appears
    await expect(page.getByRole('button', { name: 'Retry Grading' })).toBeVisible();
  });

  test('restores transcript after page reload', async ({ page }) => {
    await mockMediaAPIs(page);
    await mockSession(page);
    await mockTranscription(page);
    await page.route('**/questions/1/extract', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ concepts: [], score: 1.0, passed: true, questionAssessmentId: 1 }),
      });
    });

    await page.goto('/exam');

    // Record Q1 and wait for transcript
    await recordAnswer(page);
    await expect(page.getByText('Transcript')).toBeVisible({ timeout: 10000 });

    // Reload — sessionStorage should restore transcript without re-recording
    await page.reload({ waitUntil: 'networkidle' });

    await expect(page.getByText('Question 1 of 3')).toBeVisible();
    await expect(page.getByText('Transcript')).toBeVisible();
    await expect(page.getByText('My answer about quorums.')).toBeVisible();

    // Next Question should be enabled — transcript is sufficient to advance
    await expect(page.getByRole('button', { name: 'Next Question' })).toBeEnabled();
  });

  test('exit exam clears saved state so the next visit starts fresh', async ({ page }) => {
    await mockMediaAPIs(page);
    await mockSession(page);
    await mockTranscription(page);

    await page.goto('/exam');

    // Record Q1 so sessionStorage is populated
    await recordAnswer(page);
    await expect(page.getByText('Transcript')).toBeVisible({ timeout: 10000 });

    // Exit — should clear sessionStorage and navigate home
    await page.getByRole('button', { name: 'Exit Exam' }).click();
    await expect(page).toHaveURL('/');

    // Re-enter the exam; no saved state should be restored
    await page.goto('/exam');
    await expect(page.getByText('Question 1 of 3')).toBeVisible();
    await expect(page.getByText('Transcript')).not.toBeVisible();
  });
});
