import { Injectable } from '@angular/core';

const API_URL = 'http://localhost:3000';

@Injectable({ providedIn: 'root' })
export class TranscriptionService {
  async transcribe(blob: Blob): Promise<string> {
    const form = new FormData();
    form.append('audio', blob, 'recording.webm');

    const response = await fetch(`${API_URL}/transcribe`, {
      method: 'POST',
      body: form,
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({})) as { error?: string };
      throw new Error(body.error ?? `HTTP ${response.status}`);
    }

    const data = await response.json() as { transcript: string };
    return data.transcript;
  }
}
