import { TestBed } from '@angular/core/testing';
import { AudioRecorderComponent } from './audio-recorder.component';

function makeFakeMediaRecorder() {
  let stopHandler: (() => void) | null = null;
  let dataHandler: ((e: { data: Blob }) => void) | null = null;

  return {
    state: 'inactive' as RecordingState,
    mimeType: 'audio/webm;codecs=opus',
    set onstop(fn: (() => void) | null) { stopHandler = fn; },
    set ondataavailable(fn: ((e: { data: Blob }) => void) | null) { dataHandler = fn; },
    start() { this.state = 'recording'; },
    stop() {
      this.state = 'inactive';
      dataHandler?.({ data: new Blob([new Uint8Array(4)], { type: 'audio/webm' }) });
      stopHandler?.();
    },
  };
}

describe('AudioRecorderComponent', () => {
  beforeEach(async () => {
    // Stub getUserMedia and MediaRecorder before each test
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: { getUserMedia: async () => ({ getTracks: () => [] }) },
    });
    const fakeRecorder = makeFakeMediaRecorder();
    (globalThis as unknown as Record<string, unknown>)['MediaRecorder'] = class {
      static isTypeSupported() { return true; }
      readonly mimeType = fakeRecorder.mimeType;
      state = fakeRecorder.state;
      set ondataavailable(fn: ((e: { data: Blob }) => void) | null) { fakeRecorder.ondataavailable = fn; }
      set onstop(fn: (() => void) | null) { fakeRecorder.onstop = fn; }
      start() { fakeRecorder.start(); this.state = fakeRecorder.state; }
      stop() { fakeRecorder.stop(); this.state = fakeRecorder.state; }
    };

    await TestBed.configureTestingModule({
      imports: [AudioRecorderComponent],
    }).compileComponents();
  });

  it('should create with idle state', () => {
    const fixture = TestBed.createComponent(AudioRecorderComponent);
    expect(fixture.componentInstance.state()).toBe('idle');
  });

  describe('formatTime()', () => {
    it('formats zero as 00:00', () => {
      const fixture = TestBed.createComponent(AudioRecorderComponent);
      expect(fixture.componentInstance.formatTime(0)).toBe('00:00');
    });

    it('formats 65 seconds as 01:05', () => {
      const fixture = TestBed.createComponent(AudioRecorderComponent);
      expect(fixture.componentInstance.formatTime(65)).toBe('01:05');
    });

    it('formats 3600 seconds as 60:00', () => {
      const fixture = TestBed.createComponent(AudioRecorderComponent);
      expect(fixture.componentInstance.formatTime(3600)).toBe('60:00');
    });
  });

  it('deleteRecording() resets state to idle and emits null', () => {
    const fixture = TestBed.createComponent(AudioRecorderComponent);
    const emitted: (Blob | null)[] = [];
    fixture.componentInstance.recordingReady.subscribe((v) => emitted.push(v));

    fixture.componentInstance.deleteRecording();

    expect(fixture.componentInstance.state()).toBe('idle');
    expect(emitted).toEqual([null]);
  });

  it('retryFromError() resets state to idle', () => {
    const fixture = TestBed.createComponent(AudioRecorderComponent);
    fixture.componentInstance.state.set('error');

    fixture.componentInstance.retryFromError();

    expect(fixture.componentInstance.state()).toBe('idle');
  });

  it('startRecording() transitions through requesting → recording', async () => {
    const fixture = TestBed.createComponent(AudioRecorderComponent);
    const promise = fixture.componentInstance.startRecording();
    expect(fixture.componentInstance.state()).toBe('requesting');
    await promise;
    expect(fixture.componentInstance.state()).toBe('recording');
  });

  it('sets error state when getUserMedia is denied', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: {
        getUserMedia: async () => { throw new Error('Permission denied'); },
      },
    });

    const fixture = TestBed.createComponent(AudioRecorderComponent);
    await fixture.componentInstance.startRecording();

    expect(fixture.componentInstance.state()).toBe('error');
    expect(fixture.componentInstance.errorMessage()).toContain('Permission denied');
  });
});
