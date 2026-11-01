/**
 * Audio Level Meter using Web Audio API (AnalyserNode)
 * Computes live decibel / volume amplitude and speaking ring state.
 */

export class AudioLevelMeter {
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private animFrameId: number | null = null;
  private isRunning = false;

  constructor(
    private stream: MediaStream,
    private onLevel: (level: number) => void,
    private onSpeaking?: (speaking: boolean) => void,
    private speakingThreshold = 0.06
  ) {
    this.start();
  }

  private start() {
    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return;

      this.audioCtx = new AudioCtxClass();
      if (this.audioCtx.state === "suspended") {
        void this.audioCtx.resume();
      }

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.4;

      const audioTrack = this.stream.getAudioTracks()[0];
      if (!audioTrack) return;

      this.source = this.audioCtx.createMediaStreamSource(this.stream);
      this.source.connect(this.analyser);

      const buffer = new Uint8Array(this.analyser.frequencyBinCount);
      let wasSpeaking = false;

      const checkVolume = () => {
        if (!this.isRunning || !this.analyser) return;

        this.analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }

        const average = sum / buffer.length;
        // Normalized value 0.0 to 1.0
        const level = Math.min(1, Math.max(0, average / 128));
        this.onLevel(level);

        const isSpeaking = level >= this.speakingThreshold;
        if (isSpeaking !== wasSpeaking) {
          wasSpeaking = isSpeaking;
          if (this.onSpeaking) this.onSpeaking(isSpeaking);
        }

        this.animFrameId = requestAnimationFrame(checkVolume);
      };

      this.isRunning = true;
      this.animFrameId = requestAnimationFrame(checkVolume);
    } catch (err) {
      console.warn("AudioLevelMeter init warning:", err);
    }
  }

  public stop() {
    this.isRunning = false;
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    if (this.source) {
      try {
        this.source.disconnect();
      } catch {}
      this.source = null;
    }
    if (this.audioCtx && this.audioCtx.state !== "closed") {
      try {
        void this.audioCtx.close();
      } catch {}
      this.audioCtx = null;
    }
  }
}
