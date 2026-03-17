import { Injectable } from '@angular/core';

const API_URL = 'http://localhost:3000';

export interface SaveQuestionRequest {
  questionNumber: number;
  questionText: string;
  transcript: string;
}

@Injectable({ providedIn: 'root' })
export class SessionService {
  async createSession(): Promise<string> {
    const response = await fetch(`${API_URL}/sessions`, { method: 'POST' });
    if (!response.ok) throw new Error('Failed to create session');
    const data = await response.json() as { id: string };
    return data.id;
  }

  async saveQuestion(sessionId: string, question: SaveQuestionRequest): Promise<void> {
    const response = await fetch(`${API_URL}/sessions/${sessionId}/questions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(question),
    });
    if (!response.ok) throw new Error('Failed to save question');
  }

  async completeSession(sessionId: string): Promise<void> {
    const response = await fetch(`${API_URL}/sessions/${sessionId}/complete`, {
      method: 'PATCH',
    });
    if (!response.ok) throw new Error('Failed to complete session');
  }
}
