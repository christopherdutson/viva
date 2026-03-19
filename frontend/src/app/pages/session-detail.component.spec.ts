import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { SessionDetailComponent } from './session-detail.component';

function makeRoute(id: string | null) {
  return {
    snapshot: { paramMap: convertToParamMap(id ? { id } : {}) },
  };
}

describe('SessionDetailComponent', () => {
  async function setup(id: string | null = 'sess-1') {
    await TestBed.configureTestingModule({
      imports: [SessionDetailComponent],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: makeRoute(id) },
      ],
    }).compileComponents();

    globalThis.fetch = async () =>
      ({
        ok: true,
        json: async () => ({
          id: 'sess-1',
          started_at: '2026-01-01T00:00:00.000Z',
          completed_at: '2026-01-01T01:00:00.000Z',
          overall_score: 0.5,
          passed: 1,
          questions: [],
        }),
      }) as Response;

    return TestBed.createComponent(SessionDetailComponent);
  }

  it('should create', async () => {
    const fixture = await setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  describe('scorePercent()', () => {
    it('returns "—" for null score', async () => {
      const fixture = await setup();
      expect(fixture.componentInstance.scorePercent(null)).toBe('—');
    });

    it('formats a decimal score as a percentage', async () => {
      const fixture = await setup();
      expect(fixture.componentInstance.scorePercent(0.75)).toBe('75%');
    });

    it('rounds to the nearest integer', async () => {
      const fixture = await setup();
      expect(fixture.componentInstance.scorePercent(0.333)).toBe('33%');
    });
  });

  describe('isPassed()', () => {
    it('returns true when passed === 1', async () => {
      const fixture = await setup();
      expect(fixture.componentInstance.isPassed(1)).toBe(true);
    });

    it('returns false when passed === 0', async () => {
      const fixture = await setup();
      expect(fixture.componentInstance.isPassed(0)).toBe(false);
    });

    it('returns false when passed is null', async () => {
      const fixture = await setup();
      expect(fixture.componentInstance.isPassed(null)).toBe(false);
    });
  });

  describe('confidencePercent()', () => {
    it('formats confidence as a percentage', async () => {
      const fixture = await setup();
      expect(fixture.componentInstance.confidencePercent(0.9)).toBe('90%');
    });
  });

  it('sets error and stops loading when no session ID is in the route', async () => {
    const fixture = await setup(null);
    await fixture.componentInstance.ngOnInit();
    expect(fixture.componentInstance.error()).toBe('No session ID provided');
    expect(fixture.componentInstance.loading()).toBe(false);
  });

  it('populates session signal after successful fetch', async () => {
    const fixture = await setup();
    await fixture.componentInstance.ngOnInit();
    expect(fixture.componentInstance.session()?.id).toBe('sess-1');
    expect(fixture.componentInstance.loading()).toBe(false);
  });
});
