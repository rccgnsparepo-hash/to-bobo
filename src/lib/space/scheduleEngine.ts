// Real Alarms, Reminders & Local Scheduling Engine for Flick Space
import { playSound } from "@/lib/soundEngine";
import type { ScheduledReminder } from "./types";

const REMINDERS_KEY = "flick:space_reminders_v1";

export class SpaceScheduleEngine {
  private static timerMap: Map<string, number> = new Map();

  public static getReminders(): ScheduledReminder[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(REMINDERS_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
    } catch {
      return [];
    }
  }

  public static saveReminder(reminder: Omit<ScheduledReminder, "id" | "createdAt" | "isCompleted">): ScheduledReminder {
    const list = this.getReminders();
    const newEntry: ScheduledReminder = {
      ...reminder,
      id: `rem_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      createdAt: Date.now(),
      isCompleted: false,
    };
    const updated = [newEntry, ...list];
    try {
      localStorage.setItem(REMINDERS_KEY, JSON.stringify(updated));
      window.dispatchEvent(new CustomEvent("flick:schedule-updated"));
    } catch {}

    this.armReminder(newEntry);
    return newEntry;
  }

  public static deleteReminder(id: string): void {
    const list = this.getReminders();
    const filtered = list.filter((r) => r.id !== id);
    try {
      localStorage.setItem(REMINDERS_KEY, JSON.stringify(filtered));
      window.dispatchEvent(new CustomEvent("flick:schedule-updated"));
    } catch {}

    const timer = this.timerMap.get(id);
    if (timer) {
      window.clearTimeout(timer);
      this.timerMap.delete(id);
    }
  }

  public static markCompleted(id: string): void {
    const list = this.getReminders();
    const target = list.find((r) => r.id === id);
    if (target) {
      target.isCompleted = true;
      try {
        localStorage.setItem(REMINDERS_KEY, JSON.stringify(list));
        window.dispatchEvent(new CustomEvent("flick:schedule-updated"));
      } catch {}
    }
  }

  public static initScheduler(): void {
    if (typeof window === "undefined") return;

    // Request notification permission if needed
    if (typeof Notification !== "undefined" && Notification.permission === "default") {
      void Notification.requestPermission();
    }

    const reminders = this.getReminders();
    reminders.forEach((r) => {
      if (!r.isCompleted && r.triggerTime > Date.now()) {
        this.armReminder(r);
      }
    });
  }

  private static armReminder(reminder: ScheduledReminder): void {
    const delay = Math.max(0, reminder.triggerTime - Date.now());
    if (delay > 24 * 60 * 60 * 1000) return; // Limit timeout range to 24h

    const existingTimer = this.timerMap.get(reminder.id);
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }

    const timer = window.setTimeout(() => {
      this.fireAlarm(reminder);
      this.markCompleted(reminder.id);
      this.timerMap.delete(reminder.id);
    }, delay);

    this.timerMap.set(reminder.id, timer);
  }

  public static fireAlarm(reminder: ScheduledReminder): void {
    // 1. Play audio chime
    if (reminder.soundEnabled) {
      try {
        playSound("notification_chime");
      } catch {}
    }

    // 2. Trigger desktop / mobile notification
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      try {
        const notif = new Notification(`⏰ Flick Space Alarm: ${reminder.title}`, {
          body: `It's time for your ${reminder.targetType} session!`,
          icon: "/icon-192.png",
        });
        notif.onclick = () => {
          window.focus();
          if (reminder.targetUrl) {
            window.location.href = reminder.targetUrl;
          }
        };
      } catch {}
    }

    // 3. In-app toast notification
    window.dispatchEvent(
      new CustomEvent("flick:alarm-triggered", {
        detail: { reminder },
      })
    );
  }
}
