import React, { useMemo } from "react";
import { Sparkles, Check, SpellCheck } from "lucide-react";
import { getAutocorrectSuggestion, getWordPredictions } from "@/lib/autocorrect";

interface AutocorrectBarProps {
  currentText: string;
  onApplyCorrection: (newText: string) => void;
  className?: string;
}

export function AutocorrectBar({
  currentText,
  onApplyCorrection,
  className = "",
}: AutocorrectBarProps) {
  // Extract the active word currently being typed at the end of the text
  const lastWordInfo = useMemo(() => {
    if (!currentText) return null;
    const match = currentText.match(/([a-zA-Z0-9']+)\s*$/);
    if (!match) return null;
    return {
      word: match[1],
      index: match.index ?? (currentText.length - match[0].length),
      fullMatch: match[0],
    };
  }, [currentText]);

  const suggestion = useMemo(() => {
    if (!lastWordInfo) return null;
    return getAutocorrectSuggestion(lastWordInfo.word);
  }, [lastWordInfo]);

  const predictions = useMemo(() => {
    if (!lastWordInfo) return [];
    return getWordPredictions(lastWordInfo.word);
  }, [lastWordInfo]);

  if (!lastWordInfo || (!suggestion && predictions.length === 0)) {
    return null;
  }

  const applyWord = (replacement: string) => {
    if (!lastWordInfo) return;
    const prefix = currentText.slice(0, lastWordInfo.index);
    const suffix = currentText.slice(lastWordInfo.index + lastWordInfo.fullMatch.length);
    // Add trailing space so typing flow is natural
    const updated = `${prefix}${replacement} ${suffix}`;
    onApplyCorrection(updated);
  };

  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 bg-[#12141c]/95 border-t border-b border-white/10 backdrop-blur-md overflow-x-auto no-scrollbar animate-in fade-in duration-150 ${className}`}
    >
      <div className="flex items-center gap-1 text-[11px] font-bold text-snap shrink-0 mr-1">
        <Sparkles className="w-3 h-3 text-snap animate-pulse" />
        <span className="hidden sm:inline">Spell</span>
      </div>

      {suggestion && (
        <button
          type="button"
          onClick={() => applyWord(suggestion.suggestion)}
          className="px-2.5 py-1 rounded-full bg-snap text-black text-xs font-bold shadow-md hover:brightness-110 active:scale-95 transition flex items-center gap-1 shrink-0"
        >
          <Check className="w-3 h-3 stroke-[3]" />
          <span>"{suggestion.suggestion}"</span>
        </button>
      )}

      {predictions
        .filter((p) => !suggestion || p !== suggestion.suggestion)
        .map((pred, i) => (
          <button
            key={i}
            type="button"
            onClick={() => applyWord(pred)}
            className="px-2.5 py-1 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-medium active:scale-95 transition shrink-0"
          >
            {pred}
          </button>
        ))}

      <button
        type="button"
        onClick={() => applyWord(lastWordInfo.word)}
        className="ml-auto text-[10px] text-muted-foreground hover:text-white px-1.5 py-0.5 rounded transition shrink-0"
        title="Keep typed word"
      >
        Keep "{lastWordInfo.word}"
      </button>
    </div>
  );
}
