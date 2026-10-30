import React, { useRef, useEffect, useState } from "react";
import { Plus, Minus, RotateCw, Undo2, Dices, Eye, Layers } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { FashionModel, GarmentItem } from "@/lib/fashionData";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";

interface Props {
  model: FashionModel;
  onSelectModel: (model: FashionModel) => void;
  availableModels: FashionModel[];
  equipped: {
    top?: GarmentItem;
    bottom?: GarmentItem;
    dress?: GarmentItem;
    shoes: GarmentItem;
    accessory?: GarmentItem;
  };
  onInspectGarment: (garment: GarmentItem) => void;
  currency: "CNY" | "USD" | "NGN";
  onRandomizeFit: () => void;
  onResetFit: () => void;
  canUndo: boolean;
  onUndo: () => void;
  isLoading?: boolean;
}

export function FashionModelViewport({
  model,
  onSelectModel,
  availableModels,
  equipped,
  onInspectGarment,
  currency,
  onRandomizeFit,
  onResetFit,
  canUndo,
  onUndo,
  isLoading = false,
}: Props) {
  const [rotationAngle, setRotationAngle] = useState(0);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [viewAngleMode, setViewAngleMode] = useState<"front" | "side" | "back">("front");

  // Drag interaction refs
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
    if (Math.abs(deltaX) > 3) {
      const newAngle = (currentAngleRef.current + deltaX * 0.8) % 360;
      setRotationAngle(newAngle < 0 ? newAngle + 360 : newAngle);
      startXRef.current = e.clientX;
    }
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  const formatPrice = (item: GarmentItem) => {
    if (currency === "CNY") return `¥${item.priceCNY}`;
    if (currency === "NGN") return `₦${item.priceNGN.toLocaleString()}`;
    return `$${item.priceUSD}`;
  };

  // Determine angle view
  const normalizedDeg = ((rotationAngle % 360) + 360) % 360;
  const isBackView = viewAngleMode === "back" || (normalizedDeg > 115 && normalizedDeg < 245);
  const isSideView =
    viewAngleMode === "side" ||
    (normalizedDeg >= 55 && normalizedDeg <= 115) ||
    (normalizedDeg >= 245 && normalizedDeg <= 295);

  const displayImage = isBackView
    ? model.defaultAngles.back
    : isSideView
    ? model.defaultAngles.side
    : model.defaultAngles.front;

  const stepAngle = (deg: number) => {
    void triggerLightHaptic();
    setRotationAngle((prev) => {
      const next = (prev + deg) % 360;
      return next < 0 ? next + 360 : next;
    });
  };

  return (
    <div
      className="relative flex-1 w-full h-full flex items-center justify-center overflow-hidden touch-none select-none bg-gradient-to-b from-[#f2f2f4] via-[#ebebef] to-[#e4e4e8] dark:from-[#131417] dark:via-[#16171b] dark:to-[#0f1013]"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {/* Editorial Soft Backdrop Glow */}
      <div
        className="absolute inset-0 pointer-events-none transition-colors duration-1000 opacity-40"
        style={{
          background: `radial-gradient(circle at 50% 42%, #ff336622 0%, transparent 68%)`,
        }}
      />

      {/* Top Left HUD: Model Selector & View Mode */}
      <div className="absolute top-4 left-4 z-20 flex flex-col gap-2.5">
        {/* Model Avatar Switcher */}
        <div className="relative">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void triggerLightHaptic();
              setShowModelPicker(!showModelPicker);
            }}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-2xl bg-background/85 hover:bg-background border border-border shadow-md backdrop-blur-md transition-all active:scale-95"
            title="Switch fashion model"
          >
            <div className="w-8 h-8 rounded-xl overflow-hidden bg-secondary border border-border shrink-0">
              <img src={model.avatarThumb} alt={model.name} className="w-full h-full object-cover" />
            </div>
            <div className="text-left pr-1">
              <span className="block text-xs font-bold text-foreground leading-tight">{model.name}</span>
              <span className="block text-[9px] text-muted-foreground uppercase tracking-wider">
                {model.gender}
              </span>
            </div>
          </button>

          {/* Model Switcher Dropdown */}
          <AnimatePresence>
            {showModelPicker && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.95 }}
                className="absolute top-12 left-0 z-30 w-52 p-2 rounded-2xl bg-card border border-border shadow-2xl backdrop-blur-xl space-y-1"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground border-b border-border/50">
                  Select Fashion Model
                </div>
                {availableModels.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => {
                      void triggerLightHaptic();
                      onSelectModel(m);
                      setShowModelPicker(false);
                    }}
                    className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition ${
                      m.id === model.id ? "bg-rose-500/10 text-rose-500 font-bold" : "hover:bg-secondary text-foreground"
                    }`}
                  >
                    <div className="w-7 h-7 rounded-lg overflow-hidden shrink-0 border border-border">
                      <img src={m.avatarThumb} alt={m.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs truncate">{m.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{m.bio.split("•")[1] || m.gender}</div>
                    </div>
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* View Angle Pill: Front / Side / Back */}
        <div
          className="flex items-center gap-0.5 p-1 rounded-xl bg-background/85 border border-border shadow-sm backdrop-blur-md"
          onClick={(e) => e.stopPropagation()}
        >
          {(
            [
              { id: "front", label: "Front" },
              { id: "side", label: "Side" },
              { id: "back", label: "Back" },
            ] as const
          ).map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                void triggerLightHaptic();
                setViewAngleMode(v.id);
                setRotationAngle(v.id === "front" ? 0 : v.id === "side" ? 90 : 180);
              }}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold transition ${
                (viewAngleMode === v.id)
                  ? "bg-rose-500 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top Right HUD: Zoom & Rotate Controls */}
      <div
        className="absolute top-4 right-4 z-20 flex flex-col gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Zoom In */}
        <button
          type="button"
          onClick={() => {
            void triggerLightHaptic();
            setZoomLevel((z) => Math.min(1.35, z + 0.1));
          }}
          className="w-9 h-9 rounded-xl bg-background/85 hover:bg-background border border-border grid place-items-center text-foreground shadow-sm backdrop-blur-md hover:scale-105 active:scale-95 transition"
          title="Zoom in model"
        >
          <Plus className="w-4 h-4" />
        </button>

        {/* Zoom Out */}
        <button
          type="button"
          onClick={() => {
            void triggerLightHaptic();
            setZoomLevel((z) => Math.max(0.8, z - 0.1));
          }}
          className="w-9 h-9 rounded-xl bg-background/85 hover:bg-background border border-border grid place-items-center text-foreground shadow-sm backdrop-blur-md hover:scale-105 active:scale-95 transition"
          title="Zoom out model"
        >
          <Minus className="w-4 h-4" />
        </button>

        {/* 360 Step Rotate */}
        <button
          type="button"
          onClick={() => stepAngle(90)}
          className="w-9 h-9 rounded-xl bg-background/85 hover:bg-background border border-border grid place-items-center text-foreground shadow-sm backdrop-blur-md hover:scale-105 active:scale-95 transition"
          title="Rotate 90 degrees"
        >
          <RotateCw className="w-4 h-4" />
        </button>
      </div>

      {/* Center Left HUD: Quick Style Utility (Undo, Randomize, Reset) */}
      <div
        className="absolute bottom-28 left-4 z-20 flex flex-col gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Randomize Fit */}
        <button
          type="button"
          onClick={() => {
            void triggerMediumHaptic();
            onRandomizeFit();
          }}
          className="w-10 h-10 rounded-2xl bg-background/90 hover:bg-background border border-border grid place-items-center text-foreground shadow-md backdrop-blur-md hover:scale-105 active:scale-95 transition group"
          title="Surprise Me (Random Outfit)"
        >
          <Dices className="w-4 h-4 text-rose-500 group-hover:rotate-180 transition-transform duration-300" />
        </button>

        {/* Undo Action */}
        {canUndo && (
          <button
            type="button"
            onClick={() => {
              void triggerLightHaptic();
              onUndo();
            }}
            className="w-10 h-10 rounded-2xl bg-background/90 hover:bg-background border border-border grid place-items-center text-foreground shadow-md backdrop-blur-md hover:scale-105 active:scale-95 transition"
            title="Undo last change"
          >
            <Undo2 className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Center 3D Mannequin Stage */}
      <div
        className="relative w-full h-full max-w-sm sm:max-w-md flex items-center justify-center cursor-grab active:cursor-grabbing"
        style={{ perspective: 1200 }}
      >
        {/* Ground Platform Shadow */}
        <div className="absolute bottom-16 sm:bottom-20 w-64 sm:w-72 h-10 rounded-[50%] bg-black/15 dark:bg-black/50 blur-lg pointer-events-none transform -rotate-x-60" />

        {/* Model Avatar Render */}
        <motion.div
          animate={{
            scale: zoomLevel,
            rotateY: isBackView ? 180 : 0,
          }}
          transition={{ type: "spring", stiffness: 160, damping: 22 }}
          className="relative h-[72vh] max-h-[580px] w-auto aspect-[9/18] flex items-center justify-center"
        >
          {isLoading && (
            <div className="absolute inset-0 bg-background/40 backdrop-blur-xs flex items-center justify-center z-10 rounded-3xl animate-pulse">
              <div className="w-8 h-8 rounded-full border-2 border-rose-500 border-t-transparent animate-spin" />
            </div>
          )}
          <img
            src={displayImage}
            alt={model.name}
            className="h-full w-auto object-contain pointer-events-none drop-shadow-2xl"
          />
        </motion.div>

        {/* Interactive Garment Price Pins along the Model */}
        {/* 1. TOP PIN (or DRESS PIN) */}
        {(equipped.top || equipped.dress) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            key={equipped.dress ? `pin-dress-${equipped.dress.id}` : `pin-top-${equipped.top?.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onInspectGarment(equipped.dress || equipped.top!);
            }}
            className="absolute top-[28%] left-[12%] sm:left-[18%] z-20 flex items-center gap-1.5 p-1 pr-2.5 rounded-full bg-background/90 border border-border shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition backdrop-blur-md"
            title={`Inspect ${equipped.dress?.name || equipped.top?.name}`}
          >
            <div className="w-7 h-7 rounded-full overflow-hidden bg-secondary border border-border shrink-0">
              <img
                src={(equipped.dress || equipped.top)!.imageUrl}
                alt={(equipped.dress || equipped.top)!.name}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-[11px] font-bold font-mono text-foreground">
              {formatPrice(equipped.dress || equipped.top!)}
            </span>
            <div className="w-3.5 h-3.5 rounded-full bg-rose-500 text-white grid place-items-center">
              <Plus className="w-2 h-2" />
            </div>
          </motion.div>
        )}

        {/* 2. BOTTOM PIN (only when not in dress mode) */}
        {!equipped.dress && equipped.bottom && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            key={`pin-bottom-${equipped.bottom.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onInspectGarment(equipped.bottom!);
            }}
            className="absolute top-[48%] right-[10%] sm:right-[16%] z-20 flex items-center gap-1.5 p-1 pr-2.5 rounded-full bg-background/90 border border-border shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition backdrop-blur-md"
            title={`Inspect ${equipped.bottom.name}`}
          >
            <div className="w-7 h-7 rounded-full overflow-hidden bg-secondary border border-border shrink-0">
              <img
                src={equipped.bottom.imageUrl}
                alt={equipped.bottom.name}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-[11px] font-bold font-mono text-foreground">
              {formatPrice(equipped.bottom)}
            </span>
            <div className="w-3.5 h-3.5 rounded-full bg-rose-500 text-white grid place-items-center">
              <Plus className="w-2 h-2" />
            </div>
          </motion.div>
        )}

        {/* 3. SHOES PIN */}
        {equipped.shoes && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            key={`pin-shoes-${equipped.shoes.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onInspectGarment(equipped.shoes);
            }}
            className="absolute bottom-[22%] left-[16%] sm:left-[22%] z-20 flex items-center gap-1.5 p-1 pr-2.5 rounded-full bg-background/90 border border-border shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition backdrop-blur-md"
            title={`Inspect ${equipped.shoes.name}`}
          >
            <div className="w-7 h-7 rounded-full overflow-hidden bg-secondary border border-border shrink-0">
              <img
                src={equipped.shoes.imageUrl}
                alt={equipped.shoes.name}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-[11px] font-bold font-mono text-foreground">
              {formatPrice(equipped.shoes)}
            </span>
            <div className="w-3.5 h-3.5 rounded-full bg-rose-500 text-white grid place-items-center">
              <Plus className="w-2 h-2" />
            </div>
          </motion.div>
        )}

        {/* 4. ACCESSORY PIN (if equipped) */}
        {equipped.accessory && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            key={`pin-acc-${equipped.accessory.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onInspectGarment(equipped.accessory!);
            }}
            className="absolute top-[20%] right-[14%] sm:right-[20%] z-20 flex items-center gap-1.5 p-1 pr-2.5 rounded-full bg-background/90 border border-border shadow-lg cursor-pointer hover:scale-105 active:scale-95 transition backdrop-blur-md"
            title={`Inspect ${equipped.accessory.name}`}
          >
            <div className="w-7 h-7 rounded-full overflow-hidden bg-secondary border border-border shrink-0">
              <img
                src={equipped.accessory.imageUrl}
                alt={equipped.accessory.name}
                className="w-full h-full object-cover"
              />
            </div>
            <span className="text-[11px] font-bold font-mono text-foreground">
              {formatPrice(equipped.accessory)}
            </span>
            <div className="w-3.5 h-3.5 rounded-full bg-rose-500 text-white grid place-items-center">
              <Plus className="w-2 h-2" />
            </div>
          </motion.div>
        )}
      </div>

      {/* Drag 360° Tooltip Indicator */}
      <div className="absolute bottom-4 inset-x-0 flex justify-center pointer-events-none z-10">
        <span className="px-3 py-1 rounded-full bg-black/40 text-white text-[10px] font-medium tracking-wide backdrop-blur-md">
          Drag horizontally to rotate 360° ({Math.round(normalizedDeg)}°)
        </span>
      </div>
    </div>
  );
}
