import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Smile } from "lucide-react";
import { playSound } from "@/lib/soundEngine";
import { notify } from "@/lib/notify";

const EMOJIS = ["😂", "🤣", "🔥", "❤️", "😍", "😮", "💀", "👏"] as const;

export function Reactions({
  postId,
  authorId,
  postContent,
}: {
  postId: string;
  authorId?: string;
  postContent?: string;
}) {
  const { user, profile } = useAuth();
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [mine, setMine] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const trayRef = useRef<HTMLDivElement>(null);

  const refresh = async () => {
    const { data } = await supabase
      .from("reactions")
      .select("emoji, user_id")
      .eq("post_id", postId);

    const c: Record<string, number> = {};
    let me: string | null = null;
    (data ?? []).forEach((r) => {
      c[r.emoji] = (c[r.emoji] ?? 0) + 1;
      if (r.user_id === user?.id) me = r.emoji;
    });
    setCounts(c);
    setMine(me);
  };

  useEffect(() => {
    refresh();
    const ch = supabase
      .channel(`rx-${postId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reactions", filter: `post_id=eq.${postId}` },
        refresh
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postId, user?.id]);

  // Handle outside click to close tray
  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (trayRef.current && !trayRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [open]);

  const pick = async (e: string) => {
    if (!user) return;
    setOpen(false);

    if (mine === e) {
      // Toggle off current reaction
      setMine(null);
      setCounts((prev) => {
        const next = { ...prev };
        if (next[e] && next[e] > 1) next[e] -= 1;
        else delete next[e];
        return next;
      });
      await supabase.from("reactions").delete().eq("post_id", postId).eq("user_id", user.id);
    } else {
      // Set or change reaction
      const prevReaction = mine;
      setMine(e);
      setCounts((prev) => {
        const next = { ...prev };
        if (prevReaction && next[prevReaction]) {
          if (next[prevReaction] > 1) next[prevReaction] -= 1;
          else delete next[prevReaction];
        }
        next[e] = (next[e] ?? 0) + 1;
        return next;
      });

      try {
        playSound("flick_reaction");
      } catch {}

      await supabase.from("reactions").upsert({ post_id: postId, user_id: user.id, emoji: e });

      // Notify post author if reacting to someone else's post
      if (authorId && authorId !== user.id) {
        const actorName =
          profile?.display_name ||
          user.user_metadata?.display_name ||
          user.user_metadata?.full_name ||
          "Someone";
        const actorHandle = profile?.handle || user.user_metadata?.handle || "user";
        const actorAvatar = profile?.avatar_url || user.user_metadata?.avatar_url || null;

        notify({
          kind: "reaction",
          title: `${actorName} reacted ${e} to your flick`,
          message: postContent?.slice(0, 80) ?? `Reacted ${e} on your flick`,
          actor: {
            id: user.id,
            display_name: actorName,
            handle: actorHandle,
            avatar_url: actorAvatar,
          },
          data: { post_id: postId, emoji: e },
          recipients: [authorId],
        });
      }
    }
  };

  // Group active reactions sorted by highest count
  const sortedReactions = Object.entries(counts)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <div className="relative inline-flex items-center gap-1.5 flex-wrap">
      {/* Reaction picker trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`p-1 rounded-full transition flex items-center justify-center ${
          mine
            ? "text-snap bg-snap/10 hover:bg-snap/20"
            : "text-muted-foreground hover:text-snap hover:bg-secondary/60"
        }`}
        aria-label="React with emoji"
        title="Add emoji reaction"
      >
        <Smile className="w-4 h-4" />
      </button>

      {/* Interactive reaction badges: click directly to laugh or toggle */}
      {sortedReactions.map(([emoji, count]) => {
        const isMine = mine === emoji;
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => pick(emoji)}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition border active:scale-95 ${
              isMine
                ? "bg-snap/15 border-snap/50 text-foreground font-semibold shadow-xs"
                : "bg-secondary/60 hover:bg-secondary border-border text-muted-foreground hover:text-foreground"
            }`}
            title={isMine ? `Remove ${emoji} reaction` : `React with ${emoji}`}
          >
            <span className="text-sm leading-none">{emoji}</span>
            <span className="text-[11px] font-semibold">{count}</span>
          </button>
        );
      })}

      {/* Floating reaction picker tray */}
      <AnimatePresence>
        {open && (
          <motion.div
            ref={trayRef}
            initial={{ opacity: 0, y: 8, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.92 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full mb-2 left-0 z-30 flex items-center gap-1.5 bg-card/95 backdrop-blur-md border border-border rounded-full px-2.5 py-1.5 shadow-xl"
          >
            {EMOJIS.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => pick(e)}
                className={`text-xl p-1 rounded-full hover:scale-125 transition-transform active:scale-90 ${
                  mine === e ? "scale-110 bg-snap/20 rounded-full" : ""
                }`}
                title={`React with ${e}`}
              >
                {e}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}