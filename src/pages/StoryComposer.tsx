import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Upload,
  X,
  Video,
  Camera as CameraIcon,
  RefreshCw,
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  CheckCircle2,
  Bookmark,
  Trash2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { notify } from "@/lib/notify";
import { triggerNotchNotification } from "@/lib/notchNotification";
import { UploadProgress, type UploadStage } from "@/components/UploadProgress";
import { triggerLightHaptic, triggerSuccessHaptic } from "@/lib/haptics";
import {
  hasStoryDraft,
  saveStoryDraft,
  loadStoryDraft,
  clearStoryDraft,
  type StoryDraftMetadata,
} from "@/lib/storyDraft";

const MAX_RECORD_SECONDS = 30; // Maximum story recording duration

function formatDuration(seconds: number): string {
  const s = Math.floor(seconds);
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

export default function StoryComposerPage() {
  const { user, profile } = useAuth();
  const nav = useNavigate();
  const [tab, setTab] = useState<"photos" | "video" | "record">("photos");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [stages, setStages] = useState<UploadStage[]>([]);

  // Draft state
  const [draftAvailable, setDraftAvailable] = useState<StoryDraftMetadata | null>(null);
  const [draftSavedToast, setDraftSavedToast] = useState(false);

  // Recording State & Duration Tracking
  const [recording, setRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [facing, setFacing] = useState<"user" | "environment">("user");
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);

  // Upload Duration & Overall Progress Tracking
  const [uploadDuration, setUploadDuration] = useState(0);
  const [overallUploadProgress, setOverallUploadProgress] = useState(0);

  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<number | null>(null);
  const uploadTimerRef = useRef<number | null>(null);

  // Check for saved draft in localStorage on mount
  useEffect(() => {
    (async () => {
      try {
        const draft = await loadStoryDraft();
        if (draft && draft.metadata) {
          setDraftAvailable(draft.metadata);
        }
      } catch (err) {
        console.warn("Failed to check story draft:", err);
      }
    })();
  }, []);

  const resumeDraft = async () => {
    void triggerLightHaptic();
    try {
      const res = await loadStoryDraft();
      if (!res) return;
      setTab(res.metadata.tab);
      setFacing(res.metadata.facing);
      setRecordDuration(res.metadata.recordDuration);
      if (res.videoBlob && res.videoUrl) {
        const ext = res.metadata.mimeType?.includes("mp4") ? "mp4" : "webm";
        const file = new File(
          [res.videoBlob],
          res.metadata.fileName || `draft-recording-${Date.now()}.${ext}`,
          { type: res.metadata.mimeType || "video/webm" }
        );
        setFiles([file]);
        setRecordedVideoUrl(res.videoUrl);
      }
      setDraftAvailable(null);
      toast.success("Story draft resumed! You can continue recording or post.");
    } catch (err) {
      toast.error("Failed to load draft.");
    }
  };

  const discardDraft = async () => {
    void triggerLightHaptic();
    await clearStoryDraft();
    setDraftAvailable(null);
    toast("Story draft discarded.");
  };

  const saveCurrentDraft = async () => {
    void triggerLightHaptic();
    try {
      let videoBlobToSave: Blob | null = null;
      const dur = recordDuration;

      if (recording) {
        stopRecording();
      }

      if (files.length > 0) {
        videoBlobToSave = files[0];
      } else if (chunksRef.current.length > 0) {
        videoBlobToSave = new Blob(chunksRef.current, { type: "video/webm" });
      }

      await saveStoryDraft({
        tab,
        recordDuration: dur,
        facing,
        videoBlob: videoBlobToSave,
        fileName: files[0]?.name,
      });

      setDraftSavedToast(true);
      setTimeout(() => setDraftSavedToast(false), 3000);
      toast.success("Story draft saved to localStorage! You can resume recording later.");
    } catch (err) {
      toast.error("Failed to save draft.");
    }
  };

  // Auto-save draft when navigating away or unmounting if unsaved work exists
  useEffect(() => {
    const onLeave = () => {
      if (files.length > 0 || chunksRef.current.length > 0 || (tab === "record" && recordDuration > 0)) {
        const blob =
          files[0] ||
          (chunksRef.current.length > 0 ? new Blob(chunksRef.current, { type: "video/webm" }) : null);
        void saveStoryDraft({
          tab,
          recordDuration,
          facing,
          videoBlob: blob,
          fileName: files[0]?.name,
        });
      }
    };

    window.addEventListener("beforeunload", onLeave);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
      onLeave();
    };
  }, [tab, recordDuration, facing, files]);

  // Start/Stop Camera Stream when in "record" tab
  useEffect(() => {
    if (tab !== "record") {
      stopCameraStream();
      return;
    }

    let active = true;
    (async () => {
      try {
        stopCameraStream();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1080 }, height: { ideal: 1920 } },
          audio: true,
        });
        if (!active) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        mediaStreamRef.current = stream;
        if (videoPreviewRef.current) {
          videoPreviewRef.current.srcObject = stream;
        }
      } catch (err) {
        toast.error("Camera or microphone permission was denied.");
      }
    })();

    return () => {
      active = false;
      stopCameraStream();
    };
  }, [tab, facing]);

  const stopCameraStream = () => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  };

  // Start recording video story
  const startRecording = () => {
    if (!mediaStreamRef.current) {
      toast.error("Camera is not available.");
      return;
    }

    void triggerLightHaptic();
    chunksRef.current = [];
    setRecordDuration(0);
    setRecordedVideoUrl(null);

    try {
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : MediaRecorder.isTypeSupported("video/mp4")
        ? "video/mp4"
        : "video/webm";

      const recorder = new MediaRecorder(mediaStreamRef.current, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const videoUrl = URL.createObjectURL(blob);
        setRecordedVideoUrl(videoUrl);

        // Turn recorded blob into File for upload
        const ext = mimeType.includes("mp4") ? "mp4" : "webm";
        const file = new File([blob], `story-recording-${Date.now()}.${ext}`, { type: mimeType });
        setFiles([file]);
      };

      recorder.start(200); // 200ms timeslices
      setRecording(true);

      const startTime = Date.now();
      recordTimerRef.current = window.setInterval(() => {
        const elapsed = (Date.now() - startTime) / 1000;
        setRecordDuration(elapsed);

        if (elapsed >= MAX_RECORD_SECONDS) {
          stopRecording();
        }
      }, 100);
    } catch (err) {
      toast.error("Failed to start video recording.");
    }
  };

  // Stop recording video story
  const stopRecording = () => {
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

  // Retake video
  const retakeRecording = () => {
    void triggerLightHaptic();
    if (recordedVideoUrl) {
      URL.revokeObjectURL(recordedVideoUrl);
    }
    setRecordedVideoUrl(null);
    setFiles([]);
    setRecordDuration(0);
  };

  // Track upload elapsed duration & overall progress
  useEffect(() => {
    if (!busy) {
      if (uploadTimerRef.current) {
        clearInterval(uploadTimerRef.current);
        uploadTimerRef.current = null;
      }
      setUploadDuration(0);
      setOverallUploadProgress(0);
      return;
    }

    const start = Date.now();
    uploadTimerRef.current = window.setInterval(() => {
      setUploadDuration((Date.now() - start) / 1000);
    }, 200);

    return () => {
      if (uploadTimerRef.current) clearInterval(uploadTimerRef.current);
    };
  }, [busy]);

  // Update overall progress whenever stages change
  useEffect(() => {
    if (stages.length === 0) {
      setOverallUploadProgress(0);
      return;
    }
    const sum = stages.reduce((acc, curr) => acc + curr.progress, 0);
    const avg = Math.round(sum / stages.length);
    setOverallUploadProgress(avg);
  }, [stages]);

  const submit = async () => {
    if (!user || files.length === 0) return;
    setBusy(true);

    const initial: UploadStage[] = files.map((f) => ({
      label: `Uploading ${f.name}`,
      progress: 5,
      status: "active",
    }));
    setStages(initial);

    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (f.size > 50 * 1024 * 1024) {
          toast.error(`${f.name} is over 50MB`);
          continue;
        }

        const ext = f.name.split(".").pop() || "mp4";
        const path = `${user.id}/story-${crypto.randomUUID()}.${ext}`;

        const tick = setInterval(() => {
          setStages((s) =>
            s.map((x, idx) =>
              idx === i && x.progress < 88 ? { ...x, progress: x.progress + 6 } : x
            )
          );
        }, 200);

        const { error: upErr } = await supabase.storage
          .from("media")
          .upload(path, f, { contentType: f.type });

        clearInterval(tick);
        if (upErr) throw upErr;

        setStages((s) =>
          s.map((x, idx) =>
            idx === i ? { ...x, progress: 95, label: `Publishing ${f.name}` } : x
          )
        );

        const url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
        const isVideo = f.type.startsWith("video/") || f.name.endsWith(".webm") || f.name.endsWith(".mp4");

        const { error } = await supabase.from("stories").insert({
          author_id: user.id,
          image_url: url,
          media_type: isVideo ? "video" : "image",
        });

        if (error) throw error;

        setStages((s) =>
          s.map((x, idx) =>
            idx === i ? { ...x, progress: 100, status: "done", label: `Posted ${f.name}` } : x
          )
        );
      }

      const { data: recipients } = await supabase
        .from("profiles")
        .select("id")
        .neq("id", user.id)
        .limit(500);

      notify({
        kind: "story",
        message: `${files.length} new ${files.length === 1 ? "story" : "stories"}`,
        actor: { id: user.id, handle: profile?.handle, display_name: profile?.display_name },
        recipients: (recipients ?? []).map((r) => r.id),
        url: "/",
        dedupe_id: `story:${user.id}:${Date.now()}`,
      });

      triggerNotchNotification({
        kind: "story",
        title: "Story published! 📸",
        message: `${files.length} new story flick${files.length > 1 ? "s" : ""} live for 24h`,
        actor: {
          id: user.id,
          display_name: profile?.display_name || "You",
          handle: profile?.handle || "user",
          avatar_url: profile?.avatar_url,
        },
        url: "/",
      });

      await clearStoryDraft();

      setTimeout(() => {
        setStages([]);
        nav("/");
      }, 900);
    } catch (e) {
      setStages((s) =>
        s.map((x) => (x.status === "active" ? { ...x, status: "error", detail: "failed" } : x))
      );
      toast.error((e as Error).message);
      setTimeout(() => setStages([]), 4000);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen p-4 pb-28 relative select-none">
      {/* Visual Progress Indicator at Top of Page for Recording & Uploading Duration */}
      <div className="fixed top-0 inset-x-0 z-50">
        {/* Progress Bar Track */}
        <div className="h-1.5 w-full bg-secondary/80 backdrop-blur-md overflow-hidden border-b border-border/40">
          <motion.div
            className={`h-full ${
              recording
                ? "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.8)]"
                : "bg-gradient-to-r from-snap via-emerald-400 to-snap shadow-[0_0_15px_rgba(197,232,99,0.9)]"
            }`}
            initial={{ width: "0%" }}
            animate={{
              width: recording
                ? `${Math.min(100, (recordDuration / MAX_RECORD_SECONDS) * 100)}%`
                : busy
                ? `${overallUploadProgress}%`
                : files.length > 0
                ? "100%"
                : "0%",
            }}
            transition={{ ease: "linear", duration: recording ? 0.1 : 0.2 }}
          />
        </div>

        {/* Live Floating Status & Duration Badge */}
        <AnimatePresence>
          {(recording || busy) && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mx-auto mt-2 w-fit px-3.5 py-1.5 rounded-full bg-black/90 backdrop-blur-xl border border-white/15 text-xs flex items-center gap-2.5 shadow-2xl"
            >
              {recording ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-ping shrink-0" />
                  <span className="font-extrabold text-rose-400 tracking-wider">REC</span>
                  <span className="font-mono font-bold text-white">
                    {formatDuration(recordDuration)} / {formatDuration(MAX_RECORD_SECONDS)}
                  </span>
                </>
              ) : busy ? (
                <>
                  <div className="w-3.5 h-3.5 rounded-full border-2 border-snap border-t-transparent animate-spin shrink-0" />
                  <span className="font-bold text-snap">Uploading</span>
                  <span className="font-mono text-white/90">
                    {overallUploadProgress}% · ({formatDuration(uploadDuration)})
                  </span>
                </>
              ) : null}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Header bar */}
      <header className="flex items-center justify-between mt-2 mb-4">
        <button
          onClick={() => nav("/")}
          className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition"
          title="Back to feed"
        >
          <X className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h1 className="font-display text-xl font-bold tracking-tight">New Story</h1>
          <p className="text-[11px] text-muted-foreground">Disappears after 24 hours</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={saveCurrentDraft}
            disabled={busy || (files.length === 0 && !recording && recordDuration === 0 && !recordedVideoUrl)}
            className={`px-3 py-1.5 rounded-full border border-border/80 text-xs font-bold transition flex items-center gap-1.5 ${
              draftSavedToast
                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/50"
                : "hover:border-snap/80 text-muted-foreground hover:text-foreground hover:bg-secondary/60 disabled:opacity-30"
            }`}
            title="Save composition as draft in localStorage"
          >
            {draftSavedToast ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Saved</span>
              </>
            ) : (
              <>
                <Bookmark className="w-3.5 h-3.5 text-snap" />
                <span className="hidden sm:inline">Save Draft</span>
              </>
            )}
          </button>
          <button
            onClick={submit}
            disabled={busy || files.length === 0}
            className="px-5 py-1.5 rounded-full bg-snap text-snap-foreground font-extrabold text-xs disabled:opacity-40 shadow-md hover:opacity-95 active:scale-95 transition"
          >
            {busy ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-full border-2 border-snap-foreground border-t-transparent animate-spin" />
                <span>{Math.round(overallUploadProgress)}%</span>
              </span>
            ) : (
              "Post Story"
            )}
          </button>
        </div>
      </header>

      {/* Unsaved Draft Resume Banner */}
      <AnimatePresence>
        {draftAvailable && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mb-4 p-3.5 rounded-2xl bg-[#141724] border border-snap/40 backdrop-blur-md flex items-center justify-between gap-3 shadow-xl"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-snap/15 border border-snap/30 text-snap flex items-center justify-center shrink-0 shadow-inner">
                <Bookmark className="w-4 h-4 fill-snap/30" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <span>Resume Saved Draft</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-snap/20 text-snap font-mono uppercase">
                    localStorage
                  </span>
                </p>
                <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                  {draftAvailable.hasRecordedVideo
                    ? `Recorded clip (${formatDuration(draftAvailable.recordDuration)})`
                    : draftAvailable.tab === "photos"
                    ? "Bulk photos draft"
                    : "Video draft"} · Saved {new Date(draftAvailable.savedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={discardDraft}
                className="p-1.5 text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition"
                title="Discard draft"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={resumeDraft}
                className="px-3.5 py-1.5 rounded-full bg-snap text-black text-xs font-extrabold hover:brightness-110 active:scale-95 transition shadow-sm"
              >
                Resume
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mode selection tabs */}
      <div className="flex gap-2 mb-4 bg-secondary/40 p-1 rounded-full border border-border/60">
        {(
          [
            { id: "photos", label: "Bulk Photos" },
            { id: "video", label: "Upload Video" },
            { id: "record", label: "Record Clip" },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            onClick={() => {
              setTab(t.id);
              setFiles([]);
              retakeRecording();
            }}
            className={`flex-1 py-1.5 px-3 rounded-full text-xs font-bold transition ${
              tab === t.id
                ? "bg-snap text-snap-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab 1 & 2: Upload Area */}
      {tab !== "record" && (
        <label className="block border-2 border-dashed border-border/80 hover:border-snap rounded-3xl p-10 text-center cursor-pointer bg-card/40 transition">
          {tab === "video" ? (
            <Video className="mx-auto w-10 h-10 mb-3 text-snap animate-pulse" />
          ) : (
            <Upload className="mx-auto w-10 h-10 mb-3 text-snap animate-pulse" />
          )}
          <p className="text-sm font-semibold text-foreground">
            {tab === "photos" ? "Tap to select multiple photos" : "Tap to select a video (≤50MB)"}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Supports PNG, JPG, MP4, MOV</p>
          <input
            type="file"
            hidden
            multiple={tab === "photos"}
            accept={tab === "photos" ? "image/*" : "video/*"}
            onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          />
        </label>
      )}

      {/* Tab 3: Live Video Recording */}
      {tab === "record" && (
        <div className="relative aspect-[9/16] max-h-[68vh] mx-auto rounded-3xl overflow-hidden bg-black border border-border/80 shadow-2xl flex flex-col justify-between p-4">
          {/* Top recording duration pill */}
          <div className="flex items-center justify-between z-20">
            <div className="px-3 py-1 rounded-full bg-black/60 backdrop-blur border border-white/10 text-xs font-mono font-bold flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  recording ? "bg-rose-500 animate-ping" : "bg-snap"
                }`}
              />
              <span>
                {formatDuration(recordDuration)} / {formatDuration(MAX_RECORD_SECONDS)}
              </span>
            </div>

            {!recordedVideoUrl && (
              <button
                type="button"
                onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
                className="p-2 rounded-full bg-black/60 backdrop-blur border border-white/10 text-white hover:text-snap transition"
                title="Flip Camera"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Camera Viewport or Recorded Video Preview */}
          <div className="absolute inset-0 z-0">
            {recordedVideoUrl ? (
              <video
                src={recordedVideoUrl}
                controls
                autoPlay
                loop
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <video
                ref={videoPreviewRef}
                autoPlay
                playsInline
                muted
                onError={(e) => e.preventDefault()}
                style={{ transform: facing === "user" ? "scaleX(-1)" : undefined }}
                className="w-full h-full object-cover"
              />
            )}
          </div>

          {/* Bottom Record / Retake Controls */}
          <div className="z-20 mt-auto flex items-center justify-center gap-4 pt-4">
            {!recordedVideoUrl ? (
              <button
                type="button"
                onClick={recording ? stopRecording : startRecording}
                className={`w-18 h-18 rounded-full border-4 flex items-center justify-center transition shadow-2xl active:scale-95 ${
                  recording
                    ? "border-rose-500 bg-rose-500/30 text-rose-500"
                    : "border-snap bg-white text-black"
                }`}
                title={recording ? "Stop Recording" : "Record Video Clip"}
              >
                {recording ? (
                  <div className="w-6 h-6 rounded-md bg-rose-500" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-snap" />
                )}
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={retakeRecording}
                  className="px-3.5 py-2 rounded-full bg-black/70 backdrop-blur border border-white/20 text-white text-xs font-bold flex items-center gap-1.5 hover:bg-black/90 transition"
                  title="Retake recording"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Retake</span>
                </button>
                <button
                  type="button"
                  onClick={saveCurrentDraft}
                  className="px-3.5 py-2 rounded-full bg-black/70 backdrop-blur border border-snap/40 text-snap text-xs font-bold flex items-center gap-1.5 hover:bg-black/90 transition"
                  title="Save clip as draft in localStorage"
                >
                  <Bookmark className="w-3.5 h-3.5" />
                  <span>Save Draft</span>
                </button>
                <button
                  type="button"
                  onClick={submit}
                  disabled={busy}
                  className="px-4 py-2 rounded-full bg-snap text-snap-foreground text-xs font-extrabold flex items-center gap-1.5 shadow-lg hover:opacity-95 transition"
                >
                  <Sparkles className="w-3.5 h-3.5 fill-current" />
                  <span>Post Clip</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Selected media preview grid */}
      {files.length > 0 && tab !== "record" && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold px-1">
            <span className="text-muted-foreground">{files.length} item(s) selected</span>
            <button
              onClick={() => setFiles([])}
              className="text-muted-foreground hover:text-foreground"
            >
              Clear
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {files.map((f, i) => (
              <div
                key={i}
                className="aspect-square rounded-2xl overflow-hidden bg-secondary border border-border/80 relative shadow-md"
              >
                {f.type.startsWith("image/") ? (
                  <img
                    src={URL.createObjectURL(f)}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full p-2 flex flex-col items-center justify-center text-center text-xs">
                    <Video className="w-6 h-6 text-snap mb-1" />
                    <span className="break-all text-[10px] line-clamp-2 text-foreground font-semibold">
                      {f.name}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Upload Stages Drawer */}
      <UploadProgress stages={stages} onDismiss={() => setStages([])} />
    </div>
  );
}
