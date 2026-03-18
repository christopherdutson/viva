import { Component, OnInit, OnDestroy, computed, inject, signal, viewChildren } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { AudioRecorderComponent } from '../components/audio-recorder.component';
import { TranscriptionService } from '../services/transcription.service';
import { SessionService } from '../services/session.service';
import { ExtractionService, type ConceptExtraction } from '../services/extraction.service';

const QUESTIONS = [
  {
    number: 1,
    prompt:
      'Explain how distributed systems use quorum-based decisions to handle node failures, and describe the role of fencing tokens in preventing split-brain scenarios.',
  },
  {
    number: 2,
    prompt:
      'Compare Byzantine faults with crash faults in distributed systems. Under what conditions might a system need Byzantine fault tolerance, and why do most practical systems only handle crash faults?',
  },
  {
    number: 3,
    prompt:
      'Describe the main system models for timing assumptions in distributed systems. Then explain the difference between safety and liveness properties, and give an example of each in the context of a distributed database.',
  },
];

interface QuestionState {
  blob: Blob | null;
  transcript: string | null;
  transcribing: boolean;
  transcriptionError: string | null;
  extracting: boolean;
  extractionError: string | null;
  concepts: ConceptExtraction[] | null;
  score: number | null;
  passed: boolean | null;
}

// What we persist to sessionStorage (no blob — not serialisable)
interface PersistedState {
  sessionId: string;
  states: Array<{
    transcript: string | null;
    transcriptionError: string | null;
    extractionError: string | null;
    concepts: ConceptExtraction[] | null;
    score: number | null;
    passed: boolean | null;
  }>;
}

const STORAGE_KEY = 'viva_exam';

const emptyState = (): QuestionState => ({
  blob: null,
  transcript: null,
  transcribing: false,
  transcriptionError: null,
  extracting: false,
  extractionError: null,
  concepts: null,
  score: null,
  passed: null,
});

@Component({
  standalone: true,
  selector: 'app-exam',
  imports: [RouterLink, AudioRecorderComponent],
  templateUrl: './exam.component.html',
  styleUrl: './exam.component.css',
})
export class ExamComponent implements OnInit, OnDestroy {
  private readonly transcriptionService = inject(TranscriptionService);
  private readonly sessionService = inject(SessionService);
  private readonly extractionService = inject(ExtractionService);
  private readonly router = inject(Router);
  private readonly recorders = viewChildren(AudioRecorderComponent);

  readonly questions = QUESTIONS;
  readonly total = QUESTIONS.length;

  private readonly currentIndexSignal = signal(0);
  private readonly examCompleted = signal(false);
  readonly completing = signal(false);
  readonly sessionId = signal<string | null>(null);
  readonly sessionWarning = signal<string | null>(null);

  readonly questionStates = signal<QuestionState[]>(
    QUESTIONS.map(() => emptyState()),
  );

  private readonly generations = QUESTIONS.map(() => 0);
  private readonly unloadHandler = (e: BeforeUnloadEvent) => {
    if (!this.examCompleted() && this.questionStates().some((s) => s.transcript !== null)) {
      e.preventDefault();
    }
  };

  readonly currentQuestion = computed(() => QUESTIONS[this.currentIndexSignal()]);

  async ngOnInit(): Promise<void> {
    window.addEventListener('beforeunload', this.unloadHandler);

    if (this.restoreFromStorage()) return;

    try {
      const id = await this.sessionService.createSession();
      this.sessionId.set(id);
      this.saveToStorage();
    } catch {
      this.sessionWarning.set('Could not connect to the server — your answers will not be saved.');
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener('beforeunload', this.unloadHandler);
  }

  currentIndex(): number {
    return this.currentIndexSignal();
  }

  currentState(): QuestionState {
    return this.questionStates()[this.currentIndexSignal()] ?? emptyState();
  }

  completed(): boolean {
    return this.examCompleted();
  }

  isLast(): boolean {
    return this.currentIndex() === this.total - 1;
  }

  isReadyToAdvance(): boolean {
    const s = this.currentState();
    // blob check dropped — a restored transcript (blob=null) is sufficient to advance
    return s.transcript !== null && !s.transcribing;
  }

  hasTranscriptionState(): boolean {
    const s = this.currentState();
    return s.blob !== null || s.transcript !== null || s.transcribing || s.transcriptionError !== null;
  }

  exitExam(): void {
    void this.router.navigate(['/']);
  }

  goTo(index: number): void {
    this.pauseCurrentAudio();
    this.currentIndexSignal.set(index);
  }

  onRecordingReady(index: number, blob: Blob | null): void {
    this.generations[index]++;
    this.patchState(index, { ...emptyState(), blob });
    if (blob) {
      void this.transcribe(index, blob, this.generations[index]);
    }
  }

  retryTranscription(): void {
    const idx = this.currentIndex();
    const s = this.currentState();
    if (s.blob) {
      void this.transcribe(idx, s.blob, this.generations[idx]);
    }
  }

  retryExtraction(): void {
    const idx = this.currentIndex();
    const s = this.currentState();
    if (s.transcript && this.sessionId()) {
      this.patchState(idx, { extractionError: null });
      void this.extract(idx, this.generations[idx]);
    }
  }

  async next(): Promise<void> {
    if (!this.isReadyToAdvance() || this.completing()) return;
    if (this.isLast()) {
      this.completing.set(true);
      try {
        const id = this.sessionId();
        if (id) {
          await this.sessionService.completeSession(id);
        }
      } catch {
        // Non-fatal — still show completion screen
      } finally {
        this.completing.set(false);
      }
      this.examCompleted.set(true);
      this.clearStorage();
      return;
    }
    this.pauseCurrentAudio();
    this.currentIndexSignal.update((i) => i + 1);
  }

  prev(): void {
    this.pauseCurrentAudio();
    this.currentIndexSignal.update((i) => Math.max(i - 1, 0));
  }

  private pauseCurrentAudio(): void {
    this.recorders()[this.currentIndexSignal()]?.pauseAudio();
  }

  private async transcribe(index: number, blob: Blob, gen: number): Promise<void> {
    this.patchState(index, { transcribing: true, transcriptionError: null });
    try {
      const transcript = await this.transcriptionService.transcribe(blob);
      if (this.generations[index] !== gen) return;
      this.patchState(index, { transcript, transcribing: false });
      try {
        await this.persistQuestion(index, transcript);
      } catch {
        // Non-fatal — extraction will surface its own 404 error if save failed
      }
      void this.extract(index, gen);
    } catch (err) {
      if (this.generations[index] !== gen) return;
      this.patchState(index, {
        transcribing: false,
        transcriptionError: err instanceof Error ? err.message : 'Transcription failed',
      });
    }
  }

  private async persistQuestion(index: number, transcript: string): Promise<void> {
    const id = this.sessionId();
    if (!id) return;
    const question = QUESTIONS[index];
    if (!question) return;
    await this.sessionService.saveQuestion(id, {
      questionNumber: question.number,
      questionText: question.prompt,
      transcript,
    });
  }

  private async extract(index: number, gen: number): Promise<void> {
    const id = this.sessionId();
    if (!id) return;
    const question = QUESTIONS[index];
    if (!question) return;

    this.patchState(index, { extracting: true, extractionError: null });
    try {
      const result = await this.extractionService.extract(id, question.number);
      if (this.generations[index] !== gen) return;
      this.patchState(index, {
        extracting: false,
        concepts: result.concepts,
        score: result.score,
        passed: result.passed,
      });
    } catch (err) {
      if (this.generations[index] !== gen) return;
      this.patchState(index, {
        extracting: false,
        extractionError: err instanceof Error ? err.message : 'Extraction failed',
      });
    }
  }

  private patchState(index: number, patch: Partial<QuestionState>): void {
    this.questionStates.update((states) =>
      states.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
    this.saveToStorage();
  }

  // ── sessionStorage persistence ──────────────────────────────────────────────

  private saveToStorage(): void {
    const id = this.sessionId();
    if (!id) return;
    const data: PersistedState = {
      sessionId: id,
      states: this.questionStates().map((s) => ({
        transcript: s.transcript,
        transcriptionError: s.transcriptionError,
        extractionError: s.extractionError,
        concepts: s.concepts,
        score: s.score,
        passed: s.passed,
      })),
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // sessionStorage unavailable — silently skip
    }
  }

  private restoreFromStorage(): boolean {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const data = JSON.parse(raw) as PersistedState;
      if (!data.sessionId || !Array.isArray(data.states)) return false;

      this.sessionId.set(data.sessionId);
      this.questionStates.set(
        QUESTIONS.map((_, i) => {
          const saved = data.states[i];
          if (!saved) return emptyState();
          return { ...emptyState(), ...saved };
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  private clearStorage(): void {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
