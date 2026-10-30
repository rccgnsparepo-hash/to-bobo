import { SavedOutfit, GarmentItem, CurrentOutfit, GARMENT_CATALOG } from "./fashionData";
import { supabase } from "@/integrations/supabase/client";

export type WardrobeCollection =
  | "All"
  | "Favorites"
  | "Campus"
  | "Weekend"
  | "Work"
  | "Events"
  | "Date Night"
  | "Cultural";

export interface UserStyleProfile {
  preferredAesthetics: string[];
  favoriteColors: string[];
  topSize: string;
  bottomSize: string;
  shoeSize: string;
  campusOrCity: string;
  budgetTier: "Essential ($)" | "Mid-Range ($$)" | "Luxury ($$$)";
  genderPreference: "female" | "male" | "unisex";
  currency?: "USD" | "CNY" | "NGN";
  defaultModelId?: string;
}

export type UserStylePreferences = UserStyleProfile;

const DEFAULT_PROFILE: UserStyleProfile = {
  preferredAesthetics: ["Streetwear", "Minimalist", "Campus Fits"],
  favoriteColors: ["#D4B996", "#111111", "#FFFFFF"],
  topSize: "M",
  bottomSize: "32",
  shoeSize: "40",
  campusOrCity: "University Campus",
  budgetTier: "Mid-Range ($$)",
  genderPreference: "female",
  currency: "USD",
  defaultModelId: "mei",
};

/**
 * Retrieves all saved outfits for the active user
 */
export function getSavedWardrobe(userId: string = "guest"): SavedOutfit[] {
  try {
    const raw = localStorage.getItem(`flick:wardrobe:${userId}`);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

/**
 * Saves a new or updated outfit into the user's digital wardrobe
 */
export async function saveOutfitToWardrobe(
  outfit: Omit<SavedOutfit, "id" | "createdAt" | "updatedAt"> & { id?: string },
  userId: string = "guest"
): Promise<SavedOutfit> {
  const current = getSavedWardrobe(userId);
  const now = new Date().toISOString();

  let target: SavedOutfit;
  if (outfit.id) {
    target = {
      ...outfit,
      id: outfit.id,
      createdAt: (current.find((o) => o.id === outfit.id)?.createdAt) || now,
      updatedAt: now,
    };
    const idx = current.findIndex((o) => o.id === outfit.id);
    if (idx >= 0) {
      current[idx] = target;
    } else {
      current.unshift(target);
    }
  } else {
    target = {
      ...outfit,
      id: `fit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      createdAt: now,
      updatedAt: now,
    };
    current.unshift(target);
  }

  localStorage.setItem(`flick:wardrobe:${userId}`, JSON.stringify(current));
  window.dispatchEvent(new CustomEvent("flick:wardrobe-updated", { detail: { count: current.length } }));

  // Background cloud sync to Supabase if logged in
  if (userId && userId !== "guest") {
    try {
      const { data } = await supabase.from("user_settings").select("theme").eq("user_id", userId).maybeSingle();
      const existingTheme = (data?.theme as Record<string, unknown>) || {};
      await supabase.from("user_settings").upsert({
        user_id: userId,
        theme: {
          ...existingTheme,
          fashion_wardrobe: current.slice(0, 50),
        },
        updated_at: now,
      });
    } catch (e) {
      console.warn("Cloud sync of wardrobe skipped:", e);
    }
  }

  return target;
}

/**
 * Deletes an outfit from the user's wardrobe
 */
export function deleteOutfitFromWardrobe(outfitId: string, userId: string = "guest"): boolean {
  const current = getSavedWardrobe(userId);
  const filtered = current.filter((o) => o.id !== outfitId);
  localStorage.setItem(`flick:wardrobe:${userId}`, JSON.stringify(filtered));
  window.dispatchEvent(new CustomEvent("flick:wardrobe-updated", { detail: { count: filtered.length } }));
  return true;
}

/**
 * Duplicates an existing outfit
 */
export async function duplicateOutfit(outfitId: string, userId: string = "guest"): Promise<SavedOutfit | null> {
  const current = getSavedWardrobe(userId);
  const found = current.find((o) => o.id === outfitId);
  if (!found) return null;

  return saveOutfitToWardrobe(
    {
      ...found,
      id: undefined,
      name: `${found.name} (Copy)`,
      isFavorite: false,
    },
    userId
  );
}

/**
 * Toggles the favorite status of a saved outfit
 */
export function toggleFavoriteOutfit(outfitId: string, userId: string = "guest"): boolean {
  const current = getSavedWardrobe(userId);
  const found = current.find((o) => o.id === outfitId);
  if (!found) return false;

  found.isFavorite = !found.isFavorite;
  found.updatedAt = new Date().toISOString();
  localStorage.setItem(`flick:wardrobe:${userId}`, JSON.stringify(current));
  window.dispatchEvent(new CustomEvent("flick:wardrobe-updated"));
  return found.isFavorite;
}

/**
 * Records an outfit in the recently tried list
 */
export function recordRecentlyTried(
  items: CurrentOutfit | {
    top?: GarmentItem;
    bottom?: GarmentItem;
    dress?: GarmentItem;
    shoes?: GarmentItem;
    accessory?: GarmentItem;
  },
  modelId: string = "mei",
  userId: string = "guest"
) {
  try {
    const key = `flick:recently_tried:${userId}`;
    const raw = localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    const entry = {
      id: `recent_${Date.now()}`,
      items,
      modelId,
      timestamp: new Date().toISOString(),
    };
    // Deduplicate against the very last tried items
    const updated = [entry, ...list.slice(0, 15)];
    localStorage.setItem(key, JSON.stringify(updated));
  } catch {
    /* fallback */
  }
}

/**
 * Gets the recently tried list
 */
export function getRecentlyTried(userId: string = "guest"): any[] {
  try {
    const raw = localStorage.getItem(`flick:recently_tried:${userId}`);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/**
 * Reads user style profile
 */
export function getUserStyleProfile(userId: string = "guest"): UserStyleProfile {
  try {
    const raw = localStorage.getItem(`flick:style_profile:${userId}`);
    if (!raw) return DEFAULT_PROFILE;
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PROFILE;
  }
}

/**
 * Saves user style profile
 */
export function saveUserStyleProfile(profile: Partial<UserStyleProfile>, userId: string = "guest") {
  try {
    const curr = getUserStyleProfile(userId);
    const updated = { ...curr, ...profile };
    localStorage.setItem(`flick:style_profile:${userId}`, JSON.stringify(updated));
    window.dispatchEvent(new CustomEvent("flick:style-profile-updated", { detail: updated }));
  } catch {
    /* fallback */
  }
}

/**
 * Resolves garments for an outfit whether given IDs or objects
 */
export function resolveGarmentsForOutfit(items?: {
  top?: GarmentItem | string;
  bottom?: GarmentItem | string;
  dress?: GarmentItem | string;
  shoes?: GarmentItem | string;
  accessory?: GarmentItem | string;
  topId?: string;
  bottomId?: string;
  dressId?: string;
  shoesId?: string;
  accessoryId?: string;
}): CurrentOutfit {
  if (!items) return { shoes: GARMENT_CATALOG.find((g) => g.category === "shoes") };

  const resolveItem = (val?: GarmentItem | string, idFallback?: string): GarmentItem | undefined => {
    if (val && typeof val === "object" && val.id) return val;
    const targetId = typeof val === "string" ? val : idFallback;
    if (!targetId) return undefined;
    return GARMENT_CATALOG.find((g) => g.id === targetId);
  };

  return {
    top: resolveItem(items.top, items.topId),
    bottom: resolveItem(items.bottom, items.bottomId),
    dress: resolveItem(items.dress, items.dressId),
    shoes: resolveItem(items.shoes, items.shoesId) || GARMENT_CATALOG.find((g) => g.category === "shoes"),
    accessory: resolveItem(items.accessory, items.accessoryId),
  };
}

/**
 * Saves outfit to digital wardrobe with flexible payload (from modal or studio)
 */
export async function saveOutfitToLocalWardrobe(
  outfitData: {
    name: string;
    description?: string;
    collection: string;
    isFavorite?: boolean;
    modelId: string;
    previewUrl?: string;
    stylingRule?: string;
    items: {
      topId?: string;
      bottomId?: string;
      dressId?: string;
      shoesId?: string;
      accessoryId?: string;
      top?: GarmentItem;
      bottom?: GarmentItem;
      dress?: GarmentItem;
      shoes?: GarmentItem;
      accessory?: GarmentItem;
    };
  },
  userId: string = "guest"
): Promise<SavedOutfit> {
  const resolved = resolveGarmentsForOutfit(outfitData.items);
  return saveOutfitToWardrobe(
    {
      userId,
      name: outfitData.name,
      description: outfitData.description,
      collection: outfitData.collection as any,
      isFavorite: !!outfitData.isFavorite,
      modelId: outfitData.modelId,
      previewImage: outfitData.previewUrl || "",
      previewUrl: outfitData.previewUrl,
      stylingRule: outfitData.stylingRule,
      items: {
        ...resolved,
        shoes: resolved.shoes || GARMENT_CATALOG.find((g) => g.category === "shoes")!,
      },
    },
    userId
  );
}

// Aliases for compatibility
export const getLocalWardrobe = getSavedWardrobe;
export const deleteSavedOutfit = deleteOutfitFromWardrobe;
export const duplicateSavedOutfit = duplicateOutfit;
export const getRecentlyTriedOutfits = getRecentlyTried;
export const getUserStylePreferences = (userId: string = "guest"): UserStylePreferences => getUserStyleProfile(userId);
export const saveUserStylePreferences = (prefs: Partial<UserStylePreferences>, userId: string = "guest") => saveUserStyleProfile(prefs, userId);

export type { SavedOutfit };

