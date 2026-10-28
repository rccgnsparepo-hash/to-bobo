import { useRef, useEffect, useState } from "react";
import {
  Plus,
  Minus,
  RotateCw,
  Undo2,
  RefreshCw,
  Sparkles,
  Shirt,
  Info,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";
import type { CurrentOutfit, GarmentItem, ModelAvatar } from "@/lib/fashionData";
import { FASHION_HAIRSTYLES, FASHION_MODELS } from "@/lib/fashionData";

interface Props {
  model: ModelAvatar;
  outfit: CurrentOutfit;
  currency: "USD" | "CNY" | "NGN";
  onInspectGarment: (item: GarmentItem) => void;
  onModelChange: (model: ModelAvatar) => void;
  onUndo: () => void;
  onReset: () => void;
  onRandomizeFit: () => void;
  canUndo: boolean;
  isLoading?: boolean;
}

export function VirtualModelStage({
  model,
  outfit,
  currency,
  onInspectGarment,
  onModelChange,
  onUndo,
  onReset,
  onRandomizeFit,
  canUndo,
  isLoading,
}: Props) {
  const [rotationAngle, setRotationAngle] = useState(0); // 0 = front, 90 = side, 180 = back
  const [zoomLevel, setZoomLevel] = useState(1);
  const [selectedHairstyle, setSelectedHairstyle] = useState(FASHION_HAIRSTYLES[0]);
  const [showModelModal, setShowModelModal] = useState(false);

  // Drag interaction
  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const currentAngleRef = useRef(0);

  useEffect(() => {
    currentAngleRef.current = rotationAngle;
  }, [rotationAngle]);

  const handlePointerDown = (e: React.PointerEvent) => {
    isDraggingRef.current = true;
    startXRef.current = e.clientX;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const deltaX = e.clientX - startXRef.current;
    if (Math.abs(deltaX) > 4) {
      const newAngle = (currentAngleRef.current + deltaX * 0.85) % 360;
      setRotationAngle(newAngle < 0 ? newAngle + 360 : newAngle);
      startXRef.current = e.clientX;
    }
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  const stepRotation = (delta: number) => {
    void triggerLightHaptic();
    setRotationAngle((prev) => {
      const next = (prev + delta) % 360;
      return next < 0 ? next + 360 : next;
    });
  };

  const cycleHairstyle = () => {
    void triggerLightHaptic();
    const idx = FASHION_HAIRSTYLES.findIndex((h) => h.id === selectedHairstyle.id);
    const next = FASHION_HAIRSTYLES[(idx + 1) % FASHION_HAIRSTYLES.length];
    setSelectedHairstyle(next);
  };

  const formatPrice = (piece: GarmentItem) => {
    if (currency === "CNY") return `¥ ${piece.priceCNY}`;
    if (currency === "NGN") return `₦ ${piece.priceNGN.toLocaleString()}`;
    return `$ ${piece.priceUSD}`;
  };

  // Determine angle view
  const normalizedDeg = ((rotationAngle % 360) + 360) % 360;
  const isBackView = normalizedDeg > 110 && normalizedDeg < 250;
  const isSideView =
    (normalizedDeg >= 50 && normalizedDeg <= 110) ||
    (normalizedDeg >= 250 && normalizedDeg <= 300);

  const displayImage = isBackView
    ? model.baseImages.back
    : isSideView
    ? model.baseImages.side
    : model.baseImages.front;

  return (
    <section
      className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden touch-none select-none bg-gradient-to-b from-[#f2f2f4] via-[#e5e5e7] to-[#d8d8dc] dark:from-[#18191c] dark:via-[#121316] dark:to-[#0c0d0f]"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Radial Stage Atmosphere Lighting */}
      <div className="absolute inset-0 pointer-events-none opacity-50 bg-[radial-gradient(circle_at_50%_40%,rgba(244,63,94,0.08)_0%,transparent_70%)]" />

      {/* Top Left HUD: Avatar Model Profile & Hairstyle */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2.5">
        <button
          type="button"
          onClick={() => setShowModelModal(true)}
          className="flex flex-col items-center group active:scale-95 transition"
          title="Switch Model Avatar"
        >
          <div className="w-12 h-12 rounded-2xl overflow-hidden bg-white dark:bg-zinc-800 p-0.5 border-2 border-white/80 dark:border-zinc-700 shadow-md group-hover:ring-2 group-hover:ring-rose-400">
            <img
              src={model.avatarThumb}
              alt={model.name}
              className="w-full h-full object-cover rounded-xl"
            />
          </div>
          <span className="text-[10px] font-bold text-zinc-700 dark:text-zinc-200 mt-0.5 drop-shadow-sm">
            {model.name}
          </span>
        </button>

        <button
          type="button"
          onClick={cycleHairstyle}
          className="w-11 h-11 rounded-2xl bg-white/85 dark:bg-zinc-850/90 backdrop-blur-md border border-black/5 dark:border-white/10 grid place-items-center shadow-md hover:scale-105 active:scale-95 transition"
          title={`Hairstyle: ${selectedHairstyle.name} (Tap to change)`}
        >
          <span className="text-lg">{selectedHairstyle.icon}</span>
        </button>
      </div>

      {/* Top Right HUD: Zoom & Step Rotate */}
      <div className="absolute top-4 right-4 z-20 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            void triggerLightHaptic();
            setZoomLevel((z) => Math.min(1.35, z + 0.1));
          }}
          className="w-9 h-9 rounded-2xl bg-white/85 dark:bg-zinc-850/90 backdrop-blur-md border border-black/5 dark:border-white/10 grid place-items-center text-zinc-700 dark:text-zinc-200 shadow-md hover:scale-105 active:scale-95 transition"
          title="Zoom in"
        >
          <Plus className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => {
            void triggerLightHaptic();
            setZoomLevel((z) => Math.max(0.8, z - 0.1));
          }}
          className="w-9 h-9 rounded-2xl bg-white/85 dark:bg-zinc-850/90 backdrop-blur-md border border-black/5 dark:border-white/10 grid place-items-center text-zinc-700 dark:text-zinc-200 shadow-md hover:scale-105 active:scale-95 transition"
          title="Zoom out"
        >
          <Minus className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => stepRotation(90)}
          className="w-9 h-9 rounded-2xl bg-white/85 dark:bg-zinc-850/90 backdrop-blur-md border border-black/5 dark:border-white/10 grid place-items-center text-zinc-700 dark:text-zinc-200 shadow-md hover:scale-105 active:scale-95 transition"
          title="Rotate 90 degrees"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* Bottom Center Stage Controls: Undo, Randomize, Reset */}
      <div className="absolute bottom-4 left-4 z-20 flex items-center gap-2">
        <button
          type="button"
          disabled={!canUndo}
          onClick={onUndo}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur-md border transition ${
            canUndo
              ? "bg-white/85 dark:bg-zinc-800/90 text-foreground border-black/10 dark:border-white/10 shadow-sm active:scale-95"
              : "bg-black/5 dark:bg-white/5 text-muted-foreground/50 border-transparent cursor-not-allowed"
          }`}
          title="Undo last garment change"
        >
          <Undo2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Undo</span>
        </button>

        <button
          type="button"
          onClick={onRandomizeFit}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/85 dark:bg-zinc-800/90 backdrop-blur-md border border-black/10 dark:border-white/10 text-foreground text-xs font-semibold shadow-sm hover:scale-105 active:scale-95 transition"
          title="Surprise me with a random combination"
        >
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>Surprise Me</span>
        </button>

        <button
          type="button"
          onClick={onReset}
          className="w-8 h-8 rounded-full bg-white/85 dark:bg-zinc-800/90 backdrop-blur-md border border-black/10 dark:border-white/10 grid place-items-center text-muted-foreground hover:text-foreground transition active:scale-95"
          title="Reset to default outfit"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Center 3D Stage & Interactive Mannequin */}
      <div
        className="relative w-full h-full max-w-sm flex items-center justify-center cursor-grab active:cursor-grabbing"
        style={{ perspective: 1200 }}
      >
        {/* Ground Pedestal Floor Shadow */}
        <div className="absolute bottom-6 w-60 h-10 rounded-[50%] bg-black/15 dark:bg-black/50 blur-lg pointer-events-none transform -rotate-x-60" />

        <motion.div
          animate={{
            scale: zoomLevel,
            rotateY: isBackView ? 180 : 0,
          }}
          transition={{ type: "spring", stiffness: 140, damping: 20 }}
          className="relative h-[68vh] max-h-[550px] w-auto aspect-[9/18] flex items-center justify-center"
        >
          {/* Base Model Body Image */}
          <img
            src={displayImage}
            alt={model.name}
            className="h-full w-auto object-contain pointer-events-none drop-shadow-2xl"
          />

          {/* Loading Overlay */}
          <AnimatePresence>
            {isLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-white/40 dark:bg-black/40 backdrop-blur-[2px] rounded-2xl flex items-center justify-center pointer-events-none"
              >
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/70 text-white text-xs font-medium">
                  <div className="w-3 h-3 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                  <span>Fitting garment…</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Floating Garment Inspection Tags Matching Reference Video */}
        {/* 1. TOP OR DRESS PIN */}
        {(outfit.dress || outfit.top) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            key={`pin-upper-${(outfit.dress || outfit.top)!.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onInspectGarment((outfit.dress || outfit.top)!);
            }}
            className="absolute top-[28%] left-[12%] sm:left-[18%] z-20 flex items-center gap-1.5 p-1.5 pr-2.5 rounded-full bg-white/90 dark:bg-zinc-850/95 backdrop-blur-md border border-black/10 dark:border-white/15 shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition"
            title="Inspect upper garment"
          >
            <div className="w-7 h-7 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-black/10 shrink-0">
              <img
                src={(outfit.dress || outfit.top)!.thumbnailUrl}
                alt={(outfit.dress || outfit.top)!.name}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-100 font-mono">
              {formatPrice((outfit.dress || outfit.top)!)}
            </span>
            <div className="w-3.5 h-3.5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 grid place-items-center">
              <Plus className="w-2 h-2" />
            </div>
          </motion.div>
        )}

        {/* 2. BOTTOM PIN (Only when dress is not worn) */}
        {!outfit.dress && outfit.bottom && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            key={`pin-bottom-${outfit.bottom.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onInspectGarment(outfit.bottom!);
            }}
            className="absolute top-[48%] right-[10%] sm:right-[16%] z-20 flex items-center gap-1.5 p-1.5 pr-2.5 rounded-full bg-white/90 dark:bg-zinc-850/95 backdrop-blur-md border border-black/10 dark:border-white/15 shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition"
            title="Inspect bottom garment"
          >
            <div className="w-7 h-7 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-black/10 shrink-0">
              <img
                src={outfit.bottom.thumbnailUrl}
                alt={outfit.bottom.name}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-100 font-mono">
              {formatPrice(outfit.bottom)}
            </span>
            <div className="w-3.5 h-3.5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 grid place-items-center">
              <Plus className="w-2 h-2" />
            </div>
          </motion.div>
        )}

        {/* 3. SHOES PIN */}
        {outfit.shoes && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            key={`pin-shoes-${outfit.shoes.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onInspectGarment(outfit.shoes!);
            }}
            className="absolute bottom-[18%] left-[16%] sm:left-[22%] z-20 flex items-center gap-1.5 p-1.5 pr-2.5 rounded-full bg-white/90 dark:bg-zinc-850/95 backdrop-blur-md border border-black/10 dark:border-white/15 shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition"
            title="Inspect footwear"
          >
            <div className="w-7 h-7 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-black/10 shrink-0">
              <img
                src={outfit.shoes.thumbnailUrl}
                alt={outfit.shoes.name}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-100 font-mono">
              {formatPrice(outfit.shoes)}
            </span>
            <div className="w-3.5 h-3.5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 grid place-items-center">
              <Plus className="w-2 h-2" />
            </div>
          </motion.div>
        )}

        {/* 4. ACCESSORY PIN (When equipped) */}
        {outfit.accessory && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            key={`pin-acc-${outfit.accessory.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onInspectGarment(outfit.accessory!);
            }}
            className="absolute top-[18%] right-[14%] sm:right-[20%] z-20 flex items-center gap-1.5 p-1.5 pr-2.5 rounded-full bg-white/90 dark:bg-zinc-850/95 backdrop-blur-md border border-black/10 dark:border-white/15 shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition"
            title="Inspect accessory"
          >
            <div className="w-7 h-7 rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800 border border-black/10 shrink-0">
              <img
                src={outfit.accessory.thumbnailUrl}
                alt={outfit.accessory.name}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-[11px] font-bold text-zinc-800 dark:text-zinc-100 font-mono">
              {formatPrice(outfit.accessory)}
            </span>
            <div className="w-3.5 h-3.5 rounded-full bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 grid place-items-center">
              <Plus className="w-2 h-2" />
            </div>
          </motion.div>
        )}
      </div>

      {/* Rotation Degree Subtle Badge */}
      <div className="absolute bottom-4 right-4 pointer-events-none z-10">
        <span className="px-2.5 py-1 rounded-full bg-black/40 backdrop-blur-md text-white text-[10px] font-mono font-medium">
          {Math.round(rotationAngle)}°
        </span>
      </div>

      {/* Model Avatar Picker Modal */}
      <AnimatePresence>
        {showModelModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowModelModal(false)}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-sm rounded-3xl bg-card border border-border p-5 space-y-4 shadow-2xl"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-lg text-foreground">Select Avatar Model</h3>
                  <p className="text-xs text-muted-foreground">Choose a fitting avatar for your digital looks</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowModelModal(false)}
                  className="w-7 h-7 rounded-full bg-secondary grid place-items-center text-muted-foreground hover:text-foreground"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {FASHION_MODELS.map((m) => {
                  const isSelected = m.id === model.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        void triggerMediumHaptic();
                        onModelChange(m);
                        setShowModelModal(false);
                      }}
                      className={`flex flex-col items-center p-3 rounded-2xl border transition text-center ${
                        isSelected
                          ? "bg-rose-500/10 border-rose-500 text-foreground ring-1 ring-rose-500"
                          : "bg-secondary/60 hover:bg-secondary border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <div className="w-16 h-16 rounded-full overflow-hidden mb-2 border-2 border-border shadow-inner">
                        <img src={m.avatarThumb} alt={m.name} className="w-full h-full object-cover" />
                      </div>
                      <div className="font-bold text-sm text-foreground flex items-center gap-1">
                        <span>{m.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-rose-500" />}
                      </div>
                      <span className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{m.bio}</span>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
}
