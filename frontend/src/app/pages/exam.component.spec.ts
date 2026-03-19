import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ExamComponent } from './exam.component';
import { SessionService } from '../services/session.service';
import { TranscriptionService } from '../services/transcription.service';
import { ExtractionService } from '../services/extraction.service';

const sessionServiceStub = {
  createSession: async () => 'sess-test',
  saveQuestion: async () => ({}),
  completeSession: async () => ({}),
};
const transcriptionServiceStub = { transcribe: async () => 'transcript text' };
const extractionServiceStub = {
  extract: async () => ({ concepts: [], score: 1.0, passed: true, questionAssessmentId: 1 }),
};

describe('ExamComponent', () => {
  beforeEach(async () => {
    sessionStorage.clear();

    // Stub MediaRecorder so the template renders without errors
    (globalThis as unknown as Record<string, unknown>)['MediaRecorder'] = class {
      static isTypeSupported() { return false; }
    };
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: { getUserMedia: async () => ({ getTracks: () => [] }) },
    });

    await TestBed.configureTestingModule({
      imports: [ExamComponent],
      providers: [
        provideRouter([]),
        { provide: SessionService, useValue: sessionServiceStub },
        { provide: TranscriptionService, useValue: transcriptionServiceStub },
        { provide: ExtractionService, useValue: extractionServiceStub },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(ExamComponent);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('starts on question 1', () => {
    const fixture = TestBed.createComponent(ExamComponent);
    expect(fixture.componentInstance.currentIndex()).toBe(0);
  });

  describe('isReadyToAdvance()', () => {
    it('returns false with no transcript', () => {
      const fixture = TestBed.createComponent(ExamComponent);
      expect(fixture.componentInstance.isReadyToAdvance()).toBe(false);
    });

    it('returns false while transcribing', () => {
      const fixture = TestBed.createComponent(ExamComponent);
      fixture.componentInstance.questionStates.update((s) =>
        s.map((q, i) => (i === 0 ? { ...q, transcript: 'text', transcribing: true } : q)),
      );
      expect(fixture.componentInstance.isReadyToAdvance()).toBe(false);
    });

    it('returns true with a transcript and not transcribing', () => {
      const fixture = TestBed.createComponent(ExamComponent);
      fixture.componentInstance.questionStates.update((s) =>
        s.map((q, i) => (i === 0 ? { ...q, transcript: 'text', transcribing: false } : q)),
      );
      expect(fixture.componentInstance.isReadyToAdvance()).toBe(true);
    });
  });

  describe('isLast()', () => {
    it('returns false on question 1', () => {
      const fixture = TestBed.createComponent(ExamComponent);
      expect(fixture.componentInstance.isLast()).toBe(false);
    });

    it('returns true on the last question', () => {
      const fixture = TestBed.createComponent(ExamComponent);
      fixture.componentInstance.goTo(2);
      expect(fixture.componentInstance.isLast()).toBe(true);
    });
  });

  describe('goTo() and prev()', () => {
    it('goTo() sets the current question index', () => {
      const fixture = TestBed.createComponent(ExamComponent);
      fixture.componentInstance.goTo(2);
      expect(fixture.componentInstance.currentIndex()).toBe(2);
    });

    it('prev() decrements the index', () => {
      const fixture = TestBed.createComponent(ExamComponent);
      fixture.componentInstance.goTo(1);
      fixture.componentInstance.prev();
      expect(fixture.componentInstance.currentIndex()).toBe(0);
    });

    it('prev() does not go below 0', () => {
      const fixture = TestBed.createComponent(ExamComponent);
      fixture.componentInstance.prev();
      expect(fixture.componentInstance.currentIndex()).toBe(0);
    });
  });

  describe('hasGradingErrors() and isGradingPending()', () => {
    it('hasGradingErrors() is false with clean state', () => {
      const fixture = TestBed.createComponent(ExamComponent);
      expect(fixture.componentInstance.hasGradingErrors()).toBe(false);
    });

    it('hasGradingErrors() is true when any question has an extraction error', () => {
      const fixture = TestBed.createComponent(ExamComponent);
      fixture.componentInstance.questionStates.update((s) =>
        s.map((q, i) => (i === 1 ? { ...q, extractionError: 'Extraction failed' } : q)),
      );
      expect(fixture.componentInstance.hasGradingErrors()).toBe(true);
    });

    it('isGradingPending() is true when any question is extracting', () => {
      const fixture = TestBed.createComponent(ExamComponent);
      fixture.componentInstance.questionStates.update((s) =>
        s.map((q, i) => (i === 0 ? { ...q, extracting: true } : q)),
      );
      expect(fixture.componentInstance.isGradingPending()).toBe(true);
    });
  });

  it('exitExam() clears sessionStorage and navigates to /', async () => {
    const fixture = TestBed.createComponent(ExamComponent);
    sessionStorage.setItem('viva_exam', JSON.stringify({ sessionId: 'x', grading: false, states: [] }));

    const router = TestBed.inject(Router);
    const navSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    fixture.componentInstance.exitExam();

    expect(sessionStorage.getItem('viva_exam')).toBeNull();
    expect(navSpy).toHaveBeenCalledWith(['/']);
  });
});
