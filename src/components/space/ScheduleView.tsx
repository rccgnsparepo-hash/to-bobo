import React, { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  Plus,
  Bell,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Radio,
  BookOpen,
  Volume2,
} from "lucide-react";
import { SpaceScheduleEngine } from "@/lib/space/scheduleEngine";
import type { ScheduledReminder } from "@/lib/space/types";

interface ScheduleViewProps {
  onJoinSession?: (type: string, id: string) => void;
}

export const ScheduleView: React.FC<ScheduleViewProps> = () => {
  const [reminders, setReminders] = useState<ScheduledReminder[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [title, setTitle] = useState("");
  const [dateTime, setDateTime] = useState("");
  const [category, setCategory] = useState<"live" | "class" | "meeting" | "prep" | "other">("live");
  const [alarmSound, setAlarmSound] = useState(true);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    SpaceScheduleEngine.init();
    setReminders(SpaceScheduleEngine.getReminders());

    if ("Notification" in window) {
      setNotifPermission(Notification.permission);
    }

    const handler = () => {
      setReminders(SpaceScheduleEngine.getReminders());
    };
    window.addEventListener("flick:schedule-updated", handler);
    return () => window.removeEventListener("flick:schedule-updated", handler);
  }, []);

  const requestPermission = async () => {
    if ("Notification" in window) {
      const res = await Notification.requestPermission();
      setNotifPermission(res);
    }
  };

  const handleCreateReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !dateTime) return;

    const targetTime = new Date(dateTime).getTime();
    if (isNaN(targetTime)) return;

    SpaceScheduleEngine.saveReminder({
      title: title.trim(),
      scheduledFor: targetTime,
      category,
      playAlarm: alarmSound,
    });

    setTitle("");
    setDateTime("");
    setShowAddModal(false);
  };

  const handleDelete = (id: string) => {
    SpaceScheduleEngine.deleteReminder(id);
  };

  const handleToggleComplete = (id: string) => {
    SpaceScheduleEngine.markCompleted(id);
  };

  const upcoming = reminders
    .filter((r) => !r.isCompleted && r.scheduledFor >= Date.now() - 60000)
    .sort((a, b) => a.scheduledFor - b.scheduledFor);

  const past = reminders
    .filter((r) => r.isCompleted || r.scheduledFor < Date.now() - 60000)
    .sort((a, b) => b.scheduledFor - a.scheduledFor);

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 bg-[#14151a] rounded-2xl border border-white/5">
        <div>
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-lime-400" />
            <h2 className="text-xl font-bold text-white tracking-tight">My Schedule & Alarms</h2>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Personal calendar for live events, classes, meetings, and preparation alarms.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {notifPermission !== "granted" && "Notification" in window && (
            <button
              onClick={requestPermission}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-xl hover:bg-amber-500/20 transition-colors"
            >
              <Bell className="w-3.5 h-3.5" />
              Enable Notifications
            </button>
          )}

          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-lime-400 text-black text-xs font-bold rounded-xl hover:bg-lime-300 transition-colors shadow-lg shadow-lime-400/20"
          >
            <Plus className="w-4 h-4" />
            Add Alarm / Event
          </button>
        </div>
      </div>

      {/* Upcoming Section */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-4 h-4 text-lime-400" />
          Upcoming Sessions & Alarms ({upcoming.length})
        </h3>

        {upcoming.length === 0 ? (
          <div className="p-8 text-center rounded-2xl border border-dashed border-white/10 bg-[#0f1014]">
            <Calendar className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-zinc-300">No upcoming events scheduled</p>
            <p className="text-xs text-zinc-500 mt-1">
              Add your classes, study hours, or live broadcast alarms to stay on track.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {upcoming.map((item) => {
              const diffMs = item.scheduledFor - Date.now();
              const isImminent = diffMs > 0 && diffMs < 1000 * 60 * 30; // within 30 min
              const formattedDate = new Date(item.scheduledFor).toLocaleString(undefined, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              });

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    isImminent
                      ? "bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/10"
                      : "bg-[#14151a] border-white/5 hover:border-white/10"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 rounded-xl bg-white/5 flex items-center justify-center shrink-0">
                        {item.category === "live" && <Radio className="w-4 h-4 text-rose-400" />}
                        {item.category === "class" && <BookOpen className="w-4 h-4 text-blue-400" />}
                        {item.category === "prep" && <Clock className="w-4 h-4 text-purple-400" />}
                        {item.category !== "live" && item.category !== "class" && item.category !== "prep" && (
                          <Bell className="w-4 h-4 text-lime-400" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white">{item.title}</h4>
                        <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400">
                          <span>{formattedDate}</span>
                          {item.playAlarm && (
                            <span className="flex items-center gap-1 text-[10px] text-lime-400 bg-lime-400/10 px-2 py-0.5 rounded-full">
                              <Volume2 className="w-2.5 h-2.5" />
                              Alarm
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleToggleComplete(item.id)}
                        title="Mark complete"
                        className="p-2 text-zinc-400 hover:text-lime-400 hover:bg-white/5 rounded-lg transition-colors"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(item.id)}
                        title="Delete reminder"
                        className="p-2 text-zinc-400 hover:text-rose-400 hover:bg-white/5 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Completed / Past Section */}
      {past.length > 0 && (
        <div className="space-y-3 pt-4 border-t border-white/5">
          <h3 className="text-sm font-semibold text-zinc-500 uppercase tracking-wider">
            Past / Completed ({past.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 opacity-60">
            {past.map((item) => (
              <div
                key={item.id}
                className="p-3 bg-[#111216] rounded-xl border border-white/5 flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-zinc-500" />
                  <span className="text-zinc-300 line-through">{item.title}</span>
                </div>
                <button
                  onClick={() => handleDelete(item.id)}
                  className="p-1 text-zinc-500 hover:text-rose-400"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Reminder Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#14151a] border border-white/10 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-lime-400" />
              Schedule Reminder or Alarm
            </h3>

            <form onSubmit={handleCreateReminder} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Title / Event Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Physics Prep Class or Live Q&A"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-lime-400"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Date & Time</label>
                <input
                  type="datetime-local"
                  required
                  value={dateTime}
                  onChange={(e) => setDateTime(e.target.value)}
                  className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-lime-400"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-zinc-300 block mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                  className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-sm text-white focus:outline-none focus:border-lime-400"
                >
                  <option value="live">Live Stream</option>
                  <option value="class">Classroom Lesson</option>
                  <option value="prep">Prep / Exam Focus</option>
                  <option value="meeting">Group Call / Meeting</option>
                  <option value="other">Personal Reminder</option>
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="alarmSoundCheck"
                  checked={alarmSound}
                  onChange={(e) => setAlarmSound(e.target.checked)}
                  className="rounded text-lime-400 focus:ring-lime-400 bg-black/50 border-white/10"
                />
                <label htmlFor="alarmSoundCheck" className="text-xs text-zinc-300 cursor-pointer">
                  Play audible audio alert when alarm triggers
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 text-xs font-medium text-zinc-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-lime-400 text-black rounded-xl hover:bg-lime-300 transition-colors shadow-lg shadow-lime-400/20"
                >
                  Save Schedule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
