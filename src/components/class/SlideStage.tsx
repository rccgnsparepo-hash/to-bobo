import React, { useEffect, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Upload,
  Radio,
  Eye,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { ClassSlide, ClassRole } from "@/lib/class/types";
import { convertPdfToSlides } from "@/lib/class/pdfSlideConverter";
import { toast } from "sonner";
import { triggerLightHaptic } from "@/lib/haptics";

interface Props {
  slides: ClassSlide[];
  lecturerSlideIndex: number;
  currentSlideIndex: number;
  role: ClassRole;
  lecturerName: string;
  slidesDownloadable: boolean;
  onSlideChange: (index: number) => void;
  onUploadSlides?: (newSlides: ClassSlide[]) => void;
  onToggleDownloadable?: (allowed: boolean) => void;
  onJumpToLecturer: () => void;
  isFollowingLecturer: boolean;
  nextSlideButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

export function SlideStage({
  slides,
  lecturerSlideIndex,
  currentSlideIndex,
  role,
  lecturerName,
  slidesDownloadable,
  onSlideChange,
  onUploadSlides,
  onToggleDownloadable,
  onJumpToLecturer,
  isFollowingLecturer,
  nextSlideButtonRef,
}: Props) {
  const [slideDirection, setSlideDirection] = useState<1 | -1>(1);
  const [isConvertingPdf, setIsConvertingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const touchStartXRef = useRef<number | null>(null);

  const canControl = role === "lecturer" || role === "co_host";
  const currentSlide = slides[currentSlideIndex] || slides[0];

  // Preload next 2 slides for instant 0ms latency rendering
  useEffect(() => {
    const next1 = slides[currentSlideIndex + 1]?.imageUrl;
    const next2 = slides[currentSlideIndex + 2]?.imageUrl;
    if (next1) {
      const img1 = new Image();
      img1.src = next1;
    }
    if (next2) {
      const img2 = new Image();
      img2.src = next2;
    }
  }, [currentSlideIndex, slides]);

  // Keyboard navigation: Left/Right arrows
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept when typing in notes or input fields
      if (
        document.activeElement?.tagName === "TEXTAREA" ||
        document.activeElement?.tagName === "INPUT"
      ) {
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNextSlide();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrevSlide();
      } else if (e.key.toLowerCase() === "j" && !isFollowingLecturer) {
        e.preventDefault();
        onJumpToLecturer();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentSlideIndex, slides.length, isFollowingLecturer]);

  const handleNextSlide = () => {
    if (currentSlideIndex < slides.length - 1) {
      void triggerLightHaptic();
      setSlideDirection(1);
      onSlideChange(currentSlideIndex + 1);
    }
  };

  const handlePrevSlide = () => {
    if (currentSlideIndex > 0) {
      void triggerLightHaptic();
      setSlideDirection(-1);
      onSlideChange(currentSlideIndex - 1);
    }
  };

  // Touch Swipe navigation
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const diff = touchStartXRef.current - e.changedTouches[0].clientX;
    touchStartXRef.current = null;

    if (diff > 50) {
      handleNextSlide();
    } else if (diff < -50) {
      handlePrevSlide();
    }
  };

  // Handle PDF/PPTX file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsConvertingPdf(true);
    toast.loading("Converting lecture slides...", { id: "pdf-conv" });

    try {
      const converted = await convertPdfToSlides(file);
      if (converted.length > 0 && onUploadSlides) {
        onUploadSlides(converted);
        toast.success(`Loaded ${converted.length} slides from "${file.name}"`, { id: "pdf-conv" });
      } else {
        toast.error("No pages found in uploaded presentation", { id: "pdf-conv" });
      }
    } catch {
      toast.error("Failed to convert presentation", { id: "pdf-conv" });
    } finally {
      setIsConvertingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const downloadCurrentSlide = () => {
    if (!currentSlide?.imageUrl) return;
    const a = document.createElement("a");
    a.href = currentSlide.imageUrl;
    a.download = `lecture_slide_${currentSlideIndex + 1}.png`;
    a.click();
    toast.success(`Downloaded Slide ${currentSlideIndex + 1}`);
  };

  return (
    <div className="flex flex-col gap-3 w-full h-full @container">
      {/* 16:9 Stage Container */}
      <div
        className="relative w-full aspect-video rounded-[18px] bg-[#141417] border border-[#2a2a32] overflow-hidden shadow-2xl flex items-center justify-center select-none"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Slide Content with Short 450ms Slide-and-Fade */}
        <AnimatePresence mode="popLayout" custom={slideDirection}>
          {currentSlide ? (
            <motion.div
              key={currentSlide.id || currentSlideIndex}
              custom={slideDirection}
              initial={{
                opacity: 0,
                x: slideDirection > 0 ? "8%" : "-8%",
              }}
              animate={{
                opacity: 1,
                x: 0,
              }}
              exit={{
                opacity: 0,
                x: slideDirection > 0 ? "-8%" : "8%",
              }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
              className="absolute inset-0 w-full h-full flex items-center justify-center bg-black/40"
            >
              <img
                src={currentSlide.imageUrl}
                alt={currentSlide.title || `Slide ${currentSlideIndex + 1}`}
                className="w-full h-full object-contain pointer-events-none"
              />
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 max-w-md">
              <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 grid place-items-center text-zinc-400">
                <Upload className="w-8 h-8 text-[#4a5cff]" />
              </div>
              <div>
                <h3 className="font-bricolage text-lg font-bold text-white">
                  {canControl ? "Upload Presentation Slides" : "Awaiting Lecture Slides"}
                </h3>
                <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
                  {canControl
                    ? "Upload your PDF lecture presentation or slides to broadcast live to students."
                    : "The lecturer has not loaded slides for this session yet. They will appear here in real-time once shared."}
                </p>
              </div>

              {canControl && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isConvertingPdf}
                  className="px-5 py-2.5 rounded-xl bg-[#4a5cff] hover:bg-[#3d4ee0] text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-[#4a5cff]/30 active:scale-95 transition"
                >
                  {isConvertingPdf ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  <span>{isConvertingPdf ? "Converting Slides..." : "Upload PDF Slides"}</span>
                </button>
              )}
            </div>
          )}
        </AnimatePresence>

        {/* Following Status & Jump Button Pill */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2">
          {isFollowingLecturer ? (
            <div className="px-3 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/10 text-xs font-mono font-medium text-zinc-300 flex items-center gap-1.5 shadow-lg">
              <span className="w-2 h-2 rounded-full bg-[#4a5cff] animate-pulse" />
              <span>Following {lecturerName}</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onJumpToLecturer}
              className="px-3.5 py-1.5 rounded-full bg-[#4a5cff] hover:bg-[#3d4ee6] text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-[0_0_15px_rgba(74,92,255,0.4)] active:scale-95 transition-all border border-white/20"
              title="Jump to lecturer's active slide (Hotkey: J)"
            >
              <Radio className="w-3.5 h-3.5 animate-pulse text-[#ff4f8b]" />
              <span>Jump to lecturer's slide ({lecturerSlideIndex + 1})</span>
            </button>
          )}

          {!isFollowingLecturer && (
            <div className="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-black/60 backdrop-blur-md text-xs font-mono text-zinc-400 border border-white/5">
              Browsing on your own
            </div>
          )}
        </div>

        {/* Top-Right Stage Controls: Download & Upload for Lecturer */}
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          {canControl && (
            <>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isConvertingPdf}
                className="px-3 py-1.5 rounded-full bg-black/75 hover:bg-black/90 backdrop-blur-md border border-white/10 hover:border-white/25 text-xs font-mono text-white flex items-center gap-1.5 transition active:scale-95 disabled:opacity-50"
                title="Upload PDF or presentation slides"
              >
                {isConvertingPdf ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#4a5cff]" />
                ) : (
                  <Upload className="w-3.5 h-3.5 text-[#4a5cff]" />
                )}
                <span>Upload Slides</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                hidden
                onChange={handleFileUpload}
              />
            </>
          )}

          {(slidesDownloadable || canControl) && (
            <button
              type="button"
              onClick={downloadCurrentSlide}
              className="p-2 rounded-full bg-black/75 hover:bg-black/90 backdrop-blur-md border border-white/10 hover:border-white/25 text-zinc-300 hover:text-white transition active:scale-95"
              title="Download current slide"
              aria-label="Download slide"
            >
              <Download className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Previous Slide Floating Arrow */}
        <button
          type="button"
          onClick={handlePrevSlide}
          disabled={currentSlideIndex === 0}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md border border-white/10 hover:border-white/25 text-white grid place-items-center transition active:scale-90 disabled:opacity-0 disabled:pointer-events-none"
          title="Previous Slide (Left Arrow)"
          aria-label="Previous Slide"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {/* Next Slide Floating Arrow */}
        <button
          ref={nextSlideButtonRef}
          type="button"
          onClick={handleNextSlide}
          disabled={currentSlideIndex === slides.length - 1}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-20 w-10 h-10 rounded-full bg-black/60 hover:bg-black/85 backdrop-blur-md border border-white/10 hover:border-white/25 text-white grid place-items-center transition active:scale-90 disabled:opacity-0 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[#4a5cff]"
          title="Next Slide (Right Arrow)"
          aria-label="Next Slide"
        >
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Bottom Slide Index Counter Bar */}
        {slides.length > 0 && (
          <div className="absolute bottom-3 inset-x-0 flex items-center justify-center pointer-events-none z-20">
            <div className="px-3.5 py-1 rounded-full bg-black/75 backdrop-blur-md border border-white/10 text-xs font-mono font-bold text-white shadow-md">
              Slide {currentSlideIndex + 1} of {slides.length}
            </div>
          </div>
        )}
      </div>

      {/* Slide Thumbnail Rail */}
      {slides.length > 0 && (
        <div className="w-full flex items-center gap-2.5 overflow-x-auto no-scrollbar py-1">
          {slides.map((s, idx) => {
            const isCurrent = idx === currentSlideIndex;
            const isLecturerActive = idx === lecturerSlideIndex;

            return (
              <button
                key={s.id || idx}
                type="button"
                onClick={() => {
                  void triggerLightHaptic();
                  setSlideDirection(idx > currentSlideIndex ? 1 : -1);
                  onSlideChange(idx);
                }}
                className={`relative shrink-0 w-24 sm:w-28 aspect-video rounded-[10px] overflow-hidden border transition-all active:scale-95 ${
                  isCurrent
                    ? "border-[#4a5cff] ring-2 ring-[#4a5cff]/40 shadow-md scale-105"
                    : "border-[#2a2a32] opacity-60 hover:opacity-100"
                }`}
                title={`Jump to slide ${idx + 1}`}
              >
                <img
                  src={s.imageUrl}
                  alt=""
                  className="w-full h-full object-cover bg-black"
                />
                <span className="absolute bottom-1 right-1 text-[10px] font-mono font-bold px-1.5 rounded bg-black/80 text-white">
                  {idx + 1}
                </span>

                {isLecturerActive && (
                  <span
                    className="absolute top-1 left-1 w-2.5 h-2.5 rounded-full bg-[#ff4f8b] animate-pulse border border-white/40"
                    title="Lecturer is here"
                  />
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
