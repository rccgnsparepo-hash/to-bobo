import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Search,
  UserCheck,
  UserPlus,
  Loader2,
  Users,
  Grid3x3,
  ExternalLink,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { FlickVerifiedBadge } from "@/components/FlickVerifiedBadge";
import { isUserVerified } from "@/lib/verification";
import {
  getFlickerUserIds,
  getFlickingUserIds,
  followUser,
  unfollowUser,
  getLocalFollowing,
} from "@/lib/follow";
import { toast } from "sonner";
import { triggerLightHaptic } from "@/lib/haptics";

type UserItem = {
  id: string;
  handle: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
};

type FlickItem = {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
};

interface UserListModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  type: "flickers" | "flicking" | "flicks";
  targetUserId: string;
  targetUsername?: string;
}

export function UserListModal({
  open,
  onClose,
  title,
  type,
  targetUserId,
  targetUsername,
}: UserListModalProps) {
  const { user: currentUser, profile: currentProfile } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserItem[]>([]);
  const [flicks, setFlicks] = useState<FlickItem[]>([]);
  const [search, setSearch] = useState("");
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});
  const [busyFollowId, setBusyFollowId] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !targetUserId) return;
    let alive = true;
    setLoading(true);
    setSearch("");

    (async () => {
      try {
        if (currentUser) {
          const myFollowing = getLocalFollowing(currentUser.id);
          const map: Record<string, boolean> = {};
          myFollowing.forEach((id) => (map[id] = true));
          setFollowingMap(map);
        }

        if (type === "flicks") {
          const { data } = await supabase
            .from("posts")
            .select("id, content, image_url, created_at")
            .eq("author_id", targetUserId)
            .order("created_at", { ascending: false });

          if (alive) {
            setFlicks((data as FlickItem[]) ?? []);
          }
        } else {
          // Flickers (Followers) or Flicking (Following)
          const targetIds =
            type === "flickers"
              ? await getFlickerUserIds(targetUserId)
              : await getFlickingUserIds(targetUserId);

          if (!targetIds.length) {
            if (alive) setUsers([]);
            return;
          }

          const { data, error } = await supabase
            .from("profiles")
            .select("id, handle, display_name, avatar_url, bio")
            .in("id", targetIds);

          if (error) throw error;
          if (alive) {
            setUsers((data as UserItem[]) ?? []);
          }
        }
      } catch (err) {
        console.warn("[UserListModal] Fetch failed:", err);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [open, type, targetUserId, currentUser]);

  const handleToggleFollow = async (targetId: string, targetHandle: string) => {
    if (!currentUser) {
      toast.error("Sign in to follow creators");
      return;
    }
    triggerLightHaptic();
    setBusyFollowId(targetId);

    const isCurrentlyFollowing = Boolean(followingMap[targetId]);
    try {
      if (isCurrentlyFollowing) {
        await unfollowUser(currentUser.id, targetId);
        setFollowingMap((prev) => ({ ...prev, [targetId]: false }));
        toast.info(`Unflicked @${targetHandle}`);
      } else {
        await followUser(currentUser.id, targetId, {
          id: currentUser.id,
          handle: currentProfile?.handle,
          display_name: currentProfile?.display_name,
        });
        setFollowingMap((prev) => ({ ...prev, [targetId]: true }));
        toast.success(`Now flicking @${targetHandle} ⚡️`);
      }
    } catch {
      toast.error("Failed to update follow status");
    } finally {
      setBusyFollowId(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      u.handle.toLowerCase().includes(q) ||
      u.display_name.toLowerCase().includes(q) ||
      (u.bio && u.bio.toLowerCase().includes(q))
    );
  });

  const filteredFlicks = flicks.filter((f) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return f.content.toLowerCase().includes(q);
  });

  if (!open) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-3xl bg-card border border-border shadow-2xl overflow-hidden relative"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-snap/15 border border-snap/30 text-snap flex items-center justify-center">
                {type === "flicks" ? <Grid3x3 className="w-4 h-4" /> : <Users className="w-4 h-4" />}
              </div>
              <div>
                <h3 className="font-display font-extrabold text-lg text-foreground leading-tight">
                  {title}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {targetUsername ? `@${targetUsername}` : "Community"}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-secondary hover:bg-secondary/80 flex items-center justify-center text-muted-foreground hover:text-foreground transition active:scale-95"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search bar */}
          <div className="px-5 pt-3 pb-2">
            <div className="relative">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={type === "flicks" ? "Search flicks…" : "Search users by name or @handle…"}
                className="w-full pl-9 pr-4 py-2 rounded-2xl bg-secondary/60 border border-border text-xs focus:outline-none focus:ring-1 focus:ring-snap placeholder:text-muted-foreground"
              />
            </div>
          </div>

          {/* List Content */}
          <div className="flex-1 overflow-y-auto px-5 py-2 divide-y divide-border/40">
            {loading ? (
              <div className="py-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin text-snap" />
                <span className="text-xs">Loading {type}…</span>
              </div>
            ) : type === "flicks" ? (
              filteredFlicks.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground text-xs">
                  {search ? "No matching flicks found" : "No flicks posted yet"}
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 py-2">
                  {filteredFlicks.map((f) => (
                    <div
                      key={f.id}
                      onClick={() => {
                        onClose();
                        navigate("/");
                      }}
                      className="group relative aspect-square rounded-2xl overflow-hidden bg-secondary border border-border/80 cursor-pointer hover:border-snap transition"
                    >
                      {f.image_url ? (
                        <img
                          src={f.image_url}
                          alt=""
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      ) : (
                        <div className="w-full h-full p-3 text-[11px] leading-snug text-muted-foreground flex items-center justify-center text-center bg-secondary/80">
                          <p className="line-clamp-4">{f.content}</p>
                        </div>
                      )}
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-white">
                        <ExternalLink className="w-4 h-4" />
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : filteredUsers.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground text-xs">
                {search
                  ? "No matching users found"
                  : type === "flickers"
                    ? "No flickers following yet"
                    : "Not flicking anyone yet"}
              </div>
            ) : (
              filteredUsers.map((u) => {
                const isMe = currentUser?.id === u.id;
                const isFollowing = Boolean(followingMap[u.id]);
                const isBusy = busyFollowId === u.id;

                return (
                  <div
                    key={u.id}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-secondary/20 transition rounded-xl px-2"
                  >
                    <div
                      onClick={() => {
                        onClose();
                        navigate(`/u/${u.handle}`);
                      }}
                      className="flex items-center gap-3 min-w-0 flex-1 cursor-pointer"
                    >
                      <Avatar url={u.avatar_url} name={u.display_name} size={42} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-xs sm:text-sm text-foreground truncate hover:underline">
                            {u.display_name}
                          </span>
                          {isUserVerified(u.id) && <FlickVerifiedBadge size={14} />}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">@{u.handle}</div>
                        {u.bio && (
                          <p className="text-[11px] text-muted-foreground/80 truncate mt-0.5 max-w-xs">
                            {u.bio}
                          </p>
                        )}
                      </div>
                    </div>

                    {!isMe && (
                      <button
                        onClick={() => handleToggleFollow(u.id, u.handle)}
                        disabled={isBusy}
                        className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition active:scale-95 flex items-center gap-1.5 ${
                          isFollowing
                            ? "bg-secondary text-foreground hover:bg-secondary/70 border border-border"
                            : "bg-snap text-snap-foreground hover:brightness-105 shadow-sm shadow-snap/20"
                        }`}
                      >
                        {isBusy ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : isFollowing ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>Flicking</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>Flick</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
