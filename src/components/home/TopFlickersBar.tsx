import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Swords, Trophy, Crown, Flame } from "lucide-react";
import { fetchTopFlickers, type TopFlicker } from "@/lib/topFlickers";
import { Avatar } from "@/components/Avatar";
import { DuelModal } from "@/components/duel/DuelModal";
import { triggerLightHaptic } from "@/lib/haptics";
import { FlickVerifiedBadge } from "@/components/FlickVerifiedBadge";
import { isUserVerified } from "@/lib/verification";

interface TopFlickersBarProps {
  title?: string;
  compact?: boolean;
}

export function TopFlickersBar({
  title = "Top Flickers",
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
  const displayTitle =
    title === "TOP FLICKERS OF THE WEEK" || title === "TOP FLICKERS OF THE WEEK • HALL OF FAME"
      ? "Top Flickers"
      : title;

  return (
    <section className="border-b border-border/50 bg-background/50 dark:bg-zinc-950/40 backdrop-blur-xs p-4 sm:p-5 space-y-3 relative">
      {/* Editorial Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 px-0.5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-secondary/80 text-foreground/80 flex items-center justify-center border border-border/50 shrink-0">
            <Trophy className="w-3.5 h-3.5 text-amber-500/90" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold tracking-tight text-foreground">
                {displayTitle}
              </h2>
              <span className="text-xs text-muted-foreground/60 select-none">·</span>
              <span className="text-xs text-muted-foreground">This week</span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5 font-normal">
              Ranked by post impressions and community engagement
            </p>
          </div>
        </div>

        {/* Subtle Challenge #1 Action */}
        {top1 && (
          <button
            type="button"
            onClick={() => {
              triggerLightHaptic();
              setSelectedDuelOpponent(top1);
            }}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary/70 hover:bg-secondary text-foreground text-xs font-medium border border-border/60 hover:border-border transition active:scale-95"
            title={`Duel with #1 ${top1.display_name}`}
          >
            <Swords className="w-3 h-3 text-muted-foreground" />
            <span>Challenge #1</span>
          </button>
        )}
      </div>

      {/* Understated Minimalist Cards Carousel */}
      <div className="flex items-stretch gap-3 overflow-x-auto pb-1.5 pt-0.5 no-scrollbar">
        {topFlickers.slice(0, 8).map((flicker) => {
          const isFirst = flicker.rank === 1;
          const isSecond = flicker.rank === 2;
          const isThird = flicker.rank === 3;

          return (
            <motion.div
              key={flicker.id}
              whileHover={{ y: -2 }}
              transition={{ duration: 0.15 }}
              className={`flex-shrink-0 w-36 sm:w-40 rounded-2xl p-3 flex flex-col justify-between items-center text-center relative transition-all duration-200 group bg-card/60 hover:bg-card border shadow-2xs hover:shadow-sm ${
                isFirst
                  ? "border-amber-500/30 dark:border-amber-500/20"
                  : "border-border/50 hover:border-border"
              }`}
            >
              {/* Clean Rank Indicator */}
              <div className="w-full flex items-center justify-between mb-1.5 px-0.5">
                <span
                  className={`text-[11px] font-mono font-bold tracking-tight ${
                    isFirst
                      ? "text-amber-500"
                      : isSecond
                        ? "text-zinc-400 dark:text-zinc-300"
                        : isThird
                          ? "text-amber-700/80 dark:text-amber-600/80"
                          : "text-muted-foreground/60"
                  }`}
                >
                  #{flicker.rank}
                </span>
                {isFirst && <Crown className="w-3.5 h-3.5 text-amber-500" />}
              </div>

              {/* Minimal Avatar */}
              <button
                type="button"
                onClick={() => navigate(`/u/${flicker.handle}`)}
                className="relative my-1 cursor-pointer focus:outline-none"
                title={`View @${flicker.handle}'s profile`}
              >
                <div
                  className={`rounded-full p-0.5 ring-1 transition-all ${
                    isFirst
                      ? "ring-amber-500/50 group-hover:ring-amber-500"
                      : "ring-border group-hover:ring-foreground/20"
                  }`}
                >
                  <Avatar url={flicker.avatar_url} name={flicker.display_name} size={48} />
                </div>
              </button>

              {/* Creator Name & Handle */}
              <button
                type="button"
                onClick={() => navigate(`/u/${flicker.handle}`)}
                className="w-full min-w-0 cursor-pointer mt-1 focus:outline-none"
              >
                <div className="font-semibold text-xs text-foreground truncate group-hover:text-primary transition flex items-center justify-center gap-1">
                  <span className="truncate">{flicker.display_name}</span>
                  {isUserVerified(flicker.id) && <FlickVerifiedBadge size={12} />}
                </div>
                <div className="text-[11px] text-muted-foreground truncate font-normal mt-0.5">
                  @{flicker.handle}
                </div>
              </button>

              {/* Quiet Metric Display */}
              <div className="mt-2.5 text-center space-y-0.5">
                <div className="text-xs font-semibold font-mono text-foreground flex items-center justify-center gap-1">
                  <Flame className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span>{flicker.engagementScore.toLocaleString()}</span>
                  <span className="text-[10px] text-muted-foreground font-sans font-normal">pts</span>
                </div>
                <div className="text-[10px] text-muted-foreground/70 font-normal truncate">
                  {flicker.flicksCount} flicks · {flicker.likesReceived} likes
                </div>
              </div>

              {/* Low-Key Duel Action */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerLightHaptic();
                  setSelectedDuelOpponent(flicker);
                }}
                className="mt-3 w-full py-1.5 px-2 rounded-xl text-[11px] font-medium bg-secondary/60 hover:bg-secondary text-foreground/80 hover:text-foreground border border-border/50 hover:border-border transition-colors active:scale-95 flex items-center justify-center gap-1.5"
                title={`Challenge ${flicker.display_name} to a Live Duel`}
              >
                <Swords className="w-3 h-3 text-muted-foreground" />
                <span>Duel</span>
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
    </section>
  );
}
