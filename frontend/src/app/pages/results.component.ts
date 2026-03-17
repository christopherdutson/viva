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
  templateUrl: './results.component.html',
  styleUrl: './results.component.css',
})
export class ResultsComponent {
  sessions = DUMMY_SESSIONS;
}
