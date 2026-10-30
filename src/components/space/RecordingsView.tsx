import { useState, useEffect, useRef } from "react";
import {
  Mic,
  MicOff,
  Play,
  Pause,
  Download,
  Trash2,
  Share2,
  Clock,
  Sparkles,
  FileAudio,
  Radio,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";
import { useAuth } from "@/lib/auth";
import { StudioAudioRecorder } from "@/lib/space/audioRecorder";
import { SpaceService } from "@/lib/space/spaceService";
import type { AudioRecording } from "@/lib/space/types";

export function RecordingsView() {
  const { user, profile } = useAuth();
  const [recordings, setRecordings] = useState<AudioRecording[]>(() => SpaceService.getRecordings());
  const [recorderState, setRecorderState] = useState<"inactive" | "recording" | "paused">("inactive");
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [waveformLevels, setWaveformLevels] = useState<number[]>(new Array(16).fill(10));
  const [playingId, setPlayingId] = useState<string | null>(null);

  const recorderRef = useRef<StudioAudioRecorder | null>(null);
  const timerIntervalRef = useRef<number | null>(null);
  const visualizerIntervalRef = useRef<number | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    const sync = () => setRecordings(SpaceService.getRecordings());
    window.addEventListener("flick:space-recordings-updated", sync);
    return () => window.removeEventListener("flick:space-recordings-updated", sync);
  }, []);

  const handleStartRecord = async () => {
    try {
      void triggerMediumHaptic();
      const rec = new StudioAudioRecorder();
      recorderRef.current = rec;
      await rec.start();
      setRecorderState("recording");
      setRecordSeconds(0);

      // Timer
      timerIntervalRef.current = window.setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);

      // Visualizer Waveform poller
      visualizerIntervalRef.current = window.setInterval(() => {
        if (rec.getState() === "recording") {
          const raw = rec.getWaveformData();
          const slices = [
            raw[0] || 10,
            raw[2] || 15,
            raw[4] || 25,
            raw[6] || 40,
            raw[8] || 30,
            raw[10] || 20,
            raw[12] || 15,
            raw[14] || 10,
          ];
          setWaveformLevels(slices);
        }
      }, 120);

      toast("Studio recording active. Speak into your microphone.");
    } catch (e) {
      toast.error(`Recording failed: ${(e as Error).message}`);
    }
  };

  const handlePauseResume = () => {
    if (!recorderRef.current) return;
    void triggerLightHaptic();
    if (recorderState === "recording") {
      recorderRef.current.pause();
      setRecorderState("paused");
      toast("Recording paused");
    } else if (recorderState === "paused") {
      recorderRef.current.resume();
      setRecorderState("recording");
      toast("Recording resumed");
    }
  };

  const handleStopAndSave = async () => {
    if (!recorderRef.current) return;
    void triggerMediumHaptic();

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    if (visualizerIntervalRef.current) clearInterval(visualizerIntervalRef.current);

    try {
      const { blob, durationSeconds } = await recorderRef.current.stop();
      const localUrl = URL.createObjectURL(blob);

      const title = `Audio Session ${new Date().toLocaleDateString([], {
        month: "short",
        day: "numeric",
      })} ${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;

      SpaceService.saveRecording({
        userId: user?.id || "me",
        userName: profile?.display_name || "Creator",
        title,
        category: "voice_note",
        audioUrl: localUrl,
        durationSeconds,
        isPrivate: false,
        fileSizeBytes: blob.size,
      });

      setRecorderState("inactive");
      setRecordSeconds(0);
      setWaveformLevels(new Array(16).fill(10));
      toast.success("Recording saved to your authorized Space vault! 🎙️");
    } catch (e) {
      toast.error("Failed to stop recording");
      setRecorderState("inactive");
    }
  };

  const handlePlayToggle = (rec: AudioRecording) => {
    void triggerLightHaptic();
    if (playingId === rec.id) {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      setPlayingId(null);
    } else {
      if (audioPlayerRef.current) {
        audioPlayerRef.current.pause();
      }
      const audio = new Audio(rec.audioUrl);
      audioPlayerRef.current = audio;
      audio.onended = () => setPlayingId(null);
      audio.play().catch(() => {});
      setPlayingId(rec.id);
    }
  };

  const handleDownload = (rec: AudioRecording) => {
    void triggerLightHaptic();
    const a = document.createElement("a");
    a.href = rec.audioUrl;
    a.download = `${rec.title.replace(/\s+/g, "_")}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("Recording downloaded to your device");
  };

  const formatSeconds = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="flex-1 w-full h-full overflow-y-auto no-scrollbar p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Studio Recorder Deck */}
      <div className="rounded-3xl bg-gradient-to-r from-purple-950/70 via-zinc-900 to-rose-950/60 border border-purple-500/30 p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xl">
        <div className="space-y-2 text-center md:text-left max-w-lg">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/20 text-purple-400 font-bold text-xs border border-purple-500/30">
            <Radio className="w-3.5 h-3.5" />
            <span>STUDIO VOICE & AUDIO RECORDER</span>
          </div>
          <h2 className="font-display font-bold text-2xl sm:text-3xl text-white tracking-tight">
            Record, preview & store audio
          </h2>
          <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
            Capture high-quality audio sessions, lecture recaps, and personal voice thoughts with live waveform monitoring.
          </p>
        </div>

        {/* Live Recorder Deck Control */}
        <div className="p-4 rounded-2xl bg-black/50 border border-white/10 backdrop-blur-md flex flex-col items-center gap-3 w-full md:w-auto">
          {/* Waveform Bar & Timer */}
          <div className="flex items-center gap-3">
            <span className="font-mono font-bold text-lg text-white min-w-[50px]">
              {formatSeconds(recordSeconds)}
            </span>

            {/* Dynamic Waveform Visualizer */}
            <div className="flex items-center gap-1 h-8">
              {waveformLevels.map((lvl, i) => (
                <div
                  key={i}
                  className={`w-1.5 rounded-full transition-all duration-100 ${
                    recorderState === "recording"
                      ? "bg-purple-500"
                      : recorderState === "paused"
                      ? "bg-amber-500"
                      : "bg-zinc-700"
                  }`}
                  style={{
                    height: recorderState === "recording" ? `${Math.max(6, (lvl / 255) * 32)}px` : "6px",
                  }}
                />
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            {recorderState === "inactive" ? (
              <button
                type="button"
                onClick={handleStartRecord}
                className="px-5 py-2.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md shadow-purple-600/30 transition active:scale-95 flex items-center gap-2"
              >
                <Mic className="w-4 h-4" />
                <span>Start Recording</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handlePauseResume}
                  className="px-3.5 py-2 rounded-full bg-secondary hover:bg-secondary/80 text-foreground font-bold text-xs border border-border transition active:scale-95"
                >
                  {recorderState === "recording" ? "Pause" : "Resume"}
                </button>
                <button
                  type="button"
                  onClick={handleStopAndSave}
                  className="px-4 py-2 rounded-full bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition active:scale-95"
                >
                  Stop & Save
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Authorized Saved Recordings Vault */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
            <FileAudio className="w-4 h-4 text-purple-500" />
            <span>Authorized Recordings Vault</span>
          </h3>
          <span className="text-xs text-muted-foreground font-mono">
            {recordings.length} saved sessions
          </span>
        </div>

        {recordings.length === 0 ? (
          <div className="py-16 text-center space-y-3 rounded-3xl bg-card border border-border p-8 max-w-md mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-purple-500/10 text-purple-500 grid place-items-center mx-auto">
              <Mic className="w-7 h-7" />
            </div>
            <h4 className="font-display font-bold text-base text-foreground">No recordings saved</h4>
            <p className="text-xs text-muted-foreground">
              Hit "Start Recording" above to record a voice session, lecture note, or study summary.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recordings.map((rec) => {
              const isPlaying = playingId === rec.id;
              return (
                <div
                  key={rec.id}
                  className="p-5 rounded-3xl bg-card border border-border space-y-4 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-500">
                        {rec.category}
                      </span>
                      <span className="text-muted-foreground font-mono">
                        {formatSeconds(rec.durationSeconds)}
                      </span>
                    </div>
                    <h4 className="font-display font-bold text-sm text-foreground truncate">
                      {rec.title}
                    </h4>
                    <span className="text-[10px] text-muted-foreground block font-mono">
                      Recorded {new Date(rec.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Player & File Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-border">
                    <button
                      type="button"
                      onClick={() => handlePlayToggle(rec)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-bold text-xs transition active:scale-95 ${
                        isPlaying
                          ? "bg-purple-600 text-white shadow-sm"
                          : "bg-secondary text-foreground hover:bg-secondary/80 border border-border"
                      }`}
                    >
                      {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                      <span>{isPlaying ? "Playing…" : "Play Audio"}</span>
                    </button>

                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDownload(rec)}
                        className="p-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground transition active:scale-95"
                        title="Download audio file"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void triggerLightHaptic();
                          SpaceService.deleteRecording(rec.id);
                          toast("Recording deleted");
                        }}
                        className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 transition active:scale-95"
                        title="Delete recording"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
