import React, { useState, useEffect } from "react";
import { Sparkles, Palette, Check, Save } from "lucide-react";
import { toast } from "sonner";
import {
  getUserStyleProfile,
  saveUserStyleProfile,
  UserStyleProfile,
} from "@/lib/fashionWardrobe";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";

interface Props {
  userId: string;
}

const AVAILABLE_AESTHETICS = [
  "Streetwear",
  "Old Money",
  "Minimalist",
  "Campus Fits",
  "Traditional & African",
  "Y2K",
  "Date Night",
  "Athleisure",
  "Casual",
  "Formal",
];

const PALETTE_OPTIONS = [
  { name: "Almond Cream", hex: "#D4B996" },
  { name: "Pitch Noir", hex: "#111111" },
  { name: "Pure White", hex: "#FFFFFF" },
  { name: "Indigo Sapphire", hex: "#1B365D" },
  { name: "Sunset Gold", hex: "#E5A93C" },
  { name: "Sage Moss", hex: "#8A9A86" },
  { name: "Slate Charcoal", hex: "#323639" },
  { name: "Terracotta Earth", hex: "#C86446" },
  { name: "Vivid Volt", hex: "#CEFF00" },
  { name: "Coral Cerise", hex: "#FF4040" },
];

export function FashionMyStyle({ userId }: Props) {
  const [profile, setProfile] = useState<UserStyleProfile>(() =>
    getUserStyleProfile(userId)
  );

  useEffect(() => {
    setProfile(getUserStyleProfile(userId));
  }, [userId]);

  const toggleAesthetic = (tag: string) => {
    void triggerLightHaptic();
    setProfile((prev) => {
      const exists = prev.preferredAesthetics.includes(tag);
      const updated = exists
        ? prev.preferredAesthetics.filter((t) => t !== tag)
        : [...prev.preferredAesthetics, tag];
      return { ...prev, preferredAesthetics: updated };
    });
  };

  const toggleColor = (hex: string) => {
    void triggerLightHaptic();
    setProfile((prev) => {
      const exists = prev.favoriteColors.includes(hex);
      const updated = exists
        ? prev.favoriteColors.filter((c) => c !== hex)
        : [...prev.favoriteColors, hex];
      return { ...prev, favoriteColors: updated };
    });
  };

  const handleSave = () => {
    void triggerMediumHaptic();
    saveUserStyleProfile(profile, userId);
    toast.success("Style preferences updated! ✨");
  };

  return (
    <div className="flex-1 w-full overflow-y-auto px-4 sm:px-8 py-6 max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-rose-500 font-extrabold text-xs uppercase tracking-wider">
          <Palette className="w-3.5 h-3.5" />
          <span>Style DNA</span>
        </div>
        <h2 className="font-display font-black text-2xl sm:text-3xl text-foreground tracking-tight">
          My Fashion Profile & Preferences
        </h2>
        <p className="text-sm text-muted-foreground">
          Tailor your virtual fitting room, sizing charts, and AI Stylist recommendations to your personal proportions and favorite aesthetics.
        </p>
      </div>

      {/* 1. Preferred Aesthetics */}
      <div className="space-y-3 p-5 rounded-3xl bg-card border border-border shadow-xs">
        <h3 className="font-display font-bold text-base text-foreground">
          Favorite Fashion Aesthetics
        </h3>
        <p className="text-xs text-muted-foreground">
          Select aesthetics you love to see prioritized in Discover and AI style suggestions.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {AVAILABLE_AESTHETICS.map((tag) => {
            const active = profile.preferredAesthetics.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleAesthetic(tag)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition flex items-center gap-1.5 ${
                  active
                    ? "bg-rose-500 text-white shadow-xs scale-102"
                    : "bg-secondary text-muted-foreground hover:text-foreground"
                }`}
              >
                {active && <Check className="w-3 h-3" />}
                <span>{tag}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Signature Color Palette */}
      <div className="space-y-3 p-5 rounded-3xl bg-card border border-border shadow-xs">
        <h3 className="font-display font-bold text-base text-foreground">
          Signature Color Palette
        </h3>
        <p className="text-xs text-muted-foreground">
          Tones you naturally gravitate towards when curating outfits.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-1">
          {PALETTE_OPTIONS.map((col) => {
            const active = profile.favoriteColors.includes(col.hex);
            return (
              <button
                key={col.hex}
                type="button"
                onClick={() => toggleColor(col.hex)}
                className={`p-2 rounded-2xl border text-left flex items-center gap-2 transition ${
                  active
                    ? "border-rose-500 bg-rose-500/10 font-bold"
                    : "border-border bg-secondary/50 hover:bg-secondary"
                }`}
              >
                <span
                  className="w-5 h-5 rounded-full border border-black/15 shadow-xs shrink-0"
                  style={{ backgroundColor: col.hex }}
                />
                <span className="text-xs truncate">{col.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Proportions & Standard Sizing */}
      <div className="space-y-4 p-5 rounded-3xl bg-card border border-border shadow-xs">
        <h3 className="font-display font-bold text-base text-foreground">
          Default Sizing & Measurements
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
          {/* Top Size */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">Top Size</label>
            <select
              value={profile.topSize}
              onChange={(e) => setProfile({ ...profile, topSize: e.target.value })}
              className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-rose-500"
            >
              {["XS", "S", "M", "L", "XL", "XXL"].map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Bottom Size */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">Bottom Size (Waist)</label>
            <select
              value={profile.bottomSize}
              onChange={(e) => setProfile({ ...profile, bottomSize: e.target.value })}
              className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-rose-500"
            >
              {["26", "28", "30", "32", "34", "36", "38"].map((s) => (
                <option key={s} value={s}>
                  {s} in
                </option>
              ))}
            </select>
          </div>

          {/* Shoe Size */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">Shoe Size (EU)</label>
            <select
              value={profile.shoeSize}
              onChange={(e) => setProfile({ ...profile, shoeSize: e.target.value })}
              className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-rose-500"
            >
              {["36", "37", "38", "39", "40", "41", "42", "43", "44", "45"].map((s) => (
                <option key={s} value={s}>
                  EU {s}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 4. Lifestyle & Budget */}
      <div className="space-y-4 p-5 rounded-3xl bg-card border border-border shadow-xs">
        <h3 className="font-display font-bold text-base text-foreground">
          Lifestyle & Price Segment
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">Location / Setting</label>
            <input
              type="text"
              value={profile.campusOrCity}
              onChange={(e) => setProfile({ ...profile, campusOrCity: e.target.value })}
              placeholder="e.g. UNILAG Campus, Brooklyn, Lekki, Shinjuku"
              className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-medium text-foreground focus:outline-none focus:border-rose-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-muted-foreground">Budget Focus</label>
            <select
              value={profile.budgetTier}
              onChange={(e) => setProfile({ ...profile, budgetTier: e.target.value as any })}
              className="w-full bg-secondary border border-border rounded-xl px-3 py-2 text-xs font-bold text-foreground focus:outline-none focus:border-rose-500"
            >
              <option value="Essential ($)">Essential ($ - Campus Thrift & High-Street)</option>
              <option value="Mid-Range ($$)">Mid-Range ($$ - Contemporary Indie Brands)</option>
              <option value="Luxury ($$$)">Luxury ($$$ - Runway & Designer Savile)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="pt-2 flex justify-end">
        <button
          type="button"
          onClick={handleSave}
          className="px-6 py-2.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-rose-500/30 hover:scale-105 active:scale-95 transition"
        >
          <Save className="w-4 h-4" />
          <span>Save Style DNA</span>
        </button>
      </div>
    </div>
  );
}
