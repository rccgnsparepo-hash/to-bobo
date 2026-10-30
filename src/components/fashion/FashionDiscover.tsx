import React, { useState } from "react";
import { Sparkles, Heart, Shirt, ArrowRight, Check } from "lucide-react";
import { CuratedLook, CURATED_LOOKS, FashionAesthetic } from "@/lib/fashionData";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";

interface Props {
  onWearLook: (look: CuratedLook) => void;
  currency: "CNY" | "USD" | "NGN";
}

const AESTHETICS: (FashionAesthetic | "All")[] = [
  "All",
  "Streetwear",
  "Old Money",
  "Campus Fits",
  "Traditional & African",
  "Y2K",
  "Date Night",
  "Minimalist",
  "Athleisure",
  "Casual",
  "Formal",
];

export function FashionDiscover({ onWearLook, currency }: Props) {
  const [selectedAesthetic, setSelectedAesthetic] = useState<FashionAesthetic | "All">("All");
  const [likesMap, setLikesMap] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    CURATED_LOOKS.forEach((l) => (init[l.id] = l.likes));
    return init;
  });
  const [likedLooks, setLikedLooks] = useState<Set<string>>(new Set());

  const filteredLooks = CURATED_LOOKS.filter((look) => {
    if (selectedAesthetic === "All") return true;
    return look.aesthetic === selectedAesthetic;
  });

  const toggleLike = (lookId: string) => {
    void triggerLightHaptic();
    setLikedLooks((prev) => {
      const next = new Set(prev);
      const isLiked = next.has(lookId);
      if (isLiked) {
        next.delete(lookId);
        setLikesMap((m) => ({ ...m, [lookId]: (m[lookId] || 1) - 1 }));
      } else {
        next.add(lookId);
        setLikesMap((m) => ({ ...m, [lookId]: (m[lookId] || 0) + 1 }));
      }
      return next;
    });
  };

  const calculateTotalCost = (look: CuratedLook) => {
    const pieces = [look.top, look.bottom, look.dress, look.shoes, look.accessory].filter(Boolean);
    if (currency === "CNY") {
      const total = pieces.reduce((acc, p) => acc + (p?.priceCNY || 0), 0);
      return `¥${total}`;
    }
    if (currency === "NGN") {
      const total = pieces.reduce((acc, p) => acc + (p?.priceNGN || 0), 0);
      return `₦${total.toLocaleString()}`;
    }
    const total = pieces.reduce((acc, p) => acc + (p?.priceUSD || 0), 0);
    return `$${total}`;
  };

  return (
    <div className="flex-1 w-full overflow-y-auto px-4 sm:px-8 py-6 max-w-6xl mx-auto space-y-6">
      {/* Editorial Title Banner */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-rose-500 font-extrabold text-xs uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          <span>Curated Style Directory</span>
        </div>
        <h2 className="font-display font-black text-2xl sm:text-3xl text-foreground tracking-tight">
          Discover Runway & Street Inspo
        </h2>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Browse handcrafted fashion combinations curated by stylists. Equip any complete look onto your 3D model with one tap, or customize individual garments to match your personal vibe.
        </p>
      </div>

      {/* Aesthetic Filter Chips (Button Segmented Controls) */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {AESTHETICS.map((a) => {
          const active = selectedAesthetic === a;
          return (
            <button
              key={a}
              type="button"
              onClick={() => {
                void triggerLightHaptic();
                setSelectedAesthetic(a);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition ${
                active
                  ? "bg-foreground text-background shadow-xs scale-100"
                  : "bg-secondary/70 text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              {a}
            </button>
          );
        })}
      </div>

      {/* Looks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredLooks.map((look) => {
          const isLiked = likedLooks.has(look.id);
          const likeCount = likesMap[look.id] || look.likes;

          return (
            <div
              key={look.id}
              className="group rounded-3xl bg-card border border-border overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col"
            >
              {/* Image Preview & Swatch Bar */}
              <div className="relative aspect-[4/5] bg-secondary/60 overflow-hidden">
                <img
                  src={look.thumbnailUrl}
                  alt={look.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />

                {/* Aesthetic Badge */}
                <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-background/85 backdrop-blur-md border border-border/60 text-[10px] font-bold uppercase tracking-wider text-foreground">
                  {look.aesthetic}
                </div>

                {/* Like Button */}
                <button
                  type="button"
                  onClick={() => toggleLike(look.id)}
                  className="absolute top-3 right-3 w-8 h-8 rounded-full bg-background/85 backdrop-blur-md border border-border/60 grid place-items-center text-foreground hover:scale-110 active:scale-95 transition"
                  title="Like this outfit"
                >
                  <Heart
                    className={`w-4 h-4 ${
                      isLiked ? "fill-rose-500 text-rose-500" : "text-muted-foreground"
                    }`}
                  />
                </button>

                {/* Bottom Color Swatches */}
                <div className="absolute bottom-3 left-3 flex items-center gap-1 px-2 py-1 rounded-full bg-background/80 backdrop-blur-md">
                  {look.swatches.map((color, idx) => (
                    <span
                      key={idx}
                      className="w-2.5 h-2.5 rounded-full border border-black/10"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                  <span className="text-[10px] font-bold font-mono ml-1 text-foreground">
                    {calculateTotalCost(look)}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display font-bold text-base text-foreground group-hover:text-rose-500 transition-colors">
                      {look.name}
                    </h3>
                    <span className="text-xs text-muted-foreground font-mono">
                      {likeCount} likes
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1">
                    Occasion: {look.occasion}
                  </p>
                  <p className="text-xs text-foreground/80 line-clamp-2 pt-1 italic font-serif">
                    "{look.stylingRule}"
                  </p>
                </div>

                {/* Piece Previews */}
                <div className="flex items-center gap-2 pt-1 border-t border-border/60">
                  <div className="flex -space-x-2 overflow-hidden py-1">
                    {[look.top, look.bottom, look.dress, look.shoes, look.accessory]
                      .filter(Boolean)
                      .map((p, idx) => (
                        <div
                          key={idx}
                          className="w-7 h-7 rounded-full border-2 border-card overflow-hidden bg-secondary shrink-0 shadow-xs"
                          title={p?.name}
                        >
                          <img src={p?.imageUrl} alt={p?.name} className="w-full h-full object-cover" />
                        </div>
                      ))}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {[look.top, look.bottom, look.dress, look.shoes, look.accessory].filter(Boolean).length} garments
                  </span>

                  <button
                    type="button"
                    onClick={() => {
                      void triggerMediumHaptic();
                      onWearLook(look);
                    }}
                    className="ml-auto px-3.5 py-1.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-rose-500/25 active:scale-95 transition"
                  >
                    <span>Wear Fit</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
