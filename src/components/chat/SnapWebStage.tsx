import { useState, useRef, useEffect } from "react";
import {
  Camera,
  CameraOff,
  Lock,
  RefreshCw,
  HelpCircle,
  Sparkles,
  Maximize2,
  Minimize2,
  Check,
  ChevronRight,
  ExternalLink,
  Info,
  X,
  Volume2,
  Image as ImageIcon,
  UserPlus,
  MessageSquare,
  ShieldCheck,
  MousePointer2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { triggerLightHaptic } from "@/lib/haptics";

type WallpaperTheme = "cash" | "snap_yellow" | "cyber_grid" | "obsidian" | "sunset";

interface SnapWebStageProps {
  onSelectUser?: (userId: string) => void;
  onOpenNewChat?: () => void;
  onOpenMyAI?: () => void;
}

export function SnapWebStage({ onSelectUser, onOpenNewChat, onOpenMyAI }: SnapWebStageProps) {
  const [wallpaper, setWallpaper] = useState<WallpaperTheme>("cash");
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [browserType, setBrowserType] = useState<"chrome" | "safari" | "edge" | "firefox">("chrome");
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isRequestingCamera, setIsRequestingCamera] = useState(false);
  const [domainLabel, setDomainLabel] = useState("snapchat.com");

  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Detect browser for tailored help instructions
  useEffect(() => {
    if (typeof navigator !== "undefined") {
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes("edg/")) setBrowserType("edge");
      else if (ua.includes("safari") && !ua.includes("chrome")) setBrowserType("safari");
      else if (ua.includes("firefox")) setBrowserType("firefox");
      else setBrowserType("chrome");
    }
  }, []);

  // Sync stream to video element when active
  useEffect(() => {
    if (videoRef.current && cameraStream) {
      videoRef.current.srcObject = cameraStream;
      videoRef.current.play().catch(() => {});
    }
  }, [cameraStream, cameraActive]);

  // Clean up media streams
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
    setCameraError(null);

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
      toast.success("Camera access granted! Live viewfinder ready.", {
        icon: <Camera className="w-4 h-4 text-emerald-400" />,
      });
    } catch (err: unknown) {
      console.warn("Camera access denied or blocked:", err);
      const msg = err instanceof Error ? err.message : "Camera blocked";
      setCameraError(msg);
      setShowHelpModal(true);
      toast.error("Camera access was blocked by the browser.", {
        description: "Click the lock icon in the address bar to allow camera.",
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

  const handleCaptureSnap = () => {
    if (!videoRef.current) return;
    void triggerLightHaptic();
    const canvas = document.createElement("canvas");
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      // Mirror image for front camera
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
      setCapturedPhoto(dataUrl);
      toast.success("Snap captured! Ready to send to friends.");
    }
  };

  return (
    <div className="relative w-full h-full flex flex-col overflow-hidden select-none bg-[#121315]">
      {/* Top Snapchat Desktop Window Titlebar */}
      <div className="h-10 bg-[#1e1f23]/95 border-b border-white/5 px-4 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-2.5">
          {/* Snapchat Ghost Icon */}
          <div className="w-5 h-5 rounded-full bg-[#fffc00] grid place-items-center shadow-sm">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5 text-black">
              <path d="M12.001 2c-3.568 0-6.19 2.584-6.19 6.223 0 1.25.32 2.227.79 3.036-.583.193-1.46.543-1.92 1.134-.37.478-.344 1.05-.205 1.488.225.71.82 1.118 1.47 1.22.148.243.328.46.54.646-.358.825-1.127 1.428-2.128 1.834-.347.142-.516.488-.415.845.097.34.406.574.76.574.195 0 .4-.07.59-.158 1.464-.679 2.766-.54 3.738.196.883.67 1.892 1.162 3.06 1.162 1.167 0 2.176-.492 3.06-1.162.97-.736 2.274-.875 3.738-.196.19.088.395.158.59.158.354 0 .663-.234.76-.574.101-.357-.068-.703-.415-.845-1-.406-1.77-1.009-2.128-1.834.212-.186.392-.403.54-.646.65-.102 1.245-.51 1.47-1.22.14-.438.165-1.01-.205-1.488-.46-.591-1.337-.941-1.92-1.134.47-.809.79-1.786.79-3.036C18.19 4.584 15.57 2 12.001 2z" />
            </svg>
          </div>
          <span className="text-xs font-semibold text-zinc-300 tracking-tight">
            Snapchat - (23) Snapchat
          </span>
        </div>

        {/* Wallpaper Picker & Window Controls */}
        <div className="flex items-center gap-2">
          {/* Wallpaper selector pill */}
          <div className="flex items-center bg-black/40 rounded-full p-0.5 border border-white/10 text-[11px]">
            <button
              type="button"
              onClick={() => setWallpaper("cash")}
              className={`px-2 py-0.5 rounded-full transition ${
                wallpaper === "cash" ? "bg-white/20 text-white font-bold" : "text-zinc-400 hover:text-white"
              }`}
              title="100 Dollar Bills Wallpaper (from reference)"
            >
              💵 Cash
            </button>
            <button
              type="button"
              onClick={() => setWallpaper("snap_yellow")}
              className={`px-2 py-0.5 rounded-full transition ${
                wallpaper === "snap_yellow" ? "bg-[#fffc00] text-black font-bold" : "text-zinc-400 hover:text-white"
              }`}
              title="Snap Yellow"
            >
              🟡 Snap
            </button>
            <button
              type="button"
              onClick={() => setWallpaper("cyber_grid")}
              className={`px-2 py-0.5 rounded-full transition ${
                wallpaper === "cyber_grid" ? "bg-cyan-500/30 text-cyan-300 font-bold" : "text-zinc-400 hover:text-white"
              }`}
              title="Cyber Grid Room"
            >
              🌌 Cyber
            </button>
          </div>

          {/* Window control buttons */}
          <div className="flex items-center gap-1.5 ml-2 text-zinc-400">
            <span className="w-3 h-3 rounded-full bg-zinc-600/80 hover:bg-zinc-500 transition cursor-pointer" />
            <span className="w-3 h-3 rounded-full bg-zinc-600/80 hover:bg-zinc-500 transition cursor-pointer" />
            <span className="w-3 h-3 rounded-full bg-zinc-600/80 hover:bg-rose-500 transition cursor-pointer" />
          </div>
        </div>
      </div>

      {/* Main Wallpaper & 3D Stage Canvas */}
      <div className="relative flex-1 w-full h-full overflow-hidden flex items-center justify-center p-4 md:p-8">
        {/* Background Wallpaper Rendering */}
        {wallpaper === "cash" && (
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            {/* Dollar Bills Collage Backdrop */}
            <div
              className="absolute inset-0 opacity-90 scale-105"
              style={{
                backgroundImage: `url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='280' height='160' viewBox='0 0 280 160'><defs><filter id='f' x='-10%25' y='-10%25' width='120%25' height='120%25'><feDropShadow dx='0' dy='3' stdDeviation='4' flood-opacity='0.45'/></filter><linearGradient id='bg' x1='0%25' y1='0%25' x2='100%25' y2='100%25'><stop offset='0%25' stop-color='%23dcf1de'/><stop offset='50%25' stop-color='%23c7e3cb'/><stop offset='100%25' stop-color='%23b2d4b7'/></linearGradient></defs><g filter='url(%23f)' transform='rotate(-9 120 70)'><rect x='10' y='15' width='240' height='120' rx='6' fill='url(%23bg)' stroke='%23366847' stroke-width='2'/><rect x='16' y='21' width='228' height='108' rx='4' fill='none' stroke='%23487f59' stroke-dasharray='4 2'/><circle cx='130' cy='75' r='38' fill='%239abf9f' opacity='0.7'/><circle cx='130' cy='75' r='30' fill='none' stroke='%23274e35' stroke-width='2'/><path d='M118 64c0-5 6-8 12-8s12 3 12 8c0 8-16 7-16 14 0 5 6 7 12 7s12-2 12-7' fill='none' stroke='%231b3e27' stroke-width='3'/><path d='M130 50v42' stroke='%231b3e27' stroke-width='3'/><text x='25' y='42' font-family='monospace' font-weight='bold' font-size='22' fill='%231e4d2b'>100</text><text x='205' y='42' font-family='monospace' font-weight='bold' font-size='22' fill='%231e4d2b'>100</text><text x='25' y='122' font-family='monospace' font-weight='bold' font-size='20' fill='%231e4d2b'>100</text><text x='205' y='122' font-family='monospace' font-weight='bold' font-size='20' fill='%231e4d2b'>100</text><text x='78' y='36' font-family='serif' font-weight='bold' font-size='8.5' letter-spacing='1' fill='%231e4d2b'>THE UNITED STATES OF AMERICA</text><text x='96' y='120' font-family='serif' font-size='7.5' font-weight='bold' fill='%231e4d2b'>ONE HUNDRED DOLLARS</text></g><g filter='url(%23f)' transform='rotate(16 160 110)' opacity='0.85'><rect x='50' y='50' width='230' height='115' rx='6' fill='url(%23bg)' stroke='%23366847' stroke-width='2'/><circle cx='165' cy='107' r='32' fill='%239abf9f' opacity='0.6'/><text x='62' y='75' font-family='monospace' font-weight='bold' font-size='20' fill='%231e4d2b'>100</text><text x='230' y='75' font-family='monospace' font-weight='bold' font-size='20' fill='%231e4d2b'>100</text></g></svg>")`,
                backgroundSize: "280px 160px",
              }}
            />
            {/* Soft vignette overlay */}
            <div className="absolute inset-0 bg-radial from-transparent via-black/25 to-black/75" />
          </div>
        )}

        {wallpaper === "snap_yellow" && (
          <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#fff700] via-[#ffea00] to-[#ffd000] overflow-hidden">
            <div className="absolute -right-20 -bottom-20 w-96 h-96 rounded-full bg-white/20 blur-3xl pointer-events-none" />
            <div className="absolute inset-0 bg-radial from-transparent via-transparent to-black/40" />
          </div>
        )}

        {wallpaper === "cyber_grid" && (
          <div className="absolute inset-0 z-0 bg-[#090b10] overflow-hidden">
            <div
              className="absolute inset-0 opacity-30"
              style={{
                backgroundImage:
                  "linear-gradient(to right, #00f0ff 1px, transparent 1px), linear-gradient(to bottom, #ff0077 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            />
            <div className="absolute inset-0 bg-radial from-transparent via-black/40 to-black/90" />
          </div>
        )}

        {/* 3D Perspective Floor Surface (bottom 35%) */}
        <div className="absolute bottom-0 inset-x-0 h-44 md:h-52 z-0 pointer-events-none">
          <div
            className="w-full h-full bg-gradient-to-t from-[#8b9196]/60 via-[#686d73]/40 to-transparent backdrop-blur-[2px]"
            style={{
              transform: "perspective(400px) rotateX(45deg)",
              transformOrigin: "bottom center",
              boxShadow: "inset 0 10px 40px rgba(0,0,0,0.6)",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
        </div>

        {/* 3D Character (standing next to the card, leaning on floor with soft shadow) */}
        <div className="hidden md:flex absolute right-[4%] lg:right-[9%] bottom-4 z-10 flex-col items-center pointer-events-none select-none">
          {/* Character illustration matching the dreadlocks & cardigan pose */}
          <div className="relative w-56 h-80 lg:w-64 lg:h-96">
            <svg
              viewBox="0 0 200 320"
              className="w-full h-full drop-shadow-2xl"
              style={{ filter: "drop-shadow(0 15px 25px rgba(0,0,0,0.7))" }}
            >
              <defs>
                {/* Hair & skin gradients */}
                <linearGradient id="skin" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8d553b" />
                  <stop offset="100%" stopColor="#603825" />
                </linearGradient>
                <linearGradient id="hair" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#692d19" />
                  <stop offset="50%" stopColor="#411b0e" />
                  <stop offset="100%" stopColor="#1e0c06" />
                </linearGradient>
                <linearGradient id="cardigan" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#30343a" />
                  <stop offset="100%" stopColor="#1b1d20" />
                </linearGradient>
                <linearGradient id="pants" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#9da4ac" />
                  <stop offset="100%" stopColor="#6e747b" />
                </linearGradient>
              </defs>

              {/* Character Shoes */}
              <ellipse cx="88" cy="308" rx="19" ry="8" fill="#121314" />
              <ellipse cx="122" cy="312" rx="19" ry="8" fill="#121314" />

              {/* Legs / Relaxed Grey Trousers */}
              <path
                d="M74 195 L84 305 L96 305 L106 200 Z"
                fill="url(#pants)"
                stroke="#54595e"
                strokeWidth="1.5"
              />
              <path
                d="M103 200 L114 308 L128 308 L136 195 Z"
                fill="url(#pants)"
                stroke="#54595e"
                strokeWidth="1.5"
              />

              {/* Cardigan & Torso */}
              <path
                d="M65 110 C65 110 75 195 72 205 L138 205 C135 195 145 110 145 110 Z"
                fill="url(#cardigan)"
              />
              {/* White collar inner shirt */}
              <polygon points="98,110 112,110 105,135" fill="#f4f4f5" />
              <line x1="105" y1="135" x2="105" y2="200" stroke="#4a4f55" strokeWidth="2" strokeDasharray="3 3" />

              {/* Arms clasped at chest in cool lean */}
              {/* Left Arm */}
              <path
                d="M68 115 C50 140 60 165 95 160 C90 150 82 135 80 120 Z"
                fill="url(#cardigan)"
              />
              {/* Right Arm */}
              <path
                d="M142 115 C160 140 150 165 115 160 C120 150 128 135 130 120 Z"
                fill="url(#cardigan)"
              />
              {/* Hands */}
              <circle cx="105" cy="160" r="10" fill="url(#skin)" />

              {/* Head / Neck */}
              <rect x="99" y="96" width="12" height="18" fill="url(#skin)" rx="4" />
              <ellipse cx="105" cy="72" rx="27" ry="32" fill="url(#skin)" />

              {/* Facial features */}
              <ellipse cx="96" cy="70" rx="3.5" ry="4" fill="#ffffff" />
              <circle cx="96" cy="70" r="2" fill="#1f140e" />
              <ellipse cx="114" cy="70" rx="3.5" ry="4" fill="#ffffff" />
              <circle cx="114" cy="70" r="2" fill="#1f140e" />
              {/* Eyebrows */}
              <path d="M91 63 Q96 60 101 62" stroke="#25120a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <path d="M109 62 Q114 60 119 63" stroke="#25120a" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              {/* Nose */}
              <path d="M104 70 L103 77 L107 77" stroke="#522b1a" strokeWidth="2" fill="none" strokeLinecap="round" />
              {/* Friendly smile */}
              <path d="M98 83 Q105 90 112 83" stroke="#36170a" strokeWidth="2.5" fill="none" strokeLinecap="round" />

              {/* Dreadlocks / Braids Hairdo with highlights */}
              {/* Top volume */}
              <ellipse cx="105" cy="50" rx="33" ry="24" fill="url(#hair)" />
              {/* Individual textured loc strands cascading */}
              <path d="M76 56 C70 65 72 85 75 92" stroke="url(#hair)" strokeWidth="6" strokeLinecap="round" />
              <path d="M83 48 C78 60 80 80 82 96" stroke="url(#hair)" strokeWidth="6" strokeLinecap="round" />
              <path d="M92 42 C90 56 90 75 89 90" stroke="url(#hair)" strokeWidth="6" strokeLinecap="round" />
              <path d="M101 38 C100 52 101 70 100 84" stroke="url(#hair)" strokeWidth="6" strokeLinecap="round" />
              <path d="M110 38 C112 52 110 70 111 86" stroke="url(#hair)" strokeWidth="6" strokeLinecap="round" />
              <path d="M118 42 C122 56 120 76 122 92" stroke="url(#hair)" strokeWidth="6" strokeLinecap="round" />
              <path d="M127 48 C132 60 131 82 130 96" stroke="url(#hair)" strokeWidth="6" strokeLinecap="round" />
              <path d="M135 56 C140 68 138 88 134 94" stroke="url(#hair)" strokeWidth="6" strokeLinecap="round" />
            </svg>
          </div>

          {/* Cast Shadow on Stage Floor */}
          <div className="w-44 h-4 rounded-full bg-black/70 blur-md -mt-3 transform scale-y-75" />
        </div>

        {/* Center Card: Faithful reproduction of the Snapchat Web Camera Blocked card */}
        <div className="relative z-10 w-full max-w-[430px] rounded-[32px] bg-[#222428]/95 backdrop-blur-2xl border border-white/10 shadow-2xl p-7 text-center">
          {/* Active Live Camera Viewfinder Overlay (if camera was allowed) */}
          {cameraActive ? (
            <div className="space-y-4">
              <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden bg-black border border-white/10 shadow-inner">
                {capturedPhoto ? (
                  <img
                    src={capturedPhoto}
                    alt="Captured Snap"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover -scale-x-100"
                  />
                )}

                {/* Top overlay indicator */}
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-[11px] font-bold text-white flex items-center gap-1.5 border border-white/10">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span>LIVE CAMERA</span>
                </div>

                {/* Shutter button inside video frame */}
                <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-4">
                  {capturedPhoto ? (
                    <button
                      type="button"
                      onClick={() => setCapturedPhoto(null)}
                      className="px-4 py-2 rounded-full bg-white/20 hover:bg-white/30 text-white font-bold text-xs backdrop-blur-md transition"
                    >
                      Retake
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={handleCaptureSnap}
                      className="w-14 h-14 rounded-full bg-white ring-4 ring-white/40 active:scale-95 transition shadow-lg grid place-items-center"
                      title="Take Snap"
                    >
                      <div className="w-11 h-11 rounded-full border-2 border-black/20" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={handleStopCamera}
                  className="px-4 py-2 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-semibold text-xs transition"
                >
                  Close Camera
                </button>
                {capturedPhoto && (
                  <button
                    type="button"
                    onClick={() => {
                      toast.success("Snap ready! Pick a friend to send.");
                      if (onOpenNewChat) onOpenNewChat();
                    }}
                    className="px-5 py-2 rounded-full bg-[#fffc00] text-black font-bold text-xs hover:bg-[#fff000] active:scale-95 transition shadow-md flex items-center gap-1.5"
                  >
                    <span>Send Snap</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div>
              {/* Yellow Circle with Browser Permissions Diagram */}
              <div className="w-48 h-48 sm:w-52 sm:h-52 mx-auto rounded-full bg-[#fffc00] relative flex items-center justify-center p-3 shadow-lg shadow-black/30">
                {/* Browser permission prompt mockup box */}
                <div className="relative w-40 sm:w-44 bg-white rounded-xl shadow-xl border border-zinc-200/80 p-2.5 text-left text-zinc-900 select-none">
                  {/* Mockup Titlebar */}
                  <div className="flex items-center justify-between pb-1.5 border-b border-zinc-100 text-[10px]">
                    <div className="flex items-center gap-1 font-semibold text-zinc-800 truncate">
                      <Lock className="w-2.5 h-2.5 text-zinc-500 shrink-0" />
                      <span className="truncate">{domainLabel}</span>
                    </div>
                    <div className="flex items-center gap-1 text-zinc-400">
                      <Info className="w-2.5 h-2.5" />
                      <X className="w-2.5 h-2.5" />
                    </div>
                  </div>

                  {/* Connection is secure line */}
                  <div className="py-1 flex items-center gap-1 text-[9px] text-zinc-500 font-medium border-b border-zinc-100">
                    <ShieldCheck className="w-2.5 h-2.5 text-emerald-600" />
                    <span>Connection is secure</span>
                  </div>

                  {/* Toggle rows */}
                  <div className="space-y-1.5 py-1.5">
                    {/* Camera Row */}
                    <div className="flex items-center justify-between text-[10px] text-zinc-800 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Camera className="w-3 h-3 text-zinc-600" />
                        <span>Camera</span>
                      </div>
                      <div className="flex items-center gap-1">
                        {/* Blue active toggle */}
                        <div className="w-6 h-3.5 rounded-full bg-[#0084ff] relative p-0.5 flex items-center justify-end">
                          <div className="w-2.5 h-2.5 rounded-full bg-white shadow-sm" />
                        </div>
                        <ChevronRight className="w-2.5 h-2.5 text-zinc-400" />
                      </div>
                    </div>

                    {/* Microphone Row */}
                    <div className="flex items-center justify-between text-[10px] text-zinc-800 font-medium">
                      <div className="flex items-center gap-1.5">
                        <Volume2 className="w-3 h-3 text-zinc-600" />
                        <span>Microphone</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="w-6 h-3.5 rounded-full bg-[#0084ff] relative p-0.5 flex items-center justify-end">
                          <div className="w-2.5 h-2.5 rounded-full bg-white shadow-sm" />
                        </div>
                        <X className="w-2.5 h-2.5 text-zinc-400" />
                      </div>
                    </div>
                  </div>

                  {/* Reset permissions button */}
                  <div className="pt-1 border-t border-zinc-100">
                    <button
                      type="button"
                      className="text-[9px] text-[#0084ff] font-semibold hover:underline"
                    >
                      Reset permissions
                    </button>
                  </div>

                  {/* Hand Cursor Pointer pointing to toggle */}
                  <div className="absolute -bottom-3 -right-2 transform translate-x-1 translate-y-1 pointer-events-none drop-shadow-md">
                    <svg viewBox="0 0 24 24" className="w-8 h-8 fill-white stroke-black stroke-[1.2]">
                      <path d="M10 2a2 2 0 0 1 2 2v7.5a.5.5 0 0 0 1 0V5a2 2 0 1 1 4 0v6.5a.5.5 0 0 0 1 0V7a2 2 0 1 1 4 0v9a6 6 0 0 1-6 6h-3a6 6 0 0 1-6-6v-8a2 2 0 0 1 4 0v4.5a.5.5 0 0 0 1 0V4a2 2 0 0 1 2-2z" />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Headline */}
              <h2 className="text-2xl font-bold tracking-tight text-white mt-6">
                Camera blocked
              </h2>

              {/* Subtext description */}
              <p className="text-sm text-zinc-300 leading-relaxed max-w-[280px] mx-auto mt-2.5">
                Click the 🔒 icon in the address bar, allow your camera and microphone and reload the page.
              </p>

              {/* Action Buttons & Links */}
              <div className="mt-5 space-y-3">
                <button
                  type="button"
                  onClick={handleRequestCamera}
                  disabled={isRequestingCamera}
                  className="w-full py-2.5 px-4 rounded-full bg-[#fffc00] text-black font-bold text-sm hover:bg-[#fff000] active:scale-[0.98] transition shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isRequestingCamera ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin text-black" />
                      <span>Requesting Camera…</span>
                    </>
                  ) : (
                    <>
                      <Camera className="w-4 h-4 text-black" />
                      <span>Allow Camera & Try It</span>
                    </>
                  )}
                </button>

                <div className="flex items-center justify-center gap-4 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowHelpModal(true)}
                    className="text-[#fffc00] font-bold hover:underline transition cursor-pointer"
                  >
                    Get help
                  </button>
                  <span className="text-zinc-600">•</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.location.reload();
                      }
                    }}
                    className="text-zinc-400 hover:text-white transition flex items-center gap-1 cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Reload Page</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Troubleshooting Help Modal */}
      <AnimatePresence>
        {showHelpModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#202125] border border-white/10 rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#fffc00] grid place-items-center">
                    <Camera className="w-4 h-4 text-black" />
                  </div>
                  <h3 className="font-bold text-white text-base">Unblock Camera on Web</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHelpModal(false)}
                  className="p-1 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3 text-xs text-zinc-300">
                <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-2">
                  <p className="font-semibold text-white flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-zinc-800 text-[#fffc00] grid place-items-center text-[10px] font-bold">1</span>
                    Look at your browser's address bar
                  </p>
                  <p className="text-zinc-400 pl-6">
                    Click the <strong className="text-white">lock icon 🔒</strong> or site settings icon located immediately to the left of the website URL.
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-2">
                  <p className="font-semibold text-white flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-zinc-800 text-[#fffc00] grid place-items-center text-[10px] font-bold">2</span>
                    Toggle Camera & Microphone to "Allow"
                  </p>
                  <p className="text-zinc-400 pl-6">
                    Switch the permission sliders to <strong className="text-emerald-400">Allow</strong> (blue or green).
                  </p>
                </div>

                <div className="p-3 rounded-2xl bg-black/40 border border-white/5 space-y-2">
                  <p className="font-semibold text-white flex items-center gap-1.5">
                    <span className="w-5 h-5 rounded-full bg-zinc-800 text-[#fffc00] grid place-items-center text-[10px] font-bold">3</span>
                    Refresh this page
                  </p>
                  <p className="text-zinc-400 pl-6">
                    Once updated, click Reload below to activate your camera stage.
                  </p>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowHelpModal(false);
                    if (typeof window !== "undefined") window.location.reload();
                  }}
                  className="flex-1 py-2.5 rounded-full bg-[#fffc00] text-black font-bold text-xs hover:bg-[#fff000] transition"
                >
                  Reload Page Now
                </button>
                <button
                  type="button"
                  onClick={() => setShowHelpModal(false)}
                  className="px-4 py-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-white font-semibold text-xs transition"
                >
                  Dismiss
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
