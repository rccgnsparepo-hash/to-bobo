import { useState, useEffect, useRef } from "react";
import {
  BookOpen,
  Download,
  Eye,
  Upload,
  Search,
  Filter,
  Radio,
  FileText,
  ChevronLeft,
  ChevronRight,
  X,
  Sparkles,
  RefreshCw,
  HardDrive,
} from "lucide-react";
import { toast } from "sonner";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";
import { CampusStorageService } from "@/lib/class/campusStorageService";
import { convertPdfToSlides } from "@/lib/class/pdfSlideConverter";
import {
  COLLEGE_DEFINITIONS,
  type AcademicLevel,
  type AcademicProfile,
  type CampusCollege,
  type SlideBankDeck,
  type ClassSlide,
} from "@/lib/class/types";

interface Props {
  profile: AcademicProfile | null;
  onLaunchDeckInLiveRoom: (deck: SlideBankDeck) => void;
}

const COLLEGES: CampusCollege[] = ["CBAS", "CHMS", "CHAS"];
const LEVELS: AcademicLevel[] = [100, 200, 300, 400, 500, 600];

export function CampusSlideBankZone({ profile, onLaunchDeckInLiveRoom }: Props) {
  const [selectedCollege, setSelectedCollege] = useState<CampusCollege>(
    profile?.college || "CBAS"
  );
  const [selectedLevel, setSelectedLevel] = useState<AcademicLevel>(
    profile?.level || 100
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [decks, setDecks] = useState<SlideBankDeck[]>([]);

  // Slide Reader Modal
  const [readingDeck, setReadingDeck] = useState<SlideBankDeck | null>(null);
  const [readingPageIndex, setReadingPageIndex] = useState(0);

  // Upload Modal for Lecturers
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadCourseCode, setUploadCourseCode] = useState("");
  const [uploadCourseTitle, setUploadCourseTitle] = useState("");
  const [uploadDeckTitle, setUploadDeckTitle] = useState("");
  const [uploadDepartment, setUploadDepartment] = useState(
    COLLEGE_DEFINITIONS.CBAS.departments[0]
  );
  const [uploadLevel, setUploadLevel] = useState<AcademicLevel>(100);
  const [uploadedSlides, setUploadedSlides] = useState<ClassSlide[]>([]);
  const [isConverting, setIsConverting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadDecks = () => {
    const list = CampusStorageService.getSlideBank(
      selectedCollege,
      selectedLevel,
      searchQuery
    );
    setDecks(list);
  };

  useEffect(() => {
    loadDecks();
    window.addEventListener("flick:campus-slide-bank-updated", loadDecks);
    return () => window.removeEventListener("flick:campus-slide-bank-updated", loadDecks);
  }, [selectedCollege, selectedLevel, searchQuery]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsConverting(true);
    toast.loading("Converting PDF into slide pages...", { id: "bank-upload" });

    try {
      const slides = await convertPdfToSlides(file);
      if (slides.length > 0) {
        setUploadedSlides(slides);
        if (!uploadDeckTitle) {
          setUploadDeckTitle(file.name.replace(/\.[^/.]+$/, ""));
        }
        toast.success(`Extracted ${slides.length} slides!`, { id: "bank-upload" });
      }
    } catch {
      toast.error("Failed to parse PDF slides", { id: "bank-upload" });
    } finally {
      setIsConverting(false);
    }
  };

  const handleSaveDeck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadCourseCode.trim() || !uploadDeckTitle.trim()) {
      toast.error("Please fill in course code and lecture deck title.");
      return;
    }
    if (uploadedSlides.length === 0) {
      toast.error("Please upload a PDF presentation with at least one slide.");
      return;
    }

    void triggerMediumHaptic();
    const estBytes = uploadedSlides.length * 1024 * 750; // ~750KB per page

    CampusStorageService.addDeckToSlideBank({
      college: selectedCollege,
      level: uploadLevel,
      department: uploadDepartment,
      courseCode: uploadCourseCode.trim().toUpperCase(),
      courseTitle: uploadCourseTitle.trim() || uploadCourseCode.trim().toUpperCase(),
      deckTitle: uploadDeckTitle.trim(),
      slides: uploadedSlides,
      totalPages: uploadedSlides.length,
      fileSizeBytes: estBytes,
      uploadedBy: profile?.fullName || "Faculty Instructor",
      downloadable: true,
    });

    toast.success(`Slide deck saved to ${selectedCollege} Level ${uploadLevel} Bank! 📚`);
    setShowUploadModal(false);
    setUploadedSlides([]);
    setUploadCourseCode("");
    setUploadDeckTitle("");
    loadDecks();
  };

  const isLecturer = profile?.role === "lecturer";

  return (
    <div className="space-y-6">
      {/* College Switcher (CBAS, CHMS, CHAS) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold font-mono uppercase text-zinc-300 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-[#4a5cff]" />
            <span>Campus Slide Bank by College</span>
          </div>
          {isLecturer && (
            <button
              type="button"
              onClick={() => setShowUploadModal(true)}
              className="px-3.5 py-1.5 rounded-xl bg-[#4a5cff] hover:bg-[#3d4ee0] text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#4a5cff]/20 active:scale-95 transition"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Deposit Slides to Bank</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2">
          {COLLEGES.map((col) => {
            const isSelected = selectedCollege === col;
            return (
              <button
                key={col}
                type="button"
                onClick={() => {
                  void triggerLightHaptic();
                  setSelectedCollege(col);
                }}
                className={`p-3.5 rounded-2xl text-left border transition-all ${
                  isSelected
                    ? "bg-[#4a5cff]/20 border-[#4a5cff] shadow-lg shadow-[#4a5cff]/20 text-white"
                    : "bg-[#141417] border-[#2a2a32] text-zinc-400 hover:border-zinc-600"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bricolage text-base font-extrabold text-white">
                    {col}
                  </span>
                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-[#4a5cff] animate-ping" />
                  )}
                </div>
                <div className="text-[11px] text-zinc-300 font-medium mt-1 truncate">
                  {col === "CBAS"
                    ? "Basic & Applied Sciences"
                    : col === "CHMS"
                    ? "Humanities & Management"
                    : "Health & Allied Sciences"}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Levels Filter (100L to 600L) */}
      <div className="space-y-1.5">
        <label className="text-xs font-mono font-bold text-zinc-400 uppercase tracking-wider">
          Filter by Level
        </label>
        <div className="grid grid-cols-6 gap-2">
          {LEVELS.map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => {
                void triggerLightHaptic();
                setSelectedLevel(lvl);
              }}
              className={`py-2 rounded-xl text-xs font-bold font-mono transition border ${
                selectedLevel === lvl
                  ? "bg-[#4a5cff] text-white border-[#4a5cff] shadow-md shadow-[#4a5cff]/30"
                  : "bg-[#141417] text-zinc-400 border-[#2a2a32] hover:border-zinc-600"
              }`}
            >
              {lvl}L
            </button>
          ))}
        </div>
      </div>

      {/* Search Input */}
      <div className="relative">
        <Search className="w-4 h-4 text-zinc-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={`Search ${selectedCollege} ${selectedLevel}L slides by course code, topic, or instructor...`}
          className="w-full bg-[#141417] border border-[#2a2a32] rounded-xl pl-10 pr-4 py-2.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-[#4a5cff]"
        />
      </div>

      {/* Slide Bank Deck Grid */}
      <div className="space-y-3">
        {decks.length === 0 ? (
          <div className="py-12 px-6 rounded-2xl bg-[#141417] border border-[#2a2a32] text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-black/40 border border-[#2a2a32] text-zinc-500 grid place-items-center mx-auto">
              <FileText className="w-6 h-6" />
            </div>
            <h4 className="font-bricolage text-base font-bold text-white">
              No slide decks found in {selectedCollege} {selectedLevel}L
            </h4>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              Lecturers can deposit PDF presentations into the bank for students to read and download anytime.
            </p>
            {isLecturer && (
              <button
                type="button"
                onClick={() => setShowUploadModal(true)}
                className="px-4 py-2 rounded-xl bg-[#4a5cff] text-white font-bold text-xs shadow-md active:scale-95 transition"
              >
                Deposit First Slide Deck
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {decks.map((deck) => (
              <div
                key={deck.id}
                className="p-5 rounded-[20px] bg-[#141417] border border-[#2a2a32] hover:border-[#4a5cff]/50 space-y-4 shadow-lg transition flex flex-col justify-between"
              >
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#4a5cff]/20 text-[#8898ff] font-mono font-bold text-[11px] border border-[#4a5cff]/30">
                      {deck.courseCode} · {deck.level}L
                    </span>
                    <span className="text-zinc-400 text-[11px] font-mono">
                      {deck.totalPages} pages · {CampusStorageService.formatBytes(deck.fileSizeBytes)}
                    </span>
                  </div>

                  <h4 className="font-bricolage text-base font-bold text-white leading-snug">
                    {deck.deckTitle}
                  </h4>

                  <p className="text-xs text-zinc-400 line-clamp-1">
                    {deck.courseTitle}
                  </p>

                  <div className="text-[11px] text-zinc-500 font-mono">
                    Deposited by: <span className="text-zinc-300">{deck.uploadedBy}</span>
                  </div>
                </div>

                {/* Deck Action Buttons */}
                <div className="pt-3 border-t border-[#2a2a32] space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        void triggerLightHaptic();
                        setReadingDeck(deck);
                        setReadingPageIndex(0);
                      }}
                      className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-[#4a5cff]" />
                      <span>Read Online</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        void triggerLightHaptic();
                        const first = deck.slides[0]?.imageUrl;
                        if (first) {
                          const a = document.createElement("a");
                          a.href = first;
                          a.download = `${deck.courseCode}_slides.png`;
                          a.click();
                          toast.success(`Downloaded ${deck.courseCode} lecture slides!`);
                        }
                      }}
                      className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white text-xs font-mono flex items-center justify-center gap-1.5 active:scale-95 transition border border-white/10"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </button>
                  </div>

                  {isLecturer && (
                    <button
                      type="button"
                      onClick={() => onLaunchDeckInLiveRoom(deck)}
                      className="w-full py-2 rounded-xl bg-[#4a5cff] hover:bg-[#3d4ee0] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-[#4a5cff]/20 active:scale-95 transition cursor-pointer"
                    >
                      <Radio className="w-3.5 h-3.5 text-[#ff4f8b] animate-pulse" />
                      <span>Launch in Live Room</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FULL-SCREEN SLIDE READER MODAL */}
      {readingDeck && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 text-white select-none">
          {/* Reader Header */}
          <div className="flex items-center justify-between pb-3 border-b border-[#2a2a32]">
            <div className="space-y-0.5">
              <div className="text-xs font-mono text-[#8898ff] font-bold">
                {readingDeck.college} · {readingDeck.courseCode} ({readingDeck.level}L)
              </div>
              <h3 className="font-bricolage text-lg font-bold">
                {readingDeck.deckTitle}
              </h3>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const url = readingDeck.slides[readingPageIndex]?.imageUrl;
                  if (url) {
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `${readingDeck.courseCode}_slide_${readingPageIndex + 1}.png`;
                    a.click();
                    toast.success(`Downloaded Slide ${readingPageIndex + 1}`);
                  }
                }}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/15 text-zinc-300 hover:text-white transition"
                title="Download current slide"
              >
                <Download className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setReadingDeck(null)}
                className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 grid place-items-center text-zinc-300 hover:text-white transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Reader Main Stage 16:9 */}
          <div className="flex-1 flex items-center justify-center relative my-3 max-h-[75vh]">
            {readingDeck.slides[readingPageIndex] && (
              <img
                src={readingDeck.slides[readingPageIndex].imageUrl}
                alt={`Page ${readingPageIndex + 1}`}
                className="max-h-full max-w-full object-contain rounded-2xl border border-[#2a2a32] shadow-2xl bg-black"
              />
            )}

            {/* Left/Right Floating Arrows */}
            <button
              type="button"
              onClick={() => setReadingPageIndex((prev) => Math.max(0, prev - 1))}
              disabled={readingPageIndex === 0}
              className="absolute left-4 w-12 h-12 rounded-full bg-black/60 hover:bg-black/90 border border-white/10 text-white grid place-items-center transition active:scale-95 disabled:opacity-0"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <button
              type="button"
              onClick={() =>
                setReadingPageIndex((prev) =>
                  Math.min(readingDeck.slides.length - 1, prev + 1)
                )
              }
              disabled={readingPageIndex === readingDeck.slides.length - 1}
              className="absolute right-4 w-12 h-12 rounded-full bg-black/60 hover:bg-black/90 border border-white/10 text-white grid place-items-center transition active:scale-95 disabled:opacity-0"
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* Reader Footer Page Counter & Thumbnails */}
          <div className="flex flex-col items-center gap-2 pt-2 border-t border-[#2a2a32]">
            <div className="px-4 py-1 rounded-full bg-white/10 font-mono text-xs font-bold">
              Slide {readingPageIndex + 1} of {readingDeck.slides.length}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar max-w-xl py-1">
              {readingDeck.slides.map((s, idx) => (
                <button
                  key={s.id || idx}
                  type="button"
                  onClick={() => setReadingPageIndex(idx)}
                  className={`w-14 aspect-video rounded-lg overflow-hidden border transition ${
                    idx === readingPageIndex
                      ? "border-[#4a5cff] ring-2 ring-[#4a5cff]/50 scale-105"
                      : "border-[#2a2a32] opacity-50 hover:opacity-100"
                  }`}
                >
                  <img src={s.imageUrl} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* LECTURER DEPOSIT MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-[22px] bg-[#141417] border border-[#2a2a32] p-6 shadow-2xl text-white space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[#2a2a32]">
              <h3 className="font-bricolage text-lg font-bold">Deposit to Slide Bank</h3>
              <button
                type="button"
                onClick={() => setShowUploadModal(false)}
                className="w-7 h-7 rounded-full bg-white/5 border border-white/10 grid place-items-center text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveDeck} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-300">Course Code *</label>
                <input
                  type="text"
                  value={uploadCourseCode}
                  onChange={(e) => setUploadCourseCode(e.target.value)}
                  placeholder="e.g. CSC 301, ANA 201"
                  className="w-full bg-black/40 border border-[#2a2a32] rounded-xl px-3 py-2 text-xs text-white uppercase font-mono focus:border-[#4a5cff]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-300">Deck Title *</label>
                <input
                  type="text"
                  value={uploadDeckTitle}
                  onChange={(e) => setUploadDeckTitle(e.target.value)}
                  placeholder="e.g. Memory Architecture & Page Replacement"
                  className="w-full bg-black/40 border border-[#2a2a32] rounded-xl px-3 py-2 text-xs text-white focus:border-[#4a5cff]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-300">Level</label>
                <div className="grid grid-cols-6 gap-1">
                  {LEVELS.map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setUploadLevel(lvl)}
                      className={`py-1.5 rounded-lg text-xs font-mono font-bold border transition ${
                        uploadLevel === lvl
                          ? "bg-[#4a5cff] text-white border-[#4a5cff]"
                          : "bg-black/30 text-zinc-400 border-[#2a2a32]"
                      }`}
                    >
                      {lvl}L
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-300">PDF Slide Deck *</label>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isConverting}
                  className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-dashed border-white/20 text-xs font-mono flex items-center justify-center gap-2"
                >
                  {isConverting ? (
                    <RefreshCw className="w-4 h-4 animate-spin text-[#4a5cff]" />
                  ) : (
                    <Upload className="w-4 h-4 text-[#4a5cff]" />
                  )}
                  <span>
                    {isConverting
                      ? "Converting..."
                      : uploadedSlides.length > 0
                      ? `${uploadedSlides.length} slides loaded`
                      : "Select PDF presentation"}
                  </span>
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  hidden
                  onChange={handleFileUpload}
                />
              </div>

              <button
                type="submit"
                disabled={isConverting || uploadedSlides.length === 0}
                className="w-full py-3 rounded-xl bg-[#4a5cff] hover:bg-[#3d4ee0] text-white font-bold text-xs shadow-md shadow-[#4a5cff]/30 active:scale-95 transition disabled:opacity-50"
              >
                Save Deck to {selectedCollege} {uploadLevel}L Bank
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
