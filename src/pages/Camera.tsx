import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { Camera as CameraIcon, RefreshCw, Send, X, Video, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { triggerLightHaptic, triggerSuccessHaptic } from "@/lib/haptics";
import { triggerNotchNotification } from "@/components/notifications/NotchNotification";

const MAX_RECORD_SECONDS = 30;

function formatDuration(seconds: number): string {
  const s = Math.floor(seconds);
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default function CameraPage() {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [mode, setMode] = useState<"photo" | "video">("photo");

  const [snapshot, setSnapshot] = useState<string | null>(null);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [busy, setBusy] = useState(false);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);

  // Initialize camera stream
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing },
          audio: mode === "video",
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        mediaStreamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
      } catch {
        toast.error("Camera permission denied");
      }
    })();

    return () => {
      active = false;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, [facing, mode]);

  // Photo Capture with Haptic
  const capture = () => {
    void triggerLightHaptic();
    const v = videoRef.current;
    const c = canvasRef.current;
    if (!v || !c) return;
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    const ctx = c.getContext("2d")!;
    if (facing === "user") {
      ctx.translate(c.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, 0, 0, c.width, c.height);
    setSnapshot(c.toDataURL("image/jpeg", 0.9));
  };

  // Video Recording with Haptic
  const startRecording = () => {
    if (!mediaStreamRef.current) {
      toast.error("Camera stream unavailable");
      return;
    }

    // Trigger light haptic on record start
    void triggerLightHaptic();

    chunksRef.current = [];
    setRecordSeconds(0);
    setRecordedVideoUrl(null);
    setRecordedBlob(null);

    try {
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/mp4")
        ? "video/mp4"
        : "video/webm";

      const recorder = new MediaRecorder(mediaStreamRef.current, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        setRecordedVideoUrl(URL.createObjectURL(blob));
      };

      recorder.start(200);
      setRecording(true);

      const startTime = Date.now();
      recordTimerRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        setRecordSeconds(elapsed);
        if (elapsed >= MAX_RECORD_SECONDS) {
          stopRecording();
        }
      }, 100);
    } catch (err) {
      toast.error("Could not start recording");
    }
  };

  const stopRecording = () => {
    // Trigger light haptic on record stop
    void triggerLightHaptic();

    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setRecording(false);
  };

  const retake = () => {
    void triggerLightHaptic();
    setSnapshot(null);
    if (recordedVideoUrl) URL.revokeObjectURL(recordedVideoUrl);
    setRecordedVideoUrl(null);
    setRecordedBlob(null);
    setRecordSeconds(0);
  };

  const switchCamera = () => {
    void triggerLightHaptic();
    setFacing((f) => (f === "user" ? "environment" : "user"));
  };

  const switchMode = (m: "photo" | "video") => {
    void triggerLightHaptic();
    setMode(m);
    retake();
  };

  // Post story to Supabase
  const post = async () => {
    if (!user || (!snapshot && !recordedBlob)) return;
    setBusy(true);

    try {
      let fileBlob: Blob;
      let path: string;
      const isVideo = Boolean(recordedBlob);

      if (isVideo && recordedBlob) {
        fileBlob = recordedBlob;
        path = `${user.id}/story-${crypto.randomUUID()}.${recordedBlob.type.includes("mp4") ? "mp4" : "webm"}`;
      } else if (snapshot) {
        fileBlob = await (await fetch(snapshot)).blob();
        path = `${user.id}/story-${crypto.randomUUID()}.jpg`;
      } else {
        return;
      }

      const { error: upErr } = await supabase.storage
        .from("media")
        .upload(path, fileBlob, { contentType: fileBlob.type });

      if (upErr) throw upErr;

      const url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;

      const { error } = await supabase.from("stories").insert({
        author_id: user.id,
        image_url: url,
        media_type: isVideo ? "video" : "image",
      });

      if (error) throw error;

      // Trigger success haptic
      void triggerSuccessHaptic();

      triggerNotchNotification({
        kind: "story",
        title: "Story published! 📸",
        message: "Your story is now live for 24h",
        actor: {
          id: user.id,
          display_name: profile?.display_name || "You",
          handle: profile?.handle || "user",
          avatar_url: profile?.avatar_url,
        },
        url: "/",
      });

      toast.success("Story posted!");
      nav("/");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const hasMedia = Boolean(snapshot || recordedVideoUrl);

  return (
    <div className="relative bg-black min-h-screen select-none overflow-hidden flex flex-col justify-between">
      {/* Top Header */}
      <header className="absolute top-0 inset-x-0 z-30 flex items-center justify-between p-4 bg-gradient-to-b from-black/80 to-transparent">
        <button
          onClick={() => {
            void triggerLightHaptic();
            nav("/");
          }}
          className="text-white p-2.5 bg-black/50 backdrop-blur-md rounded-full border border-white/10 active:scale-95 transition"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Live recording duration badge */}
        {recording && (
          <div className="px-3.5 py-1 rounded-full bg-rose-500/30 border border-rose-500/50 text-rose-300 text-xs font-mono font-bold flex items-center gap-2 animate-pulse shadow-lg">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>
              {formatDuration(recordSeconds)} / {formatDuration(MAX_RECORD_SECONDS)}
            </span>
          </div>
        )}

        {!hasMedia && !recording && (
          <button
            onClick={switchCamera}
            className="text-white p-2.5 bg-black/50 backdrop-blur-md rounded-full border border-white/10 active:scale-95 transition"
            title="Flip camera"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        )}
      </header>

      {/* Main Viewport Container */}
      <div className="relative flex-1 w-full max-h-[88vh] mx-auto overflow-hidden bg-black flex items-center justify-center">
        {snapshot ? (
          <img src={snapshot} alt="" className="w-full h-full object-cover" />
        ) : recordedVideoUrl ? (
          <video
            src={recordedVideoUrl}
            autoPlay
            loop
            playsInline
            controls
            className="w-full h-full object-cover"
          />
        ) : (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
            className="w-full h-full object-cover"
          />
        )}
        <canvas ref={canvasRef} hidden />
      </div>

      {/* Mode Switcher (Photo / Video) */}
      {!hasMedia && !recording && (
        <div className="absolute bottom-28 inset-x-0 flex justify-center z-20">
          <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md border border-white/15 p-1 rounded-full text-xs font-bold shadow-lg">
            <button
              onClick={() => switchMode("photo")}
              className={`px-3.5 py-1 rounded-full transition ${
                mode === "photo" ? "bg-white text-black" : "text-white/70 hover:text-white"
              }`}
            >
              Photo
            </button>
            <button
              onClick={() => switchMode("video")}
              className={`px-3.5 py-1 rounded-full transition ${
                mode === "video" ? "bg-snap text-black" : "text-white/70 hover:text-white"
              }`}
            >
              Video
            </button>
          </div>
        </div>
      )}

      {/* Bottom Shutter / Action Controls */}
      <footer className="absolute bottom-6 inset-x-0 z-30 flex items-center justify-center p-4">
        {!hasMedia ? (
          mode === "photo" ? (
            <button
              onClick={capture}
              className="w-20 h-20 rounded-full bg-white border-4 border-snap grid place-items-center shadow-[0_0_25px_rgba(197,232,99,0.5)] active:scale-90 transition"
              title="Capture Photo"
            >
              <CameraIcon className="w-8 h-8 text-black" />
            </button>
          ) : (
            <button
              onClick={recording ? stopRecording : startRecording}
              className={`w-20 h-20 rounded-full border-4 flex items-center justify-center shadow-2xl active:scale-95 transition ${
                recording
                  ? "border-rose-500 bg-rose-500/40 text-rose-500"
                  : "border-snap bg-white text-black"
              }`}
              title={recording ? "Stop Recording" : "Start Recording"}
            >
              {recording ? (
                <div className="w-7 h-7 rounded-md bg-rose-500" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-snap" />
              )}
            </button>
          )
        ) : (
          <div className="flex items-center gap-4">
            <button
              onClick={retake}
              className="px-6 py-3 rounded-full bg-black/70 backdrop-blur border border-white/20 text-white font-bold flex items-center gap-2 active:scale-95 transition"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retake</span>
            </button>

            <button
              onClick={post}
              disabled={busy}
              className="px-6 py-3 rounded-full bg-snap text-black font-extrabold flex items-center gap-2 disabled:opacity-50 shadow-lg active:scale-95 transition"
            >
              {busy ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-full border-2 border-black border-t-transparent animate-spin" />
                  <span>Posting…</span>
                </span>
              ) : (
                <>
                  <Send className="w-4 h-4 fill-current" />
                  <span>Send Story</span>
                </>
              )}
            </button>
          </div>
        )}
      </footer>

    </div>
  );
}
