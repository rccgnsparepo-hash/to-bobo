// Digital Wardrobe & Style Preference Persistence Engine for Flick Fashion Studio
import { supabase } from "@/integrations/supabase/client";
import type { CurrentOutfit, FashionStyle, GarmentItem } from "./fashionData";
import { GARMENT_CATALOG } from "./fashionData";

export type WardrobeCollection = "All" | "Campus" | "Weekend" | "Work" | "Events" | "Favorites";

export interface SavedOutfit {
  id: string;
  userId?: string;
  name: string;
  description?: string;
  collection: WardrobeCollection;
  isFavorite: boolean;
  createdAt: number;
  updatedAt: number;
  modelId: string;
  previewUrl: string;
  stylingRule?: string;
  items: {
    topId?: string;
    bottomId?: string;
    dressId?: string;
    shoesId?: string;
    accessoryId?: string;
  };
}

export interface UserStylePreferences {
  preferredStyles: FashionStyle[];
  preferredColors: string[];
  defaultModelId: string;
  currency: "USD" | "CNY" | "NGN";
  budgetTier: "budget" | "mid" | "luxury";
  sizes: {
    top: string;
    bottom: string;
    shoes: string;
  };
  occasionPriorities: string[];
}

const WARDROBE_STORAGE_KEY = "flick:digital_wardrobe_v2";
const RECENT_TRIED_KEY = "flick:recently_tried_fits";
const STYLE_PREFS_KEY = "flick:user_style_preferences";

const DEFAULT_PREFERENCES: UserStylePreferences = {
  preferredStyles: ["Campus Fits", "Streetwear", "Old Money"],
  preferredColors: ["#D4B996", "#1A1A1A", "#FFFFFF", "#0B1D3A"],
  defaultModelId: "mei",
  currency: "USD",
  budgetTier: "mid",
  sizes: {
    top: "M",
    bottom: "32",
    shoes: "40",
  },
  occasionPriorities: ["Campus", "Weekend Hangouts", "Presentations", "Date Nights"],
};

export function getLocalWardrobe(): SavedOutfit[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(WARDROBE_STORAGE_KEY);
    if (!raw) {
      // Seed default saved looks
      const initial: SavedOutfit[] = [
        {
          id: "saved-acubi-starter",
          name: "Signature Acubi Campus Fit",
          description: "Comfortable knitwear cardigan with pleated skort and platform lug boots.",
          collection: "Campus",
          isFavorite: true,
          createdAt: Date.now() - 86400000 * 2,
          updatedAt: Date.now() - 86400000 * 2,
          modelId: "mei",
          previewUrl: "/assets/aistudio/download__38__1d85c90f.jpg",
          stylingRule: "Tonal Earth Harmony: Warm camel knitwear balanced with stacked socks and lug-sole boots.",
          items: {
            topId: "top-acubi-cardigan",
            bottomId: "btm-acubi-skort",
            shoesId: "shoe-platform-boots",
            accessoryId: "acc-canvas-tote",
          },
        },
        {
          id: "saved-senator-gala",
          name: "Lagos Gala Royal Senator",
          description: "Midnight navy tunic with crisp white linen pants and handcrafted mules.",
          collection: "Events",
          isFavorite: false,
          createdAt: Date.now() - 86400000 * 4,
          updatedAt: Date.now() - 86400000 * 4,
          modelId: "leo",
          previewUrl: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?auto=format&fit=crop&w=600&q=80",
          stylingRule: "Focal Contrast Rule: Rich deep navy tunic embroidery paired with crisp white pants.",
          items: {
            topId: "top-senator-tunic",
            bottomId: "btm-senator-pants",
            shoesId: "shoe-burnished-mules",
          },
        },
      ];
      localStorage.setItem(WARDROBE_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveOutfitToLocalWardrobe(outfit: Omit<SavedOutfit, "id" | "createdAt" | "updatedAt">): SavedOutfit {
  const current = getLocalWardrobe();
  const newOutfit: SavedOutfit = {
    ...outfit,
    id: `outfit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const updated = [newOutfit, ...current];
  try {
    localStorage.setItem(WARDROBE_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("flick:wardrobe-updated"));
  } catch {}
  return newOutfit;
}

export function updateSavedOutfit(id: string, updates: Partial<SavedOutfit>): boolean {
  const current = getLocalWardrobe();
  const idx = current.findIndex((o) => o.id === id);
  if (idx < 0) return false;
  current[idx] = {
    ...current[idx],
    ...updates,
    updatedAt: Date.now(),
  };
  try {
    localStorage.setItem(WARDROBE_STORAGE_KEY, JSON.stringify(current));
    window.dispatchEvent(new CustomEvent("flick:wardrobe-updated"));
  } catch {}
  return true;
}

export function duplicateSavedOutfit(id: string): SavedOutfit | null {
  const current = getLocalWardrobe();
  const target = current.find((o) => o.id === id);
  if (!target) return null;
  const duplicated: SavedOutfit = {
    ...target,
    id: `outfit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: `${target.name} (Copy)`,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  const updated = [duplicated, ...current];
  try {
    localStorage.setItem(WARDROBE_STORAGE_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("flick:wardrobe-updated"));
  } catch {}
  return duplicated;
}

export function deleteSavedOutfit(id: string): boolean {
  const current = getLocalWardrobe();
  const filtered = current.filter((o) => o.id !== id);
  try {
    localStorage.setItem(WARDROBE_STORAGE_KEY, JSON.stringify(filtered));
    window.dispatchEvent(new CustomEvent("flick:wardrobe-updated"));
  } catch {}
  return true;
}

export function toggleFavoriteOutfit(id: string): boolean {
  const current = getLocalWardrobe();
  const target = current.find((o) => o.id === id);
  if (!target) return false;
  target.isFavorite = !target.isFavorite;
  target.updatedAt = Date.now();
  try {
    localStorage.setItem(WARDROBE_STORAGE_KEY, JSON.stringify(current));
    window.dispatchEvent(new CustomEvent("flick:wardrobe-updated"));
  } catch {}
  return target.isFavorite;
}

export function getRecentlyTriedOutfits(): { items: CurrentOutfit; timestamp: number }[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(RECENT_TRIED_KEY) || "[]");
  } catch {
    return [];
  }
}

export function recordRecentlyTried(outfit: CurrentOutfit): void {
  if (typeof window === "undefined") return;
  try {
    const list = getRecentlyTriedOutfits();
    const cleanEntry = {
      items: {
        top: outfit.top,
        bottom: outfit.bottom,
        dress: outfit.dress,
        shoes: outfit.shoes,
        accessory: outfit.accessory,
      },
      timestamp: Date.now(),
    };
    const updated = [cleanEntry, ...list.slice(0, 9)];
    localStorage.setItem(RECENT_TRIED_KEY, JSON.stringify(updated));
  } catch {}
}

export function getUserStylePreferences(): UserStylePreferences {
  if (typeof window === "undefined") return DEFAULT_PREFERENCES;
  try {
    const raw = localStorage.getItem(STYLE_PREFS_KEY);
    return raw ? { ...DEFAULT_PREFERENCES, ...JSON.parse(raw) } : DEFAULT_PREFERENCES;
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

export function saveUserStylePreferences(prefs: Partial<UserStylePreferences>): UserStylePreferences {
  const current = getUserStylePreferences();
  const updated = { ...current, ...prefs };
  try {
    localStorage.setItem(STYLE_PREFS_KEY, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("flick:style-prefs-updated"));
  } catch {}
  return updated;
}

export function resolveGarmentsForOutfit(items: SavedOutfit["items"]): CurrentOutfit {
  const resolved: CurrentOutfit = {};
  if (items.topId) resolved.top = GARMENT_CATALOG.find((g) => g.id === items.topId);
  if (items.bottomId) resolved.bottom = GARMENT_CATALOG.find((g) => g.id === items.bottomId);
  if (items.dressId) resolved.dress = GARMENT_CATALOG.find((g) => g.id === items.dressId);
  if (items.shoesId) resolved.shoes = GARMENT_CATALOG.find((g) => g.id === items.shoesId);
  if (items.accessoryId) resolved.accessory = GARMENT_CATALOG.find((g) => g.id === items.accessoryId);
  return resolved;
}
