import React from "react";
import { X, ChevronRight, Bookmark, Share2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GarmentItem } from "@/lib/fashionData";
import { triggerLightHaptic } from "@/lib/haptics";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  outfitName: string;
  stylingRule: string;
  equipped: {
    top?: GarmentItem;
    bottom?: GarmentItem;
    dress?: GarmentItem;
    shoes: GarmentItem;
    accessory?: GarmentItem;
  };
  onInspectPiece: (piece: GarmentItem) => void;
  onSaveOutfit: () => void;
  onShareOutfit: () => void;
  currency: "CNY" | "USD" | "NGN";
}

export function FashionRecipeDrawer({
  isOpen,
  onClose,
  outfitName,
  stylingRule,
  equipped,
  onInspectPiece,
  onSaveOutfit,
  onShareOutfit,
  currency,
}: Props) {
  if (!isOpen) return null;

  const pieces = [
    equipped.dress ? { piece: equipped.dress, role: "Dress / Co-ord" } : null,
    equipped.top ? { piece: equipped.top, role: "Top Garment" } : null,
    equipped.bottom ? { piece: equipped.bottom, role: "Bottom Garment" } : null,
    equipped.shoes ? { piece: equipped.shoes, role: "Footwear" } : null,
    equipped.accessory ? { piece: equipped.accessory, role: "Accessory" } : null,
  ].filter(Boolean) as { piece: GarmentItem; role: string }[];

  const formatPrice = (p: GarmentItem) => {
    if (currency === "CNY") return `¥${p.priceCNY}`;
    if (currency === "NGN") return `₦${p.priceNGN.toLocaleString()}`;
    return `$${p.priceUSD}`;
  };

  const calculateTotal = () => {
    if (currency === "CNY") {
      const sum = pieces.reduce((acc, curr) => acc + curr.piece.priceCNY, 0);
      return `¥${sum}`;
    }
    if (currency === "NGN") {
      const sum = pieces.reduce((acc, curr) => acc + curr.piece.priceNGN, 0);
      return `₦${sum.toLocaleString()}`;
    }
    const sum = pieces.reduce((acc, curr) => acc + curr.piece.priceUSD, 0);
    return `$${sum}`;
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end justify-center"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 26, stiffness: 240 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-card rounded-t-[36px] border-t border-border p-6 space-y-4 max-h-[85vh] overflow-y-auto shadow-2xl text-foreground"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div>
            <div className="flex items-center gap-1.5 text-xs text-rose-500 font-extrabold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Outfit Recipe Breakdown</span>
            </div>
            <h3 className="font-display font-bold text-lg text-foreground">
              {outfitName}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Styling Rule Callout */}
        <div className="p-3.5 rounded-2xl bg-secondary/60 border border-border/80 space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
            Styling Principle
          </span>
          <p className="text-xs text-foreground/90 font-serif italic">
            "{stylingRule}"
          </p>
        </div>

        {/* Pieces List */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-bold text-muted-foreground px-1">
            <span>Garment Pieces ({pieces.length})</span>
            <span>Total: <strong className="text-foreground font-mono">{calculateTotal()}</strong></span>
          </div>

          {pieces.map(({ piece, role }) => (
            <div
              key={piece.id}
              onClick={() => {
                void triggerLightHaptic();
                onInspectPiece(piece);
              }}
              className="p-3 rounded-2xl bg-secondary/40 border border-border flex items-center justify-between gap-3 cursor-pointer hover:border-rose-400 hover:bg-secondary/70 transition group"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl overflow-hidden bg-secondary border border-border shrink-0">
                  <img src={piece.imageUrl} alt={piece.name} className="w-full h-full object-cover" />
                </div>
                <div className="min-w-0">
                  <span className="block text-[10px] uppercase tracking-wider font-bold text-rose-500">
                    {role} • {piece.brand}
                  </span>
                  <span className="block text-xs font-bold text-foreground truncate group-hover:text-rose-500 transition-colors">
                    {piece.name}
                  </span>
                  <span className="text-[11px] font-mono font-medium text-muted-foreground">
                    {formatPrice(piece)}
                  </span>
                </div>
              </div>

              <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60">
          <button
            type="button"
            onClick={onSaveOutfit}
            className="py-2.5 rounded-full bg-secondary hover:bg-secondary/80 text-foreground text-xs font-bold flex items-center justify-center gap-1.5 transition active:scale-95"
          >
            <Bookmark className="w-3.5 h-3.5" />
            <span>Save to Wardrobe</span>
          </button>

          <button
            type="button"
            onClick={onShareOutfit}
            className="py-2.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-rose-500/25 transition active:scale-95"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>Share Fit</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
