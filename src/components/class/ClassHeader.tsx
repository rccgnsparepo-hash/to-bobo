import { useState, useEffect } from "react";
import { Copy, Check, Radio, LogOut, Share2, Sparkles, Shield, User } from "lucide-react";
import type { ClassRole } from "@/lib/class/types";
import { toast } from "sonner";
import { triggerLightHaptic } from "@/lib/haptics";

interface Props {
  roomTitle: string;
  courseCode?: string | null;
  joinCode: string;
  role: ClassRole;
  isLive: boolean;
  onLeaveRoom: () => void;
  onRoleSwitch?: (role: ClassRole) => void;
}

export function ClassHeader({
  roomTitle,
  courseCode,
  joinCode,
  role,
  isLive,
  onLeaveRoom,
  onRoleSwitch,
}: Props) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [secondsElapsed, setSecondsElapsed] = useState(0);

  // Live Timer
  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsElapsed((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTimer = (totalSeconds: number) => {
    const hrs = Math.floor(totalSeconds / 3600);
    const mins = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
    }
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const copyCode = async () => {
    void triggerLightHaptic();
    await navigator.clipboard.writeText(joinCode);
    setCopiedCode(true);
    toast.success(`Copied room code: ${joinCode}`);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyInviteLink = async () => {
    void triggerLightHaptic();
    const link = `${window.location.origin}/class/${joinCode}`;
    await navigator.clipboard.writeText(link);
    setCopiedLink(true);
    toast.success("Copied private room invite link!");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <header className="h-16 border-b border-[#2a2a32] bg-[#141417]/80 backdrop-blur-xl px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0 select-none text-white">
      {/* Left: Brand & Room Identity */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex items-center gap-2 shrink-0">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff4f8b] animate-ping" />
          <span className="font-bricolage text-base sm:text-lg tracking-tight uppercase text-white font-extrabold hidden md:inline">
            Flick Class
          </span>
        </div>

        <div className="h-5 w-px bg-[#2a2a32] hidden md:block" />

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {courseCode && (
              <span className="px-2 py-0.5 rounded-full bg-[#4a5cff]/20 text-[#8898ff] border border-[#4a5cff]/40 text-[10px] font-mono font-bold uppercase tracking-wider shrink-0">
                {courseCode}
              </span>
            )}
            <h2 className="text-xs sm:text-sm font-bold truncate text-zinc-100">
              {roomTitle}
            </h2>
          </div>
        </div>
      </div>

      {/* Middle: Live Timer & Join Code Pill */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="px-3 py-1 rounded-full bg-black/60 border border-[#2a2a32] text-xs font-mono font-semibold flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#ff4f8b] animate-pulse" />
          <span className="text-zinc-300">{formatTimer(secondsElapsed)}</span>
        </div>

        {/* 6-Character Join Code Badge with 1-Click Copy */}
        <button
          type="button"
          onClick={copyCode}
          className="px-3 py-1 rounded-full bg-[#4a5cff]/15 hover:bg-[#4a5cff]/25 border border-[#4a5cff]/40 text-xs font-mono font-bold text-[#8898ff] flex items-center gap-1.5 transition active:scale-95"
          title="Click to copy join code"
        >
          <span>CODE: {joinCode}</span>
          {copiedCode ? <Check className="w-3 h-3 text-[#C5E863]" /> : <Copy className="w-3 h-3" />}
        </button>

        <button
          type="button"
          onClick={copyInviteLink}
          className="hidden sm:flex p-1.5 rounded-full bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white transition active:scale-95"
          title="Copy invite link"
          aria-label="Copy invite link"
        >
          {copiedLink ? <Check className="w-3.5 h-3.5 text-[#C5E863]" /> : <Share2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Right: Role Switch & Leave */}
      <div className="flex items-center gap-2.5 shrink-0">
        {/* Role Pill */}
        <div className="px-2.5 py-1 rounded-full bg-black/50 border border-white/10 text-xs font-mono font-bold text-zinc-300 uppercase tracking-wider flex items-center gap-1">
          {role === "lecturer" ? (
            <Shield className="w-3.5 h-3.5 text-[#ff4f8b]" />
          ) : (
            <User className="w-3.5 h-3.5 text-[#4a5cff]" />
          )}
          <span>{role}</span>
        </div>

        {/* Quick Role Switcher for Testing/Co-host Demo */}
        {onRoleSwitch && (
          <select
            value={role}
            onChange={(e) => onRoleSwitch(e.target.value as ClassRole)}
            className="hidden lg:block bg-black/60 border border-[#2a2a32] text-[11px] font-mono rounded-lg px-2 py-1 text-zinc-300 focus:outline-none"
            title="Switch testing role"
          >
            <option value="lecturer">Role: Lecturer</option>
            <option value="student">Role: Student</option>
            <option value="co_host">Role: Co-host</option>
          </select>
        )}

        {/* Leave Room Button */}
        <button
          type="button"
          onClick={onLeaveRoom}
          className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/40 text-xs font-mono font-bold text-zinc-300 hover:text-rose-400 flex items-center gap-1.5 transition active:scale-95"
          title="Leave Lecture"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Leave</span>
        </button>
      </div>
    </header>
  );
}
