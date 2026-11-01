import { useState } from "react";
import {
  Mic,
  MicOff,
  Hand,
  Volume2,
  VolumeX,
  UserX,
  Users,
  Shield,
  Crown,
  AlertCircle,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import type { ClassMember, ClassRole } from "@/lib/class/types";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";
import { toast } from "sonner";

interface Props {
  members: ClassMember[];
  currentUserId: string;
  role: ClassRole;
  isMicActive: boolean;
  myAudioLevel: number; // 0.0 to 1.0
  isHandRaised: boolean;
  micError: string | null;
  onToggleMic: () => void;
  onToggleHand: () => void;
  onMuteAll: () => void;
  onMuteMember: (userId: string) => void;
  onRemoveMember: (userId: string) => void;
  onCallOnStudent: (userId: string) => void;
}

export function ClassVoiceGrid({
  members,
  currentUserId,
  role,
  isMicActive,
  myAudioLevel,
  isHandRaised,
  micError,
  onToggleMic,
  onToggleHand,
  onMuteAll,
  onMuteMember,
  onRemoveMember,
  onCallOnStudent,
}: Props) {
  const canModerate = role === "lecturer" || role === "co_host";
  const [selectedMember, setSelectedMember] = useState<ClassMember | null>(null);

  // Filter members with hands raised for the lecturer queue
  const handRaisedQueue = members.filter((m) => m.hand_raised);

  return (
    <div className="flex flex-col h-full rounded-[18px] bg-[#141417] border border-[#2a2a32] overflow-hidden shadow-lg">
      {/* Header with Member Count & Lecturer Moderation */}
      <div className="p-3.5 border-b border-[#2a2a32] flex items-center justify-between gap-2 shrink-0 bg-black/20">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-[#4a5cff]" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
            Class Voice & Grid ({members.length})
          </h3>
        </div>

        {canModerate && (
          <button
            type="button"
            onClick={() => {
              void triggerMediumHaptic();
              onMuteAll();
            }}
            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/40 text-zinc-300 hover:text-rose-400 text-xs font-mono font-bold transition flex items-center gap-1 active:scale-95"
            title="Mute all students"
          >
            <VolumeX className="w-3.5 h-3.5" />
            <span>Mute All</span>
          </button>
        )}
      </div>

      {/* Mic Permission Warning Alert */}
      {micError && (
        <div className="p-3 mx-3 mt-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>{micError}</span>
        </div>
      )}

      {/* Hand Raise Queue Banner (Visible to Lecturer/Co-Host) */}
      {canModerate && handRaisedQueue.length > 0 && (
        <div className="p-3 bg-[#4a5cff]/10 border-b border-[#4a5cff]/30 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono">
            <span className="font-bold text-[#8898ff] flex items-center gap-1.5">
              <Hand className="w-3.5 h-3.5 animate-bounce text-[#C5E863]" />
              Hand-Raise Queue ({handRaisedQueue.length})
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto no-scrollbar">
            {handRaisedQueue.map((student) => (
              <div
                key={student.id}
                className="px-2.5 py-1 rounded-full bg-black/60 border border-white/10 text-xs text-white flex items-center gap-2"
              >
                <span className="truncate max-w-[90px]">{student.name}</span>
                <button
                  type="button"
                  onClick={() => onCallOnStudent(student.user_id)}
                  className="text-[10px] px-2 py-0.5 rounded-full bg-[#4a5cff] hover:bg-[#3d4ee6] text-white font-bold transition active:scale-95"
                >
                  Call
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* People Grid */}
      <div className="flex-1 p-3 overflow-y-auto grid grid-cols-2 gap-2 content-start no-scrollbar">
        {members.map((member) => {
          const isMe = member.user_id === currentUserId;
          const level = isMe ? myAudioLevel : member.audio_level || 0;
          const isSpeaking = level > 0.08 && !member.is_muted;

          return (
            <div
              key={member.id}
              className={`relative p-3 rounded-[14px] bg-black/30 border transition-all flex flex-col items-center justify-center text-center gap-2 ${
                isSpeaking
                  ? "border-[#4a5cff] shadow-[0_0_15px_rgba(74,92,255,0.3)] bg-[#4a5cff]/5"
                  : "border-[#2a2a32]"
              }`}
            >
              {/* Avatar with Audio Amplitude Speaking Ring */}
              <div className="relative">
                <div
                  className="rounded-full transition-transform duration-75"
                  style={{
                    boxShadow: isSpeaking
                      ? `0 0 ${Math.round(level * 25)}px rgba(74, 92, 255, ${Math.min(1, level * 1.5)})`
                      : "none",
                    transform: isSpeaking ? `scale(${1 + level * 0.12})` : "scale(1)",
                  }}
                >
                  <Avatar
                    url={member.avatar_url}
                    name={member.name}
                    size={46}
                    className="!rounded-full"
                  />
                </div>

                {/* Hand Raised Badge */}
                {member.hand_raised && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-[#C5E863] text-black grid place-items-center animate-bounce shadow-md">
                    <Hand className="w-3 h-3" />
                  </span>
                )}

                {/* Mic Status Badge */}
                <span
                  className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border border-black grid place-items-center shadow-md ${
                    member.is_muted
                      ? "bg-rose-500/80 text-white"
                      : "bg-[#4a5cff] text-white"
                  }`}
                >
                  {member.is_muted ? (
                    <MicOff className="w-2.5 h-2.5" />
                  ) : (
                    <Mic className="w-2.5 h-2.5" />
                  )}
                </span>
              </div>

              {/* Name & Role */}
              <div className="min-w-0 w-full">
                <div className="text-xs font-bold text-white truncate flex items-center justify-center gap-1">
                  <span>{member.name}</span>
                  {member.role === "lecturer" && (
                    <Crown className="w-3 h-3 text-[#ff4f8b] shrink-0" />
                  )}
                </div>
                <div className="text-[10px] font-mono text-zinc-500 uppercase tracking-wider">
                  {member.role}
                </div>
              </div>

              {/* Moderator Controls on Hover/Select */}
              {canModerate && !isMe && member.role !== "lecturer" && (
                <div className="flex items-center gap-1 mt-1">
                  <button
                    type="button"
                    onClick={() => onMuteMember(member.user_id)}
                    className="p-1 rounded-md bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white transition"
                    title={member.is_muted ? "Unmute" : "Mute student"}
                  >
                    {member.is_muted ? (
                      <Volume2 className="w-3 h-3" />
                    ) : (
                      <VolumeX className="w-3 h-3 text-rose-400" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => onRemoveMember(member.user_id)}
                    className="p-1 rounded-md bg-white/5 hover:bg-rose-500/20 text-zinc-400 hover:text-rose-400 transition"
                    title="Remove from room"
                  >
                    <UserX className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Sticky Bottom Control Bar: Mic + Live Meter & Hand Raise */}
      <div className="p-3 border-t border-[#2a2a32] bg-black/40 flex items-center gap-2">
        {/* Mic Button with Live Level Meter */}
        <button
          type="button"
          onClick={onToggleMic}
          className={`flex-1 py-2.5 px-3 rounded-[12px] font-mono font-bold text-xs flex items-center justify-center gap-2 transition active:scale-95 border ${
            isMicActive
              ? "bg-[#4a5cff] text-white border-white/20 shadow-[0_0_15px_rgba(74,92,255,0.4)]"
              : "bg-white/5 text-zinc-400 border-white/10 hover:text-white"
          }`}
          title="Toggle Microphone (Hotkey: M)"
        >
          {isMicActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
          <span>{isMicActive ? "Mute" : "Unmute"}</span>

          {/* Real Audio Level Bar Indicator */}
          {isMicActive && (
            <div className="w-8 h-2 rounded-full bg-black/50 overflow-hidden ml-1 border border-white/20">
              <div
                className="h-full bg-[#C5E863] transition-all duration-75"
                style={{ width: `${Math.round(myAudioLevel * 100)}%` }}
              />
            </div>
          )}
        </button>

        {/* Hand Raise Button for Students */}
        <button
          type="button"
          onClick={onToggleHand}
          className={`py-2.5 px-3 rounded-[12px] font-mono font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95 border ${
            isHandRaised
              ? "bg-[#C5E863] text-black border-[#C5E863] shadow-[0_0_15px_rgba(197,232,99,0.4)]"
              : "bg-white/5 text-zinc-400 border-white/10 hover:text-white"
          }`}
          title="Raise Hand (Hotkey: H)"
        >
          <Hand className="w-4 h-4" />
          <span>{isHandRaised ? "Lower" : "Raise"}</span>
        </button>
      </div>
    </div>
  );
}
