import { Component, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AudioRecorderComponent } from '../components/audio-recorder.component';

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

@Component({
  standalone: true,
  selector: 'app-exam',
  imports: [RouterLink, AudioRecorderComponent],
  templateUrl: './exam.component.html',
  styleUrl: './exam.component.css',
})
export class ExamComponent {
  readonly questions = QUESTIONS;
  readonly total = QUESTIONS.length;

  private readonly currentIndexSignal = signal(0);
  private readonly examCompleted = signal(false);
  readonly recordings = signal<(Blob | null)[]>([null, null, null]);

  readonly currentQuestion = computed(() => QUESTIONS[this.currentIndexSignal()]);

  currentIndex(): number {
    return this.currentIndexSignal();
  }

  completed(): boolean {
    return this.examCompleted();
  }

  isLast(): boolean {
    return this.currentIndex() === this.total - 1;
  }

  onRecordingReady(index: number, blob: Blob | null): void {
    this.recordings.update((recs) => {
      const updated = [...recs] as (Blob | null)[];
      updated[index] = blob;
      return updated;
    });
  }

  next(): void {
    if (this.recordings()[this.currentIndex()] === null) return;
    if (this.isLast()) {
      this.examCompleted.set(true);
      return;
    }
    this.currentIndexSignal.update((i) => i + 1);
  }

  prev(): void {
    this.currentIndexSignal.update((i) => Math.max(i - 1, 0));
  }
}
