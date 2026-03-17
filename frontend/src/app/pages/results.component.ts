import { Component, OnInit, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';

const API_URL = 'http://localhost:3000';

interface SessionSummary {
  id: string;
  started_at: string;
  completed_at: string | null;
  overall_score: number | null;
  passed: number | null;
  question_count: number;
}

@Component({
  standalone: true,
  selector: 'app-results',
  imports: [RouterLink, DatePipe],
  templateUrl: './results.component.html',
  styleUrl: './results.component.css',
})
export class ResultsComponent implements OnInit {
  readonly sessions = signal<SessionSummary[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/sessions`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this.sessions.set(await response.json() as SessionSummary[]);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load sessions');
    } finally {
      this.loading.set(false);
    }
  }

  // Score display: real value once LLM runs, otherwise assume 100% for completed sessions
  scoreLabel(session: SessionSummary): string {
    if (session.completed_at === null) return '—';
    if (session.overall_score !== null) {
      return `${Math.round(session.overall_score * 100)}%`;
    }
    return '100%';
  }

  isPassed(session: SessionSummary): boolean {
    if (session.completed_at === null) return false;
    if (session.passed !== null) return session.passed === 1;
    return true; // assume passing until LLM scores are available
  }
}
