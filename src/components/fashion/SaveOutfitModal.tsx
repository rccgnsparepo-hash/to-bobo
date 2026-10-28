import { useState } from "react";
import { X, Save, Bookmark, Sparkles, FolderPlus } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { triggerMediumHaptic } from "@/lib/haptics";
import type { CurrentOutfit, ModelAvatar } from "@/lib/fashionData";
import { saveOutfitToLocalWardrobe, type WardrobeCollection } from "@/lib/fashionWardrobe";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  outfit: CurrentOutfit;
  model: ModelAvatar;
  previewUrl: string;
}

export function SaveOutfitModal({ isOpen, onClose, outfit, model, previewUrl }: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [collection, setCollection] = useState<WardrobeCollection>("Campus");
  const [isFavorite, setIsFavorite] = useState(false);

  if (!isOpen) return null;

  const collections: WardrobeCollection[] = ["Campus", "Weekend", "Work", "Events"];

  const handleSave = () => {
    if (!name.trim()) {
      toast.error("Please enter a name for your outfit");
      return;
    }

    void triggerMediumHaptic();
    saveOutfitToLocalWardrobe({
      name: name.trim(),
      description: description.trim() || undefined,
      collection,
      isFavorite,
      modelId: model.id,
      previewUrl,
      items: {
        topId: outfit.top?.id,
        bottomId: outfit.bottom?.id,
        dressId: outfit.dress?.id,
        shoesId: outfit.shoes?.id,
        accessoryId: outfit.accessory?.id,
      },
    });

    toast.success(`"${name}" saved to your Digital Wardrobe! 👗`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.94, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.94, opacity: 0 }}
        className="w-full max-w-md rounded-3xl bg-card border border-border p-6 shadow-2xl space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-rose-500/10 text-rose-500 grid place-items-center">
              <Bookmark className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-display font-bold text-base text-foreground">Save to Wardrobe</h3>
              <p className="text-xs text-muted-foreground">Store your customized look</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-secondary grid place-items-center text-muted-foreground hover:text-foreground"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Outfit Preview Thumbnail & Pieces */}
        <div className="flex items-center gap-3 p-3 rounded-2xl bg-secondary/60 border border-border">
          <div className="w-16 h-20 rounded-xl overflow-hidden bg-background border border-border shrink-0">
            <img src={previewUrl} alt="Outfit preview" className="w-full h-full object-cover" />
          </div>
          <div className="text-xs space-y-1 min-w-0">
            <div className="font-bold text-foreground">Composed Pieces:</div>
            <div className="text-muted-foreground truncate">
              • {outfit.dress ? outfit.dress.name : outfit.top?.name || "No top"}
            </div>
            {!outfit.dress && outfit.bottom && (
              <div className="text-muted-foreground truncate">• {outfit.bottom.name}</div>
            )}
            {outfit.shoes && (
              <div className="text-muted-foreground truncate">• {outfit.shoes.name}</div>
            )}
          </div>
        </div>

        {/* Outfit Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-foreground">Outfit Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Wednesday Lecture Chic, Friday Party Vibe"
            className="w-full bg-secondary/80 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-rose-500"
            autoFocus
          />
        </div>

        {/* Collection Category */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-foreground">Collection</label>
          <div className="grid grid-cols-4 gap-1.5">
            {collections.map((col) => {
              const active = collection === col;
              return (
                <button
                  key={col}
                  type="button"
                  onClick={() => setCollection(col)}
                  className={`py-1.5 px-2 rounded-xl border text-xs font-semibold transition text-center ${
                    active
                      ? "border-rose-500 bg-rose-500/10 text-rose-500"
                      : "border-border bg-secondary/50 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {col}
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional Notes */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-foreground">Style Notes (Optional)</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="e.g. Best with silver rings and low buns"
            className="w-full bg-secondary/80 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-rose-500"
          />
        </div>

        {/* Favorite Checkbox */}
        <label className="flex items-center gap-2 cursor-pointer pt-1">
          <input
            type="checkbox"
            checked={isFavorite}
            onChange={(e) => setIsFavorite(e.target.checked)}
            className="rounded border-border text-rose-500 focus:ring-rose-500 w-4 h-4"
          />
          <span className="text-xs text-foreground font-medium">Mark as favorite look (❤️)</span>
        </label>

        {/* Save Button */}
        <button
          type="button"
          onClick={handleSave}
          className="w-full py-3 rounded-2xl bg-gradient-to-r from-rose-500 to-amber-500 text-white font-bold text-xs shadow-md shadow-rose-500/20 hover:opacity-95 active:scale-95 transition flex items-center justify-center gap-2"
        >
          <Save className="w-4 h-4" />
          <span>Save to My Digital Wardrobe</span>
        </button>
      </motion.div>
    </div>
  );
}
