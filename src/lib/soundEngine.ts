/**
 * Flick Audio & Sound Effects Engine
 * Generates low-latency, crystal-clear Web Audio synthesized tones and cues.
 * Completely immune to CORS, offline issues, or missing external audio files.
 * Provides a master toggle, volume control, and debounced playback.
 */

export type SoundEffectType =
  | "message_sent"
  | "message_received"
  | "flick_reaction"
  | "auth_success"
  | "auth_error"
  | "verification_badge"
  | "camera_snap"
  | "notification_chime";

const SOUND_PREF_KEY = "flick:sound_enabled";
const VOLUME_PREF_KEY = "flick:sound_volume";

class SoundManager {
  private ctx: AudioContext | null = null;
  private isEnabled: boolean = true;
  private volume: number = 0.6;
  private lastPlayed: Record<string, number> = {};

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(SOUND_PREF_KEY);
        if (stored !== null) {
          this.isEnabled = stored === "true";
        }
        const volStored = localStorage.getItem(VOLUME_PREF_KEY);
        if (volStored !== null) {
          this.volume = Math.max(0, Math.min(1, parseFloat(volStored)));
        }
      } catch {}
    }
  }

  private getAudioContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isSoundEnabled(): boolean {
    return this.isEnabled;
  }

  public setSoundEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    try {
      localStorage.setItem(SOUND_PREF_KEY, enabled.toString());
      window.dispatchEvent(new CustomEvent("flick:sound-pref-updated", { detail: { enabled } }));
    } catch {}
  }

  public getVolume(): number {
    return this.volume;
  }

  public setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
    try {
      localStorage.setItem(VOLUME_PREF_KEY, this.volume.toString());
    } catch {}
  }

  /**
   * Play a specified interaction sound effect with debouncing to prevent audio spam.
   */
  public play(type: SoundEffectType): void {
    if (!this.isEnabled || typeof window === "undefined") return;

    // Throttle same sound within 120ms
    const now = Date.now();
    if (this.lastPlayed[type] && now - this.lastPlayed[type] < 120) {
      return;
    }
    this.lastPlayed[type] = now;

    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const masterGain = ctx.createGain();
      masterGain.gain.setValueAtTime(this.volume, ctx.currentTime);
      masterGain.connect(ctx.destination);

      const t0 = ctx.currentTime;

      switch (type) {
        case "message_sent": {
          // Delicate snappy upward blip (520Hz -> 840Hz)
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(520, t0);
          osc.frequency.exponentialRampToValueAtTime(860, t0 + 0.09);

          gain.gain.setValueAtTime(0.25, t0);
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);

          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(t0);
          osc.stop(t0 + 0.13);
          break;
        }

        case "message_received": {
          // Snapchat-inspired dual harmonic chime (880Hz -> 1320Hz)
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const gain = ctx.createGain();

          osc1.type = "sine";
          osc2.type = "sine";
          osc1.frequency.setValueAtTime(880, t0);
          osc2.frequency.setValueAtTime(1320, t0 + 0.05);

          gain.gain.setValueAtTime(0.3, t0);
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28);

          osc1.connect(gain);
          osc2.connect(gain);
          gain.connect(masterGain);

          osc1.start(t0);
          osc2.start(t0 + 0.05);
          osc1.stop(t0 + 0.3);
          osc2.stop(t0 + 0.3);
          break;
        }

        case "flick_reaction": {
          // Sparkle resonance (1046Hz -> 1568Hz)
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "triangle";
          osc.frequency.setValueAtTime(1046.5, t0);
          osc.frequency.exponentialRampToValueAtTime(1567.98, t0 + 0.15);

          gain.gain.setValueAtTime(0.2, t0);
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);

          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(t0);
          osc.stop(t0 + 0.23);
          break;
        }

        case "auth_success": {
          // Warm 3-note ascending welcome chime (C5 -> E5 -> G5)
          const notes = [523.25, 659.25, 783.99];
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const start = t0 + idx * 0.08;

            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, start);

            gain.gain.setValueAtTime(0.22, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);

            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(start);
            osc.stop(start + 0.26);
          });
          break;
        }

        case "auth_error": {
          // Subtle low warning alert (220Hz -> 180Hz)
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sawtooth";
          osc.frequency.setValueAtTime(240, t0);
          osc.frequency.linearRampToValueAtTime(180, t0 + 0.18);

          gain.gain.setValueAtTime(0.18, t0);
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);

          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(t0);
          osc.stop(t0 + 0.23);
          break;
        }

        case "verification_badge": {
          // Emerald triumph chime (587Hz -> 880Hz -> 1174Hz)
          const notes = [587.33, 880, 1174.66];
          notes.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const start = t0 + idx * 0.09;

            osc.type = "sine";
            osc.frequency.setValueAtTime(freq, start);

            gain.gain.setValueAtTime(0.28, start);
            gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);

            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(start);
            osc.stop(start + 0.36);
          });
          break;
        }

        case "camera_snap": {
          // Crisp shutter sound
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "square";
          osc.frequency.setValueAtTime(1200, t0);
          osc.frequency.exponentialRampToValueAtTime(200, t0 + 0.04);

          gain.gain.setValueAtTime(0.3, t0);
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.06);

          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(t0);
          osc.stop(t0 + 0.07);
          break;
        }

        case "notification_chime":
        default: {
          // Standard chime (784Hz -> 1046Hz)
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.setValueAtTime(783.99, t0);
          osc.frequency.exponentialRampToValueAtTime(1046.5, t0 + 0.12);

          gain.gain.setValueAtTime(0.22, t0);
          gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.25);

          osc.connect(gain);
          gain.connect(masterGain);
          osc.start(t0);
          osc.stop(t0 + 0.26);
          break;
        }
      }
    } catch (err) {
      console.warn("[SoundManager] Playback warning:", err);
    }
  }
}

export const soundEngine = new SoundManager();

export function playSound(type: SoundEffectType): void {
  soundEngine.play(type);
}
