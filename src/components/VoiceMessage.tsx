import { useEffect, useState } from "react";
import { Play, Pause, Mic } from "lucide-react";
import {
  subscribeGlobalAudio,
  playGlobalAudio,
  toggleGlobalAudio,
  seekGlobalAudio,
  type GlobalAudioState,
} from "@/lib/globalAudio";

// Pseudo-waveform — stable bars derived from URL so it looks consistent per clip.
function bars(seed: string, count = 38) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    h = (h * 1103515245 + 12345) & 0x7fffffff;
    out.push(0.25 + ((h % 75) / 100));
  }
  return out;
}

export function VoiceMessage({
  src,
  mine,
  senderName,
  senderAvatar,
}: {
  src: string;
  mine?: boolean;
  senderName?: string;
  senderAvatar?: string | null;
}) {
  const [globalState, setGlobalState] = useState<GlobalAudioState | null>(null);
  const wf = bars(src);

  useEffect(() => {
    const unsub = subscribeGlobalAudio(setGlobalState);
    return unsub;
  }, []);

  const isCurrentAudio = globalState?.src === src;
  const isPlaying = Boolean(isCurrentAudio && globalState?.isPlaying);
  const progress = isCurrentAudio ? globalState?.progress || 0 : 0;
  const duration = isCurrentAudio ? globalState?.duration || 0 : 0;
  const currentTime = isCurrentAudio ? globalState?.currentTime || 0 : 0;

  const toggle = () => {
    if (isCurrentAudio) {
      toggleGlobalAudio();
    } else {
      playGlobalAudio({
        src,
        title: "Voice Message",
        senderName: senderName || (mine ? "You" : "Voice Message"),
        senderAvatar: senderAvatar || null,
      });
    }
  };

  const fmt = (s: number) => {
    if (!isFinite(s) || s < 0) return "0:00";
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const handleSeek = (i: number) => {
    if (isCurrentAudio) {
      seekGlobalAudio(i / wf.length);
    } else {
      playGlobalAudio({
        src,
        title: "Voice Message",
        senderName: senderName || (mine ? "You" : "Voice Message"),
        senderAvatar: senderAvatar || null,
      });
    }
  };

  return (
    <div className={`flex items-center gap-3 min-w-[220px] max-w-[300px] py-1.5 ${mine ? "" : ""}`}>
      <button
        type="button"
        onClick={toggle}
        className={`w-9 h-9 rounded-full grid place-items-center shrink-0 transition shadow-sm ${
          mine ? "bg-snap-foreground/20 text-snap-foreground hover:bg-snap-foreground/30" : "bg-snap text-snap-foreground hover:opacity-90"
        }`}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current translate-x-[1px]" />}
      </button>

      <div className="flex items-end gap-[2px] h-7 flex-1 cursor-pointer">
        {wf.map((h, i) => {
          const active = i / wf.length <= progress;
          return (
            <span
              key={i}
              onClick={() => handleSeek(i)}
              className={`w-[3px] rounded-full transition-colors hover:opacity-80 ${
                active
                  ? mine
                    ? "bg-snap-foreground"
                    : "bg-snap"
                  : mine
                    ? "bg-snap-foreground/40"
                    : "bg-muted-foreground/40"
              }`}
              style={{ height: `${h * 100}%` }}
            />
          );
        })}
      </div>

      <div className="text-[11px] tabular-nums opacity-80 flex items-center gap-1 shrink-0 font-mono">
        <Mic className="w-3 h-3 text-snap" />
        {fmt(isPlaying ? currentTime : duration)}
      </div>
    </div>
  );
}