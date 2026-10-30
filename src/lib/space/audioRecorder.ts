// Real Audio Recording Engine with Waveform Analyzer for Flick Space
export class StudioAudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private audioStream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private startTime: number = 0;
  private pausedDuration: number = 0;
  private pauseStartTime: number = 0;
  private state: "inactive" | "recording" | "paused" = "inactive";

  public async start(): Promise<void> {
    this.audioChunks = [];
    this.pausedDuration = 0;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    this.audioStream = stream;

    // Set up Web Audio Analyser for live visualizer waveform
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.audioContext = new AudioCtx();
        const source = this.audioContext.createMediaStreamSource(stream);
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 64;
        source.connect(this.analyser);
      }
    } catch {
      // AudioContext fallback
    }

    // Pick best supported MIME type
    const mimeTypes = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/mp4",
      "audio/aac",
    ];
    let selectedMime = "";
    for (const mime of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mime)) {
        selectedMime = mime;
        break;
      }
    }

    const recorder = selectedMime
      ? new MediaRecorder(stream, { mimeType: selectedMime })
      : new MediaRecorder(stream);

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    recorder.start(100); // 100ms chunks for responsive stop/data
    this.mediaRecorder = recorder;
    this.startTime = Date.now();
    this.state = "recording";
  }

  public pause(): void {
    if (this.mediaRecorder && this.state === "recording") {
      this.mediaRecorder.pause();
      this.pauseStartTime = Date.now();
      this.state = "paused";
    }
  }

  public resume(): void {
    if (this.mediaRecorder && this.state === "paused") {
      this.mediaRecorder.resume();
      this.pausedDuration += Date.now() - this.pauseStartTime;
      this.state = "recording";
    }
  }

  public async stop(): Promise<{ blob: Blob; durationSeconds: number; mimeType: string }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error("No active recorder"));
        return;
      }

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || "audio/webm";
        const blob = new Blob(this.audioChunks, { type: mimeType });
        const totalDurationMs = Date.now() - this.startTime - this.pausedDuration;
        const durationSeconds = Math.max(1, Math.round(totalDurationMs / 1000));

        this.cleanup();
        resolve({ blob, durationSeconds, mimeType });
      };

      this.mediaRecorder.stop();
    });
  }

  /**
   * Returns normalized 0..255 byte array for live waveform audio visualizer
   */
  public getWaveformData(): Uint8Array {
    if (!this.analyser || this.state !== "recording") {
      return new Uint8Array(16).fill(10);
    }
    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    return dataArray;
  }

  public getState(): "inactive" | "recording" | "paused" {
    return this.state;
  }

  private cleanup(): void {
    this.state = "inactive";
    if (this.audioStream) {
      this.audioStream.getTracks().forEach((track) => track.stop());
      this.audioStream = null;
    }
    if (this.audioContext && this.audioContext.state !== "closed") {
      try {
        void this.audioContext.close();
      } catch {}
      this.audioContext = null;
    }
    this.analyser = null;
    this.mediaRecorder = null;
  }

  public static download(blob: Blob, filename = "flick-recording.webm"): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 1000);
  }
}
