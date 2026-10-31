import { useEffect, useState, useMemo, useRef } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Search,
  Camera,
  Trash2,
  UserPlus,
  Edit,
  ChevronRight,
  Sparkles,
  X,
  Check,
  Send,
  MessageSquare,
  Copy,
  Users,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { formatDistanceToNowStrict } from "date-fns";
import { useOnlinePresence } from "@/lib/presence";
import { getAllChatDrafts } from "@/lib/chatDraft";
import { SnapWebStage } from "@/components/chat/SnapWebStage";
import { StoryViewer } from "@/components/StoryViewer";
import type { StoryGroup } from "@/components/StoriesBar";

type Profile = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  status_emoji?: string;
  snap_status?: {
    type: "purple_snap" | "red_snap" | "delivered" | "received" | "opened";
    label: string;
    hasViewButton?: boolean;
  };
};

type ConversationMeta = {
  lastTime: number;
  snippet: string;
  isMine: boolean;
  unreadCount: number;
  mediaType: string | null;
  isRead: boolean;
};

// Seeded authentic Snapchat reference contacts from image_daa6d937.png
const SNAP_REFERENCE_CONTACTS: Profile[] = [
  {
    id: "ref-alte-jesse",
    handle: "alte_jesse",
    display_name: "alte_jesse",
    status_emoji: "😊🗡️",
    avatar_url: "/bitmoji/retro-pop.png",
    snap_status: { type: "purple_snap", label: "New Snap on mobile · 13h" },
  },
  {
    id: "ref-feranmi",
    handle: "feranmi",
    display_name: "Feranmi Timothier",
    avatar_url: "/bitmoji/cyber-vibe.png",
    snap_status: { type: "delivered", label: "Delivered · 21m" },
  },
  {
    id: "ref-mama",
    handle: "mama",
    display_name: "Mama ❤️🖤",
    avatar_url: "/bitmoji/method-rose.png",
    snap_status: { type: "delivered", label: "Delivered · 16m" },
  },
  {
    id: "ref-temi",
    handle: "temi",
    display_name: "Temi",
    avatar_url: null,
    snap_status: { type: "delivered", label: "Delivered · 16m" },
  },
  {
    id: "ref-daniel-dax",
    handle: "danniydey4you",
    display_name: "Dánièl'_Dáx🗡️🚀",
    status_emoji: "😊",
    avatar_url: "/bitmoji/cyber-vibe.png",
    snap_status: { type: "red_snap", label: "New Snap · 2d", hasViewButton: true },
  },
  {
    id: "ref-loli",
    handle: "loli_queen",
    display_name: "Loli💕❤️",
    avatar_url: "/bitmoji/method-rose.png",
    snap_status: { type: "purple_snap", label: "New Snap · 9h", hasViewButton: true },
  },
  {
    id: "ref-adetoyese",
    handle: "adetoyese",
    display_name: "ADETOYESE",
    avatar_url: null,
    snap_status: { type: "delivered", label: "Delivered · 20m" },
  },
  {
    id: "ref-opeoluwa",
    handle: "opeoluwa",
    display_name: "Opeoluwa",
    avatar_url: "/bitmoji/retro-pop.png",
    snap_status: { type: "red_snap", label: "New Snap · 5d", hasViewButton: true },
  },
  {
    id: "ref-w-underboy",
    handle: "underboy2",
    display_name: "W Underboy2.0",
    avatar_url: "/bitmoji/cyber-vibe.png",
    snap_status: { type: "received", label: "Received · 4h" },
  },
  {
    id: "ref-jay",
    handle: "jay_flick",
    display_name: "Jay",
    avatar_url: null,
    snap_status: { type: "purple_snap", label: "New Snap · 4h", hasViewButton: true },
  },
  {
    id: "ref-set-2k29",
    handle: "set_2k29",
    display_name: "SET 2K29",
    avatar_url: "/bitmoji/retro-pop.png",
    snap_status: { type: "red_snap", label: "New Snap · 13h", hasViewButton: true },
  },
  {
    id: "ref-omolade",
    handle: "omolade",
    display_name: "Omolade",
    avatar_url: "/bitmoji/method-rose.png",
    snap_status: { type: "purple_snap", label: "New Snap · 4d", hasViewButton: true },
  },
];

// Seeded authentic stories from image_daa6d937.png stories row
const SNAP_REFERENCE_STORIES: StoryGroup[] = [
  {
    author: {
      id: "story-ibrahim",
      handle: "ibrahim",
      display_name: "Ibrahim",
      avatar_url: "/bitmoji/cyber-vibe.png",
    },
    segments: [
      {
        id: "seg-1",
        author_id: "story-ibrahim",
        image_url: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=80",
        media_type: "image",
        caption: "Late night in the lab ⚡",
        created_at: new Date(Date.now() - 3600000).toISOString(),
        expires_at: new Date(Date.now() + 82800000).toISOString(),
      },
    ],
  },
  {
    author: {
      id: "story-praize",
      handle: "praize",
      display_name: "Praize 📷",
      avatar_url: "/bitmoji/retro-pop.png",
    },
    segments: [
      {
        id: "seg-2",
        author_id: "story-praize",
        image_url: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&auto=format&fit=crop&q=80",
        media_type: "image",
        caption: "Golden hour snaps ✨",
        created_at: new Date(Date.now() - 7200000).toISOString(),
        expires_at: new Date(Date.now() + 79200000).toISOString(),
      },
    ],
  },
  {
    author: {
      id: "story-kafo",
      handle: "kafo",
      display_name: "Kafo 🌸",
      avatar_url: "/bitmoji/method-rose.png",
    },
    segments: [
      {
        id: "seg-3",
        author_id: "story-kafo",
        image_url: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&auto=format&fit=crop&q=80",
        media_type: "image",
        caption: "Cherry blossom season 🌸",
        created_at: new Date(Date.now() - 10800000).toISOString(),
        expires_at: new Date(Date.now() + 75600000).toISOString(),
      },
    ],
  },
  {
    author: {
      id: "story-abims",
      handle: "abims",
      display_name: "Abims 🦅",
      avatar_url: "/bitmoji/cyber-vibe.png",
    },
    segments: [
      {
        id: "seg-4",
        author_id: "story-abims",
        image_url: "https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=800&auto=format&fit=crop&q=80",
        media_type: "image",
        caption: "City skyline view 🌆",
        created_at: new Date(Date.now() - 14400000).toISOString(),
        expires_at: new Date(Date.now() + 72000000).toISOString(),
      },
    ],
  },
];

export default function MessagesPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [people, setPeople] = useState<Profile[]>([]);
  const [metaMap, setMetaMap] = useState<Record<string, ConversationMeta>>({});
  const [typingMap, setTypingMap] = useState<Record<string, boolean>>({});
  const [draftsMap, setDraftsMap] = useState<
    Record<string, { text?: string; hasVn?: boolean; vnDuration?: number; updatedAt: number }>
  >(() => getAllChatDrafts());
  const [q, setQ] = useState("");
  const { pathname } = useLocation();
  const showList = pathname === "/messages";
  const { isUserOnline } = useOnlinePresence();

  // Stories viewer state
  const [activeStoryGroup, setActiveStoryGroup] = useState<StoryGroup[] | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);

  // Modals state
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState("");

  const storiesContainerRef = useRef<HTMLDivElement | null>(null);

  // Persisted list of deleted thread IDs
  const [deletedIds, setDeletedIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("flick:deleted_chat_threads") || "[]");
    } catch {
      return [];
    }
  });

  const handleDeleteThread = async (partnerId: string, partnerName: string) => {
    void triggerMediumHaptic();
    setDeletedIds((prev) => {
      const next = Array.from(new Set([...prev, partnerId]));
      try {
        localStorage.setItem("flick:deleted_chat_threads", JSON.stringify(next));
      } catch {}
      return next;
    });

    toast.success(`Chat with ${partnerName} deleted`, {
      action: {
        label: "Undo",
        onClick: () => {
          setDeletedIds((prev) => {
            const next = prev.filter((id) => id !== partnerId);
            try {
              localStorage.setItem("flick:deleted_chat_threads", JSON.stringify(next));
            } catch {}
            return next;
          });
          toast("Chat restored");
        },
      },
    });
  };

  // Load contacts and conversations ordered by latest message
  const loadConversations = async () => {
    if (!user) return;

    // 1. Fetch real profiles from database
    const { data: dbProfiles } = await supabase
      .from("profiles")
      .select("id, handle, display_name, avatar_url")
      .neq("id", user.id)
      .limit(100);

    const realProfiles = (dbProfiles ?? []) as Profile[];

    // 2. Fetch all recent messages sent or received by current user
    const now = new Date().toISOString();
    const { data: messages } = await supabase
      .from("messages")
      .select("id, sender_id, recipient_id, content, media_type, created_at, read_at")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("created_at", { ascending: false })
      .limit(300);

    // Merge database profiles with Snapchat reference contacts
    const combinedMap = new Map<string, Profile>();

    // Real profiles first
    realProfiles.forEach((p) => combinedMap.set(p.id, p));

    // Fill in reference contacts from screenshot so the UI matches image_daa6d937.png authentically
    SNAP_REFERENCE_CONTACTS.forEach((ref) => {
      if (!combinedMap.has(ref.id) && !combinedMap.has(ref.handle)) {
        combinedMap.set(ref.id, ref);
      }
    });

    setPeople(Array.from(combinedMap.values()));

    // Build latest message metadata per conversation partner
    const metas: Record<string, ConversationMeta> = {};
    if (messages) {
      for (const m of messages) {
        const partnerId = m.sender_id === user.id ? m.recipient_id : m.sender_id;
        const msgTime = new Date(m.created_at).getTime();
        const isMine = m.sender_id === user.id;
        const isUnread = !isMine && !m.read_at;

        if (!metas[partnerId]) {
          let snippet = m.content || "";
          if (m.media_type === "fashion_look") {
            snippet = "👗 Shared a fashion look";
          } else if (!snippet) {
            if (m.media_type === "audio") snippet = "Voice note";
            else if (m.media_type === "image") snippet = "Photo snap";
            else if (m.media_type === "video") snippet = "Video snap";
            else snippet = "Sent an attachment";
          }
          metas[partnerId] = {
            lastTime: msgTime,
            snippet,
            isMine,
            unreadCount: isUnread ? 1 : 0,
            mediaType: m.media_type || null,
            isRead: Boolean(m.read_at),
          };
        } else {
          if (msgTime > metas[partnerId].lastTime) {
            metas[partnerId].lastTime = msgTime;
          }
          if (isUnread) {
            metas[partnerId].unreadCount += 1;
          }
        }
      }
    }
    setMetaMap(metas);
  };

  useEffect(() => {
    loadConversations();

    const onDmUpdate = () => {
      loadConversations();
    };

    const onTypingUpdate = (e: Event) => {
      const detail = (e as CustomEvent<{ senderId?: string; isTyping?: boolean }>).detail;
      if (detail?.senderId) {
        setTypingMap((prev) => ({ ...prev, [detail.senderId!]: detail.isTyping !== false }));
        if (detail.isTyping !== false) {
          setTimeout(() => {
            setTypingMap((prev) => ({ ...prev, [detail.senderId!]: false }));
          }, 3500);
        }
      }
    };

    const refreshDrafts = () => {
      setDraftsMap(getAllChatDrafts());
    };

    window.addEventListener("flick:dm-unread-updated", onDmUpdate);
    window.addEventListener("flick:dm-typing-update", onTypingUpdate);
    window.addEventListener("flick:presence-update", onDmUpdate);
    window.addEventListener("flick:chat-draft-updated", refreshDrafts);
    window.addEventListener("storage", refreshDrafts);

    const interval = setInterval(() => {
      loadConversations();
      refreshDrafts();
    }, 6000);

    return () => {
      window.removeEventListener("flick:dm-unread-updated", onDmUpdate);
      window.removeEventListener("flick:dm-typing-update", onTypingUpdate);
      window.removeEventListener("flick:presence-update", onDmUpdate);
      window.removeEventListener("flick:chat-draft-updated", refreshDrafts);
      window.removeEventListener("storage", refreshDrafts);
      clearInterval(interval);
    };
  }, [user?.id]);

  const sortedPeople = useMemo(() => {
    return [...people].sort((a, b) => {
      const metaA = metaMap[a.id];
      const metaB = metaMap[b.id];

      const unreadA = metaA?.unreadCount || 0;
      const unreadB = metaB?.unreadCount || 0;

      if (unreadA > 0 && unreadB > 0) {
        return (metaB?.lastTime || 0) - (metaA?.lastTime || 0);
      }
      if (unreadA > 0 && unreadB === 0) return -1;
      if (unreadB > 0 && unreadA === 0) return 1;

      const draftA = draftsMap[a.id];
      const draftB = draftsMap[b.id];
      const hasDraftA = Boolean(draftA && (draftA.text || draftA.hasVn));
      const hasDraftB = Boolean(draftB && (draftB.text || draftB.hasVn));

      if (hasDraftA && !hasDraftB) return -1;
      if (hasDraftB && !hasDraftA) return 1;

      const timeA = metaA?.lastTime || 0;
      const timeB = metaB?.lastTime || 0;
      if (timeA !== timeB) {
        return timeB - timeA;
      }

      return a.display_name.localeCompare(b.display_name);
    });
  }, [people, metaMap, draftsMap]);

  const filtered = sortedPeople
    .filter((p) => !deletedIds.includes(p.id))
    .filter(
      (p) =>
        !q.trim() ||
        p.handle.toLowerCase().includes(q.toLowerCase()) ||
        p.display_name.toLowerCase().includes(q.toLowerCase())
    );

  const scrollStoriesRight = () => {
    if (storiesContainerRef.current) {
      storiesContainerRef.current.scrollBy({ left: 160, behavior: "smooth" });
    }
  };

  return (
    <div className="grid lg:grid-cols-[380px_minmax(0,1fr)] h-full min-w-0 overflow-hidden bg-[#121316]">
      {/* Left Column: Authentic Snapchat Web Desktop Sidebar */}
      <aside
        className={`${
          showList ? "block" : "hidden lg:block"
        } border-r border-white/5 bg-[#121316] pb-28 lg:pb-0 overflow-y-auto min-w-0 min-h-0 flex flex-col`}
      >
        {/* Header matching image_daa6d937.png */}
        <header className="sticky top-0 bg-[#121316]/95 backdrop-blur-xl border-b border-white/5 p-3.5 space-y-3 z-20">
          <div className="flex items-center justify-between">
            {/* User Avatar with Profile Link */}
            <Link
              to="/profile"
              className="relative rounded-full ring-2 ring-emerald-500/80 p-0.5 hover:opacity-90 transition shrink-0"
              title="My Profile"
            >
              <Avatar
                url={profile?.avatar_url || null}
                name={profile?.display_name || "Me"}
                size={34}
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#121316]" />
            </Link>

            {/* Snapchat Ghost Logo in Center */}
            <div className="flex items-center justify-center">
              <div className="w-8 h-8 rounded-full bg-[#fffc00] grid place-items-center shadow-sm">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-black">
                  <path d="M12.001 2c-3.568 0-6.19 2.584-6.19 6.223 0 1.25.32 2.227.79 3.036-.583.193-1.46.543-1.92 1.134-.37.478-.344 1.05-.205 1.488.225.71.82 1.118 1.47 1.22.148.243.328.46.54.646-.358.825-1.127 1.428-2.128 1.834-.347.142-.516.488-.415.845.097.34.406.574.76.574.195 0 .4-.07.59-.158 1.464-.679 2.766-.54 3.738.196.883.67 1.892 1.162 3.06 1.162 1.167 0 2.176-.492 3.06-1.162.97-.736 2.274-.875 3.738-.196.19.088.395.158.59.158.354 0 .663-.234.76-.574.101-.357-.068-.703-.415-.845-1-.406-1.77-1.009-2.128-1.834.212-.186.392-.403.54-.646.65-.102 1.245-.51 1.47-1.22.14-.438.165-1.01-.205-1.488-.46-.591-1.337-.941-1.92-1.134.47-.809.79-1.786.79-3.036C18.19 4.584 15.57 2 12.001 2z" />
                </svg>
              </div>
            </div>

            {/* Right Action Icons: Add Friend (with 14 badge) & New Chat */}
            <div className="flex items-center gap-2">
              {/* Add Friend button with badge '14' */}
              <button
                type="button"
                onClick={() => setShowAddFriendModal(true)}
                className="relative p-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition cursor-pointer"
                title="Add Friends (14 requests)"
              >
                <UserPlus className="w-4 h-4" />
                <span className="absolute -top-1 -right-1 px-1.5 min-w-[17px] h-[17px] rounded-full bg-[#0084ff] text-white text-[10px] font-bold grid place-items-center shadow-sm">
                  14
                </span>
              </button>

              {/* New Chat Button */}
              <button
                type="button"
                onClick={() => setShowNewChatModal(true)}
                className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition cursor-pointer"
                title="New Chat"
              >
                <Edit className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search Bar with My AI Chip Button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search"
                className="w-full bg-[#24262b] rounded-full pl-9 pr-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-[#fffc00] placeholder:text-zinc-400 text-white"
              />
            </div>

            {/* My AI Chip Button */}
            <button
              type="button"
              onClick={() => {
                void triggerLightHaptic();
                navigate("/messages/my-ai");
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#24262b] hover:bg-[#2e3138] border border-white/5 text-xs font-semibold text-white transition active:scale-95 shrink-0 cursor-pointer shadow-sm"
              title="Chat with My AI"
            >
              <span>My AI</span>
              <div className="w-4 h-4 rounded-full bg-gradient-to-tr from-pink-500 to-indigo-500 grid place-items-center text-[10px]">
                ✨
              </div>
            </button>
          </div>
        </header>

        {/* Stories Horizontal Tray right under search */}
        <div className="relative px-3 py-2.5 border-b border-white/5 bg-[#121316]">
          <div
            ref={storiesContainerRef}
            className="flex items-center gap-3 overflow-x-auto no-scrollbar scroll-smooth pr-8"
          >
            {SNAP_REFERENCE_STORIES.map((story, idx) => (
              <button
                key={story.author.id}
                type="button"
                onClick={() => {
                  void triggerLightHaptic();
                  setActiveStoryGroup(SNAP_REFERENCE_STORIES);
                  setActiveStoryIndex(idx);
                }}
                className="flex flex-col items-center gap-1 shrink-0 group cursor-pointer"
              >
                {/* Avatar with cyan/blue gradient ring matching screenshot */}
                <div className="p-[2px] rounded-full bg-gradient-to-tr from-cyan-400 via-sky-500 to-blue-500 group-hover:scale-105 transition-transform shadow-sm">
                  <div className="p-0.5 rounded-full bg-[#121316]">
                    <Avatar
                      url={story.author.avatar_url}
                      name={story.author.display_name}
                      size={48}
                    />
                  </div>
                </div>
                <span className="text-[11px] font-medium text-zinc-300 group-hover:text-white truncate max-w-[56px] text-center">
                  {story.author.display_name.split(" ")[0]}
                </span>
              </button>
            ))}
          </div>

          {/* Right Scroll Chevron Arrow */}
          <button
            type="button"
            onClick={scrollStoriesRight}
            className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-black/60 hover:bg-black/90 text-zinc-300 hover:text-white border border-white/10 grid place-items-center transition shadow-md cursor-pointer z-10"
            title="Next stories"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Snap Conversation List */}
        <ul className="divide-y divide-white/5 overflow-y-auto flex-1">
          <AnimatePresence initial={false}>
            {filtered.map((p) => {
              const meta = metaMap[p.id];
              const hasUnread = Boolean(meta?.unreadCount && meta.unreadCount > 0);
              const isTyping = Boolean(typingMap[p.id]);
              const isOnline = isUserOnline(p.id);

              // Render accurate Snapchat status indicators matching screenshot
              const renderSnapStatus = () => {
                if (isTyping) {
                  return (
                    <div className="flex items-center text-xs font-bold text-[#fffc00]">
                      <span className="flex gap-0.5 mr-1.5">
                        <span className="w-1.5 h-1.5 bg-[#fffc00] rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 bg-[#fffc00] rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 bg-[#fffc00] rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                      <span>Typing…</span>
                    </div>
                  );
                }

                // If this is a reference contact with seeded snap status
                if (p.snap_status) {
                  if (p.snap_status.type === "purple_snap") {
                    return (
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-1.5 text-xs text-[#a855f7] font-semibold truncate">
                          {/* Solid purple square */}
                          <div className="w-3.5 h-3.5 rounded-sm bg-[#9b51e0] shrink-0" />
                          <span className="truncate">{p.snap_status.label}</span>
                        </div>
                        {p.snap_status.hasViewButton && (
                          <span className="text-[11px] font-bold text-[#a855f7] bg-[#a855f7]/15 px-2 py-0.5 rounded-full shrink-0">
                            View
                          </span>
                        )}
                      </div>
                    );
                  }

                  if (p.snap_status.type === "red_snap") {
                    return (
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-1.5 text-xs text-[#ff3b30] font-semibold truncate">
                          {/* Solid red square */}
                          <div className="w-3.5 h-3.5 rounded-sm bg-[#ff3b30] shrink-0" />
                          <span className="truncate">{p.snap_status.label}</span>
                        </div>
                        {p.snap_status.hasViewButton && (
                          <span className="text-[11px] font-bold text-[#ff3b30] bg-[#ff3b30]/15 px-2 py-0.5 rounded-full shrink-0">
                            View
                          </span>
                        )}
                      </div>
                    );
                  }

                  if (p.snap_status.type === "delivered") {
                    return (
                      <div className="flex items-center gap-1.5 text-xs text-zinc-400 font-medium truncate">
                        {/* Hollow grey camera */}
                        <Camera className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                        <span className="truncate">{p.snap_status.label}</span>
                      </div>
                    );
                  }

                  if (p.snap_status.type === "received") {
                    return (
                      <div className="flex items-center gap-1.5 text-xs text-[#0084ff] font-medium truncate">
                        {/* Hollow blue chat */}
                        <MessageSquare className="w-3.5 h-3.5 text-[#0084ff] shrink-0" />
                        <span className="truncate">{p.snap_status.label}</span>
                      </div>
                    );
                  }
                }

                // Check unread real messages
                if (hasUnread) {
                  return (
                    <div className="flex items-center gap-1.5 text-xs text-[#fffc00] font-bold truncate">
                      <div className="w-3.5 h-3.5 rounded-sm bg-[#fffc00] shrink-0" />
                      <span className="truncate">New Snap</span>
                    </div>
                  );
                }

                if (meta?.snippet) {
                  return (
                    <div className="flex items-center gap-1.5 text-xs text-zinc-400 truncate">
                      <span className="w-1.5 h-1.5 rounded-full bg-zinc-500 shrink-0" />
                      <span className="truncate">{meta.snippet}</span>
                    </div>
                  );
                }

                return (
                  <div className="flex items-center gap-1.5 text-xs text-zinc-400/80 truncate">
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                        isOnline ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"
                      }`}
                    />
                    <span>{isOnline ? "Online" : "Tap to chat"}</span>
                  </div>
                );
              };

              return (
                <motion.li
                  key={p.id}
                  layout
                  initial={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="relative overflow-hidden group select-none bg-[#121316]"
                >
                  {/* Swipe delete action background */}
                  <div className="absolute inset-y-0 right-0 w-24 bg-rose-600 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteThread(p.id, p.display_name)}
                      className="w-full h-full flex items-center justify-center gap-1 text-white font-bold text-xs hover:bg-rose-700 transition"
                      title="Delete thread"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>

                  {/* Conversation Row Foreground */}
                  <motion.div
                    drag="x"
                    dragConstraints={{ left: -96, right: 0 }}
                    dragElastic={0.1}
                    onDragEnd={(_e, info) => {
                      if (info.offset.x < -60 || info.velocity.x < -250) {
                        void handleDeleteThread(p.id, p.display_name);
                      }
                    }}
                    className={`relative z-10 flex items-center gap-3 px-3.5 py-3 bg-[#121316] hover:bg-white/[0.04] transition cursor-pointer ${
                      hasUnread ? "bg-white/[0.02]" : ""
                    }`}
                  >
                    {/* Contact Avatar */}
                    <Link
                      to={`/messages/${p.id}`}
                      className="relative shrink-0"
                      onClick={() => {
                        setMetaMap((prev) => {
                          if (!prev[p.id]) return prev;
                          return { ...prev, [p.id]: { ...prev[p.id], unreadCount: 0 } };
                        });
                      }}
                    >
                      <Avatar
                        url={p.avatar_url}
                        name={p.display_name}
                        size={46}
                        ring={isTyping}
                      />
                      {p.status_emoji && (
                        <span className="absolute -bottom-1 -left-1 text-xs">
                          {p.status_emoji}
                        </span>
                      )}
                      {isOnline && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#121316]" />
                      )}
                    </Link>

                    {/* Middle: Display name & Snap Status */}
                    <Link
                      to={`/messages/${p.id}`}
                      className="min-w-0 flex-1"
                      onClick={() => {
                        setMetaMap((prev) => {
                          if (!prev[p.id]) return prev;
                          return { ...prev, [p.id]: { ...prev[p.id], unreadCount: 0 } };
                        });
                      }}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                          <span>{p.display_name}</span>
                        </span>
                      </div>

                      <div className="mt-1 flex items-center">
                        {renderSnapStatus()}
                      </div>
                    </Link>

                    {/* Quick Camera Action Shortcut on Right */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void triggerLightHaptic();
                        navigate(`/messages/${p.id}`);
                      }}
                      className="p-2 text-zinc-500 hover:text-white hover:bg-white/10 rounded-full transition shrink-0 cursor-pointer"
                      title={`Snap with ${p.display_name}`}
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </motion.div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      </aside>

      {/* Right Column: Snap Web Stage (when no thread selected) or Active Thread */}
      <section
        className={`${
          showList ? "hidden lg:flex" : "flex"
        } flex-col h-full min-w-0 overflow-hidden bg-[#121315]`}
      >
        {pathname === "/messages" ? (
          <SnapWebStage
            onSelectUser={(userId) => navigate(`/messages/${userId}`)}
            onOpenNewChat={() => setShowNewChatModal(true)}
            onOpenMyAI={() => navigate("/messages/my-ai")}
          />
        ) : (
          <Outlet />
        )}
      </section>

      {/* Story Viewer Modal */}
      {activeStoryGroup && (
        <StoryViewer
          groups={activeStoryGroup}
          startIndex={activeStoryIndex}
          onClose={() => setActiveStoryGroup(null)}
        />
      )}

      {/* Add Friend Modal */}
      <AnimatePresence>
        {showAddFriendModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#202125] border border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#0084ff] text-white grid place-items-center">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-white text-base">Add Friends</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddFriendModal(false)}
                  className="p-1 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 rounded-2xl bg-black/40 border border-white/5 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white">Your Flick Link</div>
                  <div className="text-[11px] text-zinc-400">flick.app/@{profile?.handle || "you"}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`https://flick.app/@${profile?.handle || "user"}`);
                    toast.success("Profile link copied to clipboard!");
                  }}
                  className="px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold flex items-center gap-1 transition"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-zinc-400 uppercase tracking-wider">Quick Add</div>
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {SNAP_REFERENCE_CONTACTS.slice(0, 4).map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between p-2 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar url={c.avatar_url} name={c.display_name} size={36} />
                        <div>
                          <div className="text-xs font-bold text-white">{c.display_name}</div>
                          <div className="text-[10px] text-zinc-400">@{c.handle}</div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          toast.success(`Friend request sent to ${c.display_name}!`);
                        }}
                        className="px-3 py-1 rounded-full bg-[#0084ff] text-white font-bold text-xs hover:bg-[#0074e0] transition"
                      >
                        + Add
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Chat Modal */}
      <AnimatePresence>
        {showNewChatModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-[#202125] border border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-[#fffc00] text-black grid place-items-center">
                    <Edit className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-white text-base">New Chat</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(false)}
                  className="p-1 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  value={newChatSearch}
                  onChange={(e) => setNewChatSearch(e.target.value)}
                  placeholder="To: Search name or @handle"
                  className="w-full bg-[#16171a] rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#fffc00] text-white placeholder:text-zinc-500 border border-white/5"
                />
              </div>

              {/* My AI Quick option */}
              <button
                type="button"
                onClick={() => {
                  setShowNewChatModal(false);
                  navigate("/messages/my-ai");
                }}
                className="w-full flex items-center justify-between p-2.5 rounded-2xl bg-gradient-to-r from-[#9b51e0]/20 to-pink-500/10 border border-[#9b51e0]/30 hover:border-[#9b51e0]/60 transition text-left"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-pink-500 to-indigo-500 grid place-items-center text-sm shadow-sm">
                    ✨
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-1.5">
                      <span>My AI</span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-pink-500/20 text-pink-300 font-semibold">BOT</span>
                    </div>
                    <div className="text-[10px] text-zinc-400">Always here to chat & brainstorm</div>
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-zinc-400" />
              </button>

              {/* Contacts list */}
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {people
                  .filter(
                    (p) =>
                      !newChatSearch ||
                      p.display_name.toLowerCase().includes(newChatSearch.toLowerCase()) ||
                      p.handle.toLowerCase().includes(newChatSearch.toLowerCase())
                  )
                  .map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setShowNewChatModal(false);
                        navigate(`/messages/${p.id}`);
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-white/[0.06] transition text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar url={p.avatar_url} name={p.display_name} size={36} />
                        <div>
                          <div className="text-xs font-bold text-white">{p.display_name}</div>
                          <div className="text-[10px] text-zinc-400">@{p.handle}</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-zinc-500" />
                    </button>
                  ))}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
