import { ImagePlus, X, Mic, Video, Music, Link2, Sparkles, Loader2, Smile } from "lucide-react";
import { FullEmojiPicker } from "@/components/common/FullEmojiPicker";
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
import { detectSocialUrl, resolveSocialEmbed, type SocialEmbed } from "@/lib/socialEmbeds";
import { SocialEmbedCard } from "@/components/social/SocialEmbedCard";

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
  const [embed, setEmbed] = useState<SocialEmbed | null>(null);
  const [resolvingEmbed, setResolvingEmbed] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkInput, setLinkInput] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const imgRef = useRef<HTMLInputElement>(null);
  const vidRef = useRef<HTMLInputElement>(null);
  const audRef = useRef<HTMLInputElement>(null);

  const checkTextForEmbed = async (val: string) => {
    setText(val);
    if (embed) return;
    const detected = detectSocialUrl(val);
    if (detected) {
      setResolvingEmbed(true);
      try {
        const resolved = await resolveSocialEmbed(detected.url);
        if (resolved) {
          setEmbed(resolved);
          toast.success(`Imported post from ${resolved.platform === "twitter" ? "X" : resolved.platform}!`);
        }
      } catch {}
      setResolvingEmbed(false);
    }
  };

  const importLinkDirectly = async (urlToImport: string) => {
    if (!urlToImport.trim()) return;
    setResolvingEmbed(true);
    try {
      const resolved = await resolveSocialEmbed(urlToImport.trim());
      if (resolved) {
        setEmbed(resolved);
        if (!text.trim()) {
          setText(resolved.caption || resolved.url);
        } else if (!text.includes(resolved.url)) {
          setText((prev) => `${prev}\n${resolved.url}`);
        }
        setShowLinkInput(false);
        setLinkInput("");
        toast.success(`Imported post from ${resolved.platform === "twitter" ? "X" : resolved.platform}! ⚡️`);
      } else {
        toast.error("Please paste a valid Instagram, Twitter (X), or TikTok post link");
      }
    } catch {
      toast.error("Failed to parse social link");
    } finally {
      setResolvingEmbed(false);
    }
  };

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
        if (embed) {
          image_url = embed.mediaUrl || null;
          media_url = embed.mediaUrl || null;
          media_type = embed.mediaType || "image";
        }
      }
      setStages((s) => s.map((x, i) => (i === 1 ? { ...x, progress: 60 } : x)));
      const { error } = await supabase.from("posts").insert({
        author_id: user.id,
        content: text.trim() || (embed ? embed.caption || embed.url : ""),
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
      setEmbed(null);
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
          onChange={(e) => checkTextForEmbed(e.target.value.slice(0, 500))}
          placeholder="What's flickering? (Paste Instagram, X, or TikTok links to auto-embed)"
          className="w-full bg-transparent text-xl placeholder:text-muted-foreground resize-none focus:outline-none min-h-[60px]"
        />

        {resolvingEmbed && (
          <div className="flex items-center gap-2 py-2 px-3 rounded-xl bg-secondary/60 text-xs text-snap animate-pulse font-mono">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Resolving social media embed preview…</span>
          </div>
        )}

        {/* Social Link Importer Box */}
        {showLinkInput && (
          <div className="p-3 mb-3 rounded-2xl bg-secondary/80 border border-border space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-foreground">
              <span className="flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-snap" />
                <span>Import from Instagram, X, or TikTok</span>
              </span>
              <button
                type="button"
                onClick={() => setShowLinkInput(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="flex gap-2">
              <input
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                placeholder="Paste link: https://x.com/..., instagram.com/p/..., tiktok.com/..."
                className="flex-1 bg-background px-3 py-1.5 rounded-xl text-xs border border-border focus:outline-none focus:ring-1 focus:ring-snap text-foreground"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void importLinkDirectly(linkInput);
                  }
                }}
              />
              <button
                type="button"
                onClick={() => importLinkDirectly(linkInput)}
                disabled={resolvingEmbed || !linkInput.trim()}
                className="px-3.5 py-1.5 rounded-xl bg-snap text-snap-foreground text-xs font-bold hover:brightness-105 transition disabled:opacity-50"
              >
                Import
              </button>
            </div>
          </div>
        )}

        {/* Live Social Embed Preview */}
        {embed && (
          <div className="relative mt-2">
            <SocialEmbedCard embed={embed} />
            <button
              type="button"
              onClick={() => setEmbed(null)}
              className="absolute top-2 right-2 bg-black/70 hover:bg-black p-1.5 rounded-full text-white transition z-10"
              title="Remove embed"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

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
          <div className="flex gap-1 items-center">
            <button
              onClick={() => imgRef.current?.click()}
              className="p-2 rounded-full hover:bg-secondary text-primary"
              title="Add Image"
            >
              <ImagePlus className="w-5 h-5" />
            </button>
            <button
              onClick={() => vidRef.current?.click()}
              className="p-2 rounded-full hover:bg-secondary text-primary"
              title="Add Video"
            >
              <Video className="w-5 h-5" />
            </button>
            <button
              onClick={() => audRef.current?.click()}
              className="p-2 rounded-full hover:bg-secondary text-primary"
              title="Add Audio"
            >
              <Music className="w-5 h-5" />
            </button>
            <button
              onClick={recordVoice}
              className={`p-2 rounded-full hover:bg-secondary ${recording ? "text-red-500 animate-pulse" : "text-primary"}`}
              title="Record Voice"
            >
              <Mic className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowLinkInput(!showLinkInput)}
              className={`p-2 rounded-full hover:bg-secondary ${showLinkInput ? "text-snap bg-snap/15" : "text-primary"}`}
              title="Import Instagram, X, or TikTok Post"
            >
              <Link2 className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setShowEmoji(!showEmoji)}
              className={`p-2 rounded-full hover:bg-secondary transition ${showEmoji ? "text-snap bg-snap/15" : "text-primary"}`}
              title="Add emojis"
            >
              <Smile className="w-5 h-5" />
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
            <span className="text-xs text-muted-foreground">{500 - text.length}</span>
            <button
              disabled={busy || (!text.trim() && !file && !embed)}
              onClick={submit}
              className="px-5 py-2 rounded-full bg-primary text-primary-foreground font-bold disabled:opacity-50 transition hover:brightness-110 shadow-sm"
            >
              Flick
            </button>
          </div>
        </div>

        {/* Full WhatsApp Emoji Keyboard for Post Composer */}
        {showEmoji && (
          <div className="mt-3 flex justify-center border-t border-border pt-3">
            <FullEmojiPicker
              onSelectEmoji={(emoji) => {
                setText((prev) => `${prev} ${emoji}`);
              }}
              onClose={() => setShowEmoji(false)}
              height={320}
              width="100%"
            />
          </div>
        )}
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
