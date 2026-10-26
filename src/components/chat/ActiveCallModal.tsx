import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  PhoneOff,
  Volume2,
  VolumeX,
  RefreshCw,
  Minimize2,
  Maximize2,
  Sparkles,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { toast } from "sonner";

export type CallType = "audio" | "video";

interface ActiveCallModalProps {
  open: boolean;
  peer: {
    id: string;
    handle: string;
    display_name: string;
    avatar_url: string | null;
  };
  callType: CallType;
  onClose: (durationSeconds?: number) => void;
}

export function ActiveCallModal({ open, peer, callType: initialType, onClose }: ActiveCallModalProps) {
  const [callType, setCallType] = useState<CallType>(initialType);
  const [status, setStatus] = useState<"ringing" | "connecting" | "connected">("ringing");
  const [duration, setDuration] = useState(0);
  const [micMuted, setMicMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(initialType === "audio");
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [minimized, setMinimized] = useState(false);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const ringOscRef = useRef<OscillatorNode | null>(null);

  // Sync initial type when opened
  useEffect(() => {
    if (open) {
      setCallType(initialType);
      setVideoOff(initialType === "audio");
      setStatus("ringing");
      setDuration(0);
      setMinimized(false);
    }
  }, [open, initialType]);

  // Web Audio Ringtone Generator (no external audio files required)
  useEffect(() => {
    if (!open || status !== "ringing") return;

    let isCancelled = false;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;

        const playRing = () => {
          if (isCancelled || status !== "ringing" || ctx.state === "closed") return;
          try {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(440, ctx.currentTime);
            gain.gain.setValueAtTime(0.04, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.2);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 1.2);
            ringOscRef.current = osc;
          } catch {
            /* noop */
          }
        };

        playRing();
        const ringInterval = window.setInterval(playRing, 3000);

        return () => {
          isCancelled = true;
          window.clearInterval(ringInterval);
          try {
            ctx.close();
          } catch {
            /* noop */
          }
        };
      }
    } catch {
      /* AudioContext not allowed without gesture */
    }
  }, [open, status]);

  // Acquire MediaStream (Camera & Microphone)
  useEffect(() => {
    if (!open) return;

    let cancelled = false;

    async function initMedia() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          toast.info("Media devices not available. Running simulated call.");
          return;
        }

        const constraints: MediaStreamConstraints = {
          audio: true,
          video: callType === "video" ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" } : false,
        };

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        if (localVideoRef.current && callType === "video") {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.warn("Could not access camera/mic:", err);
        toast.info("Microphone or camera permission not granted. Connected in audio preview mode.");
      }
    }

    void initMedia();

    // Auto connect after 2.5 seconds ringing simulation
    const connectTimer = window.setTimeout(() => {
      if (!cancelled) {
        setStatus("connected");
      }
    }, 2800);

    return () => {
      cancelled = true;
      window.clearTimeout(connectTimer);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [open, callType]);

  // Duration Timer
  useEffect(() => {
    if (status === "connected") {
      timerRef.current = window.setInterval(() => {
        setDuration((d) => d + 1);
      }, 1000);
    } else {
      if (timerRef.current) window.clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [status]);

  // Toggle Microphone
  const toggleMic = () => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = micMuted;
      });
    }
    setMicMuted((prev) => !prev);
    toast.info(micMuted ? "Microphone unmuted" : "Microphone muted");
  };

  // Toggle Camera
  const toggleVideo = async () => {
    if (callType === "audio") {
      // Upgrade to video
      setCallType("video");
      setVideoOff(false);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        });
        if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        toast.success("Camera switched on");
      } catch {
        toast.error("Camera permission denied");
      }
    } else {
      if (streamRef.current) {
        streamRef.current.getVideoTracks().forEach((track) => {
          track.enabled = videoOff;
        });
      }
      setVideoOff((prev) => !prev);
      toast.info(videoOff ? "Video enabled" : "Video paused");
    }
  };

  const handleEndCall = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    const finalSec = duration;
    const formatted = formatCallDuration(finalSec);
    toast.success(`Call ended · ${formatted}`);
    onClose(finalSec);
  };

  const formatCallDuration = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const s = sec % 60;
    return `${mins.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] pointer-events-none flex items-center justify-center p-3 md:p-6 select-none font-sans">
        {/* Backdrop for full view */}
        {!minimized && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 backdrop-blur-2xl pointer-events-auto"
          />
        )}

        {/* Call Container (Full View or Floating Mini PiP) */}
        <motion.div
          layout
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{
            scale: 1,
            opacity: 1,
            y: 0,
            width: minimized ? 280 : "100%",
            maxWidth: minimized ? 280 : 540,
            height: minimized ? 140 : 660,
          }}
          exit={{ scale: 0.85, opacity: 0, y: 30 }}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          className={`pointer-events-auto relative rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col ${
            minimized
              ? "fixed bottom-5 right-5 bg-card/95 border-snap/40 z-[10001]"
              : "bg-gradient-to-b from-neutral-900 via-neutral-950 to-black max-h-[92vh] w-full"
          }`}
        >
          {/* Top Bar */}
          <div className="px-5 pt-4 pb-2 flex items-center justify-between z-20">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-snap animate-pulse" />
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {callType === "video" ? "Flick Video" : "Flick Voice"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMinimized((m) => !m)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center text-white transition"
                title={minimized ? "Expand" : "Minimize"}
              >
                {minimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Minimized PiP View */}
          {minimized ? (
            <div className="flex-1 p-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <Avatar url={peer.avatar_url} name={peer.display_name} size={42} ring />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-white truncate">{peer.display_name}</div>
                  <div className="text-xs text-snap font-medium">
                    {status === "connected" ? formatCallDuration(duration) : status}
                  </div>
                </div>
              </div>
              <button
                onClick={handleEndCall}
                className="w-10 h-10 rounded-full bg-red-600 hover:bg-red-700 text-white grid place-items-center shadow-lg shrink-0"
              >
                <PhoneOff className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              {/* Main Call Stage */}
              <div className="flex-1 relative flex flex-col items-center justify-center p-6 text-center z-10 overflow-hidden">
                {callType === "video" && !videoOff ? (
                  // Video feed container
                  <div className="absolute inset-0 bg-neutral-950 flex items-center justify-center">
                    {/* Simulated Peer Video background */}
                    <div className="relative w-full h-full flex flex-col items-center justify-center">
                      <Avatar url={peer.avatar_url} name={peer.display_name} size={110} ring />
                      <div className="mt-4 text-white font-bold text-lg">{peer.display_name}</div>
                      <div className="text-xs text-snap font-medium mt-1">
                        {status === "connected" ? "Live Encrypted Video" : "Connecting..."}
                      </div>
                    </div>

                    {/* Local Camera Self-View (Picture-in-Picture) */}
                    <div className="absolute top-4 right-4 w-28 h-40 rounded-2xl overflow-hidden shadow-2xl border-2 border-white/20 bg-black z-30">
                      <video
                        ref={localVideoRef}
                        autoPlay
                        playsInline
                        muted
                        onError={(e) => e.preventDefault()}
                        className="w-full h-full object-cover mirror"
                        style={{ transform: "scaleX(-1)" }}
                      />
                      {videoOff && (
                        <div className="absolute inset-0 bg-neutral-900 grid place-items-center text-xs text-muted-foreground">
                          Video off
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  // Voice Call Stage with dynamic ripple pulses
                  <div className="flex flex-col items-center justify-center space-y-6">
                    <div className="relative">
                      {status === "connected" && (
                        <>
                          <motion.div
                            animate={{ scale: [1, 1.4, 1], opacity: [0.4, 0, 0.4] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            className="absolute -inset-4 rounded-full bg-snap/20"
                          />
                          <motion.div
                            animate={{ scale: [1, 1.7, 1], opacity: [0.2, 0, 0.2] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
                            className="absolute -inset-8 rounded-full bg-snap/10"
                          />
                        </>
                      )}
                      <Avatar url={peer.avatar_url} name={peer.display_name} size={128} ring />
                    </div>

                    <div>
                      <h2 className="text-2xl font-bold text-white tracking-tight">{peer.display_name}</h2>
                      <p className="text-sm text-neutral-400 mt-1">@{peer.handle}</p>
                    </div>

                    {/* Status / Timer */}
                    <div className="px-4 py-1.5 rounded-full bg-white/10 backdrop-blur border border-white/10">
                      {status === "ringing" ? (
                        <span className="text-sm font-semibold text-snap flex items-center gap-2">
                          <Sparkles className="w-3.5 h-3.5 animate-spin" /> Calling...
                        </span>
                      ) : status === "connecting" ? (
                        <span className="text-sm font-semibold text-neutral-300">Connecting...</span>
                      ) : (
                        <span className="text-sm font-mono font-bold text-white tracking-wider">
                          {formatCallDuration(duration)}
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Call Control Action Bar */}
              <div className="p-6 pb-8 bg-neutral-950/80 backdrop-blur border-t border-white/10 flex items-center justify-center gap-4 z-20">
                {/* Mute Mic */}
                <button
                  onClick={toggleMic}
                  className={`w-14 h-14 rounded-full grid place-items-center transition ${
                    micMuted ? "bg-red-500/20 text-red-400 border border-red-500/40" : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                  title={micMuted ? "Unmute" : "Mute"}
                >
                  {micMuted ? <MicOff className="w-6 h-6" /> : <Mic className="w-6 h-6" />}
                </button>

                {/* Video Toggle */}
                <button
                  onClick={toggleVideo}
                  className={`w-14 h-14 rounded-full grid place-items-center transition ${
                    videoOff || callType === "audio"
                      ? "bg-white/10 text-white hover:bg-white/20"
                      : "bg-snap text-snap-foreground"
                  }`}
                  title={videoOff ? "Start video" : "Stop video"}
                >
                  {videoOff || callType === "audio" ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                </button>

                {/* Speaker Toggle */}
                <button
                  onClick={() => setSpeakerMuted((s) => !s)}
                  className={`w-14 h-14 rounded-full grid place-items-center transition ${
                    speakerMuted ? "bg-red-500/20 text-red-400" : "bg-white/10 text-white hover:bg-white/20"
                  }`}
                  title={speakerMuted ? "Unmute speaker" : "Mute speaker"}
                >
                  {speakerMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                </button>

                {/* End Call Button */}
                <button
                  onClick={handleEndCall}
                  className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 active:scale-95 text-white grid place-items-center shadow-xl shadow-red-600/30 transition ml-2"
                  title="End call"
                >
                  <PhoneOff className="w-7 h-7" />
                </button>
              </div>
            </>
          )}
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
