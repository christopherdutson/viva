import { Component, OnInit, computed, inject, signal, viewChildren } from '@angular/core';
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
  private readonly recorders = viewChildren(AudioRecorderComponent);

  readonly questions = QUESTIONS;
  readonly total = QUESTIONS.length;

  private readonly currentIndexSignal = signal(0);
  private readonly examCompleted = signal(false);
  readonly completing = signal(false);
  readonly sessionId = signal<string | null>(null);

  readonly questionStates = signal<QuestionState[]>(
    QUESTIONS.map(() => emptyState()),
  );

  private readonly generations = QUESTIONS.map(() => 0);

  readonly currentQuestion = computed(() => QUESTIONS[this.currentIndexSignal()]);

  async ngOnInit(): Promise<void> {
    try {
      this.sessionId.set(await this.sessionService.createSession());
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
    return s.blob !== null && !s.transcribing && s.transcript !== null;
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
      await this.persistQuestion(index, transcript);
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
  }
}
