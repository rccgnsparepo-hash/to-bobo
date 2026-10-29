import { useState } from "react";
import { Sparkles, Eye, Heart, Flame, ThumbsUp, ThumbsDown, Gem, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { triggerMediumHaptic, triggerLightHaptic } from "@/lib/haptics";

interface Props {
  content: string;
  mediaUrl: string | null;
  mine: boolean;
}

interface FashionLookPayload {
  lookTitle: string;
  previewUrl: string;
  modelId: string;
  stylingRule: string;
  askOpinion?: boolean;
  note?: string;
  items: {
    top?: { id: string; name: string; priceUSD: number; imageUrl: string };
    bottom?: { id: string; name: string; priceUSD: number; imageUrl: string };
    dress?: { id: string; name: string; priceUSD: number; imageUrl: string };
    shoes?: { id: string; name: string; priceUSD: number; imageUrl: string };
    accessory?: { id: string; name: string; priceUSD: number; imageUrl: string };
  };
}

export function FashionLookCard({ content, mediaUrl, mine }: Props) {
  const navigate = useNavigate();
  const [selectedOpinion, setSelectedOpinion] = useState<string | null>(null);

  let payload: FashionLookPayload | null = null;
  try {
    payload = JSON.parse(content);
  } catch {
    payload = null;
  }

  const lookTitle = payload?.lookTitle || "Fashion Studio Look";
  const preview = mediaUrl || payload?.previewUrl || "/assets/aistudio/download__38__1d85c90f.jpg";
  const stylingRule = payload?.stylingRule;
  const items = payload?.items;
  const askOpinion = payload?.askOpinion;
  const note = payload?.note;

  const handleOpinionRate = (opinion: string) => {
    void triggerMediumHaptic();
    setSelectedOpinion(opinion);
    toast.success(`Rated fit: ${opinion}! Feedback recorded.`);
  };

  const handleOpenInStudio = () => {
    void triggerMediumHaptic();
    navigate("/fashion");
  };

  return (
    <div className="p-3 max-w-sm space-y-3">
      {/* Editorial Look Card */}
      <div className="rounded-2xl overflow-hidden bg-black/30 border border-white/10 shadow-lg">
        {/* Preview image */}
        <div className="relative aspect-[3/4] w-full bg-secondary overflow-hidden">
          <img
            src={preview}
            alt={lookTitle}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 pointer-events-none" />

          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-white text-[10px] font-bold">
            <Sparkles className="w-3 h-3 text-rose-400" />
            <span>Flick Fashion Studio</span>
          </div>

          <div className="absolute bottom-2.5 inset-x-2.5 text-white">
            <h4 className="font-display font-bold text-sm leading-tight drop-shadow-sm">
              {lookTitle}
            </h4>
            {stylingRule && (
              <p className="text-[10px] text-white/80 line-clamp-1 mt-0.5">
                {stylingRule}
              </p>
            )}
          </div>
        </div>

        {/* Sender Note */}
        {note && (
          <div className="p-2.5 text-xs text-zinc-200 border-b border-white/5 bg-zinc-900/60">
            "{note}"
          </div>
        )}

        {/* Pieces Tag Strip */}
        {items && (
          <div className="p-2 bg-zinc-950/80 space-y-1">
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider block">
              Outfit Pieces
            </span>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
              {[items.dress || items.top, items.bottom, items.shoes, items.accessory]
                .filter(Boolean)
                .map((it, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 border border-white/5 text-[10px] text-zinc-300 shrink-0"
                  >
                    <span className="truncate max-w-[90px]">{it!.name}</span>
                    <span className="text-rose-400 font-mono">${it!.priceUSD}</span>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Recreate in Studio CTA */}
        <div className="p-2.5 bg-zinc-950">
          <button
            type="button"
            onClick={handleOpenInStudio}
            className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold text-xs shadow-md shadow-rose-500/20 active:scale-95 transition flex items-center justify-center gap-1.5"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Recreate Look in 3D Studio</span>
          </button>
        </div>
      </div>

      {/* Interactive Opinion Poll (If requested by sender) */}
      {askOpinion && (
        <div className="p-2.5 rounded-xl bg-zinc-900/80 border border-white/10 text-center space-y-2">
          <span className="text-[11px] font-bold text-zinc-300 flex items-center justify-center gap-1">
            <span>Rate this outfit opinion:</span>
          </span>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: "🔥 Fire", id: "fire" },
              { label: "👍 Great", id: "great" },
              { label: "💎 Iconic", id: "iconic" },
              { label: "👎 Pass", id: "pass" },
            ].map((op) => {
              const active = selectedOpinion === op.id;
              return (
                <button
                  key={op.id}
                  type="button"
                  onClick={() => handleOpinionRate(op.id)}
                  className={`py-1.5 px-1 rounded-lg text-[11px] font-bold transition ${
                    active
                      ? "bg-rose-500 text-white scale-105 shadow-sm"
                      : "bg-white/5 hover:bg-white/10 text-zinc-300"
                  }`}
                >
                  {op.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
