import { Component, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

const QUESTIONS = [
  {
    prompt:
      "Explain how distributed systems use quorum-based decisions to handle node failures, and describe the role of fencing tokens in preventing split-brain scenarios.",
  },
  {
    prompt:
      "Compare Byzantine faults with crash faults in distributed systems. Under what conditions might a system need Byzantine fault tolerance, and why do most practical systems only handle crash faults?",
  },
  {
    prompt:
      "Describe the main system models for timing assumptions in distributed systems. Then explain the difference between safety and liveness properties, and give an example of each in the context of a distributed database.",
  },
];

@Component({
  standalone: true,
  selector: 'app-exam',
  imports: [CommonModule, RouterLink],
  template: `
    <div class="card">
      <h2>Exam</h2>
      <p>
        Question {{ currentIndex() + 1 }} of {{ total }}
      </p>

      <div style="margin-top: 1rem;">
        <strong>Prompt</strong>
        <p>{{ currentQuestion().prompt }}</p>
      </div>

      <div style="margin-top: 1.5rem;">
        <p class="muted">
          (Audio recording and transcription will be added in the next iteration.)
        </p>
      </div>

      <div class="button-group">
        <button class="secondary" (click)="prev()" [disabled]="currentIndex() === 0">
          Previous
        </button>
        <button class="primary" (click)="next()">
          {{ isLast() ? 'Finish' : 'Next' }}
        </button>
      </div>

      <div *ngIf="completed()" style="margin-top: 1.5rem;">
        <p><strong>Done!</strong> You have completed the mock exam flow.</p>
        <div class="button-group">
          <button class="secondary" [routerLink]="['/']">Home</button>
          <button class="primary" [routerLink]="['/results']">View Results</button>
        </div>
      </div>
    </div>
  `,
})
export class ExamComponent {
  private currentIndexSignal = signal(0);
  private examCompleted = signal(false);

  readonly currentQuestion = computed(() => QUESTIONS[this.currentIndexSignal()]);
  readonly total = QUESTIONS.length;

  currentIndex() {
    return this.currentIndexSignal();
  }

  completed() {
    return this.examCompleted();
  }

  isLast() {
    return this.currentIndex() === this.total - 1;
  }

  next() {
    if (this.isLast()) {
      this.examCompleted.set(true);
      return;
    }

    this.currentIndexSignal.update((current) => Math.min(current + 1, this.total - 1));
  }

  prev() {
    this.currentIndexSignal.update((current) => Math.max(current - 1, 0));
  }
}
