import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AudioRecorderComponent } from '../components/audio-recorder.component';
import { TranscriptionService } from '../services/transcription.service';
import { SessionService } from '../services/session.service';

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
}

const emptyState = (): QuestionState => ({
  blob: null,
  transcript: null,
  transcribing: false,
  transcriptionError: null,
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

  readonly questions = QUESTIONS;
  readonly total = QUESTIONS.length;

  private readonly currentIndexSignal = signal(0);
  private readonly examCompleted = signal(false);
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

  next(): void {
    if (!this.isReadyToAdvance()) return;
    if (this.isLast()) {
      this.examCompleted.set(true);
      if (this.sessionId) {
        void this.sessionService.completeSession(this.sessionId);
      }
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
      this.persistQuestion(index, transcript);
    } catch (err) {
      this.patchState(index, {
        transcribing: false,
        transcriptionError: err instanceof Error ? err.message : 'Transcription failed',
      });
    }
  }

  private persistQuestion(index: number, transcript: string): void {
    if (!this.sessionId) return;
    const question = QUESTIONS[index];
    if (!question) return;
    void this.sessionService.saveQuestion(this.sessionId, {
      questionNumber: question.number,
      questionText: question.prompt,
      transcript,
    });
  }

  private patchState(index: number, patch: Partial<QuestionState>): void {
    this.questionStates.update((states) =>
      states.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
  }
}
