import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Plus, X, Check } from "lucide-react";

export const DEFAULT_QUICK_REPLIES = ["lol", "🔥", "nice", "😂", "❤️", "bet"];
const STORAGE_KEY = "flick:custom_quick_replies";

export function getSavedQuickReplies(): string[] {
  if (typeof window === "undefined") return DEFAULT_QUICK_REPLIES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_QUICK_REPLIES;
    const list = JSON.parse(raw);
    return Array.isArray(list) && list.length ? list : DEFAULT_QUICK_REPLIES;
  } catch {
    return DEFAULT_QUICK_REPLIES;
  }
}

export function saveQuickReplies(list: string[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {}
}

interface QuickRepliesBarProps {
  onSelect: (reply: string) => void;
  onClose?: () => void;
  align?: "left" | "right";
}

export function QuickRepliesBar({ onSelect, onClose, align = "left" }: QuickRepliesBarProps) {
  const [replies, setReplies] = useState<string[]>(() => getSavedQuickReplies());
  const [isAdding, setIsAdding] = useState(false);
  const [newText, setNewText] = useState("");
  const isSubmittingRef = useRef(false);

  const handleSend = (text: string) => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    onSelect(text);
    if (onClose) onClose();
    setTimeout(() => {
      isSubmittingRef.current = false;
    }, 600);
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newText.trim();
    if (!trimmed) return;
    if (!replies.includes(trimmed)) {
      const updated = [...replies, trimmed];
      setReplies(updated);
      saveQuickReplies(updated);
    }
    setNewText("");
    setIsAdding(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: 6 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={`absolute bottom-full mb-2 z-40 bg-[#12141c]/95 backdrop-blur-2xl border border-white/15 p-1.5 rounded-2xl shadow-2xl flex items-center gap-1.5 ${
        align === "right" ? "right-0" : "left-0"
      }`}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-1.5 pl-2">
        <Zap className="w-3 h-3 text-snap" />
        <span className="hidden sm:inline">Quick</span>
      </div>

      <div className="flex items-center gap-1 overflow-x-auto max-w-[280px] sm:max-w-[340px] scrollbar-none py-0.5">
        {replies.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => handleSend(r)}
            className="px-2.5 py-1 text-xs font-semibold bg-white/10 hover:bg-snap hover:text-snap-foreground text-white rounded-xl transition duration-150 active:scale-95 shrink-0 border border-white/5 shadow-sm"
          >
            {r}
          </button>
        ))}
      </div>

      {isAdding ? (
        <form onSubmit={handleAddCustom} className="flex items-center gap-1 pl-1">
          <input
            type="text"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="Add…"
            maxLength={18}
            autoFocus
            className="w-16 px-2 py-0.5 text-xs bg-white/15 text-white rounded-lg border border-white/20 focus:outline-none focus:ring-1 focus:ring-snap"
          />
          <button
            type="submit"
            className="p-1 rounded-lg bg-snap text-snap-foreground hover:opacity-90"
            title="Save custom reply"
          >
            <Check className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={() => setIsAdding(false)}
            className="p-1 rounded-lg text-zinc-400 hover:text-white"
          >
            <X className="w-3 h-3" />
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="p-1.5 rounded-xl bg-white/5 hover:bg-white/15 text-zinc-400 hover:text-white transition"
          title="Add custom quick reply"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      )}

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-xl hover:bg-white/10 text-zinc-400 hover:text-white transition ml-0.5"
          aria-label="Close quick replies"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </motion.div>
  );
}
