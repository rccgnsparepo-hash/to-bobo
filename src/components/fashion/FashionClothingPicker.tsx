import React, { useState } from "react";
import { ChevronRight, Sparkles, Check } from "lucide-react";
import { GarmentCategory, GarmentItem } from "@/lib/fashionData";
import { triggerLightHaptic } from "@/lib/haptics";

interface Props {
  catalog: GarmentItem[];
  equipped: {
    top?: GarmentItem;
    bottom?: GarmentItem;
    dress?: GarmentItem;
    shoes: GarmentItem;
    accessory?: GarmentItem;
  };
  onSelectGarment: (garment: GarmentItem) => void;
  currency: "CNY" | "USD" | "NGN";
  onOpenDetails: (garment: GarmentItem) => void;
  onOpenRecipe: () => void;
}

export function FashionClothingPicker({
  catalog,
  equipped,
  onSelectGarment,
  currency,
  onOpenDetails,
  onOpenRecipe,
}: Props) {
  const [selectedCategory, setSelectedCategory] = useState<GarmentCategory | "all">("all");

  const categories: { id: GarmentCategory | "all"; label: string }[] = [
    { id: "all", label: "All" },
    { id: "top", label: "Tops" },
    { id: "bottom", label: "Bottoms" },
    { id: "dress", label: "Dresses" },
    { id: "shoes", label: "Shoes" },
    { id: "accessory", label: "Accessories" },
  ];

  const filteredItems = catalog.filter((item) => {
    if (selectedCategory === "all") return true;
    return item.category === selectedCategory;
  });

  const isEquipped = (item: GarmentItem) => {
    if (item.category === "top") return equipped.top?.id === item.id;
    if (item.category === "bottom") return equipped.bottom?.id === item.id;
    if (item.category === "dress") return equipped.dress?.id === item.id;
    if (item.category === "shoes") return equipped.shoes?.id === item.id;
    if (item.category === "accessory") return equipped.accessory?.id === item.id;
    return false;
  };

  const formatPrice = (item: GarmentItem) => {
    if (currency === "CNY") return `¥${item.priceCNY}`;
    if (currency === "NGN") return `₦${item.priceNGN.toLocaleString()}`;
    return `$${item.priceUSD}`;
  };

  return (
    <footer className="relative z-30 shrink-0 w-full pb-3 px-3 sm:px-6">
      <div className="mx-auto max-w-xl rounded-[32px] bg-card/90 dark:bg-zinc-900/90 backdrop-blur-2xl border border-black/5 dark:border-white/10 p-3 sm:p-4 shadow-2xl space-y-2.5">
        {/* Category Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
          {categories.map((c) => {
            const active = selectedCategory === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  void triggerLightHaptic();
                  setSelectedCategory(c.id);
                }}
                className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap transition-all ${
                  active
                    ? "bg-foreground text-background shadow-xs scale-100"
                    : "text-muted-foreground hover:text-foreground bg-secondary/50"
                }`}
              >
                {c.label}
              </button>
            );
          })}
        </div>

        {/* Horizontal Scrollable Garment Thumbnails (Matches Reference Video) */}
        <div className="flex items-center gap-3.5 overflow-x-auto no-scrollbar py-1 px-1">
          {filteredItems.map((item) => {
            const active = isEquipped(item);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  void triggerLightHaptic();
                  onSelectGarment(item);
                }}
                className="flex flex-col items-center shrink-0 group focus:outline-none transition-transform active:scale-95"
              >
                {/* Floating Color Swatches */}
                <div className="flex items-center gap-0.5 mb-1 px-1.5 py-0.5 rounded-full bg-secondary/70 shadow-2xs">
                  {item.colors.slice(0, 3).map((col, idx) => (
                    <span
                      key={idx}
                      className="w-1.5 h-1.5 rounded-full border border-black/10 dark:border-white/10"
                      style={{ backgroundColor: col.hex }}
                    />
                  ))}
                </div>

                {/* Circular Garment Thumbnail with Active Ring */}
                <div
                  className={`relative w-14 h-14 sm:w-16 sm:h-16 rounded-full p-0.5 transition-all duration-300 ${
                    active
                      ? "ring-2 ring-rose-500 ring-offset-2 ring-offset-card scale-105 shadow-md shadow-rose-500/25"
                      : "opacity-80 group-hover:opacity-100 hover:scale-102"
                  }`}
                >
                  <div className="w-full h-full rounded-full overflow-hidden bg-secondary border border-border">
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                  {active && (
                    <div className="absolute top-0 right-0 w-4 h-4 rounded-full bg-rose-500 text-white grid place-items-center shadow-xs">
                      <Check className="w-2.5 h-2.5" />
                    </div>
                  )}
                </div>

                {/* Garment Title & Price */}
                <span
                  className={`text-[10px] font-bold mt-1 text-center truncate max-w-[70px] ${
                    active ? "text-foreground font-extrabold" : "text-muted-foreground group-hover:text-foreground"
                  }`}
                >
                  {item.name.split(" ")[0]} {item.name.split(" ")[1] || ""}
                </span>
                <span className="text-[9px] font-mono font-medium text-rose-500">
                  {formatPrice(item)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Bottom Drawer Bar: "More looks like this >" / "View Complete Recipe" */}
        <div className="pt-1 flex items-center justify-between border-t border-border/50">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">
              {equipped.dress ? equipped.dress.name : equipped.top?.name || "No Top"}
            </span>
            <span aria-hidden="true">·</span>
            <span className="text-rose-500 font-mono font-bold">
              {equipped.dress
                ? formatPrice(equipped.dress)
                : formatPrice(equipped.top || equipped.shoes)}
            </span>
          </div>

          <button
            type="button"
            onClick={() => {
              void triggerLightHaptic();
              onOpenRecipe();
            }}
            className="px-3.5 py-1.5 rounded-full bg-secondary hover:bg-secondary/80 text-foreground text-xs font-bold flex items-center gap-1 transition shadow-xs"
          >
            <span>Outfit Details & Pieces</span>
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </footer>
  );
}
