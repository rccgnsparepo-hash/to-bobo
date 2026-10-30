import { useState, useEffect } from "react";
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Trash2,
  Sparkles,
  AlarmClock,
  Clock,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";
import { playSound } from "@/lib/soundEngine";
import { SpaceScheduleEngine } from "@/lib/space/scheduleEngine";
import type { PrepStudyGoal } from "@/lib/space/types";

export function PrepClassView() {
  // Pomodoro focus timer: 25 mins = 1500 seconds
  const [timerSeconds, setTimerSeconds] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [timerMode, setTimerMode] = useState<"focus" | "break">("focus");

  // Study goals
  const [goals, setGoals] = useState<PrepStudyGoal[]>(() => {
    try {
      return JSON.parse(
        localStorage.getItem("flick:prep_goals") ||
          JSON.stringify([
            { id: "g1", title: "Review Chapter 4 Algorithms & Big-O", completed: true },
            { id: "g2", title: "Practice 5 past exam questions", completed: false },
            { id: "g3", title: "Summarize lecture notes into key formulas", completed: false },
          ])
      );
    } catch {
      return [];
    }
  });
  const [newGoalText, setNewGoalText] = useState("");

  // Revision notes
  const [notes, setNotes] = useState(() => localStorage.getItem("flick:prep_notes") || "");

  // Timer interval
  useEffect(() => {
    let interval: number | null = null;
    if (isRunning && timerSeconds > 0) {
      interval = window.setInterval(() => {
        setTimerSeconds((prev) => prev - 1);
      }, 1000);
    } else if (isRunning && timerSeconds === 0) {
      // Completed timer block
      try {
        playSound("notification_chime");
      } catch {}

      if (timerMode === "focus") {
        toast.success("Focus study block complete! Take a 5-minute break. ☕");
        setTimerMode("break");
        setTimerSeconds(5 * 60);
      } else {
        toast.success("Break complete! Ready for next focus session? 📚");
        setTimerMode("focus");
        setTimerSeconds(25 * 60);
      }
      setIsRunning(false);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning, timerSeconds, timerMode]);

  const toggleGoal = (id: string) => {
    void triggerLightHaptic();
    const updated = goals.map((g) => (g.id === id ? { ...g, completed: !g.completed } : g));
    setGoals(updated);
    localStorage.setItem("flick:prep_goals", JSON.stringify(updated));
  };

  const handleAddGoal = () => {
    if (!newGoalText.trim()) return;
    void triggerLightHaptic();
    const newGoal: PrepStudyGoal = {
      id: `g_${Date.now()}`,
      title: newGoalText.trim(),
      completed: false,
    };
    const updated = [...goals, newGoal];
    setGoals(updated);
    localStorage.setItem("flick:prep_goals", JSON.stringify(updated));
    setNewGoalText("");
  };

  const handleDeleteGoal = (id: string) => {
    const updated = goals.filter((g) => g.id !== id);
    setGoals(updated);
    localStorage.setItem("flick:prep_goals", JSON.stringify(updated));
  };

  const formatTimer = (totalSeconds: number) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleSetStudyAlarm = () => {
    void triggerMediumHaptic();
    SpaceScheduleEngine.saveReminder({
      userId: "me",
      title: "Exam Revision Session (Pomodoro)",
      targetType: "prep",
      triggerTime: Date.now() + 1000 * 60 * 30, // 30 minutes from now
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      isRecurring: false,
      soundEnabled: true,
    });
    toast.success("Native study alarm set for 30 minutes from now! ⏰");
  };

  const completedCount = goals.filter((g) => g.completed).length;

  return (
    <div className="flex-1 w-full h-full overflow-y-auto no-scrollbar p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-emerald-950/70 via-zinc-900 to-teal-950/60 border border-emerald-500/30 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="space-y-2 text-center sm:text-left max-w-xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs border border-emerald-500/30">
            <BookOpen className="w-3.5 h-3.5" />
            <span>EXAM & CERTIFICATION PREPARATION</span>
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-white tracking-tight">
            Prep Class & Revision Mode
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            Timed study blocks, syllabus checklist, and revision scratchpad to stay disciplined ahead of campus tests and exams.
          </p>
        </div>

        <button
          type="button"
          onClick={handleSetStudyAlarm}
          className="py-3 px-5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/25 active:scale-95 transition flex items-center gap-2 shrink-0"
        >
          <AlarmClock className="w-4 h-4" />
          <span>Set Revision Alarm</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Pomodoro Focus Timer */}
        <div className="p-6 rounded-3xl bg-card border border-border flex flex-col items-center justify-between text-center space-y-5">
          <div className="space-y-1">
            <span className="text-[10px] font-bold font-mono uppercase px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              {timerMode === "focus" ? "🎯 Focus Session" : "☕ Short Break"}
            </span>
            <h3 className="font-display font-bold text-lg text-foreground">
              Pomodoro Timer
            </h3>
          </div>

          {/* Clock Display */}
          <div className="w-48 h-48 rounded-full border-4 border-emerald-500/30 bg-emerald-500/5 flex flex-col items-center justify-center shadow-inner relative">
            <span className="text-5xl font-mono font-bold tracking-tight text-foreground">
              {formatTimer(timerSeconds)}
            </span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">
              {timerMode === "focus" ? "Remaining" : "Break"}
            </span>
          </div>

          {/* Timer Controls */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                void triggerLightHaptic();
                setIsRunning(!isRunning);
              }}
              className={`py-2.5 px-6 rounded-2xl font-bold text-xs shadow-md transition active:scale-95 flex items-center gap-2 ${
                isRunning
                  ? "bg-secondary text-foreground hover:bg-secondary/80 border border-border"
                  : "bg-emerald-600 hover:bg-emerald-500 text-white"
              }`}
            >
              {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span>{isRunning ? "Pause" : "Start Focus"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                void triggerLightHaptic();
                setIsRunning(false);
                setTimerSeconds(timerMode === "focus" ? 25 * 60 : 5 * 60);
              }}
              className="p-2.5 rounded-2xl bg-secondary hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition active:scale-95"
              title="Reset Timer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center Column: Revision Goals Checklist */}
        <div className="p-6 rounded-3xl bg-card border border-border space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-display font-bold text-base text-foreground">
                Study Goals & Topics
              </h3>
              <p className="text-xs text-muted-foreground">
                {completedCount} of {goals.length} tasks completed
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-500">
              {goals.length > 0 ? Math.round((completedCount / goals.length) * 100) : 0}%
            </span>
          </div>

          {/* Progress Bar */}
          <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-300"
              style={{
                width: `${goals.length > 0 ? (completedCount / goals.length) * 100 : 0}%`,
              }}
            />
          </div>

          {/* Add Goal Input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newGoalText}
              onChange={(e) => setNewGoalText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddGoal();
              }}
              placeholder="Add revision topic or problem set…"
              className="w-full bg-secondary border border-border rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button
              type="button"
              onClick={handleAddGoal}
              className="p-2 rounded-xl bg-emerald-600 text-white shrink-0 hover:scale-105 active:scale-95 transition"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Goals List */}
          <div className="space-y-2 max-h-72 overflow-y-auto no-scrollbar">
            {goals.map((g) => (
              <div
                key={g.id}
                className="flex items-center justify-between p-2.5 rounded-xl bg-secondary/50 border border-border/60 text-xs transition"
              >
                <button
                  type="button"
                  onClick={() => toggleGoal(g.id)}
                  className="flex items-center gap-2.5 text-left min-w-0 flex-1"
                >
                  {g.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <span
                    className={`truncate ${
                      g.completed ? "line-through text-muted-foreground" : "text-foreground font-medium"
                    }`}
                  >
                    {g.title}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteGoal(g.id)}
                  className="p-1 text-muted-foreground hover:text-rose-500 transition"
                  title="Remove goal"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Revision Scratchpad */}
        <div className="p-6 rounded-3xl bg-card border border-border space-y-3 flex flex-col">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold text-base text-foreground">
              Revision Scratchpad
            </h3>
            <span className="text-[10px] text-muted-foreground">Auto-saved</span>
          </div>

          <textarea
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              localStorage.setItem("flick:prep_notes", e.target.value);
            }}
            placeholder="Jot down quick formulas, revision mnemonics, or question numbers to revisit…"
            className="flex-1 w-full bg-secondary border border-border rounded-2xl p-3 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none font-mono min-h-[220px]"
          />
        </div>
      </div>
    </div>
  );
}
