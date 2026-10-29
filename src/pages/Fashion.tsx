import { useState, useEffect, useRef } from "react";
import {
  Sparkles,
  Compass,
  Bookmark,
  UserCheck,
  Heart,
  Share2,
  Trash2,
  Copy,
  ExternalLink,
  ChevronRight,
  Plus,
  RotateCw,
  Eye,
  Check,
  Wand2,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";
import {
  FASHION_MODELS,
  GARMENT_CATALOG,
  CURATED_LOOKS_DATA,
  type CurrentOutfit,
  type CuratedLook,
  type GarmentItem,
  type ModelAvatar,
  type FashionStyle,
} from "@/lib/fashionData";
import {
  getLocalWardrobe,
  deleteSavedOutfit,
  duplicateSavedOutfit,
  toggleFavoriteOutfit,
  resolveGarmentsForOutfit,
  getUserStylePreferences,
  saveUserStylePreferences,
  getRecentlyTriedOutfits,
  recordRecentlyTried,
  type SavedOutfit,
  type WardrobeCollection,
  type UserStylePreferences,
} from "@/lib/fashionWardrobe";
import type { StylistRecommendation } from "@/lib/aiStylist";
import { FashionStudioNav, type FashionView } from "@/components/fashion/FashionStudioNav";
import { VirtualModelStage } from "@/components/fashion/VirtualModelStage";
import { ClothingPicker } from "@/components/fashion/ClothingPicker";
import { GarmentDetailModal } from "@/components/fashion/GarmentDetailModal";
import { SaveOutfitModal } from "@/components/fashion/SaveOutfitModal";
import { ShareOutfitChatModal } from "@/components/fashion/ShareOutfitChatModal";
import { AiStylistModal } from "@/components/fashion/AiStylistModal";

export default function FashionPage() {
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState<FashionView>("studio");

  // User preferences & Currency
  const [stylePrefs, setStylePrefs] = useState<UserStylePreferences>(() => getUserStylePreferences());
  const [currency, setCurrency] = useState<"USD" | "CNY" | "NGN">(stylePrefs.currency || "USD");

  // Active Model
  const [currentModel, setCurrentModel] = useState<ModelAvatar>(() => {
    return FASHION_MODELS.find((m) => m.id === stylePrefs.defaultModelId) || FASHION_MODELS[0];
  });

  // Current Outfit state in Studio
  const [outfit, setOutfit] = useState<CurrentOutfit>(() => {
    return {
      top: GARMENT_CATALOG.find((g) => g.id === "top-acubi-cardigan"),
      bottom: GARMENT_CATALOG.find((g) => g.id === "btm-acubi-skort"),
      shoes: GARMENT_CATALOG.find((g) => g.id === "shoe-platform-boots"),
      accessory: GARMENT_CATALOG.find((g) => g.id === "acc-canvas-tote"),
    };
  });

  // Undo history stack
  const [history, setHistory] = useState<CurrentOutfit[]>([]);
  const [activeStylingRule, setActiveStylingRule] = useState<string>(
    "Tonal Earth Harmony: Warm camel knitwear balanced with stacked socks and lug-sole boots."
  );

  // Digital Wardrobe state
  const [wardrobe, setWardrobe] = useState<SavedOutfit[]>(() => getLocalWardrobe());
  const [selectedWardrobeCollection, setSelectedWardrobeCollection] = useState<WardrobeCollection>("All");
  const [recentlyTried, setRecentlyTried] = useState(() => getRecentlyTriedOutfits());

  // Modals state
  const [inspectingGarment, setInspectingGarment] = useState<GarmentItem | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showAiStylistModal, setShowAiStylistModal] = useState(false);

  // Discover tab filter
  const [discoverFilter, setDiscoverFilter] = useState<FashionStyle | "All">("All");

  // Sync wardrobe on event
  useEffect(() => {
    const handleWardrobeUpdate = () => {
      setWardrobe(getLocalWardrobe());
      setRecentlyTried(getRecentlyTriedOutfits());
    };
    window.addEventListener("flick:wardrobe-updated", handleWardrobeUpdate);
    return () => window.removeEventListener("flick:wardrobe-updated", handleWardrobeUpdate);
  }, []);

  // Sync recently tried on outfit change
  useEffect(() => {
    recordRecentlyTried(outfit);
  }, [outfit]);

  // Garment selection handler (preserves compatible items, replaces top/bottom when dress selected)
  const handleSelectGarment = (garment: GarmentItem) => {
    void triggerLightHaptic();
    setHistory((prev) => [outfit, ...prev.slice(0, 15)]);

    setOutfit((prev) => {
      if (garment.category === "dress") {
        return {
          ...prev,
          dress: garment,
          top: undefined,
          bottom: undefined,
        };
      }
      if (garment.category === "top") {
        return {
          ...prev,
          top: garment,
          dress: undefined,
        };
      }
      if (garment.category === "bottom") {
        return {
          ...prev,
          bottom: garment,
          dress: undefined,
        };
      }
      if (garment.category === "shoes") {
        return {
          ...prev,
          shoes: garment,
        };
      }
      if (garment.category === "accessory") {
        return {
          ...prev,
          accessory: garment,
        };
      }
      return prev;
    });
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    void triggerLightHaptic();
    const [previous, ...rest] = history;
    setOutfit(previous);
    setHistory(rest);
    toast("Restored previous garment state");
  };

  const handleReset = () => {
    void triggerMediumHaptic();
    setHistory((prev) => [outfit, ...prev.slice(0, 15)]);
    setOutfit({
      top: GARMENT_CATALOG.find((g) => g.id === "top-acubi-cardigan"),
      bottom: GARMENT_CATALOG.find((g) => g.id === "btm-acubi-skort"),
      shoes: GARMENT_CATALOG.find((g) => g.id === "shoe-platform-boots"),
      accessory: GARMENT_CATALOG.find((g) => g.id === "acc-canvas-tote"),
    });
    toast("Reset outfit to starter look");
  };

  const handleRandomizeFit = () => {
    void triggerMediumHaptic();
    setHistory((prev) => [outfit, ...prev.slice(0, 15)]);

    const useDress = Math.random() > 0.75;
    const shoesList = GARMENT_CATALOG.filter((g) => g.category === "shoes");
    const accList = GARMENT_CATALOG.filter((g) => g.category === "accessory");

    if (useDress) {
      const dressList = GARMENT_CATALOG.filter((g) => g.category === "dress");
      const randomDress = dressList[Math.floor(Math.random() * dressList.length)];
      const randomShoes = shoesList[Math.floor(Math.random() * shoesList.length)];
      const randomAcc = Math.random() > 0.4 ? accList[Math.floor(Math.random() * accList.length)] : undefined;
      setOutfit({
        dress: randomDress,
        shoes: randomShoes,
        accessory: randomAcc,
      });
      setActiveStylingRule("Effortless Dress Silhouette with Statement Footwear");
    } else {
      const topList = GARMENT_CATALOG.filter((g) => g.category === "top");
      const btmList = GARMENT_CATALOG.filter((g) => g.category === "bottom");
      const randomTop = topList[Math.floor(Math.random() * topList.length)];
      const randomBtm = btmList[Math.floor(Math.random() * btmList.length)];
      const randomShoes = shoesList[Math.floor(Math.random() * shoesList.length)];
      const randomAcc = Math.random() > 0.4 ? accList[Math.floor(Math.random() * accList.length)] : undefined;
      setOutfit({
        top: randomTop,
        bottom: randomBtm,
        shoes: randomShoes,
        accessory: randomAcc,
      });
      setActiveStylingRule("Contrasting Proportions: Layered Casual Synergy");
    }
    toast.success("Generated random style inspiration! ✨");
  };

  const handleWearCuratedLook = (look: CuratedLook) => {
    void triggerMediumHaptic();
    const model = FASHION_MODELS.find((m) => m.id === look.modelId) || currentModel;
    setCurrentModel(model);

    setHistory((prev) => [outfit, ...prev.slice(0, 15)]);
    setOutfit({
      top: GARMENT_CATALOG.find((g) => g.id === look.topId),
      bottom: GARMENT_CATALOG.find((g) => g.id === look.bottomId),
      dress: GARMENT_CATALOG.find((g) => g.id === look.dressId),
      shoes: GARMENT_CATALOG.find((g) => g.id === look.shoesId),
      accessory: GARMENT_CATALOG.find((g) => g.id === look.accessoryId),
    });
    setActiveStylingRule(look.stylingRule);
    setCurrentView("studio");
    toast.success(`Loaded "${look.title}" into 3D Studio! 👗`);
  };

  const handleWearSavedOutfit = (saved: SavedOutfit) => {
    void triggerMediumHaptic();
    const resolved = resolveGarmentsForOutfit(saved.items);
    setHistory((prev) => [outfit, ...prev.slice(0, 15)]);
    setOutfit(resolved);
    if (saved.stylingRule) setActiveStylingRule(saved.stylingRule);
    const m = FASHION_MODELS.find((mod) => mod.id === saved.modelId);
    if (m) setCurrentModel(m);
    setCurrentView("studio");
    toast.success(`Opened "${saved.name}" in Studio!`);
  };

  const handleApplyAiRecommendation = (rec: StylistRecommendation) => {
    setHistory((prev) => [outfit, ...prev.slice(0, 15)]);
    setOutfit(rec.outfit);
    setActiveStylingRule(`${rec.stylingRule} — ${rec.stylistAdvice}`);
    setCurrentView("studio");
  };

  const formatPrice = (piece: GarmentItem) => {
    if (currency === "CNY") return `¥ ${piece.priceCNY}`;
    if (currency === "NGN") return `₦ ${piece.priceNGN.toLocaleString()}`;
    return `$ ${piece.priceUSD}`;
  };

  // Filtered wardrobe
  const filteredWardrobe = wardrobe.filter((item) => {
    if (selectedWardrobeCollection === "All") return true;
    if (selectedWardrobeCollection === "Favorites") return item.isFavorite;
    return item.collection === selectedWardrobeCollection;
  });

  // Filtered curated looks
  const filteredCuratedLooks = CURATED_LOOKS_DATA.filter((look) => {
    if (discoverFilter === "All") return true;
    return look.styleCategory === discoverFilter;
  });

  const styleCategories: (FashionStyle | "All")[] = [
    "All",
    "Campus Fits",
    "Streetwear",
    "Old Money",
    "African Traditional",
    "Date Night",
    "Casual",
    "Formal",
    "Minimalist",
    "Y2K",
    "Athleisure",
  ];

  return (
    <div className="relative w-full h-[100dvh] max-h-[100dvh] overflow-hidden bg-background text-foreground flex flex-col font-sans select-none">
      {/* Top Fashion Studio Navigation Header */}
      <FashionStudioNav
        currentView={currentView}
        onViewChange={setCurrentView}
        currency={currency}
        onCurrencyToggle={() => {
          const next = currency === "USD" ? "CNY" : currency === "CNY" ? "NGN" : "USD";
          setCurrency(next);
          saveUserStylePreferences({ currency: next });
        }}
        onOpenAiStylist={() => setShowAiStylistModal(true)}
        onOpenSaveOutfit={() => setShowSaveModal(true)}
        onOpenShareOutfit={() => setShowShareModal(true)}
        savedCount={wardrobe.length}
      />

      {/* Main View Router */}
      <div className="relative flex-1 w-full min-h-0 overflow-hidden flex flex-col">
        {/* ==================== 1. STUDIO VIEW ==================== */}
        {currentView === "studio" && (
          <div className="relative flex-1 w-full h-full flex flex-col overflow-hidden">
            {/* 3D Virtual Model Stage */}
            <VirtualModelStage
              model={currentModel}
              outfit={outfit}
              currency={currency}
              onInspectGarment={(item) => setInspectingGarment(item)}
              onModelChange={(m) => {
                setCurrentModel(m);
                saveUserStylePreferences({ defaultModelId: m.id });
              }}
              onUndo={handleUndo}
              onReset={handleReset}
              onRandomizeFit={handleRandomizeFit}
              canUndo={history.length > 0}
            />

            {/* Bottom Clothing Selector Carousel */}
            <ClothingPicker
              outfit={outfit}
              currency={currency}
              onSelectGarment={handleSelectGarment}
              onOpenDetails={(item) => setInspectingGarment(item)}
            />
          </div>
        )}

        {/* ==================== 2. DISCOVER VIEW ==================== */}
        {currentView === "discover" && (
          <div className="flex-1 w-full h-full overflow-y-auto no-scrollbar p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
            {/* Header Banner */}
            <div className="space-y-1">
              <h2 className="font-display font-bold text-xl sm:text-2xl text-foreground">
                Curated Fashion Inspiration
              </h2>
              <p className="text-xs text-muted-foreground">
                Browse complete editorial looks, explore aesthetics, and customize pieces in 3D Studio.
              </p>
            </div>

            {/* Aesthetic Filter Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {styleCategories.map((cat) => {
                const active = discoverFilter === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => {
                      void triggerLightHaptic();
                      setDiscoverFilter(cat);
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition ${
                      active
                        ? "bg-rose-500 text-white shadow-sm font-bold"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Curated Looks Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredCuratedLooks.map((look) => (
                <div
                  key={look.id}
                  className="rounded-3xl bg-card border border-border overflow-hidden shadow-sm hover:shadow-md transition group flex flex-col"
                >
                  {/* Cover Artwork */}
                  <div className="relative aspect-[3/4] w-full bg-secondary overflow-hidden">
                    <img
                      src={look.coverImage}
                      alt={look.title}
                      className="w-full h-full object-cover group-hover:scale-102 transition duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />

                    {/* Occasion & Style Badges */}
                    <div className="absolute top-3 left-3 flex items-center gap-1.5">
                      <span className="px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md text-white text-[10px] font-bold">
                        {look.styleCategory}
                      </span>
                    </div>

                    {/* Likes & Creator */}
                    <div className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-md text-white text-xs font-medium">
                      <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500" />
                      <span>{look.likes}</span>
                    </div>

                    {/* Bottom Metadata inside artwork */}
                    <div className="absolute bottom-3 inset-x-3 text-white space-y-1">
                      <h3 className="font-display font-bold text-lg leading-tight">{look.title}</h3>
                      <p className="text-xs text-white/80 line-clamp-2">{look.description}</p>
                    </div>
                  </div>

                  {/* Body & Actions */}
                  <div className="p-4 space-y-3 flex-1 flex flex-col justify-between">
                    {/* Style Rule */}
                    <div className="text-xs p-2.5 rounded-2xl bg-secondary/60 border border-border text-foreground/90 flex items-start gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <span className="text-[11px] leading-relaxed">{look.stylingRule}</span>
                    </div>

                    {/* Wear in Studio Button */}
                    <button
                      type="button"
                      onClick={() => handleWearCuratedLook(look)}
                      className="w-full py-2.5 rounded-2xl bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold text-xs shadow-md transition active:scale-95 flex items-center justify-center gap-2"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-rose-500" />
                      <span>Wear Look in 3D Studio</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== 3. WARDROBE VIEW ==================== */}
        {currentView === "wardrobe" && (
          <div className="flex-1 w-full h-full overflow-y-auto no-scrollbar p-4 sm:p-6 space-y-6 max-w-6xl mx-auto">
            {/* Header & Collection Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="font-display font-bold text-xl sm:text-2xl text-foreground">
                  My Digital Wardrobe
                </h2>
                <p className="text-xs text-muted-foreground">
                  Your private collection of custom styled outfits across campus, work, and events.
                </p>
              </div>

              {/* Collections Segmented Bar */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar p-1 rounded-2xl bg-secondary border border-border">
                {(["All", "Favorites", "Campus", "Weekend", "Work", "Events"] as WardrobeCollection[]).map(
                  (col) => {
                    const active = selectedWardrobeCollection === col;
                    return (
                      <button
                        key={col}
                        type="button"
                        onClick={() => {
                          void triggerLightHaptic();
                          setSelectedWardrobeCollection(col);
                        }}
                        className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                          active
                            ? "bg-card text-foreground shadow-sm font-bold"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {col === "Favorites" ? "❤️ Favorites" : col}
                      </button>
                    );
                  }
                )}
              </div>
            </div>

            {/* Wardrobe Grid */}
            {filteredWardrobe.length === 0 ? (
              <div className="py-16 text-center space-y-3 bg-card border border-border rounded-3xl p-8 max-w-md mx-auto">
                <div className="w-14 h-14 rounded-2xl bg-rose-500/10 text-rose-500 grid place-items-center mx-auto">
                  <Bookmark className="w-7 h-7" />
                </div>
                <h3 className="font-display font-bold text-base text-foreground">No outfits in this collection</h3>
                <p className="text-xs text-muted-foreground">
                  Design a unique look in the 3D Studio and tap the save icon to store it here.
                </p>
                <button
                  type="button"
                  onClick={() => setCurrentView("studio")}
                  className="px-4 py-2 rounded-2xl bg-rose-500 text-white font-bold text-xs shadow-md shadow-rose-500/20 active:scale-95 transition"
                >
                  Open 3D Studio
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredWardrobe.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-3xl bg-card border border-border space-y-3.5 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-20 h-28 rounded-2xl overflow-hidden bg-secondary border border-border shrink-0">
                        <img src={item.previewUrl} alt={item.name} className="w-full h-full object-cover" />
                      </div>

                      <div className="flex-1 min-w-0 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-mono font-bold text-rose-500">
                            {item.collection}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              void triggerLightHaptic();
                              toggleFavoriteOutfit(item.id);
                            }}
                            className="p-1 text-muted-foreground hover:text-rose-500"
                            title="Toggle favorite"
                          >
                            <Heart
                              className={`w-4 h-4 ${
                                item.isFavorite ? "fill-rose-500 text-rose-500" : ""
                              }`}
                            />
                          </button>
                        </div>

                        <h3 className="font-display font-bold text-sm text-foreground truncate">
                          {item.name}
                        </h3>
                        {item.description && (
                          <p className="text-[11px] text-muted-foreground line-clamp-2">
                            {item.description}
                          </p>
                        )}
                        <div className="text-[10px] text-muted-foreground font-mono">
                          Saved {new Date(item.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {/* Actions Bar */}
                    <div className="grid grid-cols-4 gap-1.5 pt-2 border-t border-border">
                      {/* Wear in Studio */}
                      <button
                        type="button"
                        onClick={() => handleWearSavedOutfit(item)}
                        className="col-span-2 py-2 px-3 rounded-xl bg-rose-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition"
                        title="Edit in Studio"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Wear Look</span>
                      </button>

                      {/* Duplicate */}
                      <button
                        type="button"
                        onClick={() => {
                          void triggerLightHaptic();
                          duplicateSavedOutfit(item.id);
                          toast.success("Duplicated outfit");
                        }}
                        className="py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs grid place-items-center transition active:scale-95"
                        title="Duplicate look"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete */}
                      <button
                        type="button"
                        onClick={() => {
                          void triggerLightHaptic();
                          deleteSavedOutfit(item.id);
                          toast("Look removed from wardrobe");
                        }}
                        className="py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 text-xs grid place-items-center transition active:scale-95"
                        title="Delete look"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ==================== 4. MY STYLE VIEW ==================== */}
        {currentView === "my_style" && (
          <div className="flex-1 w-full h-full overflow-y-auto no-scrollbar p-4 sm:p-6 space-y-6 max-w-2xl mx-auto">
            <div className="space-y-1">
              <h2 className="font-display font-bold text-xl sm:text-2xl text-foreground">
                Style Profile & Preferences
              </h2>
              <p className="text-xs text-muted-foreground">
                Personalize your fashion aesthetic to bias AI Stylist recommendations and curated discover feeds.
              </p>
            </div>

            {/* Aesthetics Multi-select */}
            <div className="p-5 rounded-3xl bg-card border border-border space-y-3">
              <label className="text-xs font-bold text-foreground">Preferred Aesthetics</label>
              <div className="flex flex-wrap gap-2">
                {[
                  "Campus Fits",
                  "Streetwear",
                  "Old Money",
                  "African Traditional",
                  "Date Night",
                  "Casual",
                  "Minimalist",
                  "Y2K",
                  "Athleisure",
                ].map((st) => {
                  const active = stylePrefs.preferredStyles.includes(st as FashionStyle);
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => {
                        void triggerLightHaptic();
                        const next = active
                          ? stylePrefs.preferredStyles.filter((s) => s !== st)
                          : [...stylePrefs.preferredStyles, st as FashionStyle];
                        const updated = saveUserStylePreferences({ preferredStyles: next });
                        setStylePrefs(updated);
                      }}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                        active
                          ? "bg-rose-500 text-white shadow-sm font-bold"
                          : "bg-secondary text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {st} {active && "✓"}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Color Palette Preferences */}
            <div className="p-5 rounded-3xl bg-card border border-border space-y-3">
              <label className="text-xs font-bold text-foreground">Favorite Palette Tones</label>
              <div className="flex items-center gap-2.5">
                {[
                  { name: "Oatmeal Earth", hex: "#D4B996" },
                  { name: "Stealth Black", hex: "#1A1A1A" },
                  { name: "Pure White", hex: "#FFFFFF" },
                  { name: "Midnight Navy", hex: "#0B1D3A" },
                  { name: "Emerald Glaze", hex: "#097969" },
                  { name: "Burgundy Wine", hex: "#58111A" },
                ].map((col) => {
                  const active = stylePrefs.preferredColors.includes(col.hex);
                  return (
                    <button
                      key={col.hex}
                      type="button"
                      onClick={() => {
                        void triggerLightHaptic();
                        const next = active
                          ? stylePrefs.preferredColors.filter((c) => c !== col.hex)
                          : [...stylePrefs.preferredColors, col.hex];
                        const updated = saveUserStylePreferences({ preferredColors: next });
                        setStylePrefs(updated);
                      }}
                      className={`w-8 h-8 rounded-full border-2 transition relative ${
                        active ? "ring-2 ring-rose-500 scale-110" : "border-black/20 dark:border-white/20"
                      }`}
                      style={{ backgroundColor: col.hex }}
                      title={col.name}
                    >
                      {active && (
                        <Check className="w-3.5 h-3.5 text-white mix-blend-difference absolute inset-0 m-auto" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sizing Preferences */}
            <div className="p-5 rounded-3xl bg-card border border-border space-y-3">
              <label className="text-xs font-bold text-foreground">Standard Sizing</label>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Top Size</span>
                  <input
                    type="text"
                    value={stylePrefs.sizes.top}
                    onChange={(e) => {
                      const updated = saveUserStylePreferences({
                        sizes: { ...stylePrefs.sizes, top: e.target.value },
                      });
                      setStylePrefs(updated);
                    }}
                    className="w-full bg-secondary border border-border rounded-xl px-3 py-1.5 text-xs text-foreground font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Bottom Waist</span>
                  <input
                    type="text"
                    value={stylePrefs.sizes.bottom}
                    onChange={(e) => {
                      const updated = saveUserStylePreferences({
                        sizes: { ...stylePrefs.sizes, bottom: e.target.value },
                      });
                      setStylePrefs(updated);
                    }}
                    className="w-full bg-secondary border border-border rounded-xl px-3 py-1.5 text-xs text-foreground font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Shoe (EU)</span>
                  <input
                    type="text"
                    value={stylePrefs.sizes.shoes}
                    onChange={(e) => {
                      const updated = saveUserStylePreferences({
                        sizes: { ...stylePrefs.sizes, shoes: e.target.value },
                      });
                      setStylePrefs(updated);
                    }}
                    className="w-full bg-secondary border border-border rounded-xl px-3 py-1.5 text-xs text-foreground font-mono"
                  />
                </div>
              </div>
            </div>

            {/* Budget & Currency Tier */}
            <div className="p-5 rounded-3xl bg-card border border-border space-y-3">
              <label className="text-xs font-bold text-foreground">Default Currency & Budget</label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Currency</span>
                  <div className="flex items-center gap-1">
                    {(["USD", "CNY", "NGN"] as const).map((curr) => (
                      <button
                        key={curr}
                        type="button"
                        onClick={() => {
                          setCurrency(curr);
                          const updated = saveUserStylePreferences({ currency: curr });
                          setStylePrefs(updated);
                        }}
                        className={`flex-1 py-1.5 rounded-xl border text-xs font-mono font-bold transition ${
                          currency === curr
                            ? "border-rose-500 bg-rose-500/10 text-rose-500"
                            : "border-border bg-secondary text-muted-foreground"
                        }`}
                      >
                        {curr}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] text-muted-foreground">Budget Tier</span>
                  <div className="flex items-center gap-1">
                    {(["budget", "mid", "luxury"] as const).map((b) => (
                      <button
                        key={b}
                        type="button"
                        onClick={() => {
                          const updated = saveUserStylePreferences({ budgetTier: b });
                          setStylePrefs(updated);
                        }}
                        className={`flex-1 py-1.5 rounded-xl border text-xs capitalize font-semibold transition ${
                          stylePrefs.budgetTier === b
                            ? "border-rose-500 bg-rose-500/10 text-rose-500"
                            : "border-border bg-secondary text-muted-foreground"
                        }`}
                      >
                        {b}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ==================== GLOBAL MODALS ==================== */}
      {/* 1. Garment Product Details & Marketplace Checkout Modal */}
      <GarmentDetailModal
        garment={inspectingGarment}
        currency={currency}
        onClose={() => setInspectingGarment(null)}
        onEquip={(item) => handleSelectGarment(item)}
        isEquipped={
          inspectingGarment?.id === outfit.top?.id ||
          inspectingGarment?.id === outfit.bottom?.id ||
          inspectingGarment?.id === outfit.dress?.id ||
          inspectingGarment?.id === outfit.shoes?.id ||
          inspectingGarment?.id === outfit.accessory?.id
        }
      />

      {/* 2. Save Outfit to Digital Wardrobe Modal */}
      <SaveOutfitModal
        isOpen={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        outfit={outfit}
        model={currentModel}
        previewUrl={currentModel.baseImages.front}
      />

      {/* 3. Share Outfit to Private Chat Modal */}
      <ShareOutfitChatModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        outfit={outfit}
        model={currentModel}
        previewUrl={currentModel.baseImages.front}
        stylingRule={activeStylingRule}
      />

      {/* 4. AI Stylist Modal */}
      <AiStylistModal
        isOpen={showAiStylistModal}
        onClose={() => setShowAiStylistModal(false)}
        onApplyRecommendation={handleApplyAiRecommendation}
        currentGarment={outfit.top || outfit.dress}
        currency={currency}
      />
    </div>
  );
}
