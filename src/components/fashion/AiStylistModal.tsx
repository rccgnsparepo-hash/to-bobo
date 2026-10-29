import { useState } from "react";
import { X, Bot, Sparkles, Send, Check, Wand2, ArrowRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";
import type { CurrentOutfit, GarmentItem } from "@/lib/fashionData";
import { consultAiStylist, type StylistRecommendation } from "@/lib/aiStylist";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onApplyRecommendation: (rec: StylistRecommendation) => void;
  currentGarment?: GarmentItem;
  currency: "USD" | "CNY" | "NGN";
}

const QUICK_PROMPTS = [
  "Style an outfit for a date",
  "Give me a clean campus fit",
  "Build a fit with retro sneakers",
  "Traditional African celebration look",
  "Old money university presentation",
  "Cyber streetwear with heavy textures",
];

export function AiStylistModal({
  isOpen,
  onClose,
  onApplyRecommendation,
  currentGarment,
  currency,
}: Props) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<StylistRecommendation | null>(null);

  if (!isOpen) return null;

  const handleConsult = async (selectedPrompt?: string) => {
    const query = selectedPrompt || prompt;
    if (!query.trim()) {
      toast.error("Please enter a style request");
      return;
    }

    setLoading(true);
    void triggerLightHaptic();
    try {
      const rec = await consultAiStylist(query, currentGarment);
      setRecommendation(rec);
      void triggerMediumHaptic();
    } catch (e) {
      toast.error("Failed to generate styling recommendation");
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (piece: GarmentItem) => {
    if (currency === "CNY") return `¥ ${piece.priceCNY}`;
    if (currency === "NGN") return `₦ ${piece.priceNGN.toLocaleString()}`;
    return `$ ${piece.priceUSD}`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4">
      <motion.div
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        className="w-full max-w-lg rounded-t-[36px] sm:rounded-3xl bg-card border border-border p-5 sm:p-6 shadow-2xl max-h-[90vh] overflow-y-auto no-scrollbar space-y-4"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-2 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-rose-500 to-amber-500 text-white grid place-items-center shadow-md shadow-rose-500/20">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-foreground flex items-center gap-1.5">
                <span>AI Stylist</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-rose-500/10 text-rose-500 font-bold">
                  Gemini Flash
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">Personal fashion advisor & wardrobe intelligence</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-secondary grid place-items-center text-muted-foreground hover:text-foreground transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Style Prompt Chips */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-foreground">Suggested Inquiries</label>
          <div className="flex flex-wrap gap-1.5">
            {QUICK_PROMPTS.map((qp) => (
              <button
                key={qp}
                type="button"
                onClick={() => {
                  setPrompt(qp);
                  handleConsult(qp);
                }}
                className="px-2.5 py-1 rounded-full bg-secondary/80 hover:bg-secondary border border-border text-[11px] font-medium text-foreground transition active:scale-95 text-left"
              >
                {qp}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Input Bar */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConsult();
            }}
            placeholder="Ask AI stylist (e.g. style a minimal rainy day outfit)…"
            className="flex-1 bg-secondary/80 border border-border rounded-2xl px-4 py-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-rose-500 placeholder:text-muted-foreground"
          />
          <button
            type="button"
            disabled={loading || !prompt.trim()}
            onClick={() => handleConsult()}
            className="w-10 h-10 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 text-white grid place-items-center shadow-md shadow-rose-500/20 disabled:opacity-50 transition active:scale-95 shrink-0"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>

        {/* Loading Animation */}
        {loading && (
          <div className="py-8 flex flex-col items-center justify-center gap-2.5 text-center">
            <div className="w-8 h-8 rounded-full border-2 border-rose-500/30 border-t-rose-500 animate-spin" />
            <span className="text-xs font-semibold text-foreground">
              Analyzing fashion proportions & matching garments…
            </span>
          </div>
        )}

        {/* Stylist Recommendation Card */}
        <AnimatePresence>
          {recommendation && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 rounded-3xl bg-secondary/70 border border-border space-y-3.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] uppercase font-mono font-bold text-rose-500">
                    {recommendation.occasion}
                  </span>
                  <h4 className="font-display font-bold text-base text-foreground">
                    {recommendation.lookTitle}
                  </h4>
                </div>
                {/* Palette */}
                <div className="flex items-center gap-1 shrink-0 pt-1">
                  {recommendation.colorPalette.map((hex, i) => (
                    <span
                      key={i}
                      className="w-4 h-4 rounded-full border border-black/10"
                      style={{ backgroundColor: hex }}
                    />
                  ))}
                </div>
              </div>

              {/* Styling Philosophy Rule */}
              <div className="p-3 rounded-2xl bg-background border border-border/80 text-xs space-y-1">
                <div className="font-bold text-foreground flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                  <span>Rule: {recommendation.stylingRule}</span>
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  {recommendation.stylistAdvice}
                </p>
              </div>

              {/* Piece Breakdown */}
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-foreground">Recommended Pieces:</span>
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                  {[
                    recommendation.outfit.dress || recommendation.outfit.top,
                    !recommendation.outfit.dress ? recommendation.outfit.bottom : null,
                    recommendation.outfit.shoes,
                    recommendation.outfit.accessory,
                  ]
                    .filter(Boolean)
                    .map((item) => (
                      <div
                        key={item!.id}
                        className="flex flex-col items-center p-2 rounded-2xl bg-background border border-border text-center"
                      >
                        <div className="w-12 h-12 rounded-xl overflow-hidden bg-secondary mb-1">
                          <img
                            src={item!.thumbnailUrl}
                            alt={item!.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <span className="text-[10px] font-bold text-foreground truncate w-full">
                          {item!.name}
                        </span>
                        <span className="text-[9px] font-mono text-muted-foreground">
                          {formatPrice(item!)}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              {/* Apply Action Button */}
              <button
                type="button"
                onClick={() => {
                  void triggerMediumHaptic();
                  onApplyRecommendation(recommendation);
                  toast.success(`Equipped "${recommendation.lookTitle}" in Studio! ✨`);
                  onClose();
                }}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold text-xs shadow-md shadow-rose-500/20 hover:opacity-95 active:scale-95 transition flex items-center justify-center gap-2"
              >
                <Wand2 className="w-4 h-4" />
                <span>Apply Look to 3D Studio</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
