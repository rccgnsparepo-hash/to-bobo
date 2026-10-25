import { Trophy, Crown, Sparkles, Flame, Zap } from "lucide-react";
import { getRankBadgeMeta } from "@/lib/topFlickers";

interface TopFlickerBadgeProps {
  rank: number;
  size?: "sm" | "md" | "lg";
  showLabel?: boolean;
}

export function TopFlickerBadge({ rank, size = "sm", showLabel = false }: TopFlickerBadgeProps) {
  if (!rank || rank > 10) return null;
  const meta = getRankBadgeMeta(rank);

  const sizeClasses = {
    sm: "px-1.5 py-0.5 text-[10px] gap-1",
    md: "px-2 py-0.5 text-xs gap-1.5",
    lg: "px-3 py-1 text-sm gap-2",
  }[size];

  const iconSize = size === "lg" ? "w-4 h-4" : size === "md" ? "w-3.5 h-3.5" : "w-3 h-3";

  return (
    <span
      title={`Global Top Flicker ${meta.title}`}
      className={`inline-flex items-center font-black rounded-full border shadow-md font-mono ${meta.bg} ${meta.glow} ${sizeClasses} select-none cursor-help tracking-tight transition hover:scale-105`}
    >
      <span className="text-xs">{meta.icon}</span>
      <span>#{rank}</span>
      {showLabel && <span className="font-sans font-bold text-[11px] hidden sm:inline">{meta.title}</span>}
    </span>
  );
}
