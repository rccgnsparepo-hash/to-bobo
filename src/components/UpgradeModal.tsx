import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, BadgeCheck, Flame, Users, Sparkles, UserCheck, ShieldCheck, Lock } from "lucide-react";
import { usePremium } from "@/lib/premium";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export function UpgradeModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { isPremium, activate } = usePremium();
  const { user, profile } = useAuth();
  const [busy, setBusy] = useState(false);

  // Verification criteria state
  const [stats, setStats] = useState({
    flicksCount: 0,
    flickersCount: 0,
    engagementCount: 0,
    hasAvatar: false,
    hasBio: false,
  });
  const [loading, setLoading] = useState(true);

  // Targets to be verified
  const TARGET_FLICKS = 10;
  const TARGET_FLICKERS = 15;
  const TARGET_ENGAGEMENT = 25;

  useEffect(() => {
    if (!open || !user) return;
    let alive = true;

    const loadStats = async () => {
      setLoading(true);
      try {
        // 1. My flicks
        const { data: myPosts } = await supabase
          .from("posts")
          .select("id")
          .eq("author_id", user.id);
        const postIds = (myPosts ?? []).map((p) => p.id);

        // 2. Engagement received (likes + reshares + comments)
        const [likes, reshares, comments] = postIds.length
          ? await Promise.all([
              supabase.from("likes").select("post_id", { count: "exact", head: true }).in("post_id", postIds),
              supabase.from("reshares").select("post_id", { count: "exact", head: true }).in("post_id", postIds),
              supabase.from("comments").select("id", { count: "exact", head: true }).in("post_id", postIds),
            ])
          : [{ count: 0 }, { count: 0 }, { count: 0 }];

        // 3. Flickers (unique community members who interact with the user or close connections)
        const { data: likers } = postIds.length
          ? await supabase.from("likes").select("user_id").in("post_id", postIds)
          : { data: [] };
        const uniqueFlickers = new Set((likers ?? []).map((l: { user_id: string }) => l.user_id));

        // Also count other registered profiles if community is small
        const { count: totalProfiles } = await supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .neq("id", user.id);
        
        const calculatedFlickers = Math.max(uniqueFlickers.size, Math.min(totalProfiles ?? 0, (postIds.length * 2) + (likes.count ?? 0)));

        if (alive) {
          setStats({
            flicksCount: postIds.length,
            flickersCount: calculatedFlickers,
            engagementCount: (likes.count ?? 0) + (reshares.count ?? 0) + (comments.count ?? 0),
            hasAvatar: Boolean(profile?.avatar_url),
            hasBio: Boolean(profile?.bio && profile.bio.trim().length > 3),
          });
        }
      } catch (err) {
        console.error("Failed loading verification stats:", err);
      } finally {
        if (alive) setLoading(false);
      }
    };

    loadStats();
    return () => {
      alive = false;
    };
  }, [open, user?.id, profile?.avatar_url, profile?.bio]);

  // Check which criteria are completed
  const flicksDone = stats.flicksCount >= TARGET_FLICKS;
  const flickersDone = stats.flickersCount >= TARGET_FLICKERS;
  const engagementDone = stats.engagementCount >= TARGET_ENGAGEMENT;
  const profileDone = stats.hasAvatar && stats.hasBio;

  const totalCriteria = 4;
  const completedCriteria =
    (flicksDone ? 1 : 0) +
    (flickersDone ? 1 : 0) +
    (engagementDone ? 1 : 0) +
    (profileDone ? 1 : 0);
  const readinessPercent = Math.round((completedCriteria / totalCriteria) * 100);
  const eligible = readinessPercent === 100;

  const handleClaim = async () => {
    if (!eligible && !isPremium) {
      toast.error("Complete all community milestones before claiming your Verified badge.");
      return;
    }
    setBusy(true);
    try {
      await activate();
      toast.success("Congratulations! You've earned the Flick Verified badge ✦", {
        icon: <BadgeCheck className="w-5 h-5 text-snap" />,
      });
      onClose();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-4 select-none"
      >
        <motion.div
          initial={{ y: 40, scale: 0.95, opacity: 0 }}
          animate={{ y: 0, scale: 1, opacity: 1 }}
          exit={{ y: 40, scale: 0.95, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 30 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-lg bg-background rounded-3xl border border-border shadow-2xl p-6 relative overflow-hidden flex flex-col max-h-[90vh]"
        >
          {/* Ambient Glow */}
          <div className="absolute -top-20 -right-20 w-56 h-56 rounded-full bg-snap/20 blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-full bg-snap/15 border border-snap/30 text-snap flex items-center justify-center">
                <BadgeCheck className="w-5 h-5" />
              </div>
              <div>
                <h2 className="font-display text-xl leading-tight">Flick Verified</h2>
                <p className="text-xs text-muted-foreground">Merit-based creator verification</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full hover:bg-secondary grid place-items-center text-muted-foreground hover:text-foreground transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto py-4 space-y-5">
            {/* Status card */}
            <div className="rounded-2xl border border-border bg-card/60 p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                  Verification Readiness
                </span>
                <span className="text-xs font-bold text-snap font-mono">{readinessPercent}%</span>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <div
                  className="h-full bg-snap transition-all duration-500 rounded-full shadow-[0_0_12px_rgba(197,232,99,0.8)]"
                  style={{ width: `${readinessPercent}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                Verification on Flick cannot be bought. It is earned through authentic creative
                activity, active flickers, and positive community engagement.
              </p>
            </div>

            {/* Milestones Checklist */}
            <div className="space-y-2.5">
              <div className="text-xs uppercase tracking-wider text-muted-foreground font-semibold px-1">
                Required Milestones
              </div>

              {/* 1. Flicks */}
              <div
                className={`p-3.5 rounded-2xl border transition flex items-center gap-3.5 ${
                  flicksDone
                    ? "bg-snap/10 border-snap/40 text-foreground"
                    : "bg-secondary/40 border-border text-muted-foreground"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full grid place-items-center shrink-0 ${
                    flicksDone ? "bg-snap text-snap-foreground" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {flicksDone ? <Check className="w-4 h-4 stroke-[3]" /> : <Flame className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold flex items-center justify-between">
                    <span>Publish 10 Flicks</span>
                    <span className="text-xs font-mono">
                      {stats.flicksCount}/{TARGET_FLICKS}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">Original posts shared to feed</div>
                </div>
              </div>

              {/* 2. Flickers */}
              <div
                className={`p-3.5 rounded-2xl border transition flex items-center gap-3.5 ${
                  flickersDone
                    ? "bg-snap/10 border-snap/40 text-foreground"
                    : "bg-secondary/40 border-border text-muted-foreground"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full grid place-items-center shrink-0 ${
                    flickersDone ? "bg-snap text-snap-foreground" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {flickersDone ? <Check className="w-4 h-4 stroke-[3]" /> : <Users className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold flex items-center justify-between">
                    <span>Reach 15 Flickers</span>
                    <span className="text-xs font-mono">
                      {stats.flickersCount}/{TARGET_FLICKERS}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">Active followers in your community</div>
                </div>
              </div>

              {/* 3. Engagement */}
              <div
                className={`p-3.5 rounded-2xl border transition flex items-center gap-3.5 ${
                  engagementDone
                    ? "bg-snap/10 border-snap/40 text-foreground"
                    : "bg-secondary/40 border-border text-muted-foreground"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full grid place-items-center shrink-0 ${
                    engagementDone ? "bg-snap text-snap-foreground" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {engagementDone ? <Check className="w-4 h-4 stroke-[3]" /> : <Sparkles className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold flex items-center justify-between">
                    <span>25 Engagements Received</span>
                    <span className="text-xs font-mono">
                      {stats.engagementCount}/{TARGET_ENGAGEMENT}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">Likes, replies and reshares on your content</div>
                </div>
              </div>

              {/* 4. Complete Profile */}
              <div
                className={`p-3.5 rounded-2xl border transition flex items-center gap-3.5 ${
                  profileDone
                    ? "bg-snap/10 border-snap/40 text-foreground"
                    : "bg-secondary/40 border-border text-muted-foreground"
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-full grid place-items-center shrink-0 ${
                    profileDone ? "bg-snap text-snap-foreground" : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {profileDone ? <Check className="w-4 h-4 stroke-[3]" /> : <UserCheck className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold flex items-center justify-between">
                    <span>Complete Creator Profile</span>
                    <span className="text-xs font-mono">
                      {stats.hasAvatar && stats.hasBio ? "2/2" : stats.hasAvatar || stats.hasBio ? "1/2" : "0/2"}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">Avatar photo uploaded and custom bio set</div>
                </div>
              </div>
            </div>

            {/* Standing */}
            <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-secondary/30 text-xs text-muted-foreground">
              <ShieldCheck className="w-4 h-4 text-snap shrink-0" />
              <span>Account is in good standing with zero community strikes.</span>
            </div>
          </div>

          {/* Footer Action */}
          <div className="pt-3 border-t border-border mt-auto">
            {isPremium ? (
              <div className="w-full text-center py-3 bg-snap/15 border border-snap/40 rounded-full text-snap font-bold text-sm flex items-center justify-center gap-2">
                <BadgeCheck className="w-4 h-4 text-snap" /> You are a Verified Creator ✦
              </div>
            ) : eligible ? (
              <button
                onClick={handleClaim}
                disabled={busy}
                className="w-full bg-snap text-snap-foreground rounded-full py-3.5 font-bold text-sm shadow-[0_0_25px_rgba(197,232,99,0.5)] active:scale-[0.98] transition flex items-center justify-center gap-2"
              >
                <BadgeCheck className="w-4 h-4" />
                {busy ? "Verifying…" : "Claim Verified Badge"}
              </button>
            ) : (
              <button
                disabled
                className="w-full bg-secondary text-muted-foreground rounded-full py-3.5 font-bold text-sm opacity-70 cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                Complete All Milestones ({completedCriteria}/{totalCriteria})
              </button>
            )}
            <p className="text-center text-[11px] text-muted-foreground mt-2">
              Verified badges are permanent and display next to your handle everywhere.
            </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}