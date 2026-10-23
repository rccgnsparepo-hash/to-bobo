import { useParams, Link } from "react-router-dom";
import { useEffect, useRef, useState, useMemo } from "react";
import {
  ArrowLeft,
  Send,
  Timer,
  Paperclip,
  Mic,
  Image as ImageIcon,
  Settings2,
  Reply,
  X,
  Smile,
  Camera,
  Check,
  CheckCheck,
  Sparkles,
  Phone,
  Video,
  Info,
  Search,
  Plus,
  Download,
  Flame,
  Zap,
  ZoomIn,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { Avatar } from "@/components/Avatar";
import { VoiceMessage } from "@/components/VoiceMessage";
import { notify } from "@/lib/notify";
import { ChatProfileSheet } from "@/components/ChatProfileSheet";
import { ActiveCallModal, type CallType } from "@/components/chat/ActiveCallModal";
import { MicPermissionModal } from "@/components/chat/MicPermissionModal";
import { QuickRepliesBar } from "@/components/chat/QuickRepliesBar";
import { MediaViewerModal } from "@/components/chat/MediaViewerModal";
import { downloadMedia } from "@/lib/downloadMedia";
import {
  getSupportedAudioMimeType,
  classifyMicError,
  generateSyntheticVoiceNoteBlob,
  type MicErrorInfo,
} from "@/lib/audioRecorder";
import {
  triggerNotchNotification,
  type NotchStyle,
  getStoredNotchStyle,
} from "@/components/notifications/NotchNotification";
import { useOnlinePresence, recordUserActivity } from "@/lib/presence";
import { sendDmBroadcast } from "@/lib/dmBroadcast";

type Msg = {
  id: string;
  sender_id: string;
  recipient_id: string;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
  expires_at: string | null;
  read_at: string | null;
  reply_to_id: string | null;
  reply_snippet: string | null;
  reactions?: Record<string, string[]>; // emoji -> array of user_ids
};

type Profile = { id: string; handle: string; display_name: string; avatar_url: string | null };

const POPULAR_EMOJIS = ["😂", "🔥", "❤️", "⚡", "👏", "💯", "🚀", "😍", "✨", "🙌"];
const QUICK_REACTION_EMOJIS = ["❤️", "🔥", "😂", "😮", "👏", "⚡"];

const DISAPPEAR_PRESETS = [
  { label: "Off", sec: null },
  { label: "30s", sec: 30 },
  { label: "5m", sec: 300 },
  { label: "1h", sec: 3600 },
  { label: "24h", sec: 86400 },
];

export default function ThreadPage() {
  const { userId } = useParams<{ userId: string }>();
  const { user, profile } = useAuth();
  const [other, setOther] = useState<Profile | null>(null);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [bg, setBg] = useState<string | null>(null);
  const [fontScale, setFontScale] = useState<number>(1);
  const [fontFamily, setFontFamily] = useState<string>("system");
  const [disappearSec, setDisappearSec] = useState<number | null>(null);
  const [blocked, setBlocked] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTimerMenu, setShowTimerMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [replyTo, setReplyTo] = useState<Msg | null>(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [peerTyping, setPeerTyping] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [activeReactionMsgId, setActiveReactionMsgId] = useState<string | null>(null);
  const [reactionsMap, setReactionsMap] = useState<Record<string, Record<string, number>>>({});
  const [signed, setSigned] = useState<Record<string, string>>({});
  const [activeCall, setActiveCall] = useState<{ open: boolean; type: CallType }>({
    open: false,
    type: "audio",
  });
  const bgInputRef = useRef<HTMLInputElement>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [micModalOpen, setMicModalOpen] = useState(false);
  const [micErrorInfo, setMicErrorInfo] = useState<MicErrorInfo | null>(null);
  const [radialMenuMsgId, setRadialMenuMsgId] = useState<string | null>(null);
  const [quickReplyMsgId, setQuickReplyMsgId] = useState<string | null>(null);
  const [mediaModal, setMediaModal] = useState<{
    url: string;
    type: string;
    senderName?: string;
    timestamp?: string;
  } | null>(null);
  const isSendingQuickReplyRef = useRef<boolean>(false);

  const typingTimeoutRef = useRef<number | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const lastSentTypingRef = useRef<number>(0);
  const isActivelyTypingRef = useRef<boolean>(false);
  const typingInactivityTimerRef = useRef<number | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordIntervalRef = useRef<number | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const { isUserOnline } = useOnlinePresence();
  const isOnline = isUserOnline(userId);

  const hasRecentMessage = useMemo(() => {
    if (!userId || !msgs.length) return false;
    const latestFromPeer = msgs.filter((m) => m.sender_id === userId).pop();
    if (!latestFromPeer) return false;
    return Date.now() - new Date(latestFromPeer.created_at).getTime() < 120000;
  }, [msgs, userId]);

  const effectiveOnline = peerTyping || isOnline || hasRecentMessage;
  const typingRoomId = useMemo(() => (user && userId ? [user.id, userId].sort().join(":") : null), [user, userId]);

  const emitTypingSignal = (isTyping: boolean) => {
    if (!user || !userId || !typingRoomId) return;

    if (typingChannelRef.current) {
      typingChannelRef.current.send({
        type: "broadcast",
        event: "typing",
        payload: {
          senderId: user.id,
          recipientId: userId,
          roomId: typingRoomId,
          isTyping,
          at: new Date().toISOString(),
        },
      });
    }

    // Direct broadcast to recipient's personal typing channel (shows strictly in-app)
    void sendDmBroadcast(userId, "user-typing", {
      senderId: user.id,
      displayName: profile?.display_name || profile?.handle || "Someone",
      handle: profile?.handle || "user",
      avatarUrl: profile?.avatar_url,
      isTyping,
    });
  };

  const load = async () => {
    if (!user || !userId) return;
    const now = new Date().toISOString();
    const { data } = await supabase
      .from("messages")
      .select("*")
      .or(
        `and(sender_id.eq.${user.id},recipient_id.eq.${userId}),and(sender_id.eq.${userId},recipient_id.eq.${user.id})`,
      )
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("created_at", { ascending: true });
    setMsgs((data ?? []) as Msg[]);
    // mark inbound as read
    setMsgs((rows) =>
      rows.map((m) =>
        m.recipient_id === user.id && m.sender_id === userId && !m.read_at ? { ...m, read_at: now } : m,
      ),
    );
    await supabase
      .from("messages")
      .update({ read_at: now })
      .eq("recipient_id", user.id)
      .eq("sender_id", userId)
      .is("read_at", null);
    // Also clear the notifications-bell counter for DM notifications from this peer.
    await supabase
      .from("notifications")
      .update({ read_at: now })
      .eq("user_id", user.id)
      .eq("actor_id", userId)
      .eq("kind", "message")
      .is("read_at", null);
    window.dispatchEvent(new Event("flick:notifications-updated"));
    window.dispatchEvent(new CustomEvent("flick:dm-unread-updated"));
  };

  useEffect(() => {
    if (!userId) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => setOther(data as Profile | null));
    if (user)
      supabase
        .from("chat_settings")
        .select("bg_url, font_scale, font_family, disappearing_seconds")
        .eq("owner_id", user.id)
        .eq("peer_id", userId)
        .maybeSingle()
        .then(({ data }) => {
          const row = data as {
            bg_url: string | null;
            font_scale: number | null;
            font_family: string | null;
            disappearing_seconds: number | null;
          } | null;
          setBg(row?.bg_url ?? null);
          setFontScale(row?.font_scale ?? 1);
          setFontFamily(row?.font_family ?? "system");
          setDisappearSec(row?.disappearing_seconds ?? null);
        });
    if (user)
      supabase
        .from("blocks")
        .select("blocked_id")
        .eq("blocker_id", user.id)
        .eq("blocked_id", userId)
        .maybeSingle()
        .then(({ data }) => setBlocked(!!data));
    load();
    const ch = supabase
      .channel(`dm-${[user?.id, userId].sort().join("-")}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, (payload) => {
        const row = (payload.new ?? payload.old) as Partial<Msg>;
        if (!row || !user) return;
        const relevant =
          (row.sender_id === user.id && row.recipient_id === userId) ||
          (row.sender_id === userId && row.recipient_id === user.id);
        if (relevant) load();
      })
      .subscribe();

    // Typing presence
    if (user && typingRoomId) {
      const typing = supabase.channel(`dm-typing:${typingRoomId}`, { config: { broadcast: { self: true } } });
      typing
        .on("broadcast", { event: "typing" }, (msg) => {
          const payload = msg.payload as {
            senderId?: string;
            recipientId?: string;
            roomId?: string;
            isTyping?: boolean;
            at?: string;
          };
          if (!payload.senderId || payload.senderId === user.id) return;
          if (payload.roomId && payload.roomId !== typingRoomId) return;
          if (payload.isTyping === false) {
            setPeerTyping(false);
            return;
          }
          setPeerTyping(true);
          if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = window.setTimeout(() => setPeerTyping(false), 2500);
        })
        .subscribe();
      typingChannelRef.current = typing;
    }
    const cull = setInterval(
      () => setMsgs((m) => m.filter((x) => !x.expires_at || new Date(x.expires_at) > new Date())),
      5000,
    );
    return () => {
      if (isActivelyTypingRef.current) {
        isActivelyTypingRef.current = false;
        emitTypingSignal(false);
      }
      if (typingInactivityTimerRef.current) window.clearTimeout(typingInactivityTimerRef.current);
      supabase.removeChannel(ch);
      if (typingChannelRef.current) supabase.removeChannel(typingChannelRef.current);
      if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
      clearInterval(cull);
    };
  }, [userId, user?.id, typingRoomId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs.length, peerTyping]);

  // Resolve private DM attachment paths into short-lived signed URLs.
  useEffect(() => {
    const paths = msgs
      .map((m) => m.media_url)
      .filter((u): u is string => !!u && !/^https?:\/\//.test(u) && !signed[u]);
    if (paths.length === 0) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase.storage
        .from("dm-media")
        .createSignedUrls([...new Set(paths)], 3600);
      if (cancelled || !data) return;
      setSigned((prev) => {
        const next = { ...prev };
        for (const r of data) if (r.path && r.signedUrl) next[r.path] = r.signedUrl;
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [msgs, signed]);

  const mediaSrc = (u: string | null) =>
    !u ? null : /^https?:\/\//.test(u) ? u : (signed[u] ?? null);

  const send = async () => {
    if (!user || !userId || !text.trim()) return;
    if (blocked) {
      toast.error("You have blocked this user. Unblock to send.");
      return;
    }
    const content = text.trim();
    const reply_to_id = replyTo?.id ?? null;
    const reply_snippet = replyTo
      ? (replyTo.content ?? (replyTo.media_type ? `📎 ${replyTo.media_type}` : "media")).slice(
          0,
          140,
        )
      : null;
    setText("");
    setReplyTo(null);
    setShowEmojiPicker(false);
    if (isActivelyTypingRef.current) {
      isActivelyTypingRef.current = false;
      emitTypingSignal(false);
    }
    if (typingInactivityTimerRef.current) {
      window.clearTimeout(typingInactivityTimerRef.current);
      typingInactivityTimerRef.current = null;
    }
    const expires_at = disappearSec ? new Date(Date.now() + disappearSec * 1000).toISOString() : null;
    const optimistic: Msg = {
      id: `local-${crypto.randomUUID()}`,
      sender_id: user.id,
      recipient_id: userId,
      content,
      media_url: null,
      media_type: null,
      created_at: new Date().toISOString(),
      expires_at: expires_at ?? "",
      read_at: null,
      reply_to_id,
      reply_snippet,
    };
    setMsgs((rows) => [...rows, optimistic]);
    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: user.id,
        recipient_id: userId,
        content,
        reply_to_id,
        reply_snippet,
        expires_at,
      })
      .select("*")
      .single();
    if (error) {
      setMsgs((rows) => rows.filter((m) => m.id !== optimistic.id));
      toast.error(error.message);
      return;
    }
    setMsgs((rows) => rows.map((m) => (m.id === optimistic.id ? (data as Msg) : m)));

    // Send push notification to recipient with actual user handle / ID
    const senderTag = profile?.handle ? `@${profile.handle}` : profile?.display_name || user.id.slice(0, 8);
    notify({
      kind: "message",
      title: `${senderTag} sent a chat`,
      message: content.slice(0, 120),
      actor: {
        id: user.id,
        display_name: profile?.display_name || "User",
        handle: profile?.handle || "user",
      },
      data: { recipient_id: userId, senderId: user.id },
      recipients: [userId],
      url: `/messages/${user.id}`,
      dedupe_id: `message:${user.id}:${data.id}`,
    });

    // Direct broadcast on recipient's personal DM channel for instant in-app notch popup & push everywhere
    void sendDmBroadcast(userId, "new-message", {
      id: data.id,
      sender_id: user.id,
      recipient_id: userId,
      content: content,
      media_type: null,
      media_url: null,
      senderName: profile?.display_name || profile?.handle || "Someone",
      senderHandle: profile?.handle || "user",
      senderAvatar: profile?.avatar_url,
    });
  };

  const sendQuickReply = async (quickText: string, targetMsg: Msg) => {
    if (!user || !userId || !quickText.trim() || isSendingQuickReplyRef.current) return;
    if (blocked) {
      toast.error("You have blocked this user. Unblock to send.");
      return;
    }
    isSendingQuickReplyRef.current = true;
    const content = quickText.trim();
    const reply_to_id = targetMsg.id;
    const reply_snippet = (targetMsg.content ?? (targetMsg.media_type ? `📎 ${targetMsg.media_type}` : "media")).slice(0, 140);
    const expires_at = disappearSec ? new Date(Date.now() + disappearSec * 1000).toISOString() : null;

    const optimistic: Msg = {
      id: `local-${crypto.randomUUID()}`,
      sender_id: user.id,
      recipient_id: userId,
      content,
      media_url: null,
      media_type: null,
      created_at: new Date().toISOString(),
      expires_at: expires_at ?? "",
      read_at: null,
      reply_to_id,
      reply_snippet,
    };

    setMsgs((rows) => [...rows, optimistic]);
    setQuickReplyMsgId(null);
    setRadialMenuMsgId(null);

    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({
          sender_id: user.id,
          recipient_id: userId,
          content,
          reply_to_id,
          reply_snippet,
          expires_at,
        })
        .select("*")
        .single();

      if (error) {
        setMsgs((rows) => rows.filter((m) => m.id !== optimistic.id));
        toast.error(error.message);
        return;
      }

      setMsgs((rows) => rows.map((m) => (m.id === optimistic.id ? (data as Msg) : m)));

      const senderTag = profile?.handle ? `@${profile.handle}` : profile?.display_name || user.id.slice(0, 8);
      notify({
        kind: "message",
        title: `${senderTag} sent a flick`,
        message: content,
        actor: {
          id: user.id,
          display_name: profile?.display_name || "User",
          handle: profile?.handle || "user",
        },
        data: { recipient_id: userId, senderId: user.id },
        recipients: [userId],
        url: `/messages/${user.id}`,
        dedupe_id: `message:${user.id}:${data.id}`,
      });

      void sendDmBroadcast(userId, "new-message", {
        id: data.id,
        sender_id: user.id,
        recipient_id: userId,
        content: content,
        media_type: null,
        media_url: null,
        senderName: profile?.display_name || profile?.handle || "Someone",
        senderHandle: profile?.handle || "user",
        senderAvatar: profile?.avatar_url,
      });

      window.dispatchEvent(new CustomEvent("flick:dm-unread-updated"));
    } finally {
      setTimeout(() => {
        isSendingQuickReplyRef.current = false;
      }, 500);
    }
  };

  const onType = (v: string) => {
    setText(v);
    if (!user || !userId) return;

    if (!v.trim()) {
      if (isActivelyTypingRef.current) {
        isActivelyTypingRef.current = false;
        emitTypingSignal(false);
      }
      if (typingInactivityTimerRef.current) {
        window.clearTimeout(typingInactivityTimerRef.current);
        typingInactivityTimerRef.current = null;
      }
      return;
    }

    const now = Date.now();
    if (!isActivelyTypingRef.current) {
      isActivelyTypingRef.current = true;
      lastSentTypingRef.current = now;
      emitTypingSignal(true);
    }

    if (typingInactivityTimerRef.current) {
      window.clearTimeout(typingInactivityTimerRef.current);
    }
    typingInactivityTimerRef.current = window.setTimeout(() => {
      isActivelyTypingRef.current = false;
      emitTypingSignal(false);
    }, 3500);
  };

  const uploadAndSend = async (f: File, type: "audio" | "file" | "image") => {
    if (!user || !userId) return;
    if (blocked) {
      toast.error("You have blocked this user.");
      return;
    }
    if (f.size > 25 * 1024 * 1024) {
      toast.error("File over 25MB");
      return;
    }
    const detected =
      type === "audio"
        ? "audio"
        : f.type.startsWith("image/")
          ? "image"
          : f.type.startsWith("video/")
            ? "video"
            : f.type.startsWith("audio/")
              ? "audio"
              : "file";
    const folder = [user.id, userId].sort().join("__");
    const path = `${folder}/dm-${crypto.randomUUID()}-${f.name}`;
    const { error: e1 } = await supabase.storage
      .from("dm-media")
      .upload(path, f, { contentType: f.type });
    if (e1) {
      toast.error(e1.message);
      return;
    }
    const url = path;
    const expires_at = disappearSec ? new Date(Date.now() + disappearSec * 1000).toISOString() : null;
    const optimistic: Msg = {
      id: `local-${crypto.randomUUID()}`,
      sender_id: user.id,
      recipient_id: userId,
      content: f.name,
      media_url: url,
      media_type: detected,
      created_at: new Date().toISOString(),
      expires_at: expires_at ?? "",
      read_at: null,
      reply_to_id: null,
      reply_snippet: null,
    };
    setMsgs((rows) => [...rows, optimistic]);
    const { data, error } = await supabase
      .from("messages")
      .insert({
        sender_id: user.id,
        recipient_id: userId,
        content: f.name,
        media_url: url,
        media_type: detected,
        expires_at,
      })
      .select("*")
      .single();
    if (error) {
      setMsgs((rows) => rows.filter((m) => m.id !== optimistic.id));
      toast.error(error.message);
      return;
    }
    setMsgs((rows) => rows.map((m) => (m.id === optimistic.id ? (data as Msg) : m)));
    const mediaTitle =
      detected === "audio"
        ? `${senderTag} sent a voice note`
        : detected === "image"
          ? `${senderTag} sent a photo`
          : `${senderTag} sent a video`;
    const mediaDesc = detected === "audio" ? "🎙️ Voice message" : detected === "image" ? "📷 Photo" : "🎥 Video";
    const senderTag = profile?.handle ? `@${profile.handle}` : profile?.display_name || user.id.slice(0, 8);
    notify({
      kind: "message",
      title: mediaTitle,
      message: mediaDesc,
      actor: {
        id: user.id,
        display_name: profile?.display_name || "User",
        handle: profile?.handle || "user",
      },
      data: { recipient_id: userId, senderId: user.id },
      recipients: [userId],
      url: `/messages/${user.id}`,
      dedupe_id: `message:${user.id}:${data.id}`,
    });

    // Direct broadcast on recipient's personal DM channel for instant in-app notch popup & push everywhere
    void sendDmBroadcast(userId, "new-message", {
      id: data.id,
      sender_id: user.id,
      recipient_id: userId,
      content: f.name,
      media_type: detected,
      media_url: url,
      senderName: profile?.display_name || profile?.handle || "Someone",
      senderHandle: profile?.handle || "user",
      senderAvatar: profile?.avatar_url,
    });
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

  const sendDemoVN = async () => {
    try {
      const blob = generateSyntheticVoiceNoteBlob(3.0);
      const file = new File([blob], `voice-demo-${Date.now()}.wav`, { type: "audio/wav" });
      await uploadAndSend(file, "audio");
      toast.success("Demo voice note sent!");
    } catch {
      toast.error("Could not send demo voice note");
    }
  };

  const recordVoice = async () => {
    if (recording) {
      recorderRef.current?.stop();
      if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      setRecording(false);
      setRecordSeconds(0);
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
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: mimeType || "audio/webm" });
        const file = new File([blob], `voice-${Date.now()}.${extension}`, { type: mimeType || "audio/webm" });
        await uploadAndSend(file, "audio");
        setRecording(false);
        setRecordSeconds(0);
        if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
      };
      rec.start(250);
      recorderRef.current = rec;
      setRecording(true);
      setRecordSeconds(0);
      recordIntervalRef.current = window.setInterval(() => {
        setRecordSeconds((s) => s + 1);
      }, 1000);
      setTimeout(() => {
        if (rec.state === "recording") {
          rec.stop();
          if (recordIntervalRef.current) clearInterval(recordIntervalRef.current);
        }
      }, 120000);
    } catch (err) {
      const info = classifyMicError(err);
      setMicErrorInfo(info);
      setMicModalOpen(true);
      toast.error(info.title, { description: info.message });
    }
  };

  const setBackground = async (file: File) => {
    if (!user || !userId) return;
    const path = `${user.id}/bg-${crypto.randomUUID()}-${file.name}`;
    const { error: e1 } = await supabase.storage
      .from("media")
      .upload(path, file, { contentType: file.type });
    if (e1) {
      toast.error(e1.message);
      return;
    }
    const url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
    await supabase
      .from("chat_settings")
      .upsert(
        { owner_id: user.id, peer_id: userId, bg_url: url, updated_at: new Date().toISOString() },
        { onConflict: "owner_id,peer_id" },
      );
    setBg(url);
    toast.success("Chat background updated");
  };

  const updateDisappearing = async (sec: number | null) => {
    setDisappearSec(sec);
    setShowTimerMenu(false);
    if (!user || !userId) return;
    await supabase
      .from("chat_settings")
      .upsert(
        {
          owner_id: user.id,
          peer_id: userId,
          disappearing_seconds: sec,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "owner_id,peer_id" },
      );
    toast.success(
      sec ? `Disappearing messages set to ${sec >= 3600 ? `${sec / 3600}h` : `${sec}s`}` : "Disappearing messages off",
    );
  };

  const addReaction = (msgId: string, emoji: string) => {
    setReactionsMap((prev) => {
      const msgReactions = prev[msgId] ? { ...prev[msgId] } : {};
      msgReactions[emoji] = (msgReactions[emoji] ?? 0) + 1;
      return { ...prev, [msgId]: msgReactions };
    });
    setActiveReactionMsgId(null);
    toast(`Reacted with ${emoji}`);
  };

  const simulatePeerNotificationNow = () => {
    if (!other) return;
    triggerNotchNotification({
      kind: "message",
      title: `${other.display_name} sent a flick`,
      message: "Check out this new photo flick! Tap to view directly ⚡️",
      actor: other,
      url: `/messages/${other.id}`,
    });
    toast.success("Triggered notification alert!");
  };

  return (
    <div
      className="flex flex-col h-full relative min-w-0 overflow-hidden bg-background"
      style={{
        ...(bg
          ? { backgroundImage: `url(${bg})`, backgroundSize: "cover", backgroundPosition: "center" }
          : {}),
        fontFamily: FONT_MAP[fontFamily] ?? undefined,
      }}
    >
      {/* Modern iOS Top Navigation Header */}
      <header className="shrink-0 sticky top-0 z-20 bg-background/85 backdrop-blur-xl border-b border-border/80 px-3 py-2.5 flex items-center justify-between min-w-0 shadow-sm">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Link
            to="/messages"
            className="p-1.5 -ml-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-secondary transition"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>

          <button
            onClick={() => setProfileOpen(true)}
            className="flex items-center gap-2.5 min-w-0 text-left group"
          >
            <div className="relative shrink-0">
              <Avatar url={other?.avatar_url} name={other?.display_name} size={38} ring={peerTyping} />
              {effectiveOnline && (
                <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="font-bold text-sm truncate group-hover:text-snap transition flex items-center gap-1.5">
                <span>{other?.display_name ?? "Direct Message"}</span>
                <span className="text-[10px] text-muted-foreground font-normal">@{other?.handle}</span>
              </div>
              <div className="text-[11px] flex items-center gap-1.5 leading-none mt-0.5">
                {peerTyping ? (
                  <span className="text-snap font-semibold flex items-center gap-1">
                    <span className="flex gap-0.5">
                      <span className="w-1 h-1 bg-snap rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1 h-1 bg-snap rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1 h-1 bg-snap rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </span>
                    typing…
                  </span>
                ) : effectiveOnline ? (
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Online
                  </span>
                ) : (
                  <span className="text-muted-foreground/75 font-normal flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/30" />
                    Offline
                  </span>
                )}
              </div>
            </div>
          </button>
        </div>

        {/* Top Header Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Disappearing Timer Menu Toggle */}
          <div className="relative">
            <button
              onClick={() => setShowTimerMenu((v) => !v)}
              className={`p-2 rounded-full transition flex items-center gap-1 text-xs font-semibold ${
                disappearSec
                  ? "bg-snap/20 text-snap border border-snap/40"
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
              title="Disappearing timer"
            >
              <Timer className="w-4 h-4" />
              {disappearSec && (
                <span className="text-[10px]">
                  {disappearSec >= 86400
                    ? `${disappearSec / 86400}d`
                    : disappearSec >= 3600
                      ? `${disappearSec / 3600}h`
                      : `${disappearSec}s`}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showTimerMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 5 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 5 }}
                  className="absolute right-0 mt-2 w-40 card-glass rounded-2xl p-1.5 z-40 shadow-2xl border border-white/20"
                >
                  <div className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50">
                    Disappear timer
                  </div>
                  {DISAPPEAR_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => updateDisappearing(p.sec)}
                      className={`w-full text-left px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                        disappearSec === p.sec
                          ? "bg-snap text-black font-bold"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      <span>{p.label}</span>
                      {disappearSec === p.sec && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Audio Call */}
          <button
            onClick={() => setActiveCall({ open: true, type: "audio" })}
            className="p-2 text-muted-foreground hover:text-snap hover:bg-secondary rounded-full transition"
            title="Start voice call"
            aria-label="Voice call"
          >
            <Phone className="w-4 h-4" />
          </button>

          {/* Video Call */}
          <button
            onClick={() => setActiveCall({ open: true, type: "video" })}
            className="p-2 text-muted-foreground hover:text-snap hover:bg-secondary rounded-full transition"
            title="Start video call"
            aria-label="Video call"
          >
            <Video className="w-4 h-4" />
          </button>

          {/* In-chat Search toggle */}
          <button
            onClick={() => {
              setShowSearch((v) => !v);
              if (showSearch) setSearchQuery("");
            }}
            className={`p-2 rounded-full transition ${
              showSearch ? "bg-snap text-black" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
            title="Search in chat"
            aria-label="Search messages"
          >
            <Search className="w-4 h-4" />
          </button>

          {/* Contact Info / Profile Sheet */}
          <button
            onClick={() => setProfileOpen(true)}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition"
            title="Contact Info & Media"
            aria-label="Contact info"
          >
            <Info className="w-4 h-4" />
          </button>

          {/* Chat Background Wallpaper Picker */}
          <button
            onClick={() => bgInputRef.current?.click()}
            className={`p-2 rounded-full transition ${
              bg
                ? "text-snap bg-snap/20 border border-snap/40"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary"
            }`}
            title={bg ? "Change chat wallpaper (Active)" : "Set chat wallpaper"}
            aria-label="Set chat background image"
          >
            <ImageIcon className="w-4 h-4" />
          </button>
          <input
            ref={bgInputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => e.target.files?.[0] && void setBackground(e.target.files[0])}
          />

          {/* Settings */}
          <button
            onClick={() => setShowSettings(true)}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-secondary rounded-full transition"
            aria-label="Chat settings"
          >
            <Settings2 className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* In-chat search bar */}
      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-card/95 backdrop-blur border-b border-border px-4 py-2 flex items-center gap-2 z-10 shrink-0"
          >
            <Search className="w-4 h-4 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search in this conversation..."
              className="bg-transparent flex-1 text-sm outline-none text-foreground placeholder:text-muted-foreground"
            />
            {searchQuery && (
              <span className="text-xs text-muted-foreground font-mono">
                {msgs.filter((m) => m.content?.toLowerCase().includes(searchQuery.toLowerCase())).length} found
              </span>
            )}
            <button
              onClick={() => {
                setShowSearch(false);
                setSearchQuery("");
              }}
              className="p-1 text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Message Stream */}
      <div
        className="flex-1 overflow-y-auto px-3 sm:px-4 md:px-6 py-6 space-y-3 min-h-0 overscroll-contain"
        style={{ fontSize: `${fontScale}rem` }}
      >
        {msgs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center py-16 text-muted-foreground space-y-3">
            <Avatar url={other?.avatar_url} name={other?.display_name} size={64} ring />
            <div>
              <h3 className="font-bold text-foreground text-base">{other?.display_name}</h3>
              <p className="text-xs text-muted-foreground">@{other?.handle} · Flick Direct Message</p>
            </div>
            <p className="text-xs max-w-xs text-muted-foreground/80">
              Send a disappearing message, voice note, or photo. All messages are encrypted & fullstack.
            </p>
          </div>
        )}

        <AnimatePresence initial={false}>
          {msgs.map((m) => {
            const mine = m.sender_id === user?.id;
            const reactions = reactionsMap[m.id];

            return (
              <motion.div
                key={m.id}
                id={`msg-${m.id}`}
                layout
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ type: "spring", stiffness: 360, damping: 28 }}
                drag="x"
                dragConstraints={{ left: 0, right: 0 }}
                dragElastic={0.25}
                onDragEnd={(_, info) => {
                  if (Math.abs(info.offset.x) > 50) setReplyTo(m);
                }}
                className={`flex flex-col group ${mine ? "items-end" : "items-start"}`}
              >
                {/* Replying quote badge if linked */}
                {m.reply_to_id && m.reply_snippet && (
                  <button
                    onClick={() => {
                      const el = document.getElementById(`msg-${m.reply_to_id}`);
                      if (el) {
                        el.scrollIntoView({ behavior: "smooth", block: "center" });
                        el.classList.add("ring-2", "ring-snap");
                        setTimeout(() => el.classList.remove("ring-2", "ring-snap"), 1200);
                      }
                    }}
                    className={`text-left max-w-[82%] sm:max-w-[70%] mb-1 px-3 py-1 rounded-2xl text-[11px] truncate flex items-center gap-1.5 ${
                      mine ? "bg-snap/10 text-snap border border-snap/20" : "bg-secondary text-muted-foreground border border-border"
                    }`}
                  >
                    <Reply className="w-3 h-3 shrink-0" />
                    <span className="truncate">{m.reply_snippet}</span>
                  </button>
                )}

                <div className={`relative flex items-end gap-2 max-w-[88%] sm:max-w-[76%] ${mine ? "flex-row-reverse" : "flex-row"}`}>
                  {/* Left Avatar for incoming peer messages with '+' quick action button */}
                  {!mine && (
                    <div className="relative shrink-0 mb-1">
                      <div className="relative">
                        <Avatar url={other?.avatar_url} name={other?.display_name} size={36} />
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRadialMenuMsgId((curr) => (curr === m.id ? null : m.id));
                          }}
                          className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-snap text-black flex items-center justify-center shadow-md hover:scale-110 active:scale-95 transition"
                          title="Quick actions"
                        >
                          <Plus className="w-3 h-3 stroke-[3]" />
                        </button>
                      </div>

                      {/* Radial / Quick Dock Menu when '+' is tapped */}
                      <AnimatePresence>
                        {radialMenuMsgId === m.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.85, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.85, y: 10 }}
                            className="absolute left-0 bottom-12 z-40 bg-[#14161f]/95 backdrop-blur-2xl border border-white/20 p-2 rounded-2xl shadow-2xl flex items-center gap-2"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setRadialMenuMsgId(null);
                                cameraRef.current?.click();
                              }}
                              className="p-2 rounded-xl bg-white/10 hover:bg-snap hover:text-black text-white transition flex flex-col items-center gap-0.5"
                              title="Camera Snap"
                            >
                              <Camera className="w-4 h-4" />
                              <span className="text-[9px] font-semibold">Snap</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRadialMenuMsgId(null);
                                fileRef.current?.click();
                              }}
                              className="p-2 rounded-xl bg-white/10 hover:bg-snap hover:text-black text-white transition flex flex-col items-center gap-0.5"
                              title="Send File"
                            >
                              <Paperclip className="w-4 h-4" />
                              <span className="text-[9px] font-semibold">File</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                addReaction(m.id, "🔥");
                                setRadialMenuMsgId(null);
                              }}
                              className="p-2 rounded-xl bg-white/10 hover:bg-snap hover:text-black text-white transition flex flex-col items-center gap-0.5"
                              title="Flame"
                            >
                              <Flame className="w-4 h-4 text-orange-400" />
                              <span className="text-[9px] font-semibold">Flame</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRadialMenuMsgId(null);
                                setQuickReplyMsgId((c) => (c === m.id ? null : m.id));
                              }}
                              className="p-2 rounded-xl bg-white/10 hover:bg-snap hover:text-black text-white transition flex flex-col items-center gap-0.5"
                              title="Quick Reply"
                            >
                              <Zap className="w-4 h-4 text-snap" />
                              <span className="text-[9px] font-semibold">Quick</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setReplyTo(m);
                                setRadialMenuMsgId(null);
                              }}
                              className="p-2 rounded-xl bg-white/10 hover:bg-snap hover:text-black text-white transition flex flex-col items-center gap-0.5"
                              title="Reply"
                            >
                              <Reply className="w-4 h-4" />
                              <span className="text-[9px] font-semibold">Reply</span>
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Left Action for Mine (Quick Reply & Quote Reply) */}
                  {mine && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                      <button
                        type="button"
                        onClick={() => setQuickReplyMsgId((curr) => (curr === m.id ? null : m.id))}
                        className="p-1.5 text-muted-foreground hover:text-snap rounded-full transition"
                        title="Quick reply"
                        aria-label="Quick reply"
                      >
                        <Zap className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplyTo(m)}
                        className="p-1.5 text-muted-foreground hover:text-foreground rounded-full transition"
                        title="Quote reply"
                        aria-label="Reply"
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Quick Replies Bar Popup */}
                  <AnimatePresence>
                    {quickReplyMsgId === m.id && (
                      <QuickRepliesBar
                        onSelect={(replyText) => sendQuickReply(replyText, m)}
                        onClose={() => setQuickReplyMsgId(null)}
                        align={mine ? "right" : "left"}
                      />
                    )}
                  </AnimatePresence>

                  {/* Message Bubble - Light White Frosted for Incoming, Deep Cyber Graphite for Outgoing */}
                  <div
                    onDoubleClick={() => setActiveReactionMsgId((curr) => (curr === m.id ? null : m.id))}
                    className={`overflow-hidden transition-all ${
                      mine
                        ? "dm-bubble-outgoing rounded-br-md"
                        : "dm-bubble-incoming rounded-bl-md"
                    }`}
                  >
                    {/* Header inside bubble: Sender name & timestamp */}
                    <div className="flex items-center justify-between px-4 pt-2.5 pb-1 gap-4">
                      <span className={`text-[11px] font-bold tracking-tight ${mine ? "text-snap" : "text-slate-800"}`}>
                        {mine ? "You" : other?.display_name || "Friend"}
                      </span>
                      <span className={`text-[10px] ${mine ? "text-zinc-400" : "text-slate-500"}`}>
                        {new Date(m.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    {/* Media Render */}
                    {m.media_url && !mediaSrc(m.media_url) ? (
                      <div className="px-4 py-3 text-xs text-muted-foreground animate-pulse">Loading media…</div>
                    ) : m.media_type === "audio" && mediaSrc(m.media_url) ? (
                      <div className="px-3.5 py-2">
                        <VoiceMessage
                          src={mediaSrc(m.media_url)!}
                          mine={mine}
                          senderName={mine ? "You" : (other?.display_name || (other?.handle ? `@${other.handle}` : "Voice Note"))}
                          senderAvatar={mine ? profile?.avatar_url : other?.avatar_url}
                        />
                      </div>
                    ) : m.media_type === "image" && mediaSrc(m.media_url) ? (
                      <div className="px-2 pt-1 pb-1">
                        <div
                          onClick={() =>
                            setMediaModal({
                              url: mediaSrc(m.media_url)!,
                              type: "image",
                              senderName: mine ? "You" : other?.display_name,
                              timestamp: m.created_at,
                            })
                          }
                          className="block relative group/img overflow-hidden rounded-2xl cursor-pointer"
                        >
                          <img
                            src={mediaSrc(m.media_url)!}
                            alt={m.content ?? "image"}
                            className="max-h-80 w-full object-cover rounded-2xl hover:scale-[1.02] transition duration-300"
                            loading="lazy"
                          />
                          <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/img:opacity-100 transition flex items-center justify-center gap-2">
                            <span className="p-2 bg-black/60 rounded-full text-white backdrop-blur">
                              <ZoomIn className="w-4 h-4" />
                            </span>
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                void downloadMedia(mediaSrc(m.media_url)!, undefined, "image");
                              }}
                              className="p-2 bg-black/60 rounded-full text-white backdrop-blur hover:bg-snap hover:text-black transition"
                              title="Download to device"
                            >
                              <Download className="w-4 h-4" />
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : m.media_type === "video" && mediaSrc(m.media_url) ? (
                      <div className="px-2 pt-1 pb-1">
                        <div className="relative group/vid rounded-2xl overflow-hidden">
                          <video
                            src={mediaSrc(m.media_url)!}
                            controls
                            className="max-h-80 w-full bg-black rounded-2xl"
                          />
                          <button
                            type="button"
                            onClick={() =>
                              setMediaModal({
                                url: mediaSrc(m.media_url)!,
                                type: "video",
                                senderName: mine ? "You" : other?.display_name,
                                timestamp: m.created_at,
                              })
                            }
                            className="absolute top-2 right-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition backdrop-blur opacity-0 group-hover/vid:opacity-100"
                            title="Expand video"
                          >
                            <ZoomIn className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ) : mediaSrc(m.media_url) ? (
                      /* Sleek Attachment Card matching Joker.psd mockup */
                      <div className="px-3 py-1.5">
                        <div className="bg-[#12141c] text-white p-3 rounded-2xl flex items-center justify-between gap-3 shadow-lg border border-white/10">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10 text-snap">
                              <Paperclip className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <div className="text-xs font-bold truncate text-white">
                                {m.content || "Attached Document.flick"}
                              </div>
                              <div className="text-[10px] text-zinc-400 mt-0.5 flex items-center gap-2">
                                <span>Media File</span>
                                <span>•</span>
                                <span className="text-snap font-medium">Ready</span>
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void downloadMedia(mediaSrc(m.media_url)!, m.content || undefined)}
                            className="w-8 h-8 rounded-full bg-[#22c55e] text-black flex items-center justify-center hover:scale-110 active:scale-95 transition shadow-md shadow-emerald-900/40 shrink-0"
                            title="Download file"
                          >
                            <Download className="w-4 h-4 stroke-[2.5]" />
                          </button>
                        </div>
                      </div>
                    ) : null}

                    {/* Text Content */}
                    {m.content && m.media_type !== "image" && m.media_type !== "video" && m.media_type !== "audio" && (
                      <div className={`px-4 py-2 break-words text-[14px] font-normal leading-relaxed ${
                        mine ? "text-zinc-100" : "text-slate-900"
                      }`}>
                        {m.content}
                      </div>
                    )}

                    {/* Media Caption */}
                    {m.content && (m.media_type === "image" || m.media_type === "video") && (
                      <div className={`px-4 py-1.5 text-xs ${
                        mine ? "text-zinc-300" : "text-slate-600"
                      }`}>{m.content}</div>
                    )}

                    {/* Bottom Metadata: Read Status Indicator */}
                    <div
                      className={`flex items-center justify-end gap-1 px-3 pb-1.5 text-[10px] ${
                        mine ? "text-snap/80" : "text-slate-500"
                      }`}
                    >
                      {mine && (
                        <span className="flex items-center gap-0.5">
                          {m.read_at ? (
                            <>
                              <span className="text-[9px] font-medium text-snap">Read</span>
                              <CheckCheck className="w-3.5 h-3.5 text-snap" title="Read" />
                            </>
                          ) : (
                            <>
                              <span className="text-[9px] text-zinc-400">Sent</span>
                              <Check className="w-3 h-3 text-zinc-400" title="Sent" />
                            </>
                          )}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Right Action for Peer (Quick Reply & Quote Reply) */}
                  {!mine && (
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                      <button
                        type="button"
                        onClick={() => setQuickReplyMsgId((curr) => (curr === m.id ? null : m.id))}
                        className="p-1.5 text-muted-foreground hover:text-snap rounded-full transition"
                        title="Quick reply"
                        aria-label="Quick reply"
                      >
                        <Zap className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setReplyTo(m)}
                        className="p-1.5 text-muted-foreground hover:text-foreground rounded-full transition"
                        title="Quote reply"
                        aria-label="Reply"
                      >
                        <Reply className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {/* Floating Quick Reaction Toolbar */}
                  <AnimatePresence>
                    {activeReactionMsgId === m.id && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.8, y: 10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: 10 }}
                        className={`absolute -top-10 z-30 card-glass rounded-full px-2 py-1 flex items-center gap-1.5 shadow-2xl border border-white/20 ${
                          mine ? "right-0" : "left-0"
                        }`}
                      >
                        {QUICK_REACTION_EMOJIS.map((e) => (
                          <button
                            key={e}
                            onClick={() => addReaction(m.id, e)}
                            className="hover:scale-125 transition text-base p-1"
                          >
                            {e}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Attached Reactions Pills */}
                {reactions && Object.keys(reactions).length > 0 && (
                  <div className={`flex gap-1 mt-1 ${mine ? "mr-2" : "ml-2"}`}>
                    {Object.entries(reactions).map(([emoji, count]) => (
                      <span
                        key={emoji}
                        className="bg-card border border-white/20 rounded-full px-2 py-0.5 text-[11px] shadow-sm flex items-center gap-1"
                      >
                        <span>{emoji}</span>
                        {count > 1 && <span className="font-bold text-muted-foreground">{count}</span>}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Peer Typing Bubble */}
        {peerTyping && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-center gap-2"
          >
            <Avatar url={other?.avatar_url} name={other?.display_name} size={28} />
            <div className="bg-secondary/90 border border-white/10 rounded-2xl rounded-bl-sm px-3.5 py-2 flex items-center gap-1 shadow-sm">
              <span className="w-1.5 h-1.5 bg-snap rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-snap rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-snap rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </motion.div>
        )}

        <div ref={endRef} />
      </div>

      {/* Reply Quote Banner */}
      {replyTo && (
        <div className="px-4 py-2 bg-secondary/80 backdrop-blur border-t border-border flex items-center gap-2 text-xs">
          <Reply className="w-3.5 h-3.5 text-snap" />
          <span className="truncate flex-1 font-medium">Replying to: {replyTo.content?.slice(0, 80) ?? "attachment"}</span>
          <button
            onClick={() => setReplyTo(null)}
            className="p-1 text-muted-foreground hover:text-foreground"
            aria-label="Cancel reply"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Floating Popular Emoji Bar */}
      <AnimatePresence>
        {showEmojiPicker && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="bg-card/95 backdrop-blur-xl border-t border-border px-3 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar shadow-lg"
          >
            {POPULAR_EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setText((prev) => prev + e)}
                className="text-xl p-1.5 hover:scale-125 transition shrink-0"
              >
                {e}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom Floating Composer Rebrand */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="shrink-0 sticky bottom-0 z-20 bg-[#0d0f17]/95 backdrop-blur-2xl border-t border-white/10 px-3 sm:px-4 py-2.5 pb-[max(0.85rem,env(safe-area-inset-bottom))] flex items-center gap-2 min-w-0"
      >
        {/* User avatar on composer left (as in design) */}
        <div className="shrink-0 hidden sm:block">
          <Avatar url={profile?.avatar_url} name={profile?.display_name || user?.email} size={34} />
        </div>

        {/* Quick Camera Snap */}
        <label
          className="p-2 text-zinc-400 hover:text-snap hover:bg-white/5 rounded-full cursor-pointer transition shrink-0"
          title="Snap photo"
        >
          <Camera className="w-5 h-5" />
          <input
            ref={cameraRef}
            type="file"
            hidden
            accept="image/*"
            capture="environment"
            onChange={(e) => e.target.files?.[0] && uploadAndSend(e.target.files[0], "image")}
          />
        </label>

        {/* Attach File */}
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="p-2 text-zinc-400 hover:text-snap hover:bg-white/5 rounded-full transition shrink-0"
          title="Attach file"
        >
          <Paperclip className="w-5 h-5" />
        </button>
        <input
          ref={fileRef}
          type="file"
          hidden
          onChange={(e) => e.target.files?.[0] && uploadAndSend(e.target.files[0], "file")}
        />

        {/* Voice Note Recording Button with Live Timer */}
        {recording ? (
          <div className="flex-1 flex items-center gap-2 bg-red-950/40 border border-red-500/50 rounded-full px-4 py-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-mono font-bold text-red-400">
              Recording {Math.floor(recordSeconds / 60)}:
              {String(recordSeconds % 60).padStart(2, "0")}
            </span>
            <div className="flex-1" />
            <button
              type="button"
              onClick={recordVoice}
              className="px-3 py-1 bg-red-500 text-white rounded-full text-xs font-bold shadow hover:bg-red-600 transition"
            >
              Stop & Send
            </button>
          </div>
        ) : (
          <>
            {/* Input Capsule */}
            <div className="flex-1 min-w-0 flex items-center bg-[#151824] rounded-full px-3.5 py-1.5 border border-white/10 focus-within:border-snap/70 focus-within:ring-1 focus-within:ring-snap/30 shadow-inner">
              <input
                value={text}
                onChange={(e) => onType(e.target.value)}
                onBlur={() => emitTypingSignal(false)}
                placeholder="Send a flick message…"
                className="bg-transparent flex-1 text-sm focus:outline-none placeholder:text-zinc-500 min-w-0 text-white"
              />
              <button
                type="button"
                onClick={() => setShowEmojiPicker((v) => !v)}
                className={`p-1.5 rounded-full transition text-zinc-400 hover:text-snap ${
                  showEmojiPicker ? "text-snap" : ""
                }`}
                title="Emoji"
              >
                <Smile className="w-4 h-4" />
              </button>
            </div>

            {/* Mic trigger */}
            <button
              type="button"
              onClick={recordVoice}
              className="p-2 rounded-full text-zinc-400 hover:text-snap hover:bg-white/5 transition shrink-0"
              title="Record voice note"
            >
              <Mic className="w-5 h-5" />
            </button>

            {/* Rebranded High-Impact SEND Button */}
            <button
              type="submit"
              disabled={!text.trim()}
              className="h-10 px-4 rounded-full bg-snap text-black font-extrabold text-xs uppercase tracking-wider flex items-center justify-center gap-1.5 disabled:opacity-30 disabled:scale-95 hover:scale-105 active:scale-95 transition shadow-lg shadow-snap/20 shrink-0"
              aria-label="Send"
            >
              <span>SEND</span>
              <Send className="w-3.5 h-3.5 stroke-[2.5]" />
            </button>
          </>
        )}
      </form>

      {/* Chat Settings Modal */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowSettings(false)}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur flex items-end md:items-center justify-center p-0 md:p-4"
          >
            <motion.div
              initial={{ y: 40 }}
              animate={{ y: 0 }}
              exit={{ y: 40 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full md:max-w-md bg-card border border-border rounded-t-3xl md:rounded-3xl p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-display text-xl">Chat settings</h3>
                <button onClick={() => setShowSettings(false)} className="p-1">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Text size</label>
                <input
                  type="range"
                  min={0.85}
                  max={1.35}
                  step={0.05}
                  value={fontScale}
                  onChange={(e) => {
                    const v = Number(e.target.value);
                    setFontScale(v);
                    if (user && userId) {
                      void supabase.from("chat_settings").upsert(
                        { owner_id: user.id, peer_id: userId, font_scale: v, updated_at: new Date().toISOString() },
                        { onConflict: "owner_id,peer_id" },
                      );
                    }
                  }}
                  className="w-full accent-snap mt-2"
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Small</span>
                  <span style={{ fontSize: `${fontScale}rem` }}>Aa preview</span>
                  <span>Large</span>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Font family</label>
                <select
                  value={fontFamily}
                  onChange={(e) => {
                    const v = e.target.value;
                    setFontFamily(v);
                    if (user && userId) {
                      void supabase.from("chat_settings").upsert(
                        { owner_id: user.id, peer_id: userId, font_family: v, updated_at: new Date().toISOString() },
                        { onConflict: "owner_id,peer_id" },
                      );
                    }
                  }}
                  className="w-full mt-2 bg-secondary border border-border rounded-xl px-3 py-2 text-sm focus:outline-none"
                >
                  {FONT_OPTIONS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                  <span>Chat Wallpaper</span>
                  {bg && (
                    <button
                      type="button"
                      onClick={async () => {
                        setBg(null);
                        localStorage.removeItem(`flick:chat_bg:${userId}`);
                        if (user && userId) {
                          await supabase.from("chat_settings").upsert(
                            { owner_id: user.id, peer_id: userId, background_url: null, updated_at: new Date().toISOString() },
                            { onConflict: "owner_id,peer_id" },
                          );
                        }
                        toast.success("Wallpaper reset to default");
                      }}
                      className="text-[10px] text-destructive hover:underline font-semibold"
                    >
                      Reset default
                    </button>
                  )}
                </label>
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowSettings(false);
                      bgInputRef.current?.click();
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-secondary border border-border text-xs font-semibold flex items-center justify-center gap-2 hover:bg-secondary/70 transition"
                  >
                    <ImageIcon className="w-4 h-4 text-snap" />
                    <span>{bg ? "Change Wallpaper Image" : "Upload Wallpaper Image"}</span>
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    simulatePeerNotificationNow();
                    setShowSettings(false);
                  }}
                  className="w-full py-2.5 rounded-xl bg-snap text-black font-bold text-xs flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  Test Notification Alert
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <ChatProfileSheet
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        peer={other}
        hasWallpaper={Boolean(bg)}
        onSetWallpaper={() => bgInputRef.current?.click()}
        onStartCall={(type) => setActiveCall({ open: true, type })}
        onSearchInChat={() => setShowSearch(true)}
        onDeleted={() => {
          setMsgs([]);
        }}
      />

      {other && (
        <ActiveCallModal
          open={activeCall.open}
          peer={other}
          callType={activeCall.type}
          onClose={(durationSec) => {
            setActiveCall((c) => ({ ...c, open: false }));
            if (durationSec && durationSec > 0 && user && userId) {
              const mins = Math.floor(durationSec / 60);
              const secs = durationSec % 60;
              const durText = `${mins > 0 ? `${mins}m ` : ""}${secs}s`;
              void supabase.from("messages").insert({
                sender_id: user.id,
                recipient_id: userId,
                content: `📞 ${activeCall.type === "video" ? "Video" : "Voice"} call ended · ${durText}`,
              });
            }
          }}
        />
      )}

      <MicPermissionModal
        open={micModalOpen}
        errorInfo={micErrorInfo}
        onClose={() => setMicModalOpen(false)}
        onRetry={retryMicPermission}
        onSendDemoVN={sendDemoVN}
      />

      <MediaViewerModal
        isOpen={Boolean(mediaModal)}
        onClose={() => setMediaModal(null)}
        mediaUrl={mediaModal?.url ?? null}
        mediaType={mediaModal?.type ?? "image"}
        senderName={mediaModal?.senderName}
        timestamp={mediaModal?.timestamp}
      />
    </div>
  );
}

const FONT_OPTIONS: { id: string; label: string }[] = [
  { id: "system", label: "System default" },
  { id: "trebuchet", label: "Trebuchet MS" },
  { id: "comic", label: "Comic Sans MS" },
  { id: "georgia", label: "Georgia" },
  { id: "times", label: "Times New Roman" },
  { id: "courier", label: "Courier New" },
  { id: "verdana", label: "Verdana" },
  { id: "tahoma", label: "Tahoma" },
  { id: "arial", label: "Arial" },
  { id: "helvetica", label: "Helvetica" },
  { id: "palatino", label: "Palatino" },
  { id: "garamond", label: "Garamond" },
  { id: "impact", label: "Impact" },
  { id: "lucida", label: "Lucida Console" },
  { id: "monaco", label: "Monaco" },
  { id: "brush", label: "Brush Script MT" },
  { id: "copperplate", label: "Copperplate" },
];

const FONT_MAP: Record<string, string> = {
  system: "ui-sans-serif, system-ui, -apple-system, sans-serif",
  trebuchet: '"Trebuchet MS", sans-serif',
  comic: '"Comic Sans MS", "Comic Sans", cursive',
  georgia: "Georgia, serif",
  times: '"Times New Roman", Times, serif',
  courier: '"Courier New", Courier, monospace',
  verdana: "Verdana, Geneva, sans-serif",
  tahoma: "Tahoma, Geneva, sans-serif",
  arial: "Arial, sans-serif",
  helvetica: "Helvetica, Arial, sans-serif",
  palatino: '"Palatino Linotype", Palatino, serif',
  garamond: "Garamond, serif",
  impact: "Impact, Charcoal, sans-serif",
  lucida: '"Lucida Console", Monaco, monospace',
  monaco: "Monaco, Consolas, monospace",
  brush: '"Brush Script MT", cursive',
  copperplate: 'Copperplate, "Copperplate Gothic Light", serif',
};

