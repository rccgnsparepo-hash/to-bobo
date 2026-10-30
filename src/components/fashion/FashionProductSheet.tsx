import React, { useState } from "react";
import { X, Check, ShoppingBag, MessageSquare, Shirt, Star, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { GarmentItem } from "@/lib/fashionData";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";

interface Props {
  garment: GarmentItem | null;
  onClose: () => void;
  onEquipGarment: (garment: GarmentItem) => void;
  currency: "CNY" | "USD" | "NGN";
  isEquipped: boolean;
}

export function FashionProductSheet({
  garment,
  onClose,
  onEquipGarment,
  currency,
  isEquipped,
}: Props) {
  const [selectedColor, setSelectedColor] = useState<string>(
    garment?.colors[0]?.name || ""
  );
  const [selectedSize, setSelectedSize] = useState<string>(
    garment?.sizes[0] || "M"
  );
  const [isOrdering, setIsOrdering] = useState(false);

  if (!garment) return null;

  const formatPrice = () => {
    if (currency === "CNY") return `¥${garment.priceCNY}`;
    if (currency === "NGN") return `₦${garment.priceNGN.toLocaleString()}`;
    return `$${garment.priceUSD}`;
  };

  const handleEquip = () => {
    void triggerMediumHaptic();
    onEquipGarment(garment);
    toast.success(`Equipped "${garment.name}" on model! ✨`);
  };

  const handleOrder = () => {
    void triggerLightHaptic();
    setIsOrdering(true);
    setTimeout(() => {
      setIsOrdering(false);
      toast.success(
        `Order request for "${garment.name}" (${selectedSize}, ${selectedColor}) placed with ${garment.brand}! 🛍️`
      );
      onClose();
    }, 600);
  };

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
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-rose-500">
              {garment.brand} • {garment.category.toUpperCase()}
            </span>
            <h3 className="font-display font-bold text-lg text-foreground">
              {garment.name}
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

        {/* Media & Key Specs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="aspect-square rounded-2xl overflow-hidden bg-secondary border border-border">
            <img src={garment.imageUrl} alt={garment.name} className="w-full h-full object-cover" />
          </div>

          <div className="flex flex-col justify-between space-y-3">
            <div>
              <div className="flex items-center gap-1.5 text-xs text-amber-500 font-bold mb-1">
                <Star className="w-3.5 h-3.5 fill-amber-500" />
                <span>{garment.rating} / 5.0</span>
                <span className="text-muted-foreground font-normal">
                  ({garment.stockCount} in stock)
                </span>
              </div>

              <div className="font-mono text-2xl font-black text-foreground">
                {formatPrice()}
              </div>

              <p className="text-xs text-muted-foreground mt-2 line-clamp-3">
                {garment.description}
              </p>
            </div>

            <div className="p-2.5 rounded-xl bg-secondary/60 border border-border/80 text-[11px] space-y-1">
              <div className="text-muted-foreground">
                <span className="font-bold text-foreground">Material:</span> {garment.materials}
              </div>
              <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Verified Designer Stock</span>
              </div>
            </div>
          </div>
        </div>

        {/* Color Swatch Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground">
            Color: <span className="text-foreground">{selectedColor}</span>
          </label>
          <div className="flex items-center gap-2">
            {garment.colors.map((c) => {
              const active = selectedColor === c.name;
              return (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => {
                    void triggerLightHaptic();
                    setSelectedColor(c.name);
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition ${
                    active ? "border-rose-500 bg-rose-500/10 font-bold" : "border-border bg-secondary"
                  }`}
                >
                  <span
                    className="w-3 h-3 rounded-full border border-black/15 shadow-2xs"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span>{c.name}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Size Selector */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-muted-foreground">
            Size: <span className="text-foreground">{selectedSize}</span>
          </label>
          <div className="flex items-center gap-1.5 flex-wrap">
            {garment.sizes.map((s) => {
              const active = selectedSize === s;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    void triggerLightHaptic();
                    setSelectedSize(s);
                  }}
                  className={`w-10 h-9 rounded-xl border text-xs font-bold transition ${
                    active
                      ? "border-rose-500 bg-rose-500 text-white shadow-xs"
                      : "border-border bg-secondary text-foreground hover:bg-secondary/80"
                  }`}
                >
                  {s}
                </button>
              );
            })}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={handleEquip}
            className={`py-2.5 rounded-full text-xs font-bold flex items-center justify-center gap-1.5 border transition ${
              isEquipped
                ? "bg-secondary border-border text-foreground"
                : "bg-foreground text-background hover:scale-102 shadow-xs"
            }`}
          >
            {isEquipped ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span>Currently Equipped</span>
              </>
            ) : (
              <>
                <Shirt className="w-3.5 h-3.5" />
                <span>Equip to Model</span>
              </>
            )}
          </button>

          <button
            type="button"
            disabled={isOrdering}
            onClick={handleOrder}
            className="py-2.5 rounded-full bg-rose-500 hover:bg-rose-600 disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-rose-500/25 active:scale-95 transition"
          >
            <ShoppingBag className="w-3.5 h-3.5" />
            <span>Order Piece ({formatPrice()})</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
