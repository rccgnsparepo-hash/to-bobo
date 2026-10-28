import { useState } from "react";
import { X, Check, ShoppingBag, Truck, ShieldCheck, Heart, Sparkles, Tag } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { triggerMediumHaptic } from "@/lib/haptics";
import type { GarmentItem } from "@/lib/fashionData";

interface Props {
  garment: GarmentItem | null;
  currency: "USD" | "CNY" | "NGN";
  onClose: () => void;
  onEquip: (garment: GarmentItem) => void;
  isEquipped: boolean;
}

export function GarmentDetailModal({ garment, currency, onClose, onEquip, isEquipped }: Props) {
  const [selectedColor, setSelectedColor] = useState<string>(() => garment?.availableColors[0]?.name || "");
  const [selectedSize, setSelectedSize] = useState<string>(() => garment?.availableSizes[0] || "M");
  const [showCheckout, setShowCheckout] = useState(false);
  const [shippingAddress, setShippingAddress] = useState("University Campus Hall B, Room 304");
  const [orderBusy, setOrderBusy] = useState(false);

  if (!garment) return null;

  const formatPrice = (g: GarmentItem) => {
    if (currency === "CNY") return `¥ ${g.priceCNY}`;
    if (currency === "NGN") return `₦ ${g.priceNGN.toLocaleString()}`;
    return `$ ${g.priceUSD}`;
  };

  const handlePlaceOrder = () => {
    setOrderBusy(true);
    setTimeout(() => {
      setOrderBusy(false);
      setShowCheckout(false);
      toast.success(`Order placed! Order #FLK-${Math.floor(Math.random() * 89999 + 10000)} confirmed for ${garment.name}. Shipping to ${shippingAddress}`);
      onClose();
    }, 1200);
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
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500">
              {garment.category}
            </span>
            <span className="text-xs text-muted-foreground">{garment.brand}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-secondary grid place-items-center text-muted-foreground hover:text-foreground transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Product Media & Hero */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
          <div className="aspect-square rounded-2xl overflow-hidden bg-secondary border border-border relative">
            <img
              src={garment.imageUrl}
              alt={garment.name}
              className="w-full h-full object-cover"
            />
            {garment.inStock && (
              <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-emerald-500 text-white text-[10px] font-bold">
                In Stock ({garment.stockCount})
              </span>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <h2 className="font-display font-bold text-lg sm:text-xl text-foreground leading-tight">
                {garment.name}
              </h2>
              <div className="text-xl font-bold font-mono text-rose-500 mt-1">
                {formatPrice(garment)}
              </div>
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed">
              {garment.description}
            </p>

            <div className="text-xs text-foreground/80 space-y-1">
              <div><strong className="text-foreground">Material:</strong> {garment.material}</div>
              <div><strong className="text-foreground">Seller:</strong> {garment.seller}</div>
            </div>
          </div>
        </div>

        {/* Color Options */}
        {garment.availableColors.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-border">
            <label className="text-xs font-bold text-foreground">
              Color: <span className="font-normal text-muted-foreground">{selectedColor || garment.availableColors[0].name}</span>
            </label>
            <div className="flex items-center gap-2">
              {garment.availableColors.map((color) => {
                const active = selectedColor === color.name;
                return (
                  <button
                    key={color.name}
                    type="button"
                    onClick={() => setSelectedColor(color.name)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold transition ${
                      active
                        ? "border-rose-500 bg-rose-500/10 text-foreground ring-1 ring-rose-500"
                        : "border-border bg-secondary/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <span className="w-3.5 h-3.5 rounded-full border border-black/10" style={{ backgroundColor: color.hex }} />
                    <span>{color.name}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Size Options */}
        {garment.availableSizes.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-border">
            <label className="text-xs font-bold text-foreground">
              Size: <span className="font-normal text-muted-foreground">{selectedSize}</span>
            </label>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
              {garment.availableSizes.map((size) => {
                const active = selectedSize === size;
                return (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setSelectedSize(size)}
                    className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition shrink-0 ${
                      active
                        ? "border-rose-500 bg-rose-500 text-white shadow-sm"
                        : "border-border bg-secondary/60 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {size}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Checkout Drawer or Action Buttons */}
        {showCheckout ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="p-4 rounded-2xl bg-secondary/80 border border-border space-y-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-rose-500" />
                <span>Marketplace Checkout</span>
              </span>
              <button
                type="button"
                onClick={() => setShowCheckout(false)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground">Delivery Address</label>
              <input
                type="text"
                value={shippingAddress}
                onChange={(e) => setShippingAddress(e.target.value)}
                className="w-full bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-rose-500"
                placeholder="Enter room or street address"
              />
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-border/80 text-xs">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-bold font-mono text-foreground text-sm">{formatPrice(garment)}</span>
            </div>

            <button
              type="button"
              disabled={orderBusy}
              onClick={handlePlaceOrder}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold text-xs shadow-md shadow-rose-500/20 hover:opacity-95 active:scale-95 transition disabled:opacity-50"
            >
              {orderBusy ? "Confirming Order…" : "Confirm Order & Pay"}
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-2 gap-3 pt-3">
            <button
              type="button"
              onClick={() => {
                void triggerMediumHaptic();
                onEquip(garment);
                onClose();
              }}
              className={`py-3 px-4 rounded-2xl font-bold text-xs transition active:scale-95 flex items-center justify-center gap-2 ${
                isEquipped
                  ? "bg-rose-500/10 text-rose-500 border border-rose-500"
                  : "bg-secondary text-foreground hover:bg-secondary/80 border border-border"
              }`}
            >
              {isEquipped ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Currently Equipped</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-rose-500" />
                  <span>Equip in Studio</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => setShowCheckout(true)}
              className="py-3 px-4 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold text-xs transition active:scale-95 flex items-center justify-center gap-2 shadow-md"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Buy Piece</span>
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}
