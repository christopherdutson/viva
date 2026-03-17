import { Injectable } from '@angular/core';

const API_URL = 'http://localhost:3000';

export interface ConceptExtraction {
  conceptId: number;
  conceptName: string;
  detected: boolean;
  confidence: number;
  evidence: string;
}

export interface ExtractionResult {
  questionAssessmentId: number;
  concepts: ConceptExtraction[];
  score: number;
  passed: boolean;
}

@Injectable({ providedIn: 'root' })
export class ExtractionService {
  async extract(sessionId: string, questionNumber: number): Promise<ExtractionResult> {
    const response = await fetch(
      `${API_URL}/sessions/${sessionId}/questions/${questionNumber}/extract`,
      { method: 'POST' },
    );
    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? `Extraction failed (HTTP ${response.status})`);
    }
    return response.json() as Promise<ExtractionResult>;
  }
}
