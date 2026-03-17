import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';

const API_URL = 'http://localhost:3000';

interface ConceptRow {
  concept_id: number;
  concept_name: string;
  detected: number;
  confidence: number;
  evidence: string;
}

interface QuestionDetail {
  id: number;
  question_number: number;
  question_text: string;
  transcript: string;
  score: number | null;
  passed: number | null;
  concepts: ConceptRow[];
}

interface SessionDetail {
  id: string;
  started_at: string;
  completed_at: string | null;
  overall_score: number | null;
  passed: number | null;
  questions: QuestionDetail[];
}

@Component({
  standalone: true,
  selector: 'app-session-detail',
  imports: [RouterLink, DatePipe],
  templateUrl: './session-detail.component.html',
  styleUrl: './session-detail.component.css',
})
export class SessionDetailComponent implements OnInit {
  readonly session = signal<SessionDetail | null>(null);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  constructor(private readonly route: ActivatedRoute) {}

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('No session ID provided');
      this.loading.set(false);
      return;
    }
    try {
      const response = await fetch(`${API_URL}/sessions/${id}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this.session.set(await response.json() as SessionDetail);
    } catch (err) {
      this.error.set(err instanceof Error ? err.message : 'Failed to load session');
    } finally {
      this.loading.set(false);
    }
  }

  scorePercent(score: number | null): string {
    return score !== null ? `${Math.round(score * 100)}%` : '—';
  }

  isPassed(passed: number | null): boolean {
    return passed === 1;
  }

  confidencePercent(confidence: number): string {
    return `${Math.round(confidence * 100)}%`;
  }
}
