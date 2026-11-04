import { useState, useEffect } from "react";
import {
  Calendar,
  Clock,
  BookOpen,
  Plus,
  Radio,
  MapPin,
  ArrowRight,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";
import { CampusStorageService } from "@/lib/class/campusStorageService";
import type {
  AcademicLevel,
  AcademicProfile,
  CampusTimetableSlot,
} from "@/lib/class/types";

interface Props {
  profile: AcademicProfile | null;
  onGoLiveWithCourse: (slot: {
    courseCode: string;
    title: string;
    level: AcademicLevel;
    department: string;
  }) => void;
  onJoinRoomByCode: (code: string) => void;
}

const LEVELS: AcademicLevel[] = [100, 200, 300, 400, 500, 600];
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

export function CampusTimetableZone({
  profile,
  onGoLiveWithCourse,
  onJoinRoomByCode,
}: Props) {
  const [selectedLevel, setSelectedLevel] = useState<AcademicLevel>(
    profile?.level || 100
  );
  const [selectedDay, setSelectedDay] = useState<string>("Monday");
  const [timetable, setTimetable] = useState<CampusTimetableSlot[]>([]);

  // Modal for lecturer adding slot
  const [showAddModal, setShowAddModal] = useState(false);
  const [courseCode, setCourseCode] = useState("");
  const [courseTitle, setCourseTitle] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [venue, setVenue] = useState("Virtual Lecture Hall 1");

  useEffect(() => {
    const load = () => {
      setTimetable(CampusStorageService.getTimetable(selectedLevel, selectedDay));
    };
    load();
    window.addEventListener("flick:campus-timetable-updated", load);
    return () => {
      window.removeEventListener("flick:campus-timetable-updated", load);
    };
  }, [selectedLevel, selectedDay]);

  const handleAddSlot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseCode.trim() || !courseTitle.trim()) {
      toast.error("Please enter course code and title");
      return;
    }

    void triggerMediumHaptic();
    CampusStorageService.addTimetableSlot({
      courseCode: courseCode.trim().toUpperCase(),
      courseTitle: courseTitle.trim(),
      department: profile?.department || "General Sciences",
      level: selectedLevel,
      lecturerName: profile?.fullName || "Instructor",
      lecturerId: profile?.id,
      dayOfWeek: selectedDay as any,
      startTime,
      endTime,
      venue: venue.trim() || "Virtual Hall",
    });

    toast.success(`Course ${courseCode.toUpperCase()} added to ${selectedLevel}L ${selectedDay} timetable!`);
    setShowAddModal(false);
    setCourseCode("");
    setCourseTitle("");
  };

  const isLecturer = profile?.role === "lecturer";

  return (
    <div className="space-y-6">

      {/* Level Selector Tabs (100L to 600L) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold text-zinc-300 flex items-center gap-1.5 font-mono uppercase tracking-wider">
            <BookOpen className="w-3.5 h-3.5 text-[#4a5cff]" />
            <span>Select Academic Level</span>
          </div>
          {isLecturer && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="px-3 py-1.5 rounded-xl bg-[#4a5cff] hover:bg-[#3d4ee0] text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-[#4a5cff]/20 active:scale-95 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Lecture to Timetable</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-6 gap-2">
          {LEVELS.map((lvl) => (
            <button
              key={lvl}
              type="button"
              onClick={() => {
                void triggerLightHaptic();
                setSelectedLevel(lvl);
              }}
              className={`py-2.5 rounded-[14px] text-xs font-bold font-mono transition border ${
                selectedLevel === lvl
                  ? "bg-[#4a5cff] text-white border-[#4a5cff] shadow-md shadow-[#4a5cff]/30"
                  : "bg-[#141417] text-zinc-400 border-[#2a2a32] hover:border-zinc-500"
              }`}
            >
              {lvl} Level
            </button>
          ))}
        </div>
      </div>

      {/* Days of the Week Filter */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {DAYS.map((day) => (
          <button
            key={day}
            type="button"
            onClick={() => {
              void triggerLightHaptic();
              setSelectedDay(day);
            }}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-mono transition shrink-0 border ${
              selectedDay === day
                ? "bg-white/10 text-white border-white/20 font-bold"
                : "bg-black/20 text-zinc-400 border-[#2a2a32] hover:text-zinc-300"
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      {/* Timetable Schedule Grid */}
      <div className="space-y-3">
        {timetable.length === 0 ? (
          <div className="py-12 px-6 rounded-[18px] bg-[#141417] border border-[#2a2a32] text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-black/40 border border-[#2a2a32] text-zinc-500 grid place-items-center mx-auto">
              <Calendar className="w-6 h-6" />
            </div>
            <h4 className="font-bricolage text-base font-bold text-white">
              No classes scheduled for {selectedLevel}L on {selectedDay}
            </h4>
            <p className="text-xs text-zinc-400 max-w-md mx-auto">
              Everything in this campus lecture zone is strictly real. As professors upload timetables and course schedules, they will appear here.
            </p>
            {isLecturer && (
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 rounded-xl bg-[#4a5cff] text-white font-bold text-xs shadow-md active:scale-95 transition"
              >
                Schedule First {selectedLevel}L Lecture
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {timetable.map((slot) => (
              <div
                key={slot.id}
                className="p-4 rounded-[18px] bg-[#141417] border border-[#2a2a32] space-y-3 shadow-md flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#4a5cff]/20 text-[#8898ff] font-mono font-bold text-[11px] border border-[#4a5cff]/30">
                      {slot.courseCode} · {slot.level}L
                    </span>
                    <span className="text-zinc-400 text-xs font-mono flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{slot.startTime} - {slot.endTime}</span>
                    </span>
                  </div>

                  <h4 className="font-bricolage text-base font-bold text-white leading-snug">
                    {slot.courseTitle}
                  </h4>

                  <div className="text-xs text-zinc-400 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-zinc-500">Lecturer:</span>
                      <span className="text-zinc-300 font-medium">{slot.lecturerName}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px]">
                      <MapPin className="w-3 h-3 text-[#4a5cff]" />
                      <span>{slot.venue}</span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-[#2a2a32] flex items-center justify-between gap-2">
                  {isLecturer ? (
                    <button
                      type="button"
                      onClick={() =>
                        onGoLiveWithCourse({
                          courseCode: slot.courseCode,
                          title: slot.courseTitle,
                          level: slot.level,
                          department: slot.department,
                        })
                      }
                      className="w-full py-2 rounded-xl bg-[#4a5cff] hover:bg-[#3d4ee0] text-white text-xs font-bold shadow-md shadow-[#4a5cff]/25 flex items-center justify-center gap-1.5 active:scale-95 transition cursor-pointer"
                    >
                      <Radio className="w-3.5 h-3.5 text-[#ff4f8b] animate-pulse" />
                      <span>Launch / Go Live</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        if (slot.activeRoomId) {
                          onJoinRoomByCode(slot.activeRoomId);
                        } else {
                          toast.info(`Lecture for ${slot.courseCode} starts at ${slot.startTime}.`);
                        }
                      }}
                      className="w-full py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white text-xs font-bold border border-white/10 flex items-center justify-center gap-1.5 active:scale-95 transition"
                    >
                      <span>{slot.activeRoomId ? "Join Live Classroom" : "View Lecture Details"}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Slot Modal for Lecturer */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-[20px] bg-[#141417] border border-[#2a2a32] p-6 shadow-2xl space-y-4 text-white">
            <div className="flex items-center justify-between pb-2 border-b border-[#2a2a32]">
              <h3 className="font-bricolage text-lg font-bold">Add Course to Timetable</h3>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-full bg-white/5 border border-white/10 grid place-items-center text-zinc-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddSlot} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-300">Course Code *</label>
                <input
                  type="text"
                  value={courseCode}
                  onChange={(e) => setCourseCode(e.target.value)}
                  placeholder="e.g. CSC 301 or MTH 101"
                  className="w-full bg-black/40 border border-[#2a2a32] rounded-xl px-3 py-2 text-xs text-white uppercase font-mono focus:border-[#4a5cff]"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-300">Course Title *</label>
                <input
                  type="text"
                  value={courseTitle}
                  onChange={(e) => setCourseTitle(e.target.value)}
                  placeholder="e.g. Advanced Operating Systems"
                  className="w-full bg-black/40 border border-[#2a2a32] rounded-xl px-3 py-2 text-xs text-white focus:border-[#4a5cff]"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-300">Start Time</label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full bg-black/40 border border-[#2a2a32] rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-[#4a5cff]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-300">End Time</label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full bg-black/40 border border-[#2a2a32] rounded-xl px-3 py-2 text-xs text-white font-mono focus:border-[#4a5cff]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-zinc-300">Venue</label>
                <input
                  type="text"
                  value={venue}
                  onChange={(e) => setVenue(e.target.value)}
                  placeholder="Virtual Lecture Theatre"
                  className="w-full bg-black/40 border border-[#2a2a32] rounded-xl px-3 py-2 text-xs text-white focus:border-[#4a5cff]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3 rounded-xl bg-[#4a5cff] text-white font-bold text-xs shadow-md shadow-[#4a5cff]/30 active:scale-95 transition"
              >
                Save to {selectedLevel}L {selectedDay} Timetable
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
