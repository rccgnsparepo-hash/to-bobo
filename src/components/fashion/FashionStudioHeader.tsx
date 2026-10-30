import React from "react";
import { ArrowLeft, Sparkles, Bookmark, Share2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { triggerLightHaptic } from "@/lib/haptics";

export type StudioTab = "studio" | "discover" | "wardrobe" | "style";

interface Props {
  activeTab: StudioTab;
  onTabChange: (tab: StudioTab) => void;
  currency: "CNY" | "USD" | "NGN";
  onCurrencyToggle: () => void;
  onOpenAiStylist: () => void;
  onOpenShareModal: () => void;
  onSaveOutfit: () => void;
  isSaved?: boolean;
}

export function FashionStudioHeader({
  activeTab,
  onTabChange,
  currency,
  onCurrencyToggle,
  onOpenAiStylist,
  onOpenShareModal,
  onSaveOutfit,
  isSaved = false,
}: Props) {
  const navigate = useNavigate();

  const handleTabClick = (tab: StudioTab) => {
    void triggerLightHaptic();
    onTabChange(tab);
  };

  return (
    <header className="relative z-30 shrink-0 w-full px-4 sm:px-6 pt-3 pb-2.5 flex items-center justify-between border-b border-black/5 dark:border-white/5 bg-background/80 backdrop-blur-xl transition-all">
      {/* Left: Back & Branding */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate("/")}
          className="w-9 h-9 rounded-full bg-secondary/80 hover:bg-secondary border border-border grid place-items-center text-foreground hover:scale-105 active:scale-95 transition shadow-xs"
          title="Back to Flick"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="hidden sm:block">
          <div className="flex items-center gap-1.5">
            <span className="font-display font-black text-sm tracking-tight text-foreground">
              flick<span className="text-rose-500">.</span>fashion
            </span>
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest px-1.5 py-0.5 rounded-md bg-secondary text-xs">
              Studio
            </span>
          </div>
        </div>
      </div>

      {/* Center: Internal Destination Tabs */}
      <nav className="flex items-center gap-1 p-1 rounded-full bg-secondary/90 border border-border shadow-inner">
        {(
          [
            { id: "studio", label: "Studio" },
            { id: "discover", label: "Discover" },
            { id: "wardrobe", label: "Wardrobe" },
            { id: "style", label: "My Style" },
          ] as const
        ).map((t) => {
          const active = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => handleTabClick(t.id)}
              className={`px-3 sm:px-4 py-1.5 rounded-full text-xs font-bold transition-all ${
                active
                  ? "bg-background text-foreground shadow-xs scale-100"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* Right: Studio Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Currency Switcher */}
        <button
          type="button"
          onClick={() => {
            void triggerLightHaptic();
            onCurrencyToggle();
          }}
          className="h-9 px-2.5 rounded-full bg-secondary/80 hover:bg-secondary border border-border grid place-items-center text-xs font-mono font-bold text-foreground hover:scale-105 active:scale-95 transition shadow-xs"
          title="Switch currency (¥ CNY, $ USD, ₦ NGN)"
        >
          {currency === "CNY" ? "¥ CNY" : currency === "USD" ? "$ USD" : "₦ NGN"}
        </button>

        {/* AI Stylist Trigger */}
        <button
          type="button"
          onClick={() => {
            void triggerLightHaptic();
            onOpenAiStylist();
          }}
          className="h-9 px-3 rounded-full bg-rose-500 hover:bg-rose-600 text-white flex items-center gap-1.5 text-xs font-bold shadow-md shadow-rose-500/20 hover:scale-105 active:scale-95 transition"
          title="AI Fashion Stylist"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span className="hidden md:inline">AI Stylist</span>
        </button>

        {/* Share Outfit to Chat */}
        <button
          type="button"
          onClick={() => {
            void triggerLightHaptic();
            onOpenShareModal();
          }}
          className="w-9 h-9 rounded-full bg-secondary/80 hover:bg-secondary border border-border grid place-items-center text-foreground hover:scale-105 active:scale-95 transition shadow-xs"
          title="Share look with a friend or post"
        >
          <Share2 className="w-4 h-4" />
        </button>

        {/* Save to Wardrobe */}
        <button
          type="button"
          onClick={() => {
            void triggerLightHaptic();
            onSaveOutfit();
          }}
          className={`w-9 h-9 rounded-full border grid place-items-center transition shadow-xs ${
            isSaved
              ? "bg-rose-500 border-rose-500 text-white"
              : "bg-secondary/80 hover:bg-secondary border-border text-foreground hover:scale-105 active:scale-95"
          }`}
          title="Save look to Wardrobe"
        >
          <Bookmark className={`w-4 h-4 ${isSaved ? "fill-white" : ""}`} />
        </button>
      </div>
    </header>
  );
}
