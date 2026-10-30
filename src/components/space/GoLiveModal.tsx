import { useState, useRef, useEffect } from "react";
import {
  X,
  Radio,
  Video,
  VideoOff,
  Mic,
  MicOff,
  SwitchCamera,
  Globe,
  Lock,
  Users,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";
import type { LiveBroadcastSession } from "@/lib/space/types";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirmGoLive: (
    title: string,
    category: LiveBroadcastSession["category"],
    visibility: LiveBroadcastSession["visibility"]
  ) => void;
}

const CATEGORIES: LiveBroadcastSession["category"][] = [
  "Campus",
  "Chit-Chat",
  "Tech",
  "Music",
  "Tutorial",
  "Gaming",
  "Culture",
];

export function GoLiveModal({ isOpen, onClose, onConfirmGoLive }: Props) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<LiveBroadcastSession["category"]>("Campus");
  const [visibility, setVisibility] = useState<LiveBroadcastSession["visibility"]>("public");
  const [micActive, setMicActive] = useState(true);
  const [camActive, setCamActive] = useState(true);
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");

  const previewVideoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    const startPreview = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: camActive ? { facingMode } : false,
          audio: micActive,
        });
        if (!isMounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (previewVideoRef.current) {
          previewVideoRef.current.srcObject = stream;
          previewVideoRef.current.play().catch(() => {});
        }
      } catch (err) {
        console.warn("Camera preview initialization failed:", err);
      }
    };

    void startPreview();

    return () => {
      isMounted = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen, camActive, micActive, facingMode]);

  if (!isOpen) return null;

  const handleLaunch = () => {
    if (!title.trim()) {
      toast.error("Please enter a title for your live stream");
      return;
    }
    void triggerMediumHaptic();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    onConfirmGoLive(title.trim(), category, visibility);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        className="w-full max-w-lg rounded-3xl bg-card border border-border p-5 sm:p-6 shadow-2xl space-y-4 max-h-[92vh] overflow-y-auto no-scrollbar"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-1 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-rose-500/10 text-rose-500 grid place-items-center">
              <Radio className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-foreground">
                Go Live Setup
              </h3>
              <p className="text-xs text-muted-foreground">Preview camera & configure stream</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-secondary grid place-items-center text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Live Camera Preview Box */}
        <div className="relative aspect-video w-full rounded-2xl overflow-hidden bg-black border border-border flex items-center justify-center">
          {camActive ? (
            <video
              ref={previewVideoRef}
              playsInline
              autoPlay
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 text-zinc-500">
              <VideoOff className="w-10 h-10" />
              <span className="text-xs">Camera preview turned off</span>
            </div>
          )}

          {/* Controls overlay on preview */}
          <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                void triggerLightHaptic();
                setFacingMode((m) => (m === "user" ? "environment" : "user"));
              }}
              className="p-2 rounded-full bg-black/60 text-white backdrop-blur hover:bg-black/80 transition active:scale-95"
              title="Flip Camera"
            >
              <SwitchCamera className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                void triggerLightHaptic();
                setMicActive(!micActive);
              }}
              className={`p-2 rounded-full backdrop-blur transition active:scale-95 ${
                micActive ? "bg-black/60 text-white" : "bg-rose-600 text-white"
              }`}
              title={micActive ? "Mute Microphone" : "Unmute Microphone"}
            >
              {micActive ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={() => {
                void triggerLightHaptic();
                setCamActive(!camActive);
              }}
              className={`p-2 rounded-full backdrop-blur transition active:scale-95 ${
                camActive ? "bg-black/60 text-white" : "bg-rose-600 text-white"
              }`}
              title={camActive ? "Turn Video Off" : "Turn Video On"}
            >
              {camActive ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Title Input */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-foreground">Broadcast Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Late Night Campus Chill, Reviewing New Music…"
            className="w-full bg-secondary/80 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-rose-500"
            autoFocus
          />
        </div>

        {/* Category Picker */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-foreground">Category</label>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map((cat) => {
              const active = category === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => {
                    void triggerLightHaptic();
                    setCategory(cat);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold transition ${
                    active
                      ? "bg-rose-500 text-white font-bold shadow-sm"
                      : "bg-secondary text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>
        </div>

        {/* Audience Visibility */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-foreground">Audience</label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "public", label: "Public", icon: Globe },
              { id: "followers", label: "Followers", icon: Users },
              { id: "invite_only", label: "Invite Only", icon: Lock },
            ].map((vis) => {
              const active = visibility === vis.id;
              const Icon = vis.icon;
              return (
                <button
                  key={vis.id}
                  type="button"
                  onClick={() => {
                    void triggerLightHaptic();
                    setVisibility(vis.id as LiveBroadcastSession["visibility"]);
                  }}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center gap-1 transition ${
                    active
                      ? "border-rose-500 bg-rose-500/10 text-rose-500 font-bold"
                      : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{vis.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Button */}
        <button
          type="button"
          onClick={handleLaunch}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 hover:opacity-95 active:scale-95 transition flex items-center justify-center gap-2"
        >
          <Radio className="w-4 h-4 animate-pulse" />
          <span>Launch Live Broadcast Now</span>
        </button>
      </motion.div>
    </div>
  );
}
