/**
 * Flick Notification & Announcement Audio Engine
 * Powered by user-uploaded authentic Optimus Prime voice model clips.
 * Replaces all synthetic AI text-to-speech with actual Optimus Prime voice clips.
 */

import { playSound, soundEngine } from "./soundEngine";

export type NotificationKind = "message" | "like" | "comment" | "story" | "post" | "mention" | "system" | "news" | "guardian";

export interface CallerInfo {
  id?: string | null;
  handle?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
}

const VOICE_PREF_KEY = "flick:voice_announcements_enabled";

// User-provided Optimus Prime Voice Model Clips
export const OPTIMUS_SOUNDS = {
  welcome: "/assets/aistudio/Optimus-Prime-2026-10-30-09-04-Welcome-to-Flick_76cf21e1.mp3",
  message: "/assets/aistudio/Optimus-Prime-2026-10-30-09-04-you-have-a-new-message_f1f92681.mp3",
  sentFlick: "/assets/aistudio/Optimus-Prime-2026-10-30-09-03-sent-you-a-flick_98473c18.mp3",
  news: "/assets/aistudio/Optimus-Prime-2026-10-30-09-07-News-from-the-Wire_f947a250.mp3",
  guardian: "/assets/aistudio/Optimus-Prime-2026-10-30-09-06-I-am-the-Father_-I-provide-Guardiance-here_-and_285918b1.mp3",
} as const;

export type OptimusClipKey = keyof typeof OPTIMUS_SOUNDS;

// Known audio files mapped to Optimus Prime voice clips
export const SOUND_FILE_MAP: Record<string, string> = {
  welcome: OPTIMUS_SOUNDS.welcome,
  chat: OPTIMUS_SOUNDS.message,
  message: OPTIMUS_SOUNDS.message,
  like: OPTIMUS_SOUNDS.sentFlick,
  comment: OPTIMUS_SOUNDS.sentFlick,
  story: OPTIMUS_SOUNDS.sentFlick,
  post: OPTIMUS_SOUNDS.sentFlick,
  general: OPTIMUS_SOUNDS.sentFlick,
  news: OPTIMUS_SOUNDS.news,
  guardian: OPTIMUS_SOUNDS.guardian,
};

class NotificationAudioEngine {
  private voiceEnabled = true;
  private currentAudio: HTMLAudioElement | null = null;

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

  public getAnnouncementPhrase(kind: NotificationKind, callerName: string, contentSummary?: string): string {
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
        return contentSummary ? `${callerName} posted: ${contentSummary.slice(0, 80)}` : `${callerName} just flicked`;
      case "news":
        return contentSummary ? contentSummary.slice(0, 100) : "Latest news headline";
      default:
        return contentSummary || `New notification from ${callerName}`;
    }
  }

  /**
   * Plays an audio file with HTML5 Audio
   */
  public async playCustomAudioFile(url: string, volume = 0.95): Promise<boolean> {
    if (typeof window === "undefined" || !url) return false;

    return new Promise((resolve) => {
      try {
        if (this.currentAudio) {
          try {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
          } catch {}
        }

        const audio = new Audio();
        this.currentAudio = audio;
        audio.preload = "auto";
        audio.volume = Math.max(0, Math.min(1, volume));
        let finished = false;

        const cleanup = (success: boolean) => {
          if (finished) return;
          finished = true;
          if (this.currentAudio === audio) {
            this.currentAudio = null;
          }
          try {
            audio.pause();
            audio.removeAttribute("src");
          } catch {}
          resolve(success);
        };

        audio.addEventListener("ended", () => cleanup(true));
        audio.addEventListener("error", (e) => {
          e.preventDefault?.();
          cleanup(false);
        });

        // Safety timeout if audio stalls
        const timer = setTimeout(() => cleanup(false), 8000);

        audio.src = url;
        audio
          .play()
          .then(() => {
            // Audio playing successfully
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
   * Plays genuine Optimus Prime voice clip instead of generic AI speech synthesis
   */
  public async playOptimusVoice(clip: OptimusClipKey = "sentFlick", volume = 0.95): Promise<boolean> {
    if (!this.voiceEnabled) return false;
    const path = OPTIMUS_SOUNDS[clip] || OPTIMUS_SOUNDS.sentFlick;
    return this.playCustomAudioFile(path, volume);
  }

  /**
   * Stop any currently sounding voice/speech
   */
  public stopVoice(): void {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {}
    }
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch {}
      this.currentAudio = null;
    }
  }

  /**
   * Speaks using Optimus Prime's voice instead of robotic AI TTS
   */
  public async speak(phrase?: string): Promise<void> {
    if (!this.voiceEnabled) return;

    const text = (phrase || "").toLowerCase();
    let clip: OptimusClipKey = "sentFlick";

    if (text.includes("welcome") || text.includes("flick") || text.includes("name") || text.includes("intro")) {
      clip = "welcome";
    } else if (
      text.includes("chat") ||
      text.includes("message") ||
      text.includes("calling") ||
      text.includes("call") ||
      text.includes("dm")
    ) {
      clip = "message";
    } else if (text.includes("news") || text.includes("wire") || text.includes("headline") || text.includes("breaking")) {
      clip = "news";
    } else if (
      text.includes("father") ||
      text.includes("guardian") ||
      text.includes("faratech") ||
      text.includes("security") ||
      text.includes("protect")
    ) {
      clip = "guardian";
    } else {
      clip = "sentFlick";
    }

    await this.playOptimusVoice(clip, 0.95);
  }

  /**
   * Main notification audio trigger:
   * Plays authentic Optimus Prime audio according to notification kind.
   */
  public async playNotificationAudio(
    kind: NotificationKind,
    _actor?: CallerInfo,
    customSoundUrl?: string,
    _contentSummary?: string
  ): Promise<void> {
    if (!this.voiceEnabled && !soundEngine.isSoundEnabled()) return;

    const soundKey = kind === "message" ? "chat" : kind;
    const targetFile = customSoundUrl || SOUND_FILE_MAP[soundKey] || OPTIMUS_SOUNDS.sentFlick;

    const played = await this.playCustomAudioFile(targetFile, 0.95);
    if (!played) {
      if (kind === "message") {
        playSound("message_received");
      } else if (kind === "like") {
        playSound("flick_reaction");
      } else {
        playSound("notification_chime");
      }
    }
  }

  /**
   * Plays the Optimus Prime "Welcome to Flick" audio at app launch.
   */
  public async playWelcomeToFlickAudio(): Promise<void> {
    if (typeof window === "undefined") return;

    const played = await this.playCustomAudioFile(OPTIMUS_SOUNDS.welcome, 0.95);
    if (!played) {
      playSound("auth_success");
    }
  }

  /**
   * Dedicated sound effect for Flick News Wire pushes:
   * Plays Optimus Prime "News from the wire".
   */
  public async playNewsWirePushSound(volume = 0.95): Promise<boolean> {
    if (typeof window === "undefined" || !this.voiceEnabled) return false;
    const played = await this.playCustomAudioFile(OPTIMUS_SOUNDS.news, volume);
    if (!played) {
      playSound("notification_chime");
      return false;
    }
    return true;
  }
}

export const notificationAudio = new NotificationAudioEngine();
