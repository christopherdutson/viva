import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
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
export class ExamComponent implements OnInit {
  private readonly transcriptionService = inject(TranscriptionService);
  private readonly sessionService = inject(SessionService);
  private readonly extractionService = inject(ExtractionService);

  readonly questions = QUESTIONS;
  readonly total = QUESTIONS.length;

  private readonly currentIndexSignal = signal(0);
  private readonly examCompleted = signal(false);
  readonly completing = signal(false);
  private sessionId: string | null = null;

  readonly questionStates = signal<QuestionState[]>(
    QUESTIONS.map(() => emptyState()),
  );

  readonly currentQuestion = computed(() => QUESTIONS[this.currentIndexSignal()]);

  async ngOnInit(): Promise<void> {
    try {
      this.sessionId = await this.sessionService.createSession();
    } catch {
      // Persist failure is non-fatal — exam continues without saving
    }
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
    // Unblock Next/Finish as soon as transcription is done.
    // Extraction runs in the background and does not block navigation.
    return s.blob !== null && !s.transcribing && s.transcript !== null;
  }

  onRecordingReady(index: number, blob: Blob | null): void {
    this.patchState(index, { ...emptyState(), blob });
    if (blob) {
      void this.transcribe(index, blob);
    }
  }

  retryTranscription(): void {
    const s = this.currentState();
    if (s.blob) {
      void this.transcribe(this.currentIndex(), s.blob);
    }
  }

  retryExtraction(): void {
    const idx = this.currentIndex();
    const s = this.currentState();
    if (s.transcript && this.sessionId) {
      this.patchState(idx, { extractionError: null });
      void this.extract(idx);
    }
  }

  async next(): Promise<void> {
    if (!this.isReadyToAdvance() || this.completing()) return;
    if (this.isLast()) {
      this.completing.set(true);
      try {
        if (this.sessionId) {
          await this.sessionService.completeSession(this.sessionId);
        }
      } catch {
        // Non-fatal — still show completion screen
      } finally {
        this.completing.set(false);
      }
      this.examCompleted.set(true);
      return;
    }
    this.currentIndexSignal.update((i) => i + 1);
  }

  prev(): void {
    this.currentIndexSignal.update((i) => Math.max(i - 1, 0));
  }

  private async transcribe(index: number, blob: Blob): Promise<void> {
    this.patchState(index, { transcribing: true, transcriptionError: null });
    try {
      const transcript = await this.transcriptionService.transcribe(blob);
      this.patchState(index, { transcript, transcribing: false });
      await this.persistQuestion(index, transcript);
      void this.extract(index);
    } catch (err) {
      this.patchState(index, {
        transcribing: false,
        transcriptionError: err instanceof Error ? err.message : 'Transcription failed',
      });
    }
  }

  private async persistQuestion(index: number, transcript: string): Promise<void> {
    if (!this.sessionId) return;
    const question = QUESTIONS[index];
    if (!question) return;
    await this.sessionService.saveQuestion(this.sessionId, {
      questionNumber: question.number,
      questionText: question.prompt,
      transcript,
    });
  }

  private async extract(index: number): Promise<void> {
    if (!this.sessionId) return;
    const question = QUESTIONS[index];
    if (!question) return;

    this.patchState(index, { extracting: true, extractionError: null });
    try {
      const result = await this.extractionService.extract(this.sessionId, question.number);
      this.patchState(index, {
        extracting: false,
        concepts: result.concepts,
        score: result.score,
        passed: result.passed,
      });
    } catch (err) {
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
  }
}
