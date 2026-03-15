import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

interface SessionSummary {
  id: string;
  startedAt: string;
  overallScore: number;
  passed: boolean;
}

const DUMMY_SESSIONS: SessionSummary[] = [
  {
    id: 'session-2026-03-14-1',
    startedAt: '2026-03-14T10:21:00Z',
    overallScore: 0.82,
    passed: true,
  },
  {
    id: 'session-2026-03-13-2',
    startedAt: '2026-03-13T15:06:00Z',
    overallScore: 0.61,
    passed: false,
  },
  {
    id: 'session-2026-03-12-3',
    startedAt: '2026-03-12T09:44:00Z',
    overallScore: 0.78,
    passed: true,
  },
];

@Component({
  standalone: true,
  selector: 'app-results',
  imports: [CommonModule, RouterLink],
  template: `
    <div class="card">
      <h2>Past Exam Results</h2>
      <p>Review your previous sessions; data is simulated for now.</p>

      <table class="table">
        <thead>
          <tr>
            <th>Session</th>
            <th>Date</th>
            <th>Score</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr *ngFor="let session of sessions">
            <td>{{ session.id }}</td>
            <td>{{ session.startedAt | date: 'medium' }}</td>
            <td>{{ (session.overallScore * 100) | number: '1.0-0' }}%</td>
            <td>
              <span class="badge" [class.passed]="session.passed" [class.failed]="!session.passed">
                {{ session.passed ? 'Passed' : 'Failed' }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <div class="button-group" style="margin-top: 1.5rem;">
        <button class="secondary" [routerLink]="['/']">Back to Home</button>
      </div>
    </div>
  `,
})
export class ResultsComponent {
  sessions = DUMMY_SESSIONS;
}
