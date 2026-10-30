import React, { useState } from "react";
import { Sparkles, X, ArrowRight, Wand2, Lightbulb, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { GarmentItem, GARMENTS_CATALOG } from "@/lib/fashionData";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onApplyOutfit: (outfit: {
    top?: GarmentItem;
    bottom?: GarmentItem;
    dress?: GarmentItem;
    shoes: GarmentItem;
    accessory?: GarmentItem;
    name: string;
  }) => void;
  currency: "CNY" | "USD" | "NGN";
}

interface StylistSuggestion {
  id: string;
  name: string;
  prompt: string;
  top?: GarmentItem;
  bottom?: GarmentItem;
  dress?: GarmentItem;
  shoes: GarmentItem;
  accessory?: GarmentItem;
  stylistRationale: string;
}

const QUICK_PROMPTS = [
  "Style an outfit for a date",
  "Give me a clean campus fit",
  "Build an outfit around this jacket",
  "Help me style a traditional outfit",
  "Give me an edgy Y2K stage fit",
  "Elevate an Old Money formal look",
];

export function FashionAiStylistModal({
  isOpen,
  onClose,
  onApplyOutfit,
  currency,
}: Props) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentResult, setCurrentResult] = useState<StylistSuggestion | null>(null);

  const generateLook = (query: string) => {
    void triggerLightHaptic();
    setIsGenerating(true);
    setCurrentResult(null);

    setTimeout(() => {
      const q = query.toLowerCase();
      let match: StylistSuggestion;

      if (q.includes("date") || q.includes("dinner") || q.includes("night")) {
        match = {
          id: "rec_date",
          name: "Silk Twilight Glamour",
          prompt: query,
          dress: GARMENTS_CATALOG.find((g) => g.id === "dress-slip"),
          shoes: GARMENTS_CATALOG.find((g) => g.id === "shoe-heels")!,
          accessory: GARMENTS_CATALOG.find((g) => g.id === "acc-bag"),
          stylistRationale:
            "Silk fluid drape flatters evening lighting, paired with 75mm strappy sandals that elongate the legs and a minimalist baguette bag for effortless luxury.",
        };
      } else if (q.includes("campus") || q.includes("class") || q.includes("school")) {
        match = {
          id: "rec_campus",
          name: "Clean Architecture Campus",
          prompt: query,
          top: GARMENTS_CATALOG.find((g) => g.id === "top-street"),
          bottom: GARMENTS_CATALOG.find((g) => g.id === "btm-street"),
          shoes: GARMENTS_CATALOG.find((g) => g.id === "shoe-street")!,
          accessory: GARMENTS_CATALOG.find((g) => g.id === "acc-cap"),
          stylistRationale:
            "The classic 'sandwich styling rule': A heavy 300gsm drop-shoulder ecru tee harmonizes with raw selvedge denim and retro gum-sole low-tops.",
        };
      } else if (q.includes("trad") || q.includes("african") || q.includes("senator") || q.includes("wedding")) {
        match = {
          id: "rec_trad",
          name: "Royal Lagos Senator",
          prompt: query,
          top: GARMENTS_CATALOG.find((g) => g.id === "top-senator"),
          bottom: GARMENTS_CATALOG.find((g) => g.id === "btm-senator"),
          shoes: GARMENTS_CATALOG.find((g) => g.id === "shoe-senator")!,
          accessory: GARMENTS_CATALOG.find((g) => g.id === "acc-beads"),
          stylistRationale:
            "High-contrast elegance: Midnight navy geometric embroidery anchored by crisp white linen pants and handcrafted coral beads.",
        };
      } else if (q.includes("y2k") || q.includes("stage") || q.includes("rave") || q.includes("cyber")) {
        match = {
          id: "rec_y2k",
          name: "Cyber Neon Cargo",
          prompt: query,
          top: GARMENTS_CATALOG.find((g) => g.id === "top-kpop"),
          bottom: GARMENTS_CATALOG.find((g) => g.id === "btm-kpop"),
          shoes: GARMENTS_CATALOG.find((g) => g.id === "shoe-kpop")!,
          accessory: GARMENTS_CATALOG.find((g) => g.id === "acc-shades"),
          stylistRationale:
            "Neon voltage meets techwear ripstop. Anodized buckles and futuristic trainers create maximum stage presence.",
        };
      } else {
        match = {
          id: "rec_oldmoney",
          name: "Savile Tailored Minimalist",
          prompt: query,
          top: GARMENTS_CATALOG.find((g) => g.id === "top-blazer"),
          bottom: GARMENTS_CATALOG.find((g) => g.id === "btm-pres"),
          shoes: GARMENTS_CATALOG.find((g) => g.id === "shoe-pres")!,
          accessory: GARMENTS_CATALOG.find((g) => g.id === "acc-bag"),
          stylistRationale:
            "Relaxed modern tailoring: An unstructured virgin wool blazer balanced with deep double pleats and polished calfskin loafers.",
        };
      }

      setCurrentResult(match);
      setIsGenerating(false);
    }, 600);
  };

  const handleApply = () => {
    if (!currentResult) return;
    void triggerMediumHaptic();
    onApplyOutfit({
      top: currentResult.top,
      bottom: currentResult.bottom,
      dress: currentResult.dress,
      shoes: currentResult.shoes,
      accessory: currentResult.accessory,
      name: currentResult.name,
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 220 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-card border border-border rounded-t-[36px] sm:rounded-3xl p-6 space-y-5 max-h-[90vh] overflow-y-auto shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-rose-500/10 text-rose-500 grid place-items-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-lg text-foreground">
                AI Fashion Stylist
              </h3>
              <p className="text-xs text-muted-foreground">
                Intelligent outfit combinations for every occasion
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full hover:bg-secondary text-muted-foreground hover:text-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Input & Generator */}
        <div className="space-y-2.5">
          <div className="relative">
            <input
              type="text"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && customPrompt.trim() && generateLook(customPrompt)}
              placeholder="e.g. Style an outfit for Sunday gallery opening..."
              className="w-full bg-secondary border border-border rounded-2xl px-4 py-3 pr-12 text-sm text-foreground focus:outline-none focus:border-rose-500 transition"
            />
            <button
              type="button"
              disabled={!customPrompt.trim() || isGenerating}
              onClick={() => generateLook(customPrompt)}
              className="absolute right-2 top-2 w-8 h-8 rounded-xl bg-rose-500 disabled:opacity-40 text-white grid place-items-center hover:scale-105 active:scale-95 transition"
            >
              <Wand2 className="w-4 h-4" />
            </button>
          </div>

          {/* Quick Prompts */}
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
              <span>Quick Style Scenarios:</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => {
                    setCustomPrompt(prompt);
                    generateLook(prompt);
                  }}
                  className="px-3 py-1 rounded-full bg-secondary hover:bg-secondary/80 text-[11px] font-medium text-foreground transition active:scale-95"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading Spinner */}
        {isGenerating && (
          <div className="py-12 flex flex-col items-center justify-center gap-3">
            <div className="w-8 h-8 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
            <span className="text-xs font-semibold text-muted-foreground animate-pulse">
              Curating pieces & balancing color harmonies…
            </span>
          </div>
        )}

        {/* Result Card */}
        {currentResult && !isGenerating && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-3xl bg-secondary/40 border border-border space-y-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-rose-500 tracking-wider">
                  Recommended Styling
                </span>
                <h4 className="font-display font-bold text-base text-foreground">
                  {currentResult.name}
                </h4>
              </div>
            </div>

            {/* Stylist Rationale */}
            <p className="text-xs text-muted-foreground italic font-serif bg-card/60 p-3 rounded-2xl border border-border/60">
              "{currentResult.stylistRationale}"
            </p>

            {/* Pieces Stack */}
            <div className="grid grid-cols-3 gap-2">
              {[
                currentResult.top,
                currentResult.bottom,
                currentResult.dress,
                currentResult.shoes,
                currentResult.accessory,
              ]
                .filter(Boolean)
                .map((p, idx) => (
                  <div
                    key={idx}
                    className="p-2 rounded-2xl bg-card border border-border text-center space-y-1.5"
                  >
                    <div className="aspect-square rounded-xl overflow-hidden bg-secondary">
                      <img src={p?.imageUrl} alt={p?.name} className="w-full h-full object-cover" />
                    </div>
                    <span className="block text-[10px] font-bold text-foreground truncate">
                      {p?.name}
                    </span>
                  </div>
                ))}
            </div>

            {/* Action */}
            <button
              type="button"
              onClick={handleApply}
              className="w-full py-3 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-lg shadow-rose-500/25 active:scale-95 transition"
            >
              <Check className="w-4 h-4" />
              <span>Equip Look on 3D Model</span>
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
