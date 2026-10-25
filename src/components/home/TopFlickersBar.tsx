import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Swords, Trophy, Flame, Sparkles, ChevronRight, Crown } from "lucide-react";
import { fetchTopFlickers, type TopFlicker } from "@/lib/topFlickers";
import { Avatar } from "@/components/Avatar";
import { TopFlickerBadge } from "@/components/TopFlickerBadge";
import { DuelModal } from "@/components/duel/DuelModal";
import { triggerLightHaptic } from "@/lib/haptics";

export function TopFlickersBar() {
  const navigate = useNavigate();
  const [topFlickers, setTopFlickers] = useState<TopFlicker[]>([]);
  const [selectedDuelOpponent, setSelectedDuelOpponent] = useState<TopFlicker | null>(null);

  useEffect(() => {
    fetchTopFlickers().then((flickers) => setTopFlickers(flickers));
  }, []);

  if (topFlickers.length === 0) return null;

  return (
    <div className="border-b border-border bg-gradient-to-b from-card/80 to-background/50 p-3 sm:p-4 space-y-3">
      {/* Title & Badge */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-amber-400/20 text-amber-400 flex items-center justify-center text-xs">
            <Crown className="w-3.5 h-3.5" />
          </div>
          <span className="font-display font-extrabold text-xs tracking-wider uppercase text-foreground">
            Top Flickers • Hall of Fame
          </span>
          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-snap/20 text-snap border border-snap/30">
            GLOBAL
          </span>
        </div>

        <button
          onClick={() => {
            triggerLightHaptic();
            if (topFlickers[0]) setSelectedDuelOpponent(topFlickers[0]);
          }}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/15 text-red-400 hover:bg-red-500/25 border border-red-500/30 text-xs font-bold transition active:scale-95"
        >
          <Swords className="w-3 h-3" />
          <span>DUEL #1</span>
        </button>
      </div>

      {/* Horizontal Carousel of Top Flickers */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1 no-scrollbar pt-1">
        {topFlickers.slice(0, 6).map((flicker) => (
          <motion.div
            key={flicker.id}
            whileHover={{ y: -2 }}
            className="flex-shrink-0 w-36 rounded-2xl bg-secondary/60 hover:bg-secondary border border-border p-3 flex flex-col items-center text-center relative transition group shadow-sm"
          >
            {/* Rank Crown Pill */}
            <div className="absolute -top-2 left-1/2 -translate-x-1/2">
              <TopFlickerBadge rank={flicker.rank} size="sm" />
            </div>

            {/* Glowing Avatar */}
            <div
              onClick={() => navigate(`/u/${flicker.handle}`)}
              className="mt-2 relative cursor-pointer"
            >
              <div
                className="w-14 h-14 rounded-full p-0.5 ring-2 transition group-hover:scale-105"
                style={{
                  boxShadow: `0 0 15px ${flicker.haloColor}`,
                  borderColor: flicker.haloColor,
                }}
              >
                <Avatar url={flicker.avatar_url} name={flicker.display_name} size={56} />
              </div>
            </div>

            {/* Name & Handle */}
            <div
              onClick={() => navigate(`/u/${flicker.handle}`)}
              className="mt-2 min-w-0 w-full cursor-pointer"
            >
              <div className="font-bold text-xs truncate text-foreground group-hover:text-snap transition">
                {flicker.display_name}
              </div>
              <div className="text-[10px] text-muted-foreground truncate">
                @{flicker.handle}
              </div>
            </div>

            <div className="flex items-center gap-1 text-[10px] font-mono font-bold text-snap mt-1">
              <Flame className="w-3 h-3 text-amber-400 shrink-0" />
              <span>{flicker.engagementScore.toLocaleString()} pts</span>
            </div>
            <div className="text-[9px] text-muted-foreground font-mono truncate">
              {flicker.flicksCount} flicks · {flicker.likesReceived} likes
            </div>

            {/* Duel Button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                triggerLightHaptic();
                setSelectedDuelOpponent(flicker);
              }}
              className="mt-2.5 w-full py-1 rounded-xl bg-red-600/20 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/30 text-[11px] font-extrabold flex items-center justify-center gap-1 transition active:scale-95 shadow-sm"
            >
              <Swords className="w-3 h-3" />
              <span>Duel</span>
            </button>
          </motion.div>
        ))}
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
