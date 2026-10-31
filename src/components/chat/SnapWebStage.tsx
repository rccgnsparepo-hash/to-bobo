import { useState, useRef, useEffect } from "react";
import {
  Camera,
  RefreshCw,
  Sparkles,
  ChevronRight,
  X,
  MessageSquare,
  Trophy,
  Flame,
  Radio,
  Layers,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";
import { useNavigate } from "react-router-dom";

interface SnapWebStageProps {
  onSelectUser?: (userId: string) => void;
  onOpenNewChat?: () => void;
}

export function SnapWebStage({ onSelectUser, onOpenNewChat }: SnapWebStageProps) {
  const navigate = useNavigate();
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [cameraPermissionError, setCameraPermissionError] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Sync stream to video element when camera is active
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraStream, cameraActive]);

  // Clean up media streams on unmount
  useEffect(() => {
    return () => {
      if (cameraStream) {
        cameraStream.getTracks().forEach((t) => t.stop());
      }
    };
  }, [cameraStream]);

  // Request actual camera access
  const handleRequestCamera = async () => {
    void triggerLightHaptic();
    setIsRequestingCamera(true);
    setCameraPermissionError(false);

    try {
      if (!navigator?.mediaDevices?.getUserMedia) {
        throw new Error("Camera API is not supported in this browser environment.");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });

      setCameraStream(stream);
      setCameraActive(true);
      toast.success("Camera connected! Live viewfinder ready.", {
        icon: <Camera className="w-4 h-4 text-[#C5E863]" />,
      });
    } catch (err: unknown) {
      console.warn("Camera access denied or blocked:", err);
      setCameraPermissionError(true);
      toast.error("Camera access was blocked by your browser.", {
        description: "Click the lock icon in the address bar to allow camera access.",
      });
    } finally {
      setIsRequestingCamera(false);
    }
  };

  const handleStopCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach((t) => t.stop());
      setCameraStream(null);
    }
    setCameraActive(false);
    setCapturedPhoto(null);
  };

  const handleCaptureFlick = () => {
    if (!videoRef.current) return;
    void triggerMediumHaptic();
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      setCapturedPhoto(dataUrl);
      toast.success("Flick photo captured! Choose a friend to send.");
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden select-none bg-[#0a0b0d]">
      {/* Sleek Minimalist Studio Stage Header */}
      <div className="h-12 bg-[#101216]/80 backdrop-blur-md border-b border-white/5 px-6 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-[#C5E863] animate-pulse" />
          <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
            Flick Studio
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenNewChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 hover:bg-white/10 text-xs font-medium text-zinc-200 transition cursor-pointer"
          >
            <MessageSquare className="w-3.5 h-3.5 text-[#C5E863]" />
            <span>New Chat</span>
          </button>
        </div>
      </div>

      {/* Main Studio Canvas */}
      <div className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center p-6 md:p-12">
        {/* Subtle Ambient Radial Lighting */}
        <div className="absolute inset-0 bg-radial from-[#C5E863]/5 via-transparent to-transparent pointer-events-none" />
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-[#C5E863]/5 blur-3xl pointer-events-none" />

        {/* Live Camera Viewfinder Overlay */}
        {cameraActive ? (
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative z-10 w-full max-w-xl rounded-3xl bg-black border border-white/10 shadow-2xl overflow-hidden flex flex-col"
          >
            <div className="relative aspect-[4/3] w-full bg-black overflow-hidden">
              {capturedPhoto ? (
                <img src={capturedPhoto} alt="Captured Flick" className="w-full h-full object-cover" />
              ) : (
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover -scale-x-100" />
              )}

              {/* Status Pill */}
              <div className="absolute top-4 left-4 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md text-xs font-bold text-white flex items-center gap-2 border border-white/10">
                <span className="w-2 h-2 rounded-full bg-[#C5E863] animate-pulse" />
                <span>LIVE FLICK CAM</span>
              </div>

              {/* Shutter Button Container */}
              <div className="absolute bottom-5 inset-x-0 flex items-center justify-center gap-4">
                {capturedPhoto ? (
                  <button
                    type="button"
                    onClick={() => setCapturedPhoto(null)}
                    className="px-5 py-2.5 rounded-full bg-white/20 hover:bg-white/30 text-white font-bold text-xs backdrop-blur-md transition cursor-pointer"
                  >
                    Retake
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleCaptureFlick}
                    className="w-16 h-16 rounded-full bg-white ring-4 ring-[#C5E863]/50 active:scale-95 transition shadow-2xl grid place-items-center cursor-pointer group"
                    title="Capture Flick"
                  >
                    <div className="w-13 h-13 rounded-full border-2 border-black/20 group-hover:scale-95 transition-transform" />
                  </button>
                )}
              </div>
            </div>

            {/* Bottom Camera Action Bar */}
            <div className="p-4 bg-[#14161a] border-t border-white/5 flex items-center justify-between">
              <button
                type="button"
                onClick={handleStopCamera}
                className="px-4 py-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 font-semibold text-xs transition cursor-pointer"
              >
                Close Camera
              </button>

              {capturedPhoto && (
                <button
                  type="button"
                  onClick={() => {
                    toast.success("Flick ready! Select a friend to send.");
                    if (onOpenNewChat) onOpenNewChat();
                  }}
                  className="px-5 py-2 rounded-full bg-[#C5E863] text-black font-bold text-xs hover:bg-[#b5dc4f] active:scale-95 transition shadow-md flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Send Flick</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </motion.div>
        ) : (
          /* Sleek Flick Studio Card */
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="relative z-10 w-full max-w-md rounded-3xl bg-[#14161a]/90 backdrop-blur-2xl border border-white/10 shadow-2xl p-8 text-center space-y-6"
          >
            {/* Aperture / Camera Emblem in Flick Lime */}
            <div className="w-20 h-20 mx-auto rounded-3xl bg-[#C5E863]/10 border border-[#C5E863]/30 flex items-center justify-center shadow-lg shadow-[#C5E863]/10">
              <Camera className="w-9 h-9 text-[#C5E863]" />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-bold tracking-tight text-white font-display">
                Flick Studio
              </h2>
              <p className="text-xs text-zinc-400 leading-relaxed max-w-sm mx-auto">
                Select a direct message from the left to start chatting, or launch the camera to capture live moments for your friends.
              </p>
            </div>

            {/* Camera Permission Warning Banner (if blocked) */}
            {cameraPermissionError && (
              <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs text-left space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <span>Camera access needed</span>
                </div>
                <p className="text-[11px] text-zinc-300">
                  Click the lock icon 🔒 next to the website address, enable Camera, and reload this page.
                </p>
              </div>
            )}

            {/* Primary Action Button */}
            <button
              type="button"
              onClick={handleRequestCamera}
              disabled={isRequestingCamera}
              className="w-full py-3.5 px-6 rounded-2xl bg-[#C5E863] text-black font-bold text-sm hover:bg-[#b5dc4f] active:scale-[0.98] transition shadow-lg shadow-[#C5E863]/15 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isRequestingCamera ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin text-black" />
                  <span>Connecting Camera…</span>
                </>
              ) : (
                <>
                  <Camera className="w-4 h-4 text-black" />
                  <span>Start Live Camera</span>
                </>
              )}
            </button>

            {/* Quick Explore Shortcuts */}
            <div className="pt-2 border-t border-white/5 grid grid-cols-2 gap-2 text-xs">
              <button
                type="button"
                onClick={() => navigate("/challenges")}
                className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] text-zinc-300 font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Trophy className="w-3.5 h-3.5 text-[#C5E863]" />
                <span>Leaderboard</span>
              </button>

              <button
                type="button"
                onClick={() => navigate("/")}
                className="p-2.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.07] text-zinc-300 font-semibold flex items-center justify-center gap-2 transition cursor-pointer"
              >
                <Flame className="w-3.5 h-3.5 text-[#C5E863]" />
                <span>Home Feed</span>
              </button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
