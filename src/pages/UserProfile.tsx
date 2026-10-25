import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Avatar } from "@/components/Avatar";
import { PostCard, type PostRow } from "@/components/PostCard";
import { ArrowLeft, MessageCircle, UserPlus, Check, Swords } from "lucide-react";
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
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1 bg-background ring-4 ring-background shadow-2xl">
            <div className="w-full h-full rounded-full overflow-hidden bg-secondary">
              <Avatar url={p.avatar_url} name={p.display_name} size={112} />
            </div>
          </div>
        </div>

        <div className="space-y-2.5">
          <div>
            <div className="font-display text-2xl font-bold truncate flex items-center gap-2">
              <span>{p.display_name}</span>
              {isUserVerified(p.id) && <FlickVerifiedBadge size={20} />}
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
    </>
  );
}