import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { PostCard, type PostRow } from "@/components/PostCard";
import { ArrowLeft, MessageCircle, UserPlus, Check, Swords, Radio, Mic } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/lib/auth";
import {
  getFlickingUserIds,
  followUser,
  unfollowUser,
  getFlickSocialStats,
  FOLLOWING_EVENT,
  FLICKERS_EVENT,
} from "@/lib/follow";
import { toast } from "sonner";
import { FlickVerifiedBadge } from "@/components/FlickVerifiedBadge";
import { isUserVerified } from "@/lib/verification";
import { ProfileCover } from "@/components/profile/ProfileCover";
import { UserListModal } from "@/components/profile/UserListModal";
import { DuelModal } from "@/components/duel/DuelModal";
import { SpaceService } from "@/lib/space/spaceService";
import { LiveWatchView } from "@/components/space/LiveWatchView";
import type { LiveBroadcastSession } from "@/lib/space/types";

type Profile = { id: string; handle: string; display_name: string; avatar_url: string | null; bio: string | null };

export default function UserProfilePage() {
  const { handle } = useParams<{ handle: string }>();
  const { user, profile: myProfile } = useAuth();
  const [p, setP] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [counts, setCounts] = useState({ flicks: 0, flickers: 0, flicking: 0 });
  const [isFollowing, setIsFollowing] = useState(false);
  const [userListModal, setUserListModal] = useState<{
    open: boolean;
    type: "flickers" | "flicking" | "flicks";
    title: string;
  }>({ open: false, type: "flickers", title: "Flickers" });
  const [duelOpen, setDuelOpen] = useState(false);
  const [watchingLiveModal, setWatchingLiveModal] = useState<LiveBroadcastSession | null>(null);
  const [, setLiveTick] = useState(0);

  useEffect(() => {
    const onLiveSync = () => setLiveTick((t) => t + 1);
    window.addEventListener("flick:space-live-updated", onLiveSync);
    window.addEventListener("flick:space-rooms-updated", onLiveSync);
    return () => {
      window.removeEventListener("flick:space-live-updated", onLiveSync);
      window.removeEventListener("flick:space-rooms-updated", onLiveSync);
    };
  }, []);

  const isLive = p ? SpaceService.isUserLive(p.id) : false;
  const userLiveSession = p ? SpaceService.getUserLiveSession(p.id) : null;
  const userRoom = p ? SpaceService.getUserAudioRoom(p.id) : null;

  useEffect(() => {
    if (!user || !p) return;
    getFlickingUserIds(user.id).then((ids) => {
      setIsFollowing(ids.includes(p.id));
    });

    const onFollowUpdate = (e: Event) => {
      const custom = e as CustomEvent<{ userId: string; flicking: string[] }>;
      if (custom.detail?.flicking && p) {
        setIsFollowing(custom.detail.flicking.includes(p.id));
      }
    };
    window.addEventListener(FOLLOWING_EVENT, onFollowUpdate);
    return () => window.removeEventListener(FOLLOWING_EVENT, onFollowUpdate);
  }, [user, p]);

  const refreshStats = (targetId: string) => {
    getFlickSocialStats(targetId).then((stats) => {
      setCounts(stats);
    });
  };

  useEffect(() => {
    if (!handle) return;
    supabase
      .from("profiles")
      .select("*")
      .eq("handle", handle)
      .maybeSingle()
      .then(async ({ data }) => {
        const pr = data as Profile | null;
        setP(pr);
        if (!pr) return;

        const { data: ps } = await supabase
          .from("posts")
          .select("id, content, image_url, media_url, media_type, created_at, author:profiles!posts_author_id_fkey (id, handle, display_name, avatar_url)")
          .eq("author_id", pr.id)
          .order("created_at", { ascending: false });

        const rows = (ps ?? []) as unknown as PostRow[];
        setPosts(rows);

        // Fetch real, truthful database social stats (no mock numbers)
        refreshStats(pr.id);
      });
  }, [handle]);

  useEffect(() => {
    if (!p) return;
    const handleSocialUpdate = (e: Event) => {
      const custom = e as CustomEvent<{ targetUserId?: string }>;
      if (!custom.detail?.targetUserId || custom.detail.targetUserId === p.id) {
        refreshStats(p.id);
      }
    };
    window.addEventListener(FLICKERS_EVENT, handleSocialUpdate);
    return () => window.removeEventListener(FLICKERS_EVENT, handleSocialUpdate);
  }, [p]);

  const toggleFollow = async () => {
    if (!user || !p) {
      toast.error("Please sign in to flick creators");
      return;
    }
    if (isFollowing) {
      await unfollowUser(user.id, p.id);
      setIsFollowing(false);
      setCounts((c) => ({ ...c, flickers: Math.max(0, c.flickers - 1) }));
      toast.info(`Unflicked @${p.handle}`);
    } else {
      await followUser(user.id, p.id, myProfile ? {
        id: user.id,
        handle: myProfile.handle,
        display_name: myProfile.display_name,
      } : undefined);
      setIsFollowing(true);
      setCounts((c) => ({ ...c, flickers: c.flickers + 1 }));
      toast.success(`You are now flicking @${p.handle} ⚡️`);
    }
  };

  if (!p) return <div className="p-10 text-center text-muted-foreground">Loading profile…</div>;

  return (
    <>
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl border-b border-border/80 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-1.5 -ml-1 hover:bg-secondary rounded-full transition text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-display text-base font-bold flex items-center gap-1.5 leading-tight">
              <span>{p.display_name}</span>
              {isUserVerified(p.id) && <FlickVerifiedBadge size={16} />}
            </h1>
            <p className="text-[11px] text-muted-foreground leading-none">@{p.handle} · {counts.flicks} {counts.flicks === 1 ? "flick" : "flicks"}</p>
          </div>
        </div>
      </header>

      {/* Cover Banner */}
      <ProfileCover userId={p.id} isEditable={false} />

      {/* Profile Info Header */}
      <motion.section initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-5 pt-0 pb-4">
        <div className="flex items-end justify-between -mt-14 sm:-mt-16 mb-4">
          <div className={`w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1 bg-background ring-4 ${isLive ? "ring-rose-500 animate-pulse" : "ring-background"} shadow-2xl relative`}>
            <div className="w-full h-full rounded-full overflow-hidden bg-secondary">
              <Avatar url={p.avatar_url} name={p.display_name} size={112} />
            </div>
            {isLive && (
              <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 bg-rose-600 text-white font-extrabold text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 uppercase tracking-wider shadow-md border border-white/20 whitespace-nowrap">
                <Radio className="w-2.5 h-2.5 animate-pulse" /> LIVE NOW
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2.5">
          <div>
            <div className="font-display text-2xl font-bold truncate flex items-center gap-2">
              <span>{p.display_name}</span>
              {isUserVerified(p.id) && <FlickVerifiedBadge size={20} />}
              {isLive && (
                <span className="text-xs bg-rose-500/20 text-rose-400 border border-rose-500/30 font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <Radio className="w-3 h-3 animate-pulse" /> Live
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">@{p.handle}</div>
          </div>

          {p.bio && <p className="text-sm text-foreground/85 whitespace-pre-line leading-relaxed">{p.bio}</p>}

          <div className="flex gap-5 text-sm pt-1">
            <button
              onClick={() =>
                setUserListModal({
                  open: true,
                  type: "flicking",
                  title: `Flicking (${counts.flicking})`,
                })
              }
              className="text-left hover:opacity-80 transition cursor-pointer active:scale-95"
            >
              <b className="tabular-nums font-display hover:text-snap transition">{counts.flicking}</b>{" "}
              <span className="text-muted-foreground text-xs font-normal">Flicking</span>
            </button>
            <button
              onClick={() =>
                setUserListModal({
                  open: true,
                  type: "flickers",
                  title: `Flickers (${counts.flickers})`,
                })
              }
              className="text-left hover:opacity-80 transition cursor-pointer active:scale-95"
            >
              <b className="tabular-nums font-display hover:text-snap transition">{counts.flickers}</b>{" "}
              <span className="text-muted-foreground text-xs font-normal">Flickers</span>
            </button>
            <button
              onClick={() =>
                setUserListModal({
                  open: true,
                  type: "flicks",
                  title: `Flicks (${counts.flicks})`,
                })
              }
              className="text-left hover:opacity-80 transition cursor-pointer active:scale-95"
            >
              <b className="tabular-nums font-display hover:text-snap transition">{counts.flicks}</b>{" "}
              <span className="text-muted-foreground text-xs font-normal">Flicks</span>
            </button>
          </div>
        </div>
      </motion.section>

      {/* Live Stream / Audio Room Banner CTAs */}
      {isLive && userLiveSession && (
        <div className="px-5 mb-2.5">
          <button
            type="button"
            onClick={() => setWatchingLiveModal(userLiveSession)}
            className="w-full bg-gradient-to-r from-rose-600 via-red-600 to-amber-500 hover:opacity-95 active:scale-98 text-white font-extrabold py-3 px-4 rounded-2xl text-sm flex items-center justify-between shadow-lg shadow-rose-950/30 transition animate-pulse cursor-pointer border border-white/20"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-3 h-3 rounded-full bg-white animate-ping" />
              <div className="text-left truncate">
                <div className="text-xs uppercase tracking-wider font-mono opacity-90">Live Broadcast Now</div>
                <div className="font-bold text-sm truncate">{userLiveSession.title}</div>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-black/30 text-white font-bold text-xs shrink-0 flex items-center gap-1">
              <Radio className="w-3 h-3" />
              Watch 🔴
            </span>
          </button>
        </div>
      )}

      {!isLive && userRoom && (
        <div className="px-5 mb-2.5">
          <Link
            to="/space?tab=rooms"
            className="w-full bg-gradient-to-r from-purple-700 to-indigo-600 hover:opacity-95 active:scale-98 text-white font-bold py-3 px-4 rounded-2xl text-sm flex items-center justify-between shadow-md transition border border-white/10"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <Mic className="w-4 h-4 text-[#C5E863]" />
              <div className="text-left truncate">
                <div className="text-xs uppercase tracking-wider font-mono text-purple-200">In Audio Room</div>
                <div className="font-bold text-sm truncate">{userRoom.title}</div>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-black/30 text-[#C5E863] font-bold text-xs shrink-0">
              Join 🎙️
            </span>
          </Link>
        </div>
      )}

      {/* Action Buttons: Flick / Message */}
      <div className="px-5 flex gap-2">
        {user?.id !== p.id && (
          <button
            onClick={toggleFollow}
            className={`flex-1 font-bold py-2.5 rounded-full text-sm transition flex items-center justify-center gap-2 ${
              isFollowing
                ? "bg-secondary hover:bg-secondary/80 text-foreground"
                : "bg-snap text-snap-foreground hover:opacity-90 shadow-md"
            }`}
          >
            {isFollowing ? (
              <>
                <Check className="w-4 h-4 text-snap" /> Flicking
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" /> Flick
              </>
            )}
          </button>
        )}
        {user?.id !== p.id && (
          <button
            onClick={() => setDuelOpen(true)}
            className="px-4 bg-red-500/15 hover:bg-red-500/25 text-red-400 font-bold py-2.5 rounded-full text-sm flex items-center justify-center gap-1.5 border border-red-500/30 transition active:scale-95"
            title="Challenge to Realtime Duel"
          >
            <Swords className="w-4 h-4" />
            <span>Duel</span>
          </button>
        )}
        <Link
          to={`/messages/${p.id}`}
          className="flex-1 text-center bg-secondary hover:bg-secondary/80 text-foreground font-bold py-2.5 rounded-full text-sm flex items-center justify-center gap-2 border border-border transition"
        >
          <MessageCircle className="w-4 h-4" /> Send Flick
        </Link>
      </div>

      <div className="mt-6 pb-32 px-2 lg:px-4">
        <h3 className="font-display text-sm uppercase tracking-wider text-muted-foreground px-3 mb-3">Flicks</h3>
        {posts.length === 0 && <p className="text-center text-muted-foreground py-12 text-sm">No flicks yet.</p>}
        <div className="space-y-4">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      </div>

      {p && (
        <UserListModal
          open={userListModal.open}
          onClose={() => setUserListModal((prev) => ({ ...prev, open: false }))}
          title={userListModal.title}
          type={userListModal.type}
          targetUserId={p.id}
          targetUsername={p.handle}
        />
      )}

      {p && (
        <DuelModal
          open={duelOpen}
          onClose={() => setDuelOpen(false)}
          opponent={{
            id: p.id,
            handle: p.handle,
            display_name: p.display_name,
            avatar_url: p.avatar_url,
            bio: p.bio,
            rank: 3,
            flicksCount: counts.flicks,
            recentFlicksCount: counts.flicks,
            likesReceived: 12,
            commentsReceived: 6,
            resharesReceived: 2,
            engagementScore: counts.flicks * 15 + 48,
            badgeTitle: "Challenger",
            badgeIcon: "⚔️",
            badgeColor: "from-red-500 to-amber-500",
            haloColor: "rgba(239, 68, 68, 0.4)",
          }}
        />
      )}

      {watchingLiveModal && (
        <LiveWatchView
          session={watchingLiveModal}
          onClose={() => setWatchingLiveModal(null)}
        />
      )}
    </>
  );
}