import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { PostCard, type PostRow } from "@/components/PostCard";
import { Avatar } from "@/components/Avatar";
import {
  Camera,
  Grid3x3,
  Film,
  Bookmark,
  Settings,
  Edit3,
  Check,
  X,
  Share2,
  Calendar,
  Sparkles,
  Heart,
  Users,
  Repeat2,
  ExternalLink,
  BarChart3,
  ArrowLeft,
  Search,
  Slash,
} from "lucide-react";
import { toast } from "sonner";
import { ProfileSettings } from "@/components/ProfileSettings";
import { usePremium } from "@/lib/premium";
import { useNavigate } from "react-router-dom";
import { FlickVerifiedBadge } from "@/components/FlickVerifiedBadge";
import { isUserVerified } from "@/lib/verification";
import { ProfileCover } from "@/components/profile/ProfileCover";
import { AnimatePresence, motion } from "framer-motion";
import { getFlickSocialStats, FOLLOWING_EVENT, FLICKERS_EVENT } from "@/lib/follow";
import { UserListModal } from "@/components/profile/UserListModal";

type Counts = {
  flicks: number;
  flickers: number;
  flicking: number;
  likes: number;
  reshares: number;
  comments: number;
  saved: number;
  stories: number;
};

const zeroCounts: Counts = {
  flicks: 0,
  flickers: 0,
  flicking: 0,
  likes: 0,
  reshares: 0,
  comments: 0,
  saved: 0,
  stories: 0,
};

export default function ProfilePage() {
  const { profile, user, refreshProfile } = useAuth();
  const { isPremium } = usePremium();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"grid" | "reels" | "saved">("grid");
  const [counts, setCounts] = useState<Counts>(zeroCounts);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [savedPosts, setSavedPosts] = useState<PostRow[]>([]);
  const [userListModal, setUserListModal] = useState<{
    open: boolean;
    type: "flickers" | "flicking" | "flicks";
    title: string;
  }>({ open: false, type: "flickers", title: "Flickers" });
  const fileRef = useRef<HTMLInputElement>(null);

  // Editable fields in modal
  const [draftName, setDraftName] = useState("");
  const [draftHandle, setDraftHandle] = useState("");
  const [draftBio, setDraftBio] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Fetch real statistics from DB
  useEffect(() => {
    if (!user) return;
    let alive = true;

    (async () => {
      // 1. My flicks
      const { data: mine } = await supabase
        .from("posts")
        .select(
          "id, content, image_url, media_url, media_type, created_at, author:profiles!posts_author_id_fkey (id, handle, display_name, avatar_url)"
        )
        .eq("author_id", user.id)
        .order("created_at", { ascending: false });

      if (!alive) return;
      const rows = (mine ?? []) as unknown as PostRow[];
      setPosts(rows);
      const ids = rows.map((r) => r.id);

      // 2. Engagement stats & Genuine DB Flickers / Flicking (STRICT: no fabricated numbers)
      const [lc, rc, cc, sc, stc, socialStats] = await Promise.all([
        ids.length
          ? supabase.from("likes").select("post_id", { count: "exact", head: true }).in("post_id", ids)
          : Promise.resolve({ count: 0 }),
        ids.length
          ? supabase.from("reshares").select("post_id", { count: "exact", head: true }).in("post_id", ids)
          : Promise.resolve({ count: 0 }),
        ids.length
          ? supabase.from("comments").select("id", { count: "exact", head: true }).in("post_id", ids)
          : Promise.resolve({ count: 0 }),
        supabase.from("saved_posts").select("post_id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("stories").select("id", { count: "exact", head: true }).eq("author_id", user.id),
        getFlickSocialStats(user.id),
      ]);

      if (!alive) return;

      setCounts({
        flicks: rows.length,
        flickers: socialStats.flickers,
        flicking: socialStats.flicking,
        likes: lc.count ?? 0,
        reshares: rc.count ?? 0,
        comments: cc.count ?? 0,
        saved: sc.count ?? 0,
        stories: stc.count ?? 0,
      });
    })();

    return () => {
      alive = false;
    };
  }, [user]);

  // Real-time synchronization for Flickers & Flicking
  useEffect(() => {
    if (!user) return;
    const syncSocial = () => {
      getFlickSocialStats(user.id).then((stats) => {
        setCounts((prev) => ({
          ...prev,
          flickers: stats.flickers,
          flicking: stats.flicking,
        }));
      });
    };

    window.addEventListener(FOLLOWING_EVENT, syncSocial);
    window.addEventListener(FLICKERS_EVENT, syncSocial);
    return () => {
      window.removeEventListener(FOLLOWING_EVENT, syncSocial);
      window.removeEventListener(FLICKERS_EVENT, syncSocial);
    };
  }, [user]);

  // Saved posts (loaded when Saved tab is active)
  useEffect(() => {
    if (tab !== "saved" || !user) return;
    let alive = true;

    (async () => {
      const { data: saved } = await supabase
        .from("saved_posts")
        .select("post_id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const ids = (saved ?? []).map((r: { post_id: string }) => r.post_id);
      if (ids.length === 0) {
        if (alive) setSavedPosts([]);
        return;
      }
      const { data } = await supabase
        .from("posts")
        .select(
          "id, content, image_url, media_url, media_type, created_at, author:profiles!posts_author_id_fkey (id, handle, display_name, avatar_url)"
        )
        .in("id", ids);

      if (alive) setSavedPosts(((data ?? []) as unknown) as PostRow[]);
    })();

    return () => {
      alive = false;
    };
  }, [tab, user]);

  const uploadAvatar = async (f: File) => {
    if (!user) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Avatar must be under 5MB");
      return;
    }
    setBusy(true);
    try {
      const ext = f.name.split(".").pop();
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: e1 } = await supabase.storage.from("media").upload(path, f, { contentType: f.type, upsert: true });
      if (e1) throw e1;
      const url = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
      const { error: e2 } = await supabase.from("profiles").update({ avatar_url: url }).eq("id", user.id);
      if (e2) throw e2;
      await refreshProfile();
      toast.success("Profile avatar updated ⚡️");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const openEditModal = () => {
    setDraftName(profile?.display_name ?? "");
    setDraftHandle(profile?.handle ?? "");
    setDraftBio(profile?.bio ?? "");
    setEditModalOpen(true);
  };

  const saveEditModal = async () => {
    if (!user) return;
    setSavingEdit(true);
    try {
      const cleanHandle = draftHandle.trim().replace(/^@/, "").toLowerCase();
      const cleanName = draftName.trim() || profile?.display_name || "User";
      const cleanBio = draftBio.trim() || null;

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: cleanName,
          handle: cleanHandle || profile?.handle,
          bio: cleanBio,
        })
        .eq("id", user.id);

      if (error) throw error;

      await refreshProfile();
      setEditModalOpen(false);
      toast.success("Profile updated successfully!");
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to update profile");
    } finally {
      setSavingEdit(false);
    }
  };

  const shareProfile = async () => {
    const url = `${window.location.origin}/u/${profile?.handle || "me"}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${profile?.display_name} on Flick`,
          text: `Check out @${profile?.handle} on Flick`,
          url,
        });
        return;
      } catch {
        /* fallback to clipboard */
      }
    }
    await navigator.clipboard.writeText(url);
    toast.success("Profile link copied to clipboard!");
  };

  const gridPosts = posts.filter((p) => p.media_url ?? p.image_url);
  const reelPosts = posts.filter((p) => p.media_type === "video");

  // Format joined date nicely
  const joinedDate = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { month: "long", year: "numeric" })
    : "December 2025";

  return (
    <div className="text-foreground max-w-4xl mx-auto pb-24 bg-background min-h-full">
      <ProfileSettings open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Top Header Bar matching Reference Image 1 */}
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl border-b border-border/80 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 -ml-1 hover:bg-secondary rounded-full transition text-muted-foreground hover:text-foreground"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="min-w-0">
            <h1 className="font-display text-lg font-bold truncate flex items-center gap-1.5 leading-tight">
              <span>{profile?.display_name || "Profile"}</span>
              {isUserVerified(profile?.id) && <FlickVerifiedBadge size={16} />}
            </h1>
            <p className="text-[11px] text-muted-foreground leading-none mt-0.5">
              {counts.flicks} {counts.flicks === 1 ? "flick" : "flicks"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={shareProfile}
            aria-label="Share profile"
            className="w-9 h-9 rounded-full hover:bg-secondary grid place-items-center transition text-muted-foreground hover:text-foreground"
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            className="w-9 h-9 rounded-full hover:bg-secondary grid place-items-center transition text-muted-foreground hover:text-foreground"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Full-width Profile Cover Banner */}
      <div className="relative">
        <ProfileCover userId={user?.id} isEditable={true} />
      </div>

      {/* Profile Info Header — Avatar overlaps Cover + Edit Profile Button on Right (Matching Image 1) */}
      <section className="px-5 pt-0 pb-4 relative">
        <div className="flex items-end justify-between -mt-14 sm:-mt-16 mb-4">
          {/* Overlapping Round Avatar with Ring & Camera Trigger */}
          <div className="relative group shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-full p-1 bg-background ring-4 ring-background shadow-2xl">
              <div className="w-full h-full rounded-full overflow-hidden bg-secondary">
                <Avatar url={profile?.avatar_url} name={profile?.display_name} size={112} />
              </div>
            </div>

            <button
              onClick={() => fileRef.current?.click()}
              aria-label="Change profile picture"
              className="absolute inset-0 rounded-full bg-black/45 group-hover:opacity-100 opacity-0 transition grid place-items-center text-white cursor-pointer"
            >
              <Camera className="w-6 h-6 drop-shadow" />
            </button>
            <input
              ref={fileRef}
              type="file"
              hidden
              accept="image/*"
              onChange={(e) => e.target.files?.[0] && uploadAvatar(e.target.files[0])}
            />
            {busy && (
              <div className="absolute inset-0 rounded-full bg-black/60 grid place-items-center text-xs text-white">
                …
              </div>
            )}
          </div>

          {/* Edit Profile Button (Right side, pill-shaped as in Image 1) */}
          <div className="flex items-center gap-2">
            <button
              onClick={openEditModal}
              className="py-1.5 px-5 rounded-full border border-white/20 bg-secondary/80 hover:bg-secondary font-bold text-xs text-foreground transition active:scale-95 shadow-sm"
            >
              Edit profile
            </button>
          </div>
        </div>

        {/* Identity Details */}
        <div className="space-y-3">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
                <span>{profile?.display_name || "User"}</span>
                {isUserVerified(profile?.id) && <FlickVerifiedBadge size={22} />}
              </h2>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 font-sans">
              @{profile?.handle || "user"}
            </p>
          </div>

          {/* Bio */}
          {profile?.bio && (
            <div className="text-sm text-foreground/90 leading-relaxed whitespace-pre-line font-sans">
              {profile.bio}
            </div>
          )}

          {/* Joined date */}
          {profile?.created_at && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground pt-1">
              <span className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-muted-foreground/80" />
                <span>Joined {joinedDate}</span>
              </span>
            </div>
          )}

          {/* Real Social Counts backed strictly by DB records - Tap to view list */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm pt-2">
            <button
              onClick={() =>
                setUserListModal({
                  open: true,
                  type: "flicking",
                  title: `Flicking (${counts.flicking})`,
                })
              }
              className="group text-left hover:opacity-80 transition cursor-pointer active:scale-95"
            >
              <span className="font-bold font-display text-foreground text-base tabular-nums group-hover:text-snap transition">
                {counts.flicking.toLocaleString()}
              </span>{" "}
              <span className="text-muted-foreground text-xs font-normal group-hover:underline">Flicking</span>
            </button>

            <button
              onClick={() =>
                setUserListModal({
                  open: true,
                  type: "flickers",
                  title: `Flickers (${counts.flickers})`,
                })
              }
              className="group text-left hover:opacity-80 transition cursor-pointer active:scale-95"
            >
              <span className="font-bold font-display text-foreground text-base tabular-nums group-hover:text-snap transition">
                {counts.flickers.toLocaleString()}
              </span>{" "}
              <span className="text-muted-foreground text-xs font-normal group-hover:underline">Flickers</span>
            </button>

            <button
              onClick={() =>
                setUserListModal({
                  open: true,
                  type: "flicks",
                  title: `Flicks (${counts.flicks})`,
                })
              }
              className="group text-left hover:opacity-80 transition cursor-pointer active:scale-95"
            >
              <span className="font-bold font-display text-foreground text-base tabular-nums group-hover:text-snap transition">
                {counts.flicks.toLocaleString()}
              </span>{" "}
              <span className="text-muted-foreground text-xs font-normal group-hover:underline">Flicks</span>
            </button>
          </div>
        </div>
      </section>

      {/* Tabs: Flicks / Reels / Saved */}
      <nav className="sticky top-[53px] z-10 bg-background/95 backdrop-blur border-y border-border grid grid-cols-3">
        {[
          { key: "grid" as const, icon: Grid3x3, label: "Flicks" },
          { key: "reels" as const, icon: Film, label: "Reels" },
          { key: "saved" as const, icon: Bookmark, label: "Saved" },
        ].map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`py-3 flex items-center justify-center gap-2 text-xs font-semibold uppercase tracking-wider transition relative ${
              tab === key ? "text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="w-4 h-4" />
            <span>{label}</span>
            {tab === key && (
              <motion.span
                layoutId="profileTabIndicator"
                className="absolute bottom-0 inset-x-8 h-0.5 bg-snap"
              />
            )}
          </button>
        ))}
      </nav>

      {/* Tab Content Panels */}
      <div className="p-4">
        {tab === "grid" && (
          <div className="space-y-4">
            {posts.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground border border-dashed border-border rounded-3xl space-y-2">
                <p className="font-semibold text-sm">No flicks shared yet</p>
                <p className="text-xs">Your moments, photos, and thoughts will show up here.</p>
                <button
                  onClick={() => navigate("/stories/new")}
                  className="mt-3 px-4 py-2 rounded-full bg-snap text-snap-foreground font-bold text-xs"
                >
                  Create your first flick
                </button>
              </div>
            ) : (
              posts.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  currentUserId={user?.id}
                  onDeleted={() => setPosts((prev) => prev.filter((x) => x.id !== p.id))}
                />
              ))
            )}
          </div>
        )}

        {tab === "reels" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {reelPosts.length === 0 ? (
              <div className="col-span-full p-12 text-center text-muted-foreground border border-dashed border-border rounded-3xl">
                No video reels yet
              </div>
            ) : (
              reelPosts.map((p) => (
                <div key={p.id} className="aspect-[9/16] rounded-2xl bg-secondary overflow-hidden relative">
                  {p.media_url ? (
                    <video
                      src={p.media_url}
                      className="w-full h-full object-cover"
                      muted
                      loop
                      playsInline
                      onError={(e) => {
                        (e.currentTarget as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-secondary/80 flex items-center justify-center text-muted-foreground text-xs">
                      Video
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent p-3 flex flex-col justify-end">
                    <p className="text-xs text-white line-clamp-2">{p.content}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {tab === "saved" && (
          <div className="space-y-4">
            {savedPosts.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground border border-dashed border-border rounded-3xl">
                No saved flicks in your collection
              </div>
            ) : (
              savedPosts.map((p) => (
                <PostCard
                  key={p.id}
                  post={p}
                  currentUserId={user?.id}
                />
              ))
            )}
          </div>
        )}
      </div>

      {/* Comprehensive Edit Profile Modal Dialog */}
      <AnimatePresence>
        {editModalOpen && (
          <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="w-full max-w-lg bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between border-b border-border/80 pb-3">
                <h3 className="font-display text-xl font-bold">Edit Profile</h3>
                <button
                  onClick={() => setEditModalOpen(false)}
                  className="p-1.5 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-3.5">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Display Name
                  </label>
                  <input
                    value={draftName}
                    onChange={(e) => setDraftName(e.target.value)}
                    placeholder="e.g. Daniel Dax"
                    className="w-full bg-secondary px-3.5 py-2.5 rounded-2xl text-sm border border-border focus:outline-none focus:border-snap focus:ring-1 focus:ring-snap text-foreground"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Handle (Username)
                  </label>
                  <input
                    value={draftHandle}
                    onChange={(e) => setDraftHandle(e.target.value)}
                    placeholder="e.g. dannydey4you"
                    className="w-full bg-secondary px-3.5 py-2.5 rounded-2xl text-sm border border-border focus:outline-none focus:border-snap focus:ring-1 focus:ring-snap text-foreground"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-muted-foreground block mb-1">
                    Bio (Multi-line)
                  </label>
                  <textarea
                    value={draftBio}
                    onChange={(e) => setDraftBio(e.target.value)}
                    placeholder="Tell everyone a little bit about yourself..."
                    rows={4}
                    className="w-full bg-secondary p-3 rounded-2xl text-sm border border-border focus:outline-none focus:border-snap focus:ring-1 focus:ring-snap text-foreground resize-none"
                  />
                </div>

                <div className="flex gap-2 pt-3 border-t border-border/80">
                  <button
                    type="button"
                    onClick={() => setEditModalOpen(false)}
                    className="flex-1 py-2.5 rounded-full border border-border text-xs font-semibold hover:bg-secondary transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={savingEdit}
                    onClick={saveEditModal}
                    className="flex-1 py-2.5 rounded-full bg-snap text-snap-foreground text-xs font-bold hover:brightness-105 transition disabled:opacity-60 shadow-md"
                  >
                    {savingEdit ? "Saving changes…" : "Save Profile"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Followers / Flickers / Flicks Modal */}
      {user && (
        <UserListModal
          open={userListModal.open}
          onClose={() => setUserListModal((prev) => ({ ...prev, open: false }))}
          title={userListModal.title}
          type={userListModal.type}
          targetUserId={user.id}
          targetUsername={profile?.handle}
        />
      )}
    </div>
  );
}
