import { useState } from "react";
import { ChevronUp, ChevronDown, Check, Sparkles, Filter, Info, ShoppingBag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";
import type { CurrentOutfit, GarmentCategory, GarmentItem } from "@/lib/fashionData";
import { GARMENT_CATALOG } from "@/lib/fashionData";

interface Props {
  outfit: CurrentOutfit;
  currency: "USD" | "CNY" | "NGN";
  onSelectGarment: (item: GarmentItem) => void;
  onOpenDetails: (item: GarmentItem) => void;
}

export function ClothingPicker({ outfit, currency, onSelectGarment, onOpenDetails }: Props) {
  const [activeCategory, setActiveCategory] = useState<GarmentCategory | "all">("all");
  const [selectedGarment, setSelectedGarment] = useState<GarmentItem>(() => {
    return outfit.top || outfit.dress || GARMENT_CATALOG[0];
  });
  const [activeColor, setActiveColor] = useState<string>(() => {
    return selectedGarment.availableColors[0]?.hex || "#000000";
  });
  const [activeSize, setActiveSize] = useState<string>(() => {
    return selectedGarment.availableSizes[0] || "M";
  });
  const [collapsed, setCollapsed] = useState(false);

  const categories: { id: GarmentCategory | "all"; label: string }[] = [
    { id: "all", label: "All" },
    { id: "top", label: "Tops" },
    { id: "bottom", label: "Bottoms" },
    { id: "dress", label: "Dresses" },
    { id: "shoes", label: "Shoes" },
    { id: "accessory", label: "Accessories" },
  ];

  const filteredGarments = GARMENT_CATALOG.filter((item) => {
    if (activeCategory === "all") return true;
    return item.category === activeCategory;
  });

  const isGarmentEquipped = (item: GarmentItem) => {
    if (item.category === "top") return outfit.top?.id === item.id;
    if (item.category === "bottom") return outfit.bottom?.id === item.id;
    if (item.category === "dress") return outfit.dress?.id === item.id;
    if (item.category === "shoes") return outfit.shoes?.id === item.id;
    if (item.category === "accessory") return outfit.accessory?.id === item.id;
    return false;
  };

  const handleGarmentClick = (item: GarmentItem) => {
    void triggerLightHaptic();
    setSelectedGarment(item);
    setActiveColor(item.availableColors[0]?.hex || "#000000");
    setActiveSize(item.availableSizes[0] || "M");
    onSelectGarment(item);
  };

  const formatPrice = (piece: GarmentItem) => {
    if (currency === "CNY") return `¥ ${piece.priceCNY}`;
    if (currency === "NGN") return `₦ ${piece.priceNGN.toLocaleString()}`;
    return `$ ${piece.priceUSD}`;
  };

  return (
    <footer className="relative z-30 w-full px-3 sm:px-6 pb-3 pt-1 shrink-0">
      <div className="max-w-2xl mx-auto rounded-[32px] bg-white/90 dark:bg-zinc-900/95 backdrop-blur-2xl border border-black/10 dark:border-white/10 p-3.5 shadow-2xl space-y-2.5 transition-all">
        {/* Header bar: Active Category Pills + Collapse toggle */}
        <div className="flex items-center justify-between gap-2 px-1">
          {/* Scrollable Category Filter Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {categories.map((cat) => {
              const active = activeCategory === cat.id;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    void triggerLightHaptic();
                    setActiveCategory(cat.id);
                  }}
                  className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                    active
                      ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm"
                      : "bg-black/5 dark:bg-white/5 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {cat.label}
                </button>
              );
            })}
          </div>

          {/* Collapsible toggle */}
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="p-1 rounded-full bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 text-muted-foreground hover:text-foreground transition shrink-0"
            title={collapsed ? "Expand garment selector" : "Collapse garment selector"}
          >
            {collapsed ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Collapsible Content */}
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeInOut" }}
              className="space-y-2.5 overflow-hidden"
            >
              {/* Horizontally Scrollable Garment Thumbnails (Matching Video) */}
              <div className="flex items-center gap-3 overflow-x-auto no-scrollbar px-1 py-1">
                {filteredGarments.map((item) => {
                  const equipped = isGarmentEquipped(item);
                  const isInspected = selectedGarment.id === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleGarmentClick(item)}
                      className={`relative flex flex-col items-center group shrink-0 transition-transform active:scale-95`}
                    >
                      <div
                        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-2xl overflow-hidden p-1 border-2 transition-all shadow-sm ${
                          equipped
                            ? "border-rose-500 bg-rose-500/10 ring-2 ring-rose-500/30"
                            : isInspected
                            ? "border-zinc-900 dark:border-zinc-200 bg-secondary"
                            : "border-transparent bg-secondary/80 hover:border-black/20 dark:hover:border-white/20"
                        }`}
                      >
                        <img
                          src={item.thumbnailUrl}
                          alt={item.name}
                          className="w-full h-full object-cover rounded-xl"
                        />
                      </div>

                      {/* Equipped Checkpoint */}
                      {equipped && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-500 text-white grid place-items-center shadow-md">
                          <Check className="w-2.5 h-2.5 stroke-[3]" />
                        </div>
                      )}

                      {/* Micro Price Chip */}
                      <span className="text-[10px] font-mono font-bold text-zinc-700 dark:text-zinc-300 mt-1">
                        {formatPrice(item)}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* Selected Garment Context Bar: Name, Swatches, Sizes & Details trigger */}
              <div className="flex items-center justify-between gap-3 pt-2 border-t border-black/5 dark:border-white/10 px-1 text-xs">
                {/* Left: Garment Title & Brand */}
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-foreground truncate text-xs sm:text-sm">
                    {selectedGarment.name}
                  </div>
                  <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                    <span>{selectedGarment.brand}</span>
                    <span>·</span>
                    <span className="capitalize">{selectedGarment.style}</span>
                  </div>
                </div>

                {/* Center: Color Swatches */}
                {selectedGarment.availableColors.length > 0 && (
                  <div className="flex items-center gap-1.5 shrink-0">
                    {selectedGarment.availableColors.map((color) => {
                      const isColorActive = activeColor === color.hex;
                      return (
                        <button
                          key={color.hex}
                          type="button"
                          onClick={() => {
                            void triggerLightHaptic();
                            setActiveColor(color.hex);
                          }}
                          className={`w-5 h-5 rounded-full border transition relative ${
                            isColorActive
                              ? "ring-2 ring-rose-500 ring-offset-1 dark:ring-offset-zinc-900 scale-110"
                              : "border-black/20 dark:border-white/20"
                          }`}
                          style={{ backgroundColor: color.hex }}
                          title={color.name}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Right: Garment Details Modal Trigger */}
                <button
                  type="button"
                  onClick={() => onOpenDetails(selectedGarment)}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold transition active:scale-95 shrink-0"
                  title="Inspect piece details & shop"
                >
                  <Info className="w-3.5 h-3.5 text-rose-500" />
                  <span className="hidden sm:inline">Details</span>
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </footer>
  );
}
