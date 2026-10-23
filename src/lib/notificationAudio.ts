/**
 * Flick Notification & Announcement Audio Engine
 * Synchronizes custom audio files, Web Audio synthesis, and dynamic caller ID speech
 * so notifications can speak the caller's identity ("Ryder just sent you a chat")
 * and the app launch page can play the synchronized "Welcome to Flick" audio.
 */

import { playSound } from "./soundEngine";

export type NotificationKind = "message" | "like" | "comment" | "story" | "post" | "mention" | "system";

export interface CallerInfo {
  id?: string | null;
  handle?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
}

const VOICE_PREF_KEY = "flick:voice_announcements_enabled";
const CUSTOM_SOUNDS_BASE = "/sounds";

// Known audio files that can be dropped into /public/sounds/
export const SOUND_FILE_MAP: Record<string, string> = {
  welcome: `${CUSTOM_SOUNDS_BASE}/welcome-to-flick.mp3`,
  chat: `${CUSTOM_SOUNDS_BASE}/chat-notification.mp3`,
  like: `${CUSTOM_SOUNDS_BASE}/like-notification.mp3`,
  comment: `${CUSTOM_SOUNDS_BASE}/comment-notification.mp3`,
  story: `${CUSTOM_SOUNDS_BASE}/story-notification.mp3`,
  general: `${CUSTOM_SOUNDS_BASE}/notification.mp3`,
};

class NotificationAudioEngine {
  private voiceEnabled = true;
  private isSpeaking = false;

  constructor() {
    if (typeof window !== "undefined") {
      try {
        const stored = localStorage.getItem(VOICE_PREF_KEY);
        if (stored !== null) {
          this.voiceEnabled = stored === "true";
        }
      } catch {}
    }
  }

  public isVoiceEnabled(): boolean {
    return this.voiceEnabled;
  }

  public setVoiceEnabled(enabled: boolean): void {
    this.voiceEnabled = enabled;
    try {
      localStorage.setItem(VOICE_PREF_KEY, enabled.toString());
    } catch {}
  }

  /**
   * Resolves the friendly caller display string from available actor fields.
   */
  public getCallerIdentifier(actor?: CallerInfo): string {
    if (!actor) return "Someone";
    if (actor.display_name && actor.display_name.trim().length > 0) {
      return actor.display_name.trim();
    }
    if (actor.handle && actor.handle.trim().length > 0) {
      return `@${actor.handle.trim()}`;
    }
    if (actor.id) {
      return `User ${actor.id.slice(0, 5)}`;
    }
    return "Someone";
  }

  /**
   * Formats the natural spoken phrase including dynamic caller ID before notification action
   */
  public getAnnouncementPhrase(kind: NotificationKind, callerName: string): string {
    switch (kind) {
      case "message":
        return `${callerName} just sent you a chat`;
      case "like":
        return `${callerName} liked your flick`;
      case "comment":
        return `${callerName} commented on your flick`;
      case "story":
        return `${callerName} posted a story`;
      case "post":
        return `${callerName} just flicked`;
      default:
        return `New notification from ${callerName}`;
    }
  }

  /**
   * Plays a custom audio file with fallback detection
   */
  public async playCustomAudioFile(url: string, volume = 0.85): Promise<boolean> {
    if (typeof window === "undefined") return false;
    return new Promise((resolve) => {
      try {
        const audio = new Audio(url);
        audio.volume = Math.max(0, Math.min(1, volume));
        let finished = false;

        const cleanup = (success: boolean) => {
          if (finished) return;
          finished = true;
          audio.pause();
          audio.remove();
          resolve(success);
        };

        audio.addEventListener("ended", () => cleanup(true));
        audio.addEventListener("error", () => cleanup(false));

        // Safety timeout if audio stalls
        const timer = setTimeout(() => cleanup(false), 7000);

        audio
          .play()
          .then(() => {
            // Playing successfully
          })
          .catch(() => {
            clearTimeout(timer);
            cleanup(false);
          });
      } catch {
        resolve(false);
      }
    });
  }

  /**
   * Speaks a phrase with Web Speech Synthesis API
   */
  public speak(phrase: string): Promise<void> {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(phrase);
        utterance.rate = 1.05;
        utterance.pitch = 1.02;
        utterance.volume = 0.9;

        // Pick an English voice if available
        const voices = window.speechSynthesis.getVoices();
        const enVoice = voices.find(
          (v) => v.lang.startsWith("en") && (v.name.includes("Google") || v.name.includes("Natural") || v.default)
        );
        if (enVoice) utterance.voice = enVoice;

        utterance.onend = () => {
          this.isSpeaking = false;
          resolve();
        };
        utterance.onerror = () => {
          this.isSpeaking = false;
          resolve();
        };

        this.isSpeaking = true;
        window.speechSynthesis.speak(utterance);

        // Fallback timeout in case speech synth hangs
        setTimeout(() => {
          if (this.isSpeaking) {
            this.isSpeaking = false;
            resolve();
          }
        }, 4000);
      } catch {
        resolve();
      }
    });
  }

  /**
   * Main notification audio trigger:
   * 1. Speaks dynamic caller identifier + action ("Ryder just sent you a chat")
   * 2. Plays synchronized notification audio sound effect
   */
  public async playNotificationAudio(
    kind: NotificationKind,
    actor?: CallerInfo,
    customSoundUrl?: string
  ): Promise<void> {
    const callerName = this.getCallerIdentifier(actor);
    const phrase = this.getAnnouncementPhrase(kind, callerName);

    // 1. Play custom audio file if provided or configured
    const soundKey = kind === "message" ? "chat" : kind;
    const targetFile = customSoundUrl || SOUND_FILE_MAP[soundKey] || SOUND_FILE_MAP.general;

    const filePlayed = await this.playCustomAudioFile(targetFile);

    // If no custom audio file exists yet, fallback to built-in snappy sound effect
    if (!filePlayed) {
      if (kind === "message") {
        playSound("message_received");
      } else if (kind === "like") {
        playSound("flick_reaction");
      } else {
        playSound("notification_chime");
      }
    }

    // 2. Announce caller if voice announcements are enabled
    if (this.voiceEnabled) {
      await this.speak(phrase);
    }
  }

  /**
   * Plays the "Welcome to Flick" audio at app launch.
   * Resolves only after the audio finishes sounding so the page can wait before transiting.
   */
  public async playWelcomeToFlickAudio(): Promise<void> {
    if (typeof window === "undefined") return;

    // First attempt custom audio file: /sounds/welcome-to-flick.mp3
    const customPlayed = await this.playCustomAudioFile(SOUND_FILE_MAP.welcome, 0.95);
    if (customPlayed) {
      return;
    }

    // Synthesized welcome sequence: Warm harmonic chime + spoken "Welcome to Flick"
    try {
      playSound("auth_success");
    } catch {}

    if ("speechSynthesis" in window) {
      await this.speak("Welcome to Flick");
    } else {
      // Allow chime to resonate
      await new Promise((r) => setTimeout(r, 1400));
    }
  }
}

export const notificationAudio = new NotificationAudioEngine();
