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
  MessageSquare,
  Copy,
  Plus,
  Mic,
  Send,
  Radio,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { SpaceService } from "@/lib/space/spaceService";
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
};

type ConversationMeta = {
  lastTime: number;
  snippet: string;
  isMine: boolean;
  unreadCount: number;
  mediaType: string | null;
  isRead: boolean;
};

type StoryRow = {
  id: string;
  author_id: string;
  image_url: string;
  media_type: string | null;
  caption: string | null;
  created_at: string;
  expires_at: string;
  author: { id: string; handle: string; display_name: string; avatar_url: string | null } | null;
};

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

  // Real stories from Supabase
  const [realStoryGroups, setRealStoryGroups] = useState<StoryGroup[]>([]);
  const [activeStoryGroup, setActiveStoryGroup] = useState<StoryGroup[] | null>(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);

  // Modals state
  const [showAddFriendModal, setShowAddFriendModal] = useState(false);
  const [showNewChatModal, setShowNewChatModal] = useState(false);
  const [newChatSearch, setNewChatSearch] = useState("");
  const [allDbProfiles, setAllDbProfiles] = useState<Profile[]>([]);

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

  // Load real active stories from Supabase
  const loadStories = async () => {
    try {
      const { data } = await supabase
        .from("stories")
        .select(
          "id, author_id, image_url, media_type, caption, created_at, expires_at, author:profiles!stories_author_id_fkey (id, handle, display_name, avatar_url)"
        )
        .order("created_at", { ascending: true })
        .limit(100);

      const rows = (data ?? []) as unknown as StoryRow[];
      const byAuthor = new Map<string, StoryGroup>();

      rows.forEach((r) => {
        const author = r.author || {
          id: r.author_id,
          handle: "flicker",
          display_name: "Flicker",
          avatar_url: null,
        };
        const g = byAuthor.get(r.author_id) ?? { author, segments: [] };
        g.segments.push({
          id: r.id,
          author_id: r.author_id,
          image_url: r.image_url,
          media_type: r.media_type,
          caption: r.caption,
          created_at: r.created_at,
          expires_at: r.expires_at,
        });
        byAuthor.set(r.author_id, g);
      });

      // Newest stories first
      const groups = [...byAuthor.values()].sort((a, b) => {
        const timeA = new Date(a.segments[a.segments.length - 1]?.created_at || 0).getTime();
        const timeB = new Date(b.segments[b.segments.length - 1]?.created_at || 0).getTime();
        return timeB - timeA;
      });

      setRealStoryGroups(groups);
    } catch (e) {
      console.warn("Failed to load real stories:", e);
    }
  };

  // Load contacts and conversations ordered by latest message
  const loadConversations = async () => {
    if (!user) return;

    // 1. Fetch real profiles from Supabase database
    const { data: dbProfiles } = await supabase
      .from("profiles")
      .select("id, handle, display_name, avatar_url")
      .neq("id", user.id)
      .limit(150);

    const profileList = (dbProfiles ?? []) as Profile[];
    setAllDbProfiles(profileList);

    // 2. Fetch all real messages for the current user
    const now = new Date().toISOString();
    const { data: messages } = await supabase
      .from("messages")
      .select("id, sender_id, recipient_id, content, media_type, created_at, read_at")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("created_at", { ascending: false })
      .limit(300);

    // Find any peers in messages not yet in profileList
    const peerIds = Array.from(
      new Set(
        (messages ?? []).map((m: { sender_id: string; recipient_id: string }) =>
          m.sender_id === user.id ? m.recipient_id : m.sender_id
        )
      )
    );

    const missingIds = peerIds.filter((id) => !profileList.some((p) => p.id === id));
    if (missingIds.length > 0) {
      const { data: missingProfiles } = await supabase
        .from("profiles")
        .select("id, handle, display_name, avatar_url")
        .in("id", missingIds);
      if (missingProfiles) {
        profileList.push(...(missingProfiles as Profile[]));
      }
    }

    setPeople(profileList);

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
            snippet = "👗 Fashion look";
          } else if (!snippet) {
            if (m.media_type === "audio") snippet = "Voice note";
            else if (m.media_type === "image") snippet = "Flick photo";
            else if (m.media_type === "video") snippet = "Flick video";
            else snippet = "Shared media";
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
    loadStories();

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

    const onSpaceLiveUpdate = () => {
      setDraftsMap(getAllChatDrafts());
    };

    window.addEventListener("flick:space-live-updated", onSpaceLiveUpdate);
    window.addEventListener("flick:space-rooms-updated", onSpaceLiveUpdate);

    return () => {
      window.removeEventListener("flick:dm-unread-updated", onDmUpdate);
      window.removeEventListener("flick:dm-typing-update", onTypingUpdate);
      window.removeEventListener("flick:presence-update", onDmUpdate);
      window.removeEventListener("flick:chat-draft-updated", refreshDrafts);
      window.removeEventListener("flick:space-live-updated", onSpaceLiveUpdate);
      window.removeEventListener("flick:space-rooms-updated", onSpaceLiveUpdate);
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
    <div className="grid lg:grid-cols-[380px_minmax(0,1fr)] h-full min-w-0 overflow-hidden bg-background">
      {/* Left Column: Direct Messages & Real Flickers */}
      <aside
        className={`${
          showList ? "block" : "hidden lg:block"
        } border-r border-border bg-background pb-28 lg:pb-0 overflow-y-auto min-w-0 min-h-0 flex flex-col`}
      >
        {/* Header with Flick Branding & Actions */}
        <header className="sticky top-0 bg-background/95 backdrop-blur-xl border-b border-border p-3.5 space-y-3 z-20">
          <div className="flex items-center justify-between">
            {/* User Profile Avatar Link */}
            <Link
              to="/profile"
              className="relative rounded-full ring-2 ring-snap/60 p-0.5 hover:opacity-90 transition shrink-0"
              title="My Profile"
            >
              <Avatar
                url={profile?.avatar_url || null}
                name={profile?.display_name || "Me"}
                size={34}
              />
              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-background" />
            </Link>

            {/* Flick Brand Logo & Title in Center */}
            <div className="flex items-center justify-center gap-1.5 font-display text-xl font-bold tracking-tight text-foreground">
              <span>flick</span>
              <span className="w-2 h-2 rounded-full bg-snap inline-block" />
            </div>

            {/* Right Action Icons: Add Friends & New Chat */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowAddFriendModal(true)}
                className="relative p-2 rounded-full bg-secondary/80 hover:bg-secondary text-foreground hover:text-snap transition cursor-pointer"
                title="Add Friends"
              >
                <UserPlus className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setShowNewChatModal(true)}
                className="p-2 rounded-full bg-secondary/80 hover:bg-secondary text-foreground hover:text-snap transition cursor-pointer"
                title="New Flick Chat"
              >
                <Edit className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search direct messages…"
              className="w-full bg-secondary/70 rounded-full pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-primary placeholder:text-muted-foreground text-foreground"
            />
          </div>
        </header>

        {/* Real Stories Horizontal Tray */}
        <div className="relative px-3 py-2.5 border-b border-border bg-background">
          <div
            ref={storiesContainerRef}
            className="flex items-center gap-3 overflow-x-auto no-scrollbar scroll-smooth pr-6"
          >
            {/* Create Story Button */}
            <Link
              to="/stories/new"
              className="flex flex-col items-center gap-1 shrink-0 group cursor-pointer"
              title="Post a new Flick story"
            >
              <div className="w-12 h-12 rounded-full border-2 border-dashed border-snap/60 group-hover:border-snap bg-snap/10 grid place-items-center transition-all">
                <Plus className="w-5 h-5 text-snap" />
              </div>
              <span className="text-[11px] font-medium text-foreground group-hover:text-snap truncate max-w-[56px] text-center">
                Add Story
              </span>
            </Link>

            {/* Real Stories Loaded from Supabase */}
            {realStoryGroups.length > 0 ? (
              realStoryGroups.map((group, idx) => (
                <button
                  key={group.author.id}
                  type="button"
                  onClick={() => {
                    void triggerLightHaptic();
                    setActiveStoryGroup(realStoryGroups);
                    setActiveStoryIndex(idx);
                  }}
                  className="flex flex-col items-center gap-1 shrink-0 group cursor-pointer"
                >
                  <div className="p-[2px] rounded-full bg-gradient-to-tr from-snap via-emerald-400 to-sky-400 group-hover:scale-105 transition-transform shadow-sm">
                    <div className="p-0.5 rounded-full bg-background">
                      <Avatar
                        url={group.author.avatar_url}
                        name={group.author.display_name}
                        size={46}
                      />
                    </div>
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground truncate max-w-[56px] text-center">
                    {group.author.display_name.split(" ")[0]}
                  </span>
                </button>
              ))
            ) : (
              <div className="flex items-center text-xs text-muted-foreground pl-1 py-1">
                <span>No active stories · Click + to post!</span>
              </div>
            )}
          </div>

          {realStoryGroups.length > 3 && (
            <button
              type="button"
              onClick={scrollStoriesRight}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-secondary/80 hover:bg-secondary text-foreground border border-border grid place-items-center transition shadow-md cursor-pointer z-10"
              title="Next stories"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Real Conversation List from Supabase */}
        <ul className="divide-y divide-border/40 overflow-y-auto flex-1">
          <AnimatePresence initial={false}>
            {filtered.length > 0 ? (
              filtered.map((p) => {
                const meta = metaMap[p.id];
                const hasUnread = Boolean(meta?.unreadCount && meta.unreadCount > 0);
                const isTyping = Boolean(typingMap[p.id]);
                const isLive = SpaceService.isUserLive(p.id);
                const liveSession = SpaceService.getUserLiveSession(p.id);
                const userRoom = SpaceService.getUserAudioRoom(p.id);
                const isOnline = isUserOnline(p.id);

                const renderStatus = () => {
                  if (isLive && liveSession) {
                    return (
                      <div className="flex items-center gap-1.5 text-xs text-rose-500 font-bold truncate">
                        <Radio className="w-3.5 h-3.5 animate-pulse shrink-0" />
                        <span className="truncate">LIVE NOW: {liveSession.title}</span>
                      </div>
                    );
                  }

                  if (userRoom) {
                    return (
                      <div className="flex items-center gap-1.5 text-xs text-purple-400 font-bold truncate">
                        <Mic className="w-3.5 h-3.5 shrink-0 text-[#C5E863]" />
                        <span className="truncate">In Room: {userRoom.title}</span>
                      </div>
                    );
                  }

                  if (isTyping) {
                    return (
                      <div className="flex items-center text-xs font-bold text-snap">
                        <span className="flex gap-0.5 mr-1.5">
                          <span className="w-1.5 h-1.5 bg-snap rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                          <span className="w-1.5 h-1.5 bg-snap rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                          <span className="w-1.5 h-1.5 bg-snap rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                        </span>
                        <span>Typing…</span>
                      </div>
                    );
                  }

                  const draft = draftsMap[p.id];
                  if (draft && (draft.text || draft.hasVn)) {
                    return (
                      <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold truncate">
                        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                        <span className="truncate">
                          {draft.hasVn ? "Draft: Voice note" : `Draft: ${draft.text}`}
                        </span>
                      </div>
                    );
                  }

                  if (hasUnread) {
                    return (
                      <div className="flex items-center gap-1.5 text-xs text-snap font-bold truncate">
                        <div className="w-3.5 h-3.5 rounded-sm bg-snap shrink-0" />
                        <span className="truncate">New Flick ⚡</span>
                      </div>
                    );
                  }

                  if (meta?.isMine) {
                    return (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                        <Camera className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">{meta.isRead ? "Opened" : "Delivered"}</span>
                      </div>
                    );
                  }

                  if (meta && !meta.isMine && meta.isRead) {
                    return (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                        <MessageSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="truncate">Received</span>
                      </div>
                    );
                  }

                  if (meta?.snippet) {
                    return (
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground truncate">
                        <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 shrink-0" />
                        <span className="truncate">{meta.snippet}</span>
                      </div>
                    );
                  }

                  return (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 truncate">
                      <span
                        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                          isOnline ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/30"
                        }`}
                      />
                      <span>{isOnline ? "Online" : "Start a Flick"}</span>
                    </div>
                  );
                };

                return (
                  <motion.li
                    key={p.id}
                    layout
                    initial={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="relative overflow-hidden group select-none bg-background"
                  >
                    {/* Swipe Delete Action */}
                    <div className="absolute inset-y-0 right-0 w-24 bg-rose-600 flex items-center justify-center">
                      <button
                        type="button"
                        onClick={() => handleDeleteThread(p.id, p.display_name)}
                        className="w-full h-full flex items-center justify-center gap-1 text-white font-bold text-xs hover:bg-rose-700 transition"
                        title="Delete chat"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    </div>

                    {/* Chat Item Foreground */}
                    <motion.div
                      drag="x"
                      dragConstraints={{ left: -96, right: 0 }}
                      dragElastic={0.1}
                      onDragEnd={(_e, info) => {
                        if (info.offset.x < -60 || info.velocity.x < -250) {
                          void handleDeleteThread(p.id, p.display_name);
                        }
                      }}
                      className={`relative z-10 flex items-center gap-3 px-3.5 py-3 bg-background hover:bg-secondary/40 transition cursor-pointer ${
                        hasUnread ? "bg-snap/5" : ""
                      }`}
                    >
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
                        <div className={isLive ? "rounded-full p-0.5 bg-gradient-to-tr from-rose-500 to-amber-500 animate-pulse" : userRoom ? "rounded-full p-0.5 bg-gradient-to-tr from-purple-500 to-[#C5E863]" : ""}>
                          <Avatar
                            url={p.avatar_url}
                            name={p.display_name}
                            size={44}
                            ring={isTyping}
                          />
                        </div>
                        {isLive ? (
                          <span className="absolute -top-1 -right-1 bg-rose-600 text-white font-extrabold text-[8px] px-1 py-0.2 rounded-full uppercase shadow-xs flex items-center gap-0.5 border border-white/20">
                            <Radio className="w-2 h-2 animate-pulse" />
                            LIVE
                          </span>
                        ) : userRoom ? (
                          <span className="absolute -top-1 -right-1 bg-purple-600 text-white font-bold text-[8px] px-1 py-0.2 rounded-full uppercase shadow-xs flex items-center gap-0.5 border border-white/20">
                            <Mic className="w-2 h-2 text-[#C5E863]" />
                            ROOM
                          </span>
                        ) : isOnline ? (
                          <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-background" />
                        ) : null}
                      </Link>

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
                          <div className="flex items-center gap-1.5 truncate">
                            <span
                              className={`text-sm truncate ${
                                hasUnread ? "font-bold text-foreground" : "font-semibold text-foreground/90"
                              }`}
                            >
                              {p.display_name}
                            </span>
                            {isLive && (
                              <span className="text-[9.5px] bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold px-1.5 py-0.2 rounded-full flex items-center gap-1 shrink-0">
                                <Radio className="w-2.5 h-2.5 animate-pulse" />
                                Live
                              </span>
                            )}
                            {userRoom && (
                              <span className="text-[9.5px] bg-purple-500/20 text-purple-400 border border-purple-500/30 font-bold px-1.5 py-0.2 rounded-full flex items-center gap-1 shrink-0">
                                <Mic className="w-2.5 h-2.5 text-[#C5E863]" />
                                Room
                              </span>
                            )}
                          </div>
                          {meta?.lastTime ? (
                            <span className="text-[11px] text-muted-foreground shrink-0">
                              {formatDistanceToNowStrict(new Date(meta.lastTime), { addSuffix: false })}
                            </span>
                          ) : null}
                        </div>

                        <div className="mt-1 flex items-center justify-between gap-2">
                          {renderStatus()}
                          {hasUnread && (
                            <span className="bg-snap text-snap-foreground text-[10px] font-bold rounded-full min-w-[18px] h-4 px-1 grid place-items-center shrink-0">
                              {meta.unreadCount}
                            </span>
                          )}
                        </div>
                      </Link>

                      {/* Quick Flick Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void triggerLightHaptic();
                          navigate(`/messages/${p.id}`);
                        }}
                        className="p-2 text-muted-foreground/60 hover:text-snap hover:bg-secondary rounded-full transition shrink-0 cursor-pointer"
                        title={`Send Flick to ${p.display_name}`}
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                    </motion.div>
                  </motion.li>
                );
              })
            ) : (
              /* Empty state when no database chats yet */
              <div className="p-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-secondary/80 text-snap mx-auto grid place-items-center">
                  <MessageSquare className="w-6 h-6" />
                </div>
                <div className="font-bold text-sm text-foreground">No conversations yet</div>
                <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                  Start a direct chat with any registered flicker!
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowNewChatModal(true)}
                    className="px-4 py-2 rounded-full bg-primary text-primary-foreground font-bold text-xs hover:opacity-90 transition cursor-pointer"
                  >
                    Start New Chat
                  </button>
                </div>
              </div>
            )}
          </AnimatePresence>
        </ul>
      </aside>

      {/* Right Column: Snap Web Stage (when no thread selected) or Active Thread */}
      <section
        className={`${
          showList ? "hidden lg:flex" : "flex"
        } flex-col h-full min-w-0 overflow-hidden bg-background`}
      >
        {pathname === "/messages" ? (
          <SnapWebStage
            onSelectUser={(userId) => navigate(`/messages/${userId}`)}
            onOpenNewChat={() => setShowNewChatModal(true)}
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
              className="bg-card border border-border rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-snap text-snap-foreground grid place-items-center">
                    <UserPlus className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-foreground text-base">Add Friends on Flick</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddFriendModal(false)}
                  className="p-1 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 rounded-2xl bg-secondary/50 border border-border flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-foreground">Your Flick Profile</div>
                  <div className="text-[11px] text-muted-foreground">@{profile?.handle || "you"}</div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`https://flick.app/@${profile?.handle || "user"}`);
                    toast.success("Profile link copied to clipboard!");
                  }}
                  className="px-3 py-1.5 rounded-full bg-background hover:bg-secondary text-foreground text-xs font-semibold flex items-center gap-1 transition border border-border"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </button>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                  Real Members
                </div>
                <div className="space-y-1.5 max-h-52 overflow-y-auto pr-1">
                  {allDbProfiles.length > 0 ? (
                    allDbProfiles.slice(0, 10).map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-secondary/40 transition"
                      >
                        <div className="flex items-center gap-2.5">
                          <Avatar url={c.avatar_url} name={c.display_name} size={36} />
                          <div>
                            <div className="text-xs font-bold text-foreground">{c.display_name}</div>
                            <div className="text-[10px] text-muted-foreground">@{c.handle}</div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddFriendModal(false);
                            navigate(`/messages/${c.id}`);
                          }}
                          className="px-3 py-1 rounded-full bg-snap text-snap-foreground font-bold text-xs hover:opacity-90 transition"
                        >
                          Chat
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-muted-foreground text-center py-4">
                      Share your link to invite your friends to Flick!
                    </div>
                  )}
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
              className="bg-card border border-border rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-snap text-snap-foreground grid place-items-center">
                    <Edit className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-foreground text-base">New Flick Chat</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowNewChatModal(false)}
                  className="p-1 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={newChatSearch}
                  onChange={(e) => setNewChatSearch(e.target.value)}
                  placeholder="To: Search name or @handle"
                  className="w-full bg-secondary/60 rounded-xl pl-9 pr-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-snap text-foreground placeholder:text-muted-foreground border border-border"
                />
              </div>

              {/* Real Database Users List */}
              <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                {allDbProfiles
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
                      className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-secondary/40 transition text-left"
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar url={p.avatar_url} name={p.display_name} size={36} />
                        <div>
                          <div className="text-xs font-bold text-foreground">{p.display_name}</div>
                          <div className="text-[10px] text-muted-foreground">@{p.handle}</div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
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
