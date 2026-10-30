import React, { useState, useEffect } from "react";
import {
  Bookmark,
  Heart,
  Copy,
  Trash2,
  ArrowRight,
  Sparkles,
  Clock,
  Shirt,
  Share2,
} from "lucide-react";
import { toast } from "sonner";
import { SavedOutfit } from "@/lib/fashionData";
import {
  getSavedWardrobe,
  deleteOutfitFromWardrobe,
  duplicateOutfit,
  toggleFavoriteOutfit,
  getRecentlyTried,
} from "@/lib/fashionWardrobe";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";

interface Props {
  userId: string;
  onWearOutfit: (outfit: SavedOutfit) => void;
  onShareOutfit: (outfit: SavedOutfit) => void;
  onGoToStudio: () => void;
}

const COLLECTIONS = [
  "All",
  "Favorites",
  "Campus",
  "Work",
  "Weekend",
  "Events",
  "Date Night",
  "Cultural",
] as const;

export function FashionWardrobe({
  userId,
  onWearOutfit,
  onShareOutfit,
  onGoToStudio,
}: Props) {
  const [selectedCollection, setSelectedCollection] = useState<string>("All");
  const [savedOutfits, setSavedOutfits] = useState<SavedOutfit[]>([]);
  const [recentlyTried, setRecentlyTried] = useState<any[]>([]);

  const loadData = () => {
    setSavedOutfits(getSavedWardrobe(userId));
    setRecentlyTried(getRecentlyTried(userId));
  };

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener("flick:wardrobe-updated", handleUpdate);
    return () => window.removeEventListener("flick:wardrobe-updated", handleUpdate);
  }, [userId]);

  const handleDelete = (outfitId: string, name: string) => {
    void triggerLightHaptic();
    deleteOutfitFromWardrobe(outfitId, userId);
    toast.info(`Removed "${name}" from your wardrobe`);
    loadData();
  };

  const handleDuplicate = async (outfitId: string) => {
    void triggerLightHaptic();
    const dup = await duplicateOutfit(outfitId, userId);
    if (dup) {
      toast.success(`Duplicated outfit as "${dup.name}"`);
      loadData();
    }
  };

  const handleToggleFavorite = (outfitId: string) => {
    void triggerLightHaptic();
    const fav = toggleFavoriteOutfit(outfitId, userId);
    toast.success(fav ? "Added to favorites ❤️" : "Removed from favorites");
    loadData();
  };

  const filteredOutfits = savedOutfits.filter((outfit) => {
    if (selectedCollection === "All") return true;
    if (selectedCollection === "Favorites") return outfit.isFavorite;
    return outfit.collection === selectedCollection;
  });

  return (
    <div className="flex-1 w-full overflow-y-auto px-4 sm:px-8 py-6 max-w-6xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-rose-500 font-extrabold text-xs uppercase tracking-wider">
            <Bookmark className="w-3.5 h-3.5" />
            <span>Digital Wardrobe</span>
          </div>
          <h2 className="font-display font-black text-2xl sm:text-3xl text-foreground tracking-tight">
            My Saved Looks ({savedOutfits.length})
          </h2>
          <p className="text-sm text-muted-foreground">
            Personal outfit collections, custom styling recipes, and saved fits across your devices.
          </p>
        </div>

        <button
          type="button"
          onClick={onGoToStudio}
          className="self-start sm:self-auto px-4 py-2 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-2 shadow-md shadow-rose-500/25 active:scale-95 transition"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Create New Fit in Studio</span>
        </button>
      </div>

      {/* Collection Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {COLLECTIONS.map((c) => {
          const active = selectedCollection === c;
          const count =
            c === "All"
              ? savedOutfits.length
              : c === "Favorites"
              ? savedOutfits.filter((o) => o.isFavorite).length
              : savedOutfits.filter((o) => o.collection === c).length;

          return (
            <button
              key={c}
              type="button"
              onClick={() => {
                void triggerLightHaptic();
                setSelectedCollection(c);
              }}
              className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                active
                  ? "bg-foreground text-background shadow-xs scale-100"
                  : "bg-secondary/70 text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
            >
              <span>{c}</span>
              <span className="text-[10px] opacity-70">({count})</span>
            </button>
          );
        })}
      </div>

      {/* Outfits Grid */}
      {filteredOutfits.length === 0 ? (
        <div className="py-16 text-center rounded-3xl border border-dashed border-border bg-card/50 p-8 space-y-4 max-w-md mx-auto">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 text-rose-500 grid place-items-center mx-auto">
            <Shirt className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="font-display font-bold text-lg text-foreground">
              No saved looks in {selectedCollection}
            </h3>
            <p className="text-xs text-muted-foreground">
              Experiment with tops, bottoms, footwear, and accessories on the 3D model, then save your signature styling recipes here.
            </p>
          </div>
          <button
            type="button"
            onClick={onGoToStudio}
            className="px-5 py-2.5 rounded-full bg-foreground text-background text-xs font-bold hover:scale-105 active:scale-95 transition shadow-sm"
          >
            Open Fashion Studio
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOutfits.map((outfit) => {
            const pieceCount = Object.values(outfit.items).filter(Boolean).length;
            const pieces = [
              outfit.items.top,
              outfit.items.bottom,
              outfit.items.dress,
              outfit.items.shoes,
              outfit.items.accessory,
            ].filter(Boolean);

            return (
              <div
                key={outfit.id}
                className="group rounded-3xl bg-card border border-border overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between"
              >
                <div>
                  {/* Outfit Preview Canvas */}
                  <div className="relative aspect-[4/5] bg-secondary/50 overflow-hidden">
                    <img
                      src={outfit.previewImage || pieces[0]?.imageUrl}
                      alt={outfit.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />

                    {/* Collection Label */}
                    <div className="absolute top-3 left-3 px-2.5 py-1 rounded-full bg-background/85 backdrop-blur-md border border-border text-[10px] font-bold text-foreground">
                      {outfit.collection}
                    </div>

                    {/* Favorite Button */}
                    <button
                      type="button"
                      onClick={() => handleToggleFavorite(outfit.id)}
                      className="absolute top-3 right-3 w-8 h-8 rounded-full bg-background/85 backdrop-blur-md border border-border grid place-items-center text-foreground hover:scale-110 active:scale-95 transition"
                      title="Favorite outfit"
                    >
                      <Heart
                        className={`w-4 h-4 ${
                          outfit.isFavorite ? "fill-rose-500 text-rose-500" : "text-muted-foreground"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Body Content */}
                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="font-display font-bold text-base text-foreground group-hover:text-rose-500 transition-colors">
                        {outfit.name}
                      </h3>
                      {outfit.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {outfit.description}
                        </p>
                      )}
                      <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        <span>Saved {new Date(outfit.createdAt).toLocaleDateString()}</span>
                      </p>
                    </div>

                    {/* Garment Pieces Stack */}
                    <div className="flex items-center gap-2 pt-1 border-t border-border/60">
                      <div className="flex -space-x-2 overflow-hidden py-1">
                        {pieces.map((p, idx) => (
                          <div
                            key={idx}
                            className="w-7 h-7 rounded-full border-2 border-card overflow-hidden bg-secondary shrink-0 shadow-xs"
                            title={p?.name}
                          >
                            <img src={p?.imageUrl} alt={p?.name} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                      <span className="text-[11px] text-muted-foreground">{pieceCount} pieces</span>
                    </div>
                  </div>
                </div>

                {/* Footer Controls: Wear, Share, Duplicate, Delete */}
                <div className="px-4 pb-4 pt-1 flex items-center justify-between border-t border-border/50 gap-2">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleDuplicate(outfit.id)}
                      className="p-2 rounded-xl bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                      title="Duplicate look"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onShareOutfit(outfit)}
                      className="p-2 rounded-xl bg-secondary/80 hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                      title="Share in chat"
                    >
                      <Share2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(outfit.id, outfit.name)}
                      className="p-2 rounded-xl bg-secondary/80 hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition"
                      title="Delete look"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      void triggerMediumHaptic();
                      onWearOutfit(outfit);
                    }}
                    className="px-3.5 py-1.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-rose-500/25 active:scale-95 transition"
                  >
                    <span>Equip Fit</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recently Tried Section */}
      {recentlyTried.length > 0 && (
        <div className="space-y-3 pt-6 border-t border-border/80">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-rose-500" />
            <h3 className="font-display font-bold text-lg text-foreground">
              Recently Tried Outfits
            </h3>
          </div>
          <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-2">
            {recentlyTried.map((item, idx) => {
              const activePieces = Object.values(item.items || {}).filter(Boolean);
              return (
                <div
                  key={idx}
                  onClick={() => {
                    void triggerLightHaptic();
                    onWearOutfit({
                      id: `recent_${idx}`,
                      userId,
                      name: `Recent Look #${idx + 1}`,
                      collection: "Campus",
                      isFavorite: false,
                      modelId: item.modelId || "mei",
                      previewImage: (activePieces[0] as any)?.imageUrl,
                      items: item.items,
                      createdAt: item.timestamp,
                      updatedAt: item.timestamp,
                    });
                  }}
                  className="p-2.5 rounded-2xl bg-card border border-border shrink-0 cursor-pointer hover:border-rose-500 transition shadow-xs flex items-center gap-2.5 group"
                >
                  <div className="flex -space-x-2">
                    {activePieces.slice(0, 3).map((p: any, pIdx) => (
                      <div
                        key={pIdx}
                        className="w-8 h-8 rounded-full border-2 border-card overflow-hidden bg-secondary shrink-0"
                      >
                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                  <div className="text-left pr-2">
                    <span className="block text-xs font-bold text-foreground group-hover:text-rose-500 transition-colors">
                      Quick Try #{idx + 1}
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      {activePieces.length} garments
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
