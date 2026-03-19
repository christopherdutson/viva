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

  scoreLabel(session: SessionSummary): string {
    if (session.overall_score !== null) {
      return `${Math.round(session.overall_score * 100)}%`;
    }
    return '—';
  }

  isPassed(session: SessionSummary): boolean {
    return session.passed === 1;
  }
}
