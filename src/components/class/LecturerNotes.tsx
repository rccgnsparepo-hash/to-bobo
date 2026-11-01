import { useState, useEffect, useRef } from "react";
import { Download, FileText, Check, Sparkles, Lock } from "lucide-react";
import type { ClassRole, NotesDiffEvent } from "@/lib/class/types";
import { toast } from "sonner";
import { triggerLightHaptic } from "@/lib/haptics";

interface Props {
  roomId: string;
  initialNotes: string;
  role: ClassRole;
  isLecturerTyping: boolean;
  notesDownloadable: boolean;
  onNotesChange?: (text: string) => void;
  onToggleDownloadable?: (allowed: boolean) => void;
  senderId: string;
}

export function LecturerNotes({
  roomId,
  initialNotes,
  role,
  isLecturerTyping,
  notesDownloadable,
  onNotesChange,
  onToggleDownloadable,
  senderId,
}: Props) {
  const [notes, setNotes] = useState(initialNotes);
  const [isCopied, setIsCopied] = useState(false);
  const debounceTimerRef = useRef<number | null>(null);
  const typingTimerRef = useRef<number | null>(null);
  const canEdit = role === "lecturer" || role === "co_host";

  // Sync when initialNotes updates from external / late-joiner state
  useEffect(() => {
    setNotes(initialNotes);
  }, [initialNotes]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextText = e.target.value;
    setNotes(nextText);

    // 50ms debounce for high-performance diff/keystroke broadcast
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = window.setTimeout(() => {
      if (onNotesChange) {
        onNotesChange(nextText);
      }
    }, 50);
  };

  const exportMarkdown = () => {
    void triggerLightHaptic();
    const blob = new Blob([notes], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `lecture_notes_${roomId.slice(-6)}.md`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported lecture notes as Markdown (.md)");
  };

  const copyNotes = async () => {
    void triggerLightHaptic();
    await navigator.clipboard.writeText(notes);
    setIsCopied(true);
    toast.success("Notes copied to clipboard");
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="flex flex-col h-full rounded-[18px] bg-[#141417] border border-[#2a2a32] overflow-hidden shadow-lg select-text">
      {/* Panel Header */}
      <div className="p-3.5 border-b border-[#2a2a32] flex items-center justify-between gap-2 shrink-0 bg-black/20">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#4a5cff]" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-white">
            Lecturer's Notes
          </h3>
          {isLecturerTyping && (
            <span className="flex items-center gap-1 text-[11px] font-mono text-[#ff4f8b] animate-pulse">
              <span className="w-1.5 h-1.5 rounded-full bg-[#ff4f8b]" />
              typing…
            </span>
          )}
        </div>

        {/* Actions: Export Markdown / Toggle Download */}
        <div className="flex items-center gap-1.5">
          {canEdit && onToggleDownloadable && (
            <button
              type="button"
              onClick={() => {
                void triggerLightHaptic();
                onToggleDownloadable(!notesDownloadable);
                toast(
                  notesDownloadable
                    ? "Student notes download disabled"
                    : "Student notes download enabled"
                );
              }}
              className={`p-1.5 rounded-lg border text-xs font-mono transition ${
                notesDownloadable
                  ? "bg-[#4a5cff]/15 border-[#4a5cff]/30 text-[#8898ff]"
                  : "bg-white/5 border-white/10 text-zinc-500"
              }`}
              title={
                notesDownloadable
                  ? "Students can export notes (Click to restrict)"
                  : "Notes export locked for students (Click to permit)"
              }
            >
              {notesDownloadable ? (
                <Download className="w-3.5 h-3.5" />
              ) : (
                <Lock className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {(notesDownloadable || canEdit) && (
            <button
              type="button"
              onClick={exportMarkdown}
              className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white transition active:scale-95"
              title="Download notes as Markdown (.md)"
              aria-label="Export notes as Markdown"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={copyNotes}
            className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white transition active:scale-95"
            title="Copy notes"
            aria-label="Copy notes"
          >
            {isCopied ? <Check className="w-3.5 h-3.5 text-[#C5E863]" /> : <FileText className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {/* CRITICAL: aria-live="off" on the notes stream so screen readers aren't flooded */}
      <div className="flex-1 p-4 overflow-y-auto" aria-live="off" aria-atomic="false">
        {canEdit ? (
          <textarea
            value={notes}
            onChange={handleTextChange}
            placeholder="Type live lecture notes, equations, and code snippets here. Students follow your keystrokes in real time..."
            className="w-full h-full bg-transparent resize-none focus:outline-none font-instrument-serif text-[22px] leading-relaxed text-zinc-200 placeholder:text-zinc-600 focus:ring-0"
            spellCheck={false}
          />
        ) : (
          <div className="font-instrument-serif text-[22px] leading-relaxed text-zinc-200 whitespace-pre-wrap select-text">
            {notes || "The lecturer hasn't started writing notes yet..."}
            {isLecturerTyping && (
              <span className="inline-block w-2 h-5 bg-[#4a5cff] ml-1 align-middle animate-pulse" />
            )}
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-3.5 py-2 border-t border-[#2a2a32] bg-black/30 flex items-center justify-between text-[11px] font-mono text-zinc-500">
        <span>{canEdit ? "Lecturer Mode (Editable)" : "Student View (Live Feed)"}</span>
        <span>{notes.length} characters</span>
      </div>
    </div>
  );
}
