import { useEffect, useState, useMemo } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Search, MessageSquare, Camera, Film, Mic, Check, CheckCheck, Send, Trash2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { triggerMediumHaptic } from "@/lib/haptics";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { formatDistanceToNowStrict } from "date-fns";
import { useOnlinePresence } from "@/lib/presence";
import { getAllChatDrafts } from "@/lib/chatDraft";

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

export default function MessagesPage() {
  const { user } = useAuth();
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

    // 1. Fetch profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, handle, display_name, avatar_url")
      .neq("id", user.id)
      .limit(100);

    const profileList = (profiles ?? []) as Profile[];

    // 2. Fetch all recent messages sent or received by current user
    const now = new Date().toISOString();
    const { data: messages } = await supabase
      .from("messages")
      .select("id, sender_id, recipient_id, content, media_type, created_at, read_at")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .or(`expires_at.is.null,expires_at.gt.${now}`)
      .order("created_at", { ascending: false })
      .limit(300);

    // Ensure all peers in messages exist in profileList
    const peerIdsFromMsgs = Array.from(
      new Set(
        (messages ?? []).map((m: { sender_id: string; recipient_id: string }) =>
          m.sender_id === user.id ? m.recipient_id : m.sender_id
        )
      )
    );

    const missingIds = peerIdsFromMsgs.filter((id) => !profileList.some((p) => p.id === id));
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
            try {
              const p = JSON.parse(m.content || "{}");
              snippet = `👗 Fashion Look: ${p.lookTitle || "Outfit"}`;
            } catch {
              snippet = "👗 Shared a fashion look";
            }
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

    // Fast fallback refresh interval for active chat list
    const interval = setInterval(() => {
      loadConversations();
      refreshDrafts();
    }, 5000);

    return () => {
      window.removeEventListener("flick:dm-unread-updated", onDmUpdate);
      window.removeEventListener("flick:dm-typing-update", onTypingUpdate);
      window.removeEventListener("flick:presence-update", onDmUpdate);
      window.removeEventListener("flick:chat-draft-updated", refreshDrafts);
      window.removeEventListener("storage", refreshDrafts);
      clearInterval(interval);
    };
  }, [user?.id]);

  // Sort contacts:
  // 1. Unread conversations first, ordered by recent message time desc (newest unread is #1)!
  // 2. Draft conversations next (so unsent work is immediately visible)!
  // 3. Read conversations ordered by recent message time desc!
  // 4. Contacts without messages alphabetically.
  const sortedPeople = useMemo(() => {
    return [...people].sort((a, b) => {
      const metaA = metaMap[a.id];
      const metaB = metaMap[b.id];

      const unreadA = metaA?.unreadCount || 0;
      const unreadB = metaB?.unreadCount || 0;

      // 1. Unread incoming messages get highest priority, sorted by latest message time
      if (unreadA > 0 && unreadB > 0) {
        return (metaB?.lastTime || 0) - (metaA?.lastTime || 0);
      }
      if (unreadA > 0 && unreadB === 0) return -1;
      if (unreadB > 0 && unreadA === 0) return 1;

      // 2. Draft priority (if conversation has unsent draft)
      const draftA = draftsMap[a.id];
      const draftB = draftsMap[b.id];
      const hasDraftA = Boolean(draftA && (draftA.text || draftA.hasVn));
      const hasDraftB = Boolean(draftB && (draftB.text || draftB.hasVn));

      if (hasDraftA && !hasDraftB) return -1;
      if (hasDraftB && !hasDraftA) return 1;

      // 3. Both unread or both read: sort by latest message time
      const timeA = metaA?.lastTime || 0;
      const timeB = metaB?.lastTime || 0;
      if (timeA !== timeB) {
        return timeB - timeA;
      }

      // 4. Fallback: alphabetical by display name
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

  return (
    <div className="grid lg:grid-cols-[340px_minmax(0,1fr)] h-full min-w-0 overflow-hidden bg-background">
      <aside
        className={`${showList ? "block" : "hidden lg:block"} border-r border-border bg-background pb-28 lg:pb-0 overflow-y-auto min-w-0 min-h-0`}
      >
        <header className="sticky top-0 bg-background/95 backdrop-blur-xl border-b border-border p-4 space-y-3 z-10">
          <div className="flex items-center justify-between">
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <span>Chat</span>
            </h1>
            <Link
              to="/camera"
              className="p-2 rounded-full bg-secondary/80 hover:bg-secondary text-foreground hover:text-snap transition"
              title="Camera Snap"
            >
              <Camera className="w-5 h-5" />
            </Link>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search friends or @handles…"
              className="w-full bg-secondary/70 rounded-full pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-snap placeholder:text-muted-foreground text-foreground"
            />
          </div>
        </header>

        <ul className="divide-y divide-border/40 overflow-hidden">
          <AnimatePresence initial={false}>
            {filtered.map((p) => {
              const meta = metaMap[p.id];
              const hasUnread = Boolean(meta?.unreadCount && meta.unreadCount > 0);
              const isTyping = Boolean(typingMap[p.id]);
              const isOnline = isUserOnline(p.id);

              // Determine Flick status icon and color
              const getFlickStatus = () => {
                if (isTyping) {
                  return {
                    text: "is typing…",
                    color: "text-snap font-bold",
                    icon: (
                      <span className="flex gap-0.5 mr-1">
                        <span className="w-1.5 h-1.5 bg-snap rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 bg-snap rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 bg-snap rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                    ),
                  };
                }

                // Check if an unsent draft exists for this conversation
                const draft = draftsMap[p.id];
                if (draft && (draft.text || draft.hasVn)) {
                  return {
                    text: draft.hasVn
                      ? `Draft: 🎙️ Voice note (${draft.vnDuration || 0}s)`
                      : `Draft: ${draft.text}`,
                    color: "text-amber-400 font-semibold",
                    icon: (
                      <span className="w-2 h-2 rounded-full bg-amber-400 mr-1.5 shrink-0 shadow-sm shadow-amber-400/50" />
                    ),
                  };
                }

                if (hasUnread) {
                  if (meta.mediaType === "image") {
                    return {
                      text: "New Flick 📸",
                      color: "text-snap font-bold",
                      icon: <div className="w-3.5 h-3.5 rounded bg-snap mr-1.5 shadow-sm shadow-snap/30" />,
                    };
                  }
                  if (meta.mediaType === "video") {
                    return {
                      text: "New Flick 🎥",
                      color: "text-snap font-bold",
                      icon: <div className="w-3.5 h-3.5 rounded bg-snap mr-1.5 shadow-sm shadow-snap/30" />,
                    };
                  }
                  if (meta.mediaType === "audio") {
                    return {
                      text: "New Voice Note",
                      color: "text-amber-400 font-bold",
                      icon: <Mic className="w-3.5 h-3.5 text-amber-400 fill-amber-400 mr-1" />,
                    };
                  }
                  if (meta.mediaType === "fashion_look") {
                    return {
                      text: "New Fashion Look 👗",
                      color: "text-rose-400 font-bold",
                      icon: <div className="w-3.5 h-3.5 rounded bg-rose-500 mr-1.5 shadow-sm shadow-rose-500/30" />,
                    };
                  }
                  return {
                    text: "New Flick",
                    color: "text-snap font-bold",
                    icon: <div className="w-3.5 h-3.5 rounded bg-snap mr-1.5 shadow-sm shadow-snap/30" />,
                  };
                }

                // Delivered or Opened states
                if (meta?.isMine) {
                  return {
                    text: meta.isRead ? "Opened" : "Delivered",
                    color: "text-muted-foreground",
                    icon: meta.isRead ? (
                      <div className="w-3.5 h-3.5 rounded border-2 border-rose-500 mr-1.5 shrink-0" />
                    ) : (
                      <Send className="w-3 h-3 text-muted-foreground mr-1 shrink-0" />
                    ),
                  };
                }

                if (meta && !meta.isMine && meta.isRead) {
                  return {
                    text: "Received",
                    color: "text-muted-foreground",
                    icon: <div className="w-3.5 h-3.5 rounded border border-snap/50 mr-1.5 shrink-0" />,
                  };
                }

                if (meta?.snippet) {
                  return {
                    text: meta.snippet,
                    color: "text-muted-foreground",
                    icon: <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 mr-1.5 shrink-0" />,
                  };
                }

                return {
                  text: isOnline ? "Online" : "Offline",
                  color: isOnline ? "text-emerald-400 font-medium" : "text-muted-foreground/60",
                  icon: (
                    <span
                      className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                        isOnline ? "bg-emerald-400 animate-pulse" : "bg-muted-foreground/30"
                      }`}
                    />
                  ),
                };
              };

              const flickStatus = getFlickStatus();

              return (
                <motion.li
                  key={p.id}
                  layout
                  initial={{ opacity: 1, height: "auto" }}
                  exit={{
                    opacity: 0,
                    height: 0,
                    transition: { duration: 0.28, ease: "easeInOut" },
                  }}
                  className="relative overflow-hidden group select-none bg-background"
                >
                  {/* Background Delete Button revealed on drag */}
                  <div className="absolute inset-y-0 right-0 w-28 bg-rose-600 flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => handleDeleteThread(p.id, p.display_name)}
                      className="w-full h-full flex items-center justify-center gap-1.5 text-white font-bold text-xs hover:bg-rose-700 active:scale-95 transition"
                      title="Delete chat thread"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Delete</span>
                    </button>
                  </div>

                  {/* Swipeable foreground thread item */}
                  <motion.div
                    drag="x"
                    dragConstraints={{ left: -112, right: 0 }}
                    dragElastic={0.12}
                    onDragEnd={(_e, info) => {
                      if (info.offset.x < -70 || info.velocity.x < -300) {
                        void handleDeleteThread(p.id, p.display_name);
                      }
                    }}
                    className={`relative z-10 flex items-center gap-3 px-4 py-3.5 bg-background hover:bg-secondary/40 transition cursor-grab active:cursor-grabbing ${
                      hasUnread ? "bg-snap/5" : ""
                    }`}
                  >
                    {/* Avatar with conditional online presence ring */}
                    <Link
                      to={`/messages/${p.id}`}
                      onClick={() => {
                        setMetaMap((prev) => {
                          if (!prev[p.id]) return prev;
                          return { ...prev, [p.id]: { ...prev[p.id], unreadCount: 0 } };
                        });
                      }}
                      className="relative shrink-0"
                    >
                      <Avatar url={p.avatar_url} name={p.display_name} size={46} ring={isTyping} />
                      {/* ONLY display green dot if person is ACTUALLY online */}
                      {isOnline && (
                        <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-emerald-500 ring-2 ring-background animate-pulse" />
                      )}
                    </Link>

                    {/* Conversation partner details & status line */}
                    <Link
                      to={`/messages/${p.id}`}
                      onClick={() => {
                        setMetaMap((prev) => {
                          if (!prev[p.id]) return prev;
                          return { ...prev, [p.id]: { ...prev[p.id], unreadCount: 0 } };
                        });
                      }}
                      className="min-w-0 flex-1"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-sm truncate ${
                            hasUnread ? "font-bold text-foreground" : "font-semibold text-foreground/90"
                          }`}
                        >
                          {p.display_name}
                        </span>
                        {meta?.lastTime ? (
                          <span
                            className={`text-[11px] shrink-0 ${
                              hasUnread ? "text-snap font-bold" : "text-muted-foreground"
                            }`}
                          >
                            {formatDistanceToNowStrict(new Date(meta.lastTime), { addSuffix: false })}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-between gap-2 mt-1">
                        <div className="flex items-center text-xs truncate">
                          {flickStatus.icon}
                          <span className={`truncate ${flickStatus.color}`}>{flickStatus.text}</span>
                        </div>

                        {hasUnread && (
                          <span className="bg-snap text-snap-foreground text-[11px] font-bold rounded-full min-w-[20px] h-5 px-1.5 grid place-items-center shrink-0 shadow-sm">
                            {meta.unreadCount}
                          </span>
                        )}
                      </div>
                    </Link>

                    {/* Quick Flick Shortcut Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/messages/${p.id}`);
                      }}
                      className="p-2 text-muted-foreground/60 hover:text-snap hover:bg-secondary rounded-full transition shrink-0"
                      title={`Send Flick to ${p.display_name}`}
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

      <section
        className={`${
          showList ? "hidden lg:flex" : "flex"
        } flex-col h-full min-w-0 overflow-hidden bg-background`}
      >
        <Outlet />
      </section>
    </div>
  );
}
