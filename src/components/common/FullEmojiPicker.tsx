import React, { useEffect, useRef } from "react";
import EmojiPicker, { EmojiClickData, Theme, Categories } from "emoji-picker-react";
import { X, Smile } from "lucide-react";

interface FullEmojiPickerProps {
  onSelectEmoji: (emoji: string) => void;
  onClose?: () => void;
  className?: string;
  height?: number | string;
  width?: number | string;
}

export function FullEmojiPicker({
  onSelectEmoji,
  onClose,
  className = "",
  height = 380,
  width = 340,
}: FullEmojiPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside if onClose provided
  useEffect(() => {
    if (!onClose) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    onSelectEmoji(emojiData.emoji);
  };

  return (
    <div
      ref={containerRef}
      className={`relative z-50 rounded-2xl overflow-hidden shadow-2xl border border-white/10 bg-[#161618] text-white flex flex-col ${className}`}
      style={{ width: typeof width === "number" ? `${width}px` : width }}
    >
      {/* Header bar with WhatsApp style branding and close */}
      <div className="flex items-center justify-between px-3.5 py-2 border-b border-white/10 bg-[#1f1f23] text-xs font-semibold text-zinc-300">
        <div className="flex items-center gap-1.5 text-snap">
          <Smile className="w-4 h-4" />
          <span className="text-white text-xs font-bold tracking-tight">Emojis & Reactions</span>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full text-zinc-400 hover:text-white hover:bg-white/10 transition"
            title="Close emoji keyboard"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="w-full overflow-hidden">
        <EmojiPicker
          onEmojiClick={handleEmojiClick}
          theme={Theme.DARK}
          height={height}
          width="100%"
          searchPlaceHolder="Search all emojis..."
          previewConfig={{
            showPreview: true,
          }}
          skinTonesDisabled={false}
          autoFocusSearch={false}
          lazyLoadEmojis={true}
        />
      </div>
    </div>
  );
}
