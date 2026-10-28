import { Sparkles, Bookmark, Compass, UserCheck, ArrowLeft, Bot, Save, Share2 } from "lucide-react";
import { motion } from "framer-motion";
import { triggerLightHaptic } from "@/lib/haptics";
import { useNavigate } from "react-router-dom";

export type FashionView = "studio" | "discover" | "wardrobe" | "my_style";

interface Props {
  currentView: FashionView;
  onViewChange: (view: FashionView) => void;
  currency: "USD" | "CNY" | "NGN";
  onCurrencyToggle: () => void;
  onOpenAiStylist: () => void;
  onOpenSaveOutfit: () => void;
  onOpenShareOutfit: () => void;
  savedCount: number;
}

export function FashionStudioNav({
  currentView,
  onViewChange,
  currency,
  onCurrencyToggle,
  onOpenAiStylist,
  onOpenSaveOutfit,
  onOpenShareOutfit,
  savedCount,
}: Props) {
  const navigate = useNavigate();

  const navItems: { id: FashionView; label: string; icon: typeof Sparkles; badge?: number }[] = [
    { id: "studio", label: "Studio", icon: Sparkles },
    { id: "discover", label: "Discover", icon: Compass },
    { id: "wardrobe", label: "Wardrobe", icon: Bookmark, badge: savedCount },
    { id: "my_style", label: "My Style", icon: UserCheck },
  ];

  return (
    <header className="relative z-30 w-full px-4 pt-3 pb-2.5 border-b border-black/5 dark:border-white/10 bg-white/75 dark:bg-zinc-900/80 backdrop-blur-xl shrink-0">
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-3">
        {/* Left: Back button & Title */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="w-9 h-9 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 grid place-items-center text-foreground transition active:scale-95"
            title="Return to Home"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h1 className="font-display font-bold text-sm sm:text-base tracking-tight leading-none text-foreground flex items-center gap-1.5">
              <span>Flick Fashion Studio</span>
              <span className="hidden sm:inline-block text-[10px] uppercase font-mono px-1.5 py-0.5 rounded-full bg-rose-500/15 text-rose-500 font-bold">
                PRO
              </span>
            </h1>
            <p className="text-[10px] text-muted-foreground hidden sm:block">
              Virtual outfit builder & digital wardrobe
            </p>
          </div>
        </div>

        {/* Center: Clean 4-View Segmented Navigation */}
        <nav className="flex items-center p-1 rounded-full bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10">
          {navItems.map((item) => {
            const active = currentView === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  void triggerLightHaptic();
                  onViewChange(item.id);
                }}
                className={`relative px-3 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  active
                    ? "bg-white dark:bg-zinc-800 text-foreground shadow-sm font-bold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${active ? "text-rose-500" : ""}`} />
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-rose-500/10 text-rose-500 font-mono font-bold">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Right: Quick actions & currency toggle */}
        <div className="flex items-center gap-1.5">
          {/* AI Stylist */}
          <button
            type="button"
            onClick={onOpenAiStylist}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-gradient-to-r from-rose-500 to-amber-500 text-white text-xs font-bold shadow-sm shadow-rose-500/20 hover:opacity-95 active:scale-95 transition"
            title="Consult AI Stylist"
          >
            <Bot className="w-3.5 h-3.5" />
            <span className="hidden md:inline">AI Stylist</span>
          </button>

          {/* Save Outfit */}
          {currentView === "studio" && (
            <>
              <button
                type="button"
                onClick={onOpenSaveOutfit}
                className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 grid place-items-center text-foreground transition active:scale-95"
                title="Save look to wardrobe"
              >
                <Save className="w-4 h-4 text-emerald-500" />
              </button>
              <button
                type="button"
                onClick={onOpenShareOutfit}
                className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 grid place-items-center text-foreground transition active:scale-95"
                title="Share look in private chat"
              >
                <Share2 className="w-4 h-4 text-blue-500" />
              </button>
            </>
          )}

          {/* Currency Toggle */}
          <button
            type="button"
            onClick={onCurrencyToggle}
            className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/15 grid place-items-center text-xs font-mono font-bold text-foreground transition active:scale-95"
            title={`Currency: ${currency} (Click to switch)`}
          >
            {currency === "CNY" ? "¥" : currency === "USD" ? "$" : "₦"}
          </button>
        </div>
      </div>
    </header>
  );
}
