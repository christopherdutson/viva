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
}

async function recordAnswer(page: Page) {
  await page.getByRole('button', { name: 'Start Recording' }).click();
  await page.waitForTimeout(100);
  await page.getByRole('button', { name: 'Stop Recording' }).click();
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

  test('shows analysis error and retry button when /extract returns 500', async ({ page }) => {
    await mockMediaAPIs(page);
    await mockSession(page);

    await page.route('**/transcribe', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ transcript: 'My answer about quorums.' }),
      });
    });

    await page.route('**/questions/1/extract', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Concept extraction failed' }),
      });
    });

    await page.goto('/exam');
    await recordAnswer(page);

    // Transcript should appear (transcription succeeded)
    await expect(page.getByText('Transcript')).toBeVisible({ timeout: 10000 });

    // Analysis error should appear independently
    await expect(page.getByText('Concept extraction failed')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Retry analysis' })).toBeVisible();

    // Next button should be enabled — transcription succeeded, extraction doesn't block navigation
    await expect(page.getByRole('button', { name: 'Next Question' })).toBeEnabled();
  });

  test('starts a fresh exam after page reload', async ({ page }) => {
    await mockMediaAPIs(page);
    await mockSession(page);

    await page.route('**/transcribe', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ transcript: 'My answer about quorums.' }),
      });
    });
    await page.route('**/questions/1/extract', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ concepts: [], score: 1.0, passed: true, questionAssessmentId: 1 }),
      });
    });

    await page.goto('/exam');

    // Record Q1 and wait for transcript to confirm state is populated
    await recordAnswer(page);
    await expect(page.getByText('Transcript')).toBeVisible({ timeout: 10000 });

    // Re-mock routes before reload so the new session POST is handled
    await page.route('**/sessions', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ id: 'test-session-2', started_at: '2026-01-01T00:00:00.000Z' }),
        });
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
      }
    });

    await page.reload({ waitUntil: 'networkidle' });

    // After reload: back to Q1, no transcript, no score
    await expect(page.getByText('Transcript')).not.toBeVisible();
    await expect(page.locator('.progress-step.active').first()).toBeVisible();
    await expect(page.getByText('Question 1 of 3')).toBeVisible();
  });
});
