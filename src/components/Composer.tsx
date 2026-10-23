import { useRef, useState } from "react";
import { ImagePlus, X, Mic, Video, Music } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";
import { Avatar } from "./Avatar";
import { UploadProgress, type UploadStage } from "./UploadProgress";
import { notify } from "@/lib/notify";
import { triggerNotchNotification } from "@/components/notifications/NotchNotification";
import {
  getSupportedAudioMimeType,
  classifyMicError,
  generateSyntheticVoiceNoteBlob,
  type MicErrorInfo,
} from "@/lib/audioRecorder";
import { MicPermissionModal } from "@/components/chat/MicPermissionModal";

export function Composer({ onPosted }: { onPosted: () => void }) {
  const { user, profile } = useAuth();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [stages, setStages] = useState<UploadStage[]>([]);
  const [micModalOpen, setMicModalOpen] = useState(false);
  const [micErrorInfo, setMicErrorInfo] = useState<MicErrorInfo | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const audRef = useRef<HTMLInputElement>(null);

  const pick = (f: File, maxMb: number) => {
    if (f.size > maxMb * 1024 * 1024) {
      toast.error(`File over ${maxMb}MB`);
      return;
    }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const recordVoice = async () => {
    if (recording) {
      recorderRef.current?.stop();
      return;
    }
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error("Microphone API not available in this browser context.");
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const { mimeType, extension } = getSupportedAudioMimeType();
      const options = mimeType ? { mimeType } : undefined;
      const rec = new MediaRecorder(stream, options);
      const chunks: Blob[] = [];
      rec.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunks.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mimeType || "audio/webm" });
        const f = new File([blob], `voice-${Date.now()}.${extension}`, { type: mimeType || "audio/webm" });
        setFile(f);
        setPreview(URL.createObjectURL(f));
        setRecording(false);
      };
      rec.start(250);
      recorderRef.current = rec;
      setRecording(true);
      setTimeout(() => {
        if (rec.state === "recording") rec.stop();
      }, 120000);
    } catch (err) {
      const info = classifyMicError(err);
      setMicErrorInfo(info);
      setMicModalOpen(true);
      toast.error(info.title, { description: info.message });
    }
  };

  const retryMicPermission = async (): Promise<boolean> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return true;
    } catch {
      return false;
    }
  };

  const attachDemoVoiceNote = () => {
    try {
      const blob = generateSyntheticVoiceNoteBlob(2.5);
      const f = new File([blob], `voice-sample-${Date.now()}.wav`, { type: "audio/wav" });
      setFile(f);
      setPreview(URL.createObjectURL(f));
      toast.success("Sample voice note attached!");
    } catch {
      toast.error("Could not generate voice note preview");
    }
  };

  const submit = async () => {
    if (!user || (!text.trim() && !file)) return;
    setBusy(true);
    const upStage: UploadStage = {
      label: file ? `Uploading ${file.name}` : "Preparing",
      progress: 5,
      status: "active",
    };
    const postStage: UploadStage = { label: "Publishing flick", progress: 0, status: "active" };
    setStages([upStage, postStage]);
    try {
      let media_url: string | null = null;
      let media_type = "text";
      let image_url: string | null = null;
      if (file) {
        const path = `${user.id}/${crypto.randomUUID()}-${file.name}`;
        // simulated progress ticker (Supabase JS doesn't expose upload progress)
        const ticker = setInterval(() => {
          setStages((s) =>
            s.map((x, i) => (i === 0 && x.progress < 88 ? { ...x, progress: x.progress + 7 } : x)),
          );
        }, 250);
        const { error: upErr } = await supabase.storage
          .from("media")
          .upload(path, file, { contentType: file.type });
        clearInterval(ticker);
        if (upErr) throw upErr;
        setStages((s) => s.map((x, i) => (i === 0 ? { ...x, progress: 100, status: "done" } : x)));
        media_url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
        if (file.type.startsWith("image/")) {
          media_type = "image";
          image_url = media_url;
        } else if (file.type.startsWith("video/")) media_type = "video";
        else if (file.type.startsWith("audio/")) media_type = "audio";
      } else {
        setStages((s) => s.map((x, i) => (i === 0 ? { ...x, progress: 100, status: "done" } : x)));
      }
      setStages((s) => s.map((x, i) => (i === 1 ? { ...x, progress: 60 } : x)));
      const { error } = await supabase.from("posts").insert({
        author_id: user.id,
        content: text.trim() || "",
        image_url,
        media_url,
        media_type,
      });
      if (error) throw error;
      setStages((s) => s.map((x, i) => (i === 1 ? { ...x, progress: 100, status: "done" } : x)));
      const { data: recipients } = await supabase
        .from("profiles")
        .select("id")
        .neq("id", user.id)
        .limit(500);
      notify({
        kind: "post",
        message: text.trim().slice(0, 120) || "Posted a flick",
        actor: { id: user.id, handle: profile?.handle, display_name: profile?.display_name },
        recipients: (recipients ?? []).map((r) => r.id),
        url: profile?.handle ? `/u/${profile.handle}` : "/",
        dedupe_id: `post:${user.id}:${Date.now()}`,
      });
      triggerNotchNotification({
        kind: "post",
        title: "Your flick is live! ⚡️",
        message: text.trim().slice(0, 80) || "Published to Explore feed",
        actor: {
          id: user.id,
          display_name: profile?.display_name || "You",
          handle: profile?.handle || "user",
          avatar_url: profile?.avatar_url,
        },
        url: profile?.handle ? `/u/${profile.handle}` : "/",
      });
      toast.success("Flick posted");
      setTimeout(() => setStages([]), 1800);
      setText("");
      setFile(null);
      setPreview(null);
      onPosted();
    } catch (e) {
      setStages((s) =>
        s.map((x) => (x.status === "active" ? { ...x, status: "error", detail: "failed" } : x)),
      );
      toast.error((e as Error).message);
      setTimeout(() => setStages([]), 4000);
    } finally {
      setBusy(false);
    }
  };

  const isImage = file?.type.startsWith("image/");
  const isVideo = file?.type.startsWith("video/");
  const isAudio = file?.type.startsWith("audio/");

  return (
    <div data-coach="coach-composer" className="border-b border-border p-4 flex gap-3">
      <Avatar url={profile?.avatar_url} name={profile?.display_name} size={44} />
      <div className="flex-1">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 280))}
          placeholder="What's flickering?"
          className="w-full bg-transparent text-xl placeholder:text-muted-foreground resize-none focus:outline-none min-h-[60px]"
        />
        {preview && (
          <div className="relative inline-block max-w-full">
            {isImage && (
              <img src={preview} alt="" className="rounded-2xl max-h-72 border border-border" />
            )}
            {isVideo && (
              <video src={preview} controls className="rounded-2xl max-h-72 border border-border" />
            )}
            {isAudio && <audio src={preview} controls className="w-full" />}
            <button
              onClick={() => {
                setFile(null);
                setPreview(null);
              }}
              className="absolute top-2 right-2 bg-black/60 backdrop-blur p-1.5 rounded-full"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        <div className="flex items-center justify-between mt-3">
          <div className="flex gap-1">
            <button
              onClick={() => imgRef.current?.click()}
              className="p-2 rounded-full hover:bg-secondary text-primary"
            >
              <ImagePlus className="w-5 h-5" />
            </button>
            <button
              onClick={() => vidRef.current?.click()}
              className="p-2 rounded-full hover:bg-secondary text-primary"
            >
              <Video className="w-5 h-5" />
            </button>
            <button
              onClick={() => audRef.current?.click()}
              className="p-2 rounded-full hover:bg-secondary text-primary"
            >
              <Music className="w-5 h-5" />
            </button>
            <button
              onClick={recordVoice}
              className={`p-2 rounded-full hover:bg-secondary ${recording ? "text-red-500 animate-pulse" : "text-primary"}`}
            >
              <Mic className="w-5 h-5" />
            </button>
            <input
              ref={imgRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => e.target.files?.[0] && pick(e.target.files[0], 10)}
            />
            <input
              ref={vidRef}
              type="file"
              accept="video/*"
              hidden
              onChange={(e) => e.target.files?.[0] && pick(e.target.files[0], 50)}
            />
            <input
              ref={audRef}
              type="file"
              accept="audio/*"
              hidden
              onChange={(e) => e.target.files?.[0] && pick(e.target.files[0], 25)}
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">{280 - text.length}</span>
            <button
              disabled={busy || (!text.trim() && !file)}
              onClick={submit}
              className="px-5 py-2 rounded-full bg-primary text-primary-foreground font-bold disabled:opacity-50 transition hover:brightness-110"
            >
              Flick
            </button>
          </div>
        </div>
      </div>
      <UploadProgress stages={stages} onDismiss={() => setStages([])} />
      <MicPermissionModal
        open={micModalOpen}
        errorInfo={micErrorInfo}
        onClose={() => setMicModalOpen(false)}
        onRetry={retryMicPermission}
        onSendDemoVN={attachDemoVoiceNote}
      />
    </div>
  );
}
