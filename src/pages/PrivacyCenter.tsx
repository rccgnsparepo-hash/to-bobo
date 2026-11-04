import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  ShieldCheck,
  Lock,
  Globe,
  Users,
  MessageCircle,
  Eye,
  Search,
  Clock,
  UserX,
  VolumeX,
  KeyRound,
  Download,
  Trash2,
  Check,
  ChevronRight,
  AlertTriangle,
  ArrowLeft,
  X,
  Plus,
  Loader2,
  FileCheck,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  getPrivacySettings,
  updatePrivacySettings,
  getCloseFriends,
  toggleCloseFriend,
  generateUserDataArchive,
  getAccountDeletionStatus,
  requestAccountDeletion,
  cancelAccountDeletion,
  type PrivacySettings,
  type CloseFriendUser,
} from "@/lib/privacy/privacyService";
import {
  getBlockedUserIds,
  unblockUser,
  getMutedUserIds,
  unmuteUser,
  getMutedKeywords,
  addMutedKeyword,
  removeMutedKeyword,
} from "@/lib/safety/safetyService";
import { Avatar } from "@/components/Avatar";

export default function PrivacyCenterPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [settings, setSettings] = useState<PrivacySettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Close friends
  const [closeFriends, setCloseFriends] = useState<CloseFriendUser[]>([]);
  const [closeFriendsModal, setCloseFriendsModal] = useState(false);
  const [searchFriendQuery, setSearchFriendQuery] = useState("");
  const [friendSearchResults, setFriendSearchResults] = useState<CloseFriendUser[]>([]);

  // Blocked & Muted lists
  const [blockedUsers, setBlockedUsers] = useState<{ id: string; handle: string; display_name: string }[]>([]);
  const [mutedUsers, setMutedUsers] = useState<{ id: string; handle: string; display_name: string }[]>([]);
  const [mutedKeywords, setMutedKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");

  // Data Download
  const [downloadingData, setDownloadingData] = useState(false);
  const [downloadLink, setDownloadLink] = useState<{ url: string; filename: string } | null>(null);

  // Deletion Request
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletionStatus, setDeletionStatus] = useState<{ isPending: boolean; scheduledAt?: string }>({
    isPending: false,
  });

  // Load initial settings
  useEffect(() => {
    if (!user) return;
    let alive = true;

    Promise.all([
      getPrivacySettings(user.id),
      getCloseFriends(user.id),
      getBlockedUserIds(user.id),
      getMutedUserIds(user.id),
      getMutedKeywords(user.id),
      getAccountDeletionStatus(user.id),
    ]).then(async ([sett, friends, blockIds, muteIds, keywords, delStatus]) => {
      if (!alive) return;
      setSettings(sett);
      setCloseFriends(friends);
      setMutedKeywords(keywords);
      setDeletionStatus(delStatus);

      // Hydrate blocked & muted user profiles
      if (blockIds.length > 0) {
        const { data: bProfs } = await supabase.from("profiles").select("id, handle, display_name").in("id", blockIds);
        if (bProfs && alive) setBlockedUsers(bProfs);
      }
      if (muteIds.length > 0) {
        const { data: mProfs } = await supabase.from("profiles").select("id, handle, display_name").in("id", muteIds);
        if (mProfs && alive) setMutedUsers(mProfs);
      }
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [user]);

  // Live search for close friends modal
  useEffect(() => {
    if (!searchFriendQuery.trim()) {
      setFriendSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const q = searchFriendQuery.trim().replace(/^@/, "");
      const { data } = await supabase
        .from("profiles")
        .select("id, handle, display_name, avatar_url")
        .or(`handle.ilike.%${q}%,display_name.ilike.%${q}%`)
        .limit(6);
      setFriendSearchResults((data || []) as CloseFriendUser[]);
    }, 200);
    return () => clearTimeout(t);
  }, [searchFriendQuery]);

  const handleUpdate = async (patch: Partial<PrivacySettings>) => {
    if (!user || !settings) return;
    setSaving(true);
    try {
      const updated = await updatePrivacySettings(user.id, patch);
      setSettings(updated);
      toast.success("Privacy preferences updated");
    } catch {
      toast.error("Failed to update privacy settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePrivate = async () => {
    if (!settings) return;
    await handleUpdate({ is_private: !settings.is_private });
  };

  const handleAddKeyword = async () => {
    if (!user || !newKeyword.trim()) return;
    const next = await addMutedKeyword(user.id, newKeyword);
    setMutedKeywords(next);
    setNewKeyword("");
    toast.success("Keyword muted");
  };

  const handleRemoveKeyword = async (word: string) => {
    if (!user) return;
    const next = await removeMutedKeyword(user.id, word);
    setMutedKeywords(next);
    toast.info("Keyword unmuted");
  };

  const handleUnblock = async (targetId: string) => {
    if (!user) return;
    await unblockUser(user.id, targetId);
    setBlockedUsers((prev) => prev.filter((u) => u.id !== targetId));
    toast.success("Account unblocked");
  };

  const handleUnmute = async (targetId: string) => {
    if (!user) return;
    await unmuteUser(user.id, targetId);
    setMutedUsers((prev) => prev.filter((u) => u.id !== targetId));
    toast.success("Account unmuted");
  };

  const handleDownloadData = async () => {
    if (!user) return;
    setDownloadingData(true);
    try {
      const res = await generateUserDataArchive(user.id);
      setDownloadLink({ url: res.downloadUrl, filename: res.filename });
      toast.success("Archive generated successfully");
    } catch {
      toast.error("Failed to generate data archive");
    } finally {
      setDownloadingData(false);
    }
  };

  const handleRequestDeletion = async () => {
    if (!user) return;
    try {
      const res = await requestAccountDeletion(user.id);
      setDeletionStatus({ isPending: true, scheduledAt: res.scheduledAt });
      setDeleteModalOpen(false);
      toast.success("Account scheduled for deletion in 14 days");
    } catch {
      toast.error("Failed to schedule deletion");
    }
  };

  const handleCancelDeletion = async () => {
    if (!user) return;
    try {
      await cancelAccountDeletion(user.id);
      setDeletionStatus({ isPending: false });
      toast.success("Account deletion cancelled");
    } catch {
      toast.error("Failed to cancel deletion");
    }
  };

  if (loading || !settings) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground gap-2">
        <Loader2 className="w-5 h-5 animate-spin text-snap" />
        <span className="text-sm font-medium">Loading privacy center…</span>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto min-h-screen pb-32 px-4 sm:px-6">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-background/90 backdrop-blur-xl border-b border-border/80 -mx-4 sm:-mx-6 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 -ml-1 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground transition"
            aria-label="Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-display font-bold text-lg text-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-5 h-5 text-snap" />
              <span>Privacy Center</span>
            </h1>
            <p className="text-xs text-muted-foreground leading-none">
              Control what you share and who can reach you
            </p>
          </div>
        </div>
      </header>

      <div className="pt-5 space-y-6">
        {/* 1. Privacy Status Summary Card */}
        <section className="p-5 rounded-3xl bg-secondary/60 border border-border/90 space-y-3 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className={`w-11 h-11 rounded-2xl grid place-items-center ${
                  settings.is_private
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "bg-snap/15 text-snap border border-snap/30"
                }`}
              >
                {settings.is_private ? <Lock className="w-5 h-5" /> : <Globe className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-display font-bold text-sm text-foreground">
                  {settings.is_private ? "Your profile is Private" : "Your profile is Public"}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">
                  {settings.is_private
                    ? "Only approved followers can see your flicks and stories."
                    : "Your flicks, stories, and profile are visible to everyone on Flick."}
                </p>
              </div>
            </div>
            <button
              onClick={handleTogglePrivate}
              disabled={saving}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition shrink-0 ${
                settings.is_private
                  ? "bg-secondary hover:bg-secondary/80 text-foreground border border-border"
                  : "bg-snap text-snap-foreground hover:opacity-90 shadow-sm"
              }`}
            >
              {settings.is_private ? "Make Public" : "Make Private"}
            </button>
          </div>
        </section>

        {/* 2. Direct Messages (DM Permissions) */}
        <section className="space-y-3">
          <div className="border-b border-border/60 pb-1.5">
            <h2 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-snap" />
              <span>Who can DM me</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Decide who can initiate direct message threads with your account.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: "everyone", label: "Everyone" },
              { key: "following", label: "People I follow" },
              { key: "none", label: "No one" },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => handleUpdate({ dm_permission: opt.key as any })}
                className={`p-3 rounded-2xl border text-center transition ${
                  settings.dm_permission === opt.key
                    ? "bg-snap text-snap-foreground font-bold shadow-md shadow-snap/20 border-snap"
                    : "bg-secondary/40 hover:bg-secondary text-muted-foreground hover:text-foreground border-border/70"
                }`}
              >
                <div className="text-xs">{opt.label}</div>
              </button>
            ))}
          </div>
        </section>

        {/* 3. Content Visibility & Close Friends */}
        <section className="space-y-3">
          <div className="border-b border-border/60 pb-1.5">
            <h2 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
              <Eye className="w-4 h-4 text-snap" />
              <span>Who can see my stories and posts</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Default audience for your newly published flicks and daily stories.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: "public", label: "Public" },
              { key: "followers", label: "Followers" },
              { key: "close_friends", label: "Close friends" },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => handleUpdate({ content_visibility: opt.key as any })}
                className={`p-3 rounded-2xl border text-center transition ${
                  settings.content_visibility === opt.key
                    ? "bg-snap text-snap-foreground font-bold shadow-md shadow-snap/20 border-snap"
                    : "bg-secondary/40 hover:bg-secondary text-muted-foreground hover:text-foreground border-border/70"
                }`}
              >
                <div className="text-xs">{opt.label}</div>
              </button>
            ))}
          </div>

          {/* Close Friends Manager Entry */}
          <button
            onClick={() => setCloseFriendsModal(true)}
            className="w-full p-3.5 rounded-2xl bg-secondary/50 hover:bg-secondary border border-border/80 flex items-center justify-between text-left transition group"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-400 grid place-items-center">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-foreground">
                  Close Friends list ({closeFriends.length})
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Manage the private circle who sees your close friends-only stories
                </div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition" />
          </button>
        </section>

        {/* 4. Chat Experience: Read Receipts & Typing Indicators */}
        <section className="space-y-3">
          <div className="border-b border-border/60 pb-1.5">
            <h2 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
              <MessageCircle className="w-4 h-4 text-snap" />
              <span>Chat & Activity Indicators</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Control what other people can see while you interact in direct messages.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/80 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-foreground">Read receipts</div>
              <div className="text-[11px] text-muted-foreground">
                Let senders know when you have viewed their incoming messages
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.read_receipts}
              onChange={(e) => handleUpdate({ read_receipts: e.target.checked })}
              className="accent-lime-400 w-4 h-4 cursor-pointer"
            />
          </div>

          <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/80 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-foreground">Typing indicators</div>
              <div className="text-[11px] text-muted-foreground">
                Display the animated typing indicator while you compose a reply
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.typing_indicators}
              onChange={(e) => handleUpdate({ typing_indicators: e.target.checked })}
              className="accent-lime-400 w-4 h-4 cursor-pointer"
            />
          </div>
        </section>

        {/* 5. Search & Suggestions */}
        <section className="space-y-3">
          <div className="border-b border-border/60 pb-1.5">
            <h2 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
              <Search className="w-4 h-4 text-snap" />
              <span>Search & Suggestions Visibility</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Control whether your profile appears in Explore search and who-to-follow cards.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/80 flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-foreground">Appear in search & suggestions</div>
              <div className="text-[11px] text-muted-foreground">
                Allow new flickers to find your profile in Explore results and suggested accounts
              </div>
            </div>
            <input
              type="checkbox"
              checked={settings.appear_in_search}
              onChange={(e) => handleUpdate({ appear_in_search: e.target.checked })}
              className="accent-lime-400 w-4 h-4 cursor-pointer"
            />
          </div>
        </section>

        {/* 6. Disappearing Chats Default Timer */}
        <section className="space-y-3">
          <div className="border-b border-border/60 pb-1.5">
            <h2 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
              <Clock className="w-4 h-4 text-snap" />
              <span>Disappearing chats default timer</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Set the default lifespan for messages inside your newly opened chat threads.
            </p>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {[
              { key: "off", label: "Off" },
              { key: "24h", label: "24 hours" },
              { key: "7d", label: "7 days" },
              { key: "30d", label: "30 days" },
            ].map((opt) => (
              <button
                key={opt.key}
                onClick={() => handleUpdate({ disappearing_chat_default: opt.key as any })}
                className={`p-3 rounded-2xl border text-center transition ${
                  settings.disappearing_chat_default === opt.key
                    ? "bg-snap text-snap-foreground font-bold shadow-md shadow-snap/20 border-snap"
                    : "bg-secondary/40 hover:bg-secondary text-muted-foreground hover:text-foreground border-border/70"
                }`}
              >
                <div className="text-xs">{opt.label}</div>
              </button>
            ))}
          </div>
        </section>

        {/* 7. Blocked & Muted Accounts + Muted Keywords */}
        <section className="space-y-3">
          <div className="border-b border-border/60 pb-1.5">
            <h2 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
              <UserX className="w-4 h-4 text-snap" />
              <span>Blocked, Muted & Keyword Filters</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Block accounts completely or mute specific keywords from appearing in feeds.
            </p>
          </div>

          {/* Blocked Accounts list */}
          <div className="p-4 rounded-3xl bg-secondary/30 border border-border/80 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
              Blocked Accounts ({blockedUsers.length})
            </h3>
            {blockedUsers.length === 0 ? (
              <p className="text-xs text-muted-foreground">You haven't blocked any accounts.</p>
            ) : (
              <div className="space-y-2">
                {blockedUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-2 rounded-xl bg-secondary/50">
                    <div>
                      <div className="text-xs font-bold text-foreground">{u.display_name}</div>
                      <div className="text-[10px] text-muted-foreground">@{u.handle}</div>
                    </div>
                    <button
                      onClick={() => handleUnblock(u.id)}
                      className="px-3 py-1 rounded-full text-xs font-semibold bg-secondary hover:bg-secondary/80 border border-border"
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Muted Accounts list */}
          <div className="p-4 rounded-3xl bg-secondary/30 border border-border/80 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
              Muted Accounts ({mutedUsers.length})
            </h3>
            {mutedUsers.length === 0 ? (
              <p className="text-xs text-muted-foreground">You haven't muted any creators.</p>
            ) : (
              <div className="space-y-2">
                {mutedUsers.map((u) => (
                  <div key={u.id} className="flex items-center justify-between p-2 rounded-xl bg-secondary/50">
                    <div>
                      <div className="text-xs font-bold text-foreground">{u.display_name}</div>
                      <div className="text-[10px] text-muted-foreground">@{u.handle}</div>
                    </div>
                    <button
                      onClick={() => handleUnmute(u.id)}
                      className="px-3 py-1 rounded-full text-xs font-semibold bg-secondary hover:bg-secondary/80 border border-border"
                    >
                      Unmute
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Muted Keywords Manager */}
          <div className="p-4 rounded-3xl bg-secondary/30 border border-border/80 space-y-3">
            <h3 className="font-bold text-xs uppercase tracking-wider text-muted-foreground">
              Muted Keywords in Feed ({mutedKeywords.length})
            </h3>
            <div className="flex gap-2">
              <input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddKeyword()}
                placeholder="Add word or phrase to mute…"
                className="flex-1 bg-secondary px-3 py-2 rounded-full text-xs border border-border focus:outline-none focus:ring-1 focus:ring-snap text-foreground"
              />
              <button
                type="button"
                onClick={handleAddKeyword}
                className="px-3.5 py-2 rounded-full bg-snap text-snap-foreground font-bold text-xs hover:opacity-90 transition"
              >
                + Add
              </button>
            </div>
            {mutedKeywords.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {mutedKeywords.map((word) => (
                  <span
                    key={word}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary border border-border text-xs text-foreground font-medium"
                  >
                    <span>{word}</span>
                    <button
                      onClick={() => handleRemoveKeyword(word)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={`Remove muted keyword ${word}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* 8. Download My Data */}
        <section className="space-y-3">
          <div className="border-b border-border/60 pb-1.5">
            <h2 className="font-display font-bold text-sm text-foreground flex items-center gap-2">
              <Download className="w-4 h-4 text-snap" />
              <span>Download my data</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Export an archive containing your profile, flicks, bookmarks, and preferences.
            </p>
          </div>

          <div className="p-4 rounded-3xl bg-secondary/40 border border-border/80 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-foreground">Complete JSON Archive</div>
              <div className="text-[11px] text-muted-foreground">
                Generated securely on-demand with all your authored content
              </div>
            </div>
            {downloadLink ? (
              <a
                href={downloadLink.url}
                download={downloadLink.filename}
                className="px-4 py-2 rounded-full bg-snap text-snap-foreground text-xs font-bold flex items-center gap-1.5 hover:opacity-90 transition shrink-0"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>Download .JSON</span>
              </a>
            ) : (
              <button
                onClick={handleDownloadData}
                disabled={downloadingData}
                className="px-4 py-2 rounded-full bg-secondary hover:bg-secondary/80 text-foreground border border-border text-xs font-bold flex items-center gap-1.5 transition shrink-0"
              >
                {downloadingData ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Preparing…</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5" />
                    <span>Request Archive</span>
                  </>
                )}
              </button>
            )}
          </div>
        </section>

        {/* 9. Delete Account with 14-Day Grace Period */}
        <section className="space-y-3 pt-2">
          <div className="border-b border-border/60 pb-1.5">
            <h2 className="font-display font-bold text-sm text-destructive flex items-center gap-2">
              <Trash2 className="w-4 h-4" />
              <span>Delete account</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Permanently delete your profile, posts, and media with a 14-day grace period.
            </p>
          </div>

          {deletionStatus.isPending ? (
            <div className="p-4 rounded-3xl bg-destructive/15 border border-destructive/40 space-y-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-bold text-sm text-destructive">
                    Account scheduled for deletion
                  </h4>
                  <p className="text-xs text-foreground/80 leading-relaxed mt-0.5">
                    Your account is currently in the 14-day grace period. Permanent deletion will occur on{" "}
                    <b>{new Date(deletionStatus.scheduledAt!).toLocaleDateString()}</b>.
                  </p>
                </div>
              </div>
              <button
                onClick={handleCancelDeletion}
                className="w-full py-2.5 rounded-full bg-secondary hover:bg-secondary/80 text-foreground font-bold text-xs border border-border transition"
              >
                Cancel Deletion & Keep Account
              </button>
            </div>
          ) : (
            <div className="p-4 rounded-3xl bg-secondary/30 border border-border/80 flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-bold text-foreground">Schedule Deletion</div>
                <div className="text-[11px] text-muted-foreground">
                  You can change your mind at any time within 14 days
                </div>
              </div>
              <button
                onClick={() => setDeleteModalOpen(true)}
                className="px-4 py-2 rounded-full bg-destructive/15 hover:bg-destructive/25 text-destructive border border-destructive/30 text-xs font-bold transition shrink-0"
              >
                Delete Account
              </button>
            </div>
          )}
        </section>
      </div>

      {/* Close Friends Manager Modal */}
      <AnimatePresence>
        {closeFriendsModal && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Manage close friends"
            onClick={() => setCloseFriendsModal(false)}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-md bg-card border border-border rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl space-y-4 max-h-[85vh] flex flex-col"
            >
              <div className="flex items-center justify-between pb-2 border-b border-border/80">
                <div>
                  <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
                    <Users className="w-5 h-5 text-emerald-400" />
                    <span>Close Friends</span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Only members on this list can view your close friends stories
                  </p>
                </div>
                <button
                  onClick={() => setCloseFriendsModal(false)}
                  className="w-8 h-8 rounded-full bg-secondary grid place-items-center text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Search User Input */}
              <div className="relative">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-3" />
                <input
                  value={searchFriendQuery}
                  onChange={(e) => setSearchFriendQuery(e.target.value)}
                  placeholder="Search creator by handle or name…"
                  className="w-full bg-secondary pl-9 pr-4 py-2.5 rounded-full text-xs border border-border focus:outline-none focus:ring-1 focus:ring-snap text-foreground"
                />
              </div>

              {/* Search results */}
              {friendSearchResults.length > 0 && (
                <div className="p-2 rounded-2xl bg-secondary/50 border border-border space-y-1">
                  {friendSearchResults.map((u) => {
                    const isAdded = closeFriends.some((f) => f.id === u.id);
                    return (
                      <div
                        key={u.id}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-secondary transition"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Avatar url={u.avatar_url} name={u.display_name} size={32} />
                          <div className="min-w-0">
                            <div className="font-bold text-xs truncate">{u.display_name}</div>
                            <div className="text-[10px] text-muted-foreground">@{u.handle}</div>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            if (!user) return;
                            await toggleCloseFriend(user.id, u.id);
                            const updated = await getCloseFriends(user.id);
                            setCloseFriends(updated);
                          }}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition ${
                            isAdded
                              ? "bg-emerald-500 text-black"
                              : "bg-secondary hover:bg-secondary/80 border border-border"
                          }`}
                        >
                          {isAdded ? "Added" : "+ Add"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Current close friends list */}
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Current list ({closeFriends.length})
                </h4>
                {closeFriends.length === 0 ? (
                  <p className="text-xs text-muted-foreground py-6 text-center">
                    No close friends added yet. Search above to add creators.
                  </p>
                ) : (
                  closeFriends.map((f) => (
                    <div
                      key={f.id}
                      className="flex items-center justify-between p-2.5 rounded-2xl bg-secondary/40 border border-border"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar url={f.avatar_url} name={f.display_name} size={34} />
                        <div className="min-w-0">
                          <div className="font-bold text-xs truncate">{f.display_name}</div>
                          <div className="text-[10px] text-muted-foreground">@{f.handle}</div>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          if (!user) return;
                          await toggleCloseFriend(user.id, f.id);
                          setCloseFriends((prev) => prev.filter((x) => x.id !== f.id));
                        }}
                        className="p-1.5 rounded-full hover:bg-destructive/20 text-muted-foreground hover:text-destructive"
                        title="Remove from close friends"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 14-Day Deletion Reconfirmation Modal */}
      <AnimatePresence>
        {deleteModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm account deletion"
            onClick={() => setDeleteModalOpen(false)}
            className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm bg-card border border-border rounded-3xl p-6 shadow-2xl space-y-4 text-center"
            >
              <div className="w-12 h-12 rounded-2xl bg-destructive/15 text-destructive grid place-items-center mx-auto">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div className="space-y-1.5">
                <h3 className="font-display font-bold text-lg text-foreground">
                  Schedule Account Deletion?
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Your account will be deactivated immediately and scheduled for permanent deletion in 14 days. If you log back in during this period, your deletion will be cancelled.
                </p>
              </div>
              <div className="flex gap-2.5 pt-2">
                <button
                  onClick={() => setDeleteModalOpen(false)}
                  className="flex-1 py-2.5 rounded-full bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold"
                >
                  Keep Account
                </button>
                <button
                  onClick={handleRequestDeletion}
                  className="flex-1 py-2.5 rounded-full bg-destructive text-destructive-foreground text-xs font-bold hover:brightness-110"
                >
                  Schedule Deletion
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
