import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ResultsComponent } from './results.component';

type SessionSummary = Parameters<ResultsComponent['scoreLabel']>[0];

const baseSession: SessionSummary = {
  id: 'sess-1',
  started_at: '2026-01-01T00:00:00.000Z',
  completed_at: '2026-01-01T01:00:00.000Z',
  overall_score: null,
  passed: null,
  question_count: 3,
};

describe('ResultsComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResultsComponent],
      providers: [provideRouter([])],
    }).compileComponents();

    // Prevent ngOnInit fetch from throwing in JSDOM
    globalThis.fetch = async () =>
      ({ ok: true, json: async () => [] }) as Response;
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ResultsComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  describe('scoreLabel()', () => {
    it('returns formatted percentage when overall_score is present', () => {
      const fixture = TestBed.createComponent(ResultsComponent);
      expect(
        fixture.componentInstance.scoreLabel({ ...baseSession, overall_score: 0.75 }),
      ).toBe('75%');
    });

    it('returns "—" when overall_score is null', () => {
      const fixture = TestBed.createComponent(ResultsComponent);
      expect(fixture.componentInstance.scoreLabel(baseSession)).toBe('—');
    });
  });

  describe('isPassed()', () => {
    it('returns true when passed === 1', () => {
      const fixture = TestBed.createComponent(ResultsComponent);
      expect(
        fixture.componentInstance.isPassed({ ...baseSession, passed: 1 }),
      ).toBe(true);
    });

    it('returns false when passed === 0', () => {
      const fixture = TestBed.createComponent(ResultsComponent);
      expect(
        fixture.componentInstance.isPassed({ ...baseSession, passed: 0 }),
      ).toBe(false);
    });

    it('returns false when passed is null', () => {
      const fixture = TestBed.createComponent(ResultsComponent);
      expect(fixture.componentInstance.isPassed(baseSession)).toBe(false);
    });
  });

  it('shows loading indicator initially then hides it after fetch', async () => {
    const fixture = TestBed.createComponent(ResultsComponent);
    expect(fixture.componentInstance.loading()).toBe(true);
    await fixture.componentInstance.ngOnInit();
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it('sets error signal when fetch fails', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 500 }) as Response;
    const fixture = TestBed.createComponent(ResultsComponent);
    await fixture.componentInstance.ngOnInit();
    expect(fixture.componentInstance.error()).toContain('500');
  });
});
