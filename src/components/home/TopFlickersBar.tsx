import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Swords,
  Trophy,
  Flame,
  Sparkles,
  ChevronRight,
  Crown,
  Medal,
  Zap,
  TrendingUp,
} from "lucide-react";
import { fetchTopFlickers, type TopFlicker } from "@/lib/topFlickers";
import { Avatar } from "@/components/Avatar";
import { TopFlickerBadge } from "@/components/TopFlickerBadge";
import { DuelModal } from "@/components/duel/DuelModal";
import { triggerLightHaptic } from "@/lib/haptics";
import { FlickVerifiedBadge } from "@/components/FlickVerifiedBadge";
import { isUserVerified } from "@/lib/verification";

interface TopFlickersBarProps {
  title?: string;
  compact?: boolean;
}

export function TopFlickersBar({
  title = "TOP FLICKERS OF THE WEEK",
  compact = false,
}: TopFlickersBarProps) {
  const navigate = useNavigate();
  const [topFlickers, setTopFlickers] = useState<TopFlicker[]>([]);
  const [selectedDuelOpponent, setSelectedDuelOpponent] = useState<TopFlicker | null>(null);

  useEffect(() => {
    fetchTopFlickers().then((flickers) => setTopFlickers(flickers));
  }, []);

  if (topFlickers.length === 0) return null;

  const top1 = topFlickers[0];

  return (
    <div className="border-b border-border bg-gradient-to-b from-card via-card/70 to-background/40 p-4 sm:p-5 space-y-4 relative overflow-hidden shadow-sm">
      {/* Ambient background glow for #1 player */}
      <div className="absolute top-0 right-1/4 w-80 h-32 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/4 w-80 h-32 bg-red-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Header with Week Crown */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10 px-1">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-amber-500 to-yellow-300 text-black flex items-center justify-center shadow-lg shadow-amber-500/20 font-black">
            <Crown className="w-5 h-5 fill-current" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-black text-sm sm:text-base tracking-wider uppercase text-foreground">
                {title}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-400 text-black shadow-sm">
                WEEK 43
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-500/20 text-red-400 border border-red-500/30 uppercase tracking-widest hidden sm:inline-block">
                GLOBAL LEADERBOARD
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Ranked by real post impressions, flick engagement points &amp; duel wins
            </p>
          </div>
        </div>

        {/* Global Duel Challenge CTA */}
        {top1 && (
          <button
            onClick={() => {
              triggerLightHaptic();
              setSelectedDuelOpponent(top1);
            }}
            className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-1.5 rounded-2xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-black transition active:scale-95 shadow-md shadow-red-600/30"
          >
            <Swords className="w-3.5 h-3.5 animate-pulse" />
            <span>DUEL #1 ({top1.display_name.split(" ")[0]})</span>
          </button>
        )}
      </div>

      {/* Horizontal Carousel of Featured Top Flickers */}
      <div className="flex items-stretch gap-3.5 overflow-x-auto pb-2 pt-1 no-scrollbar relative z-10">
        {topFlickers.slice(0, 8).map((flicker) => {
          const isFirst = flicker.rank === 1;
          const isSecond = flicker.rank === 2;
          const isThird = flicker.rank === 3;

          return (
            <motion.div
              key={flicker.id}
              whileHover={{ y: -4, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className={`flex-shrink-0 w-44 rounded-3xl p-4 flex flex-col justify-between text-center relative transition group shadow-md ${
                isFirst
                  ? "bg-gradient-to-b from-amber-500/20 via-card to-card border-2 border-amber-400/60 shadow-amber-500/10"
                  : isSecond
                    ? "bg-gradient-to-b from-slate-400/20 via-card to-card border border-slate-400/40"
                    : isThird
                      ? "bg-gradient-to-b from-amber-700/20 via-card to-card border border-amber-700/40"
                      : "bg-secondary/70 hover:bg-secondary border border-border"
              }`}
            >
              {/* Rank Badge */}
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <TopFlickerBadge rank={flicker.rank} size="md" />
              </div>

              {/* Avatar with Animated Glow Halo */}
              <div
                onClick={() => navigate(`/u/${flicker.handle}`)}
                className="mt-3 relative cursor-pointer mx-auto"
              >
                <div
                  className={`rounded-full p-1 ring-2 transition-transform duration-300 group-hover:scale-110 ${
                    isFirst
                      ? "ring-amber-400 shadow-[0_0_20px_rgba(251,191,36,0.5)]"
                      : isSecond
                        ? "ring-slate-300 shadow-[0_0_15px_rgba(203,213,225,0.4)]"
                        : isThird
                          ? "ring-amber-600 shadow-[0_0_15px_rgba(217,119,6,0.4)]"
                          : "ring-border"
                  }`}
                  style={{ borderColor: flicker.haloColor }}
                >
                  <Avatar url={flicker.avatar_url} name={flicker.display_name} size={64} />
                </div>

                {isFirst && (
                  <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-400 text-black flex items-center justify-center shadow font-black text-xs">
                    👑
                  </span>
                )}
              </div>

              {/* Name & Handle */}
              <div
                onClick={() => navigate(`/u/${flicker.handle}`)}
                className="mt-3 min-w-0 w-full cursor-pointer"
              >
                <div className="font-display font-extrabold text-sm truncate text-foreground group-hover:text-snap transition flex items-center justify-center gap-1">
                  <span>{flicker.display_name}</span>
                  {isUserVerified(flicker.id) && <FlickVerifiedBadge size={13} />}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  @{flicker.handle}
                </div>
              </div>

              {/* Engagement Stats Box */}
              <div className="mt-2.5 py-1.5 px-2 rounded-2xl bg-background/60 border border-white/5 space-y-0.5">
                <div className="flex items-center justify-center gap-1 text-xs font-mono font-black text-amber-400">
                  <Flame className="w-3.5 h-3.5 text-amber-400 shrink-0 fill-current" />
                  <span>{flicker.engagementScore.toLocaleString()} pts</span>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono truncate">
                  {flicker.flicksCount} flicks • {flicker.likesReceived} likes
                </div>
              </div>

              {/* Interactive Live Duel Button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  triggerLightHaptic();
                  setSelectedDuelOpponent(flicker);
                }}
                className={`mt-3 w-full py-2 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition active:scale-95 shadow-sm ${
                  isFirst
                    ? "bg-red-600 hover:bg-red-500 text-white shadow-red-600/30"
                    : "bg-red-500/15 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/30"
                }`}
              >
                <Swords className="w-3.5 h-3.5" />
                <span>Live Duel ⚔️</span>
              </button>
            </motion.div>
          );
        })}
      </div>

      {/* Duel Modal */}
      <DuelModal
        open={Boolean(selectedDuelOpponent)}
        onClose={() => setSelectedDuelOpponent(null)}
        opponent={selectedDuelOpponent}
      />
    </div>
  );
}
