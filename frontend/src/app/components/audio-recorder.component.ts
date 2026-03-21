import { Component, signal, output, OnDestroy, ElementRef, viewChild } from '@angular/core';

type RecorderState = 'idle' | 'requesting' | 'recording' | 'recorded' | 'error';

@Component({
  standalone: true,
  selector: 'app-audio-recorder',
  templateUrl: './audio-recorder.component.html',
  styleUrl: './audio-recorder.component.css',
})
export class AudioRecorderComponent implements OnDestroy {
  readonly recordingReady = output<Blob | null>();

  readonly state = signal<RecorderState>('idle');
  readonly errorMessage = signal<string>('');
  readonly audioUrl = signal<string | null>(null);
  readonly recordingSeconds = signal(0);

  private readonly audioEl = viewChild<ElementRef<HTMLAudioElement>>('audioPlayer');

  private mediaRecorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private timerInterval: ReturnType<typeof setInterval> | null = null;

  pauseAudio(): void {
    this.audioEl()?.nativeElement.pause();
  }

  stopIfRecording(): void {
    if (this.state() === 'recording') {
      this.stopRecording();
    }
  }

  async startRecording(): Promise<void> {
    this.state.set('requesting');
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      this.chunks = [];
      this.revokeUrl();

      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';

      this.mediaRecorder = new MediaRecorder(this.stream, { mimeType });

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) this.chunks.push(e.data);
      };

      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mediaRecorder!.mimeType });
        const url = URL.createObjectURL(blob);
        this.audioUrl.set(url);
        this.state.set('recorded');
        this.recordingReady.emit(blob);
        this.stopStream();
      };

      this.mediaRecorder.start();
      this.state.set('recording');
      this.recordingSeconds.set(0);
      this.timerInterval = setInterval(() => {
        this.recordingSeconds.update((s) => s + 1);
      }, 1000);
    } catch (err) {
      this.state.set('error');
      this.errorMessage.set(
        err instanceof Error ? err.message : 'Microphone access denied',
      );
      this.stopStream();
    }
  }

  stopRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.clearTimer();
  }

  deleteRecording(): void {
    this.revokeUrl();
    this.state.set('idle');
    this.recordingReady.emit(null);
  }

  retryFromError(): void {
    this.state.set('idle');
  }

  formatTime(seconds: number): string {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  private stopStream(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }

  private clearTimer(): void {
    if (this.timerInterval !== null) {
      clearInterval(this.timerInterval);
      this.timerInterval = null;
    }
  }

  private revokeUrl(): void {
    const url = this.audioUrl();
    if (url) {
      URL.revokeObjectURL(url);
      this.audioUrl.set(null);
    }
  }

  ngOnDestroy(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.clearTimer();
    this.stopStream();
    this.revokeUrl();
  }
}
