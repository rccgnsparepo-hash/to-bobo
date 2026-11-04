import { useState, useRef } from "react";
import { X, GraduationCap, Upload, Sparkles, ArrowRight, BookOpen, School } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { convertPdfToSlides } from "@/lib/class/pdfSlideConverter";
import type { ClassSlide, AcademicLevel } from "@/lib/class/types";
import { toast } from "sonner";
import { triggerMediumHaptic } from "@/lib/haptics";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  defaultLevel?: AcademicLevel;
  defaultDepartment?: string;
  onCreateRoom: (params: {
    title: string;
    courseCode?: string;
    academicLevel?: AcademicLevel;
    department?: string;
    slides: ClassSlide[];
    slidesDownloadable: boolean;
    notesDownloadable: boolean;
  }) => Promise<void>;
}

const LEVELS: AcademicLevel[] = [100, 200, 300, 400, 500, 600];

export function CreateClassModal({
  isOpen,
  onClose,
  defaultLevel = 100,
  defaultDepartment = "Computer Science",
  onCreateRoom,
}: Props) {
  const [title, setTitle] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [level, setLevel] = useState<AcademicLevel>(defaultLevel);
  const [department, setDepartment] = useState(defaultDepartment);
  const [slides, setSlides] = useState<ClassSlide[]>([]); // Clean: Zero decoy slides
  const [slidesDownloadable, setSlidesDownloadable] = useState(true);
  const [notesDownloadable, setNotesDownloadable] = useState(true);
  const [isConvertingPdf, setIsConvertingPdf] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsConvertingPdf(true);
    toast.loading("Converting lecture slides to presentation...", { id: "pdf-conv-modal" });

    try {
      const converted = await convertPdfToSlides(file);
      if (converted.length > 0) {
        setSlides(converted);
        if (!title) {
          setTitle(file.name.replace(/\.[^/.]+$/, ""));
        }
        toast.success(`Converted ${converted.length} slides ready for lecture!`, { id: "pdf-conv-modal" });
      }
    } catch {
      toast.error("Failed to convert PDF slides", { id: "pdf-conv-modal" });
    } finally {
      setIsConvertingPdf(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Please enter a lecture title");
      return;
    }

    setIsSubmitting(true);
    void triggerMediumHaptic();

    try {
      await onCreateRoom({
        title: title.trim(),
        courseCode: courseCode.trim() || undefined,
        academicLevel: level,
        department: department.trim() || undefined,
        slides,
        slidesDownloadable,
        notesDownloadable,
      });
      onClose();
    } catch {
      toast.error("Failed to create class room");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto no-scrollbar">
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.94 }}
          className="w-full max-w-lg rounded-[20px] bg-[#141417] border border-[#2a2a32] p-6 shadow-2xl text-white space-y-5 my-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 border-b border-[#2a2a32]">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-[12px] bg-[#4a5cff]/20 text-[#8898ff] border border-[#4a5cff]/30 grid place-items-center">
                <GraduationCap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bricolage text-xl font-bold uppercase tracking-tight">
                  Launch Live Lecture
                </h3>
                <p className="text-xs font-mono text-zinc-400">
                  Campus Lecture Hub · Real-Time Slide & Voice Room
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/10 text-zinc-400 hover:text-white transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-zinc-300 mb-1.5">
                Lecture Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Memory Management & Paging"
                required
                className="w-full bg-black/50 border border-[#2a2a32] rounded-[12px] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#4a5cff]"
              />
            </div>

            {/* Course Code & Academic Level */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono font-bold uppercase text-zinc-300 mb-1.5">
                  Course Code
                </label>
                <input
                  type="text"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
                  placeholder="e.g. CSC 301"
                  className="w-full bg-black/50 border border-[#2a2a32] rounded-[12px] px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-[#4a5cff] font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-bold uppercase text-zinc-300 mb-1.5 flex items-center justify-between">
                  <span>Level</span>
                  <span className="text-[#8898ff]">{level}L</span>
                </label>
                <div className="grid grid-cols-6 gap-1">
                  {LEVELS.map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setLevel(lvl)}
                      className={`py-2 rounded-lg text-xs font-bold font-mono transition border ${
                        level === lvl
                          ? "bg-[#4a5cff] text-white border-[#4a5cff]"
                          : "bg-black/30 text-zinc-400 border-[#2a2a32]"
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Slides Presentation */}
            <div>
              <label className="block text-xs font-mono font-bold uppercase text-zinc-300 mb-1.5">
                Upload Slides ({slides.length} slides attached)
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isConvertingPdf}
                  className="flex-1 py-3 px-4 rounded-[12px] bg-white/5 hover:bg-white/10 border border-dashed border-white/20 text-xs font-mono text-zinc-300 hover:text-white flex items-center justify-center gap-2 transition active:scale-95"
                >
                  <Upload className="w-4 h-4 text-[#4a5cff]" />
                  <span>
                    {isConvertingPdf
                      ? "Converting PDF..."
                      : slides.length > 0
                      ? `Replace Slides (${slides.length} loaded)`
                      : "Upload Presentation Slides (PDF)"}
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  hidden
                  onChange={handleFileUpload}
                />
              </div>
            </div>

            {/* Permissions Toggles */}
            <div className="space-y-2 pt-1 border-t border-[#2a2a32]">
              <label className="flex items-center justify-between text-xs text-zinc-300 cursor-pointer p-2 rounded-lg hover:bg-white/5">
                <span className="font-mono">Allow students to download slides</span>
                <input
                  type="checkbox"
                  checked={slidesDownloadable}
                  onChange={(e) => setSlidesDownloadable(e.target.checked)}
                  className="rounded border-zinc-700 text-[#4a5cff] focus:ring-[#4a5cff]"
                />
              </label>

              <label className="flex items-center justify-between text-xs text-zinc-300 cursor-pointer p-2 rounded-lg hover:bg-white/5">
                <span className="font-mono">Allow students to export lecturer notes</span>
                <input
                  type="checkbox"
                  checked={notesDownloadable}
                  onChange={(e) => setNotesDownloadable(e.target.checked)}
                  className="rounded border-zinc-700 text-[#4a5cff] focus:ring-[#4a5cff]"
                />
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="w-full py-3.5 rounded-[14px] bg-[#4a5cff] hover:bg-[#3d4ee0] text-white font-bold text-sm tracking-wide shadow-lg shadow-[#4a5cff]/30 transition active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isSubmitting ? "Launching Room..." : "Launch Live Lecture & Bridge"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
