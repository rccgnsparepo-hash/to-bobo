import { useState, useEffect, useRef } from "react";
import {
  GraduationCap,
  Calendar,
  Clock,
  BookOpen,
  ScreenShare,
  Users,
  Hand,
  Paperclip,
  Plus,
  Send,
  X,
  Sparkles,
  FileText,
  Link as LinkIcon,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";
import { useAuth } from "@/lib/auth";
import { SpaceService } from "@/lib/space/spaceService";
import { WebRtcEngine } from "@/lib/space/webRtcEngine";
import { Avatar } from "@/components/Avatar";
import type { ClassroomSession, ClassMaterial } from "@/lib/space/types";

export function ClassroomView() {
  const { user, profile } = useAuth();
  const [classes, setClasses] = useState<ClassroomSession[]>(() => SpaceService.getClassrooms());
  const [activeLesson, setActiveLesson] = useState<ClassroomSession | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // New Class Form
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("Computer Science");
  const [duration, setDuration] = useState(45);
  const [materialTitle, setMaterialTitle] = useState("");
  const [materialUrl, setMaterialUrl] = useState("");
  const [materials, setMaterials] = useState<ClassMaterial[]>([]);

  // Live Lesson State
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [handRaised, setHandRaised] = useState(false);
  const [classComments, setClassComments] = useState<{ user: string; text: string; time: string }[]>([]);
  const [commentInput, setCommentInput] = useState("");

  const lessonVideoRef = useRef<HTMLVideoElement | null>(null);
  const rtcEngineRef = useRef<WebRtcEngine | null>(null);

  useEffect(() => {
    const sync = () => setClasses(SpaceService.getClassrooms());
    window.addEventListener("flick:space-classes-updated", sync);
    return () => window.removeEventListener("flick:space-classes-updated", sync);
  }, []);

  const handleCreateClass = () => {
    if (!user) {
      toast.error("Please sign in to schedule a class");
      return;
    }
    if (!title.trim()) {
      toast.error("Please enter a class title");
      return;
    }

    void triggerMediumHaptic();
    const newSession = SpaceService.createClassroom({
      hostId: user.id,
      teacherName: profile?.display_name || "Instructor",
      teacherHandle: profile?.handle || "instructor",
      teacherAvatar: profile?.avatar_url,
      title: title.trim(),
      subject,
      description: `Comprehensive online lesson on ${subject}.`,
      scheduledTime: Date.now() + 1000 * 60 * 15,
      durationMinutes: duration,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      accessType: "public",
      capacity: 50,
      materials,
      allowRecording: true,
    });

    toast.success(`Class "${title}" created and open for student enrollment! 🎓`);
    setShowCreateModal(false);
    setTitle("");
    setMaterials([]);
  };

  const handleJoinLesson = (lesson: ClassroomSession) => {
    if (!user) return;
    void triggerMediumHaptic();
    SpaceService.enrollInClass(lesson.id, user.id);
    setActiveLesson(lesson);
    toast(`Entered classroom: ${lesson.title}`);
  };

  const handleStartScreenShare = async () => {
    try {
      void triggerLightHaptic();
      if (!rtcEngineRef.current) {
        rtcEngineRef.current = new WebRtcEngine(user?.id || "");
      }
      const stream = await rtcEngineRef.current.startScreenShare();
      if (lessonVideoRef.current) {
        lessonVideoRef.current.srcObject = stream;
        lessonVideoRef.current.play().catch(() => {});
      }
      setIsScreenSharing(true);
      toast.success("Screen sharing started");
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const handleSendClassChat = () => {
    if (!commentInput.trim()) return;
    setClassComments((prev) => [
      ...prev,
      {
        user: profile?.display_name || "Student",
        text: commentInput.trim(),
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
    setCommentInput("");
  };

  return (
    <div className="w-full h-full flex flex-col overflow-hidden">
      {activeLesson ? (
        /* ==================== ACTIVE CLASSROOM LESSON STAGE ==================== */
        <div className="flex-1 w-full h-full bg-background flex flex-col lg:flex-row overflow-hidden">
          {/* Main Stage: Screen Share / Presentation & Whiteboard */}
          <div className="flex-1 flex flex-col bg-black relative overflow-hidden">
            <video
              ref={lessonVideoRef}
              playsInline
              autoPlay
              className="w-full h-full object-contain bg-zinc-950"
            />

            {!isScreenSharing && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-zinc-400 space-y-3 pointer-events-none">
                <div className="w-16 h-16 rounded-full bg-blue-500/20 text-blue-400 grid place-items-center">
                  <GraduationCap className="w-8 h-8" />
                </div>
                <h3 className="text-white font-display font-bold text-lg">
                  {activeLesson.title}
                </h3>
                <p className="text-xs text-zinc-400 max-w-sm">
                  Instructor presentation stage. Screen share or lecture notes will project here.
                </p>
              </div>
            )}

            {/* Top Class HUD */}
            <div className="absolute top-0 inset-x-0 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent z-10">
              <div className="flex items-center gap-2 text-white text-xs font-bold">
                <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
                <span>LESSON IN PROGRESS</span>
                <span className="font-mono text-zinc-400 font-normal">
                  ({activeLesson.durationMinutes} min)
                </span>
              </div>

              <div className="flex items-center gap-2">
                {activeLesson.hostId === user?.id && (
                  <button
                    type="button"
                    onClick={handleStartScreenShare}
                    className="px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md transition active:scale-95 flex items-center gap-1.5"
                  >
                    <ScreenShare className="w-3.5 h-3.5" />
                    <span>{isScreenSharing ? "Sharing Screen" : "Share Screen"}</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setActiveLesson(null);
                    if (rtcEngineRef.current) rtcEngineRef.current.close();
                  }}
                  className="px-3 py-1.5 rounded-full bg-secondary/80 text-foreground font-bold text-xs"
                >
                  Leave Class
                </button>
              </div>
            </div>
          </div>

          {/* Right Rail: Attendance, Materials & Classroom Live Chat */}
          <div className="w-full lg:w-80 h-72 lg:h-full border-t lg:border-t-0 lg:border-l border-border bg-card flex flex-col shrink-0">
            {/* Header info */}
            <div className="p-4 border-b border-border space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold font-mono uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500">
                  {activeLesson.subject}
                </span>
                <span className="text-xs text-muted-foreground font-mono flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" />
                  <span>{activeLesson.enrolledUserIds.length} attending</span>
                </span>
              </div>
              <div className="text-xs font-bold text-foreground">
                Instructor: {activeLesson.teacherName}
              </div>
            </div>

            {/* Materials List */}
            {activeLesson.materials.length > 0 && (
              <div className="p-3 border-b border-border bg-secondary/30 space-y-1.5">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  Lesson Materials
                </span>
                <div className="space-y-1">
                  {activeLesson.materials.map((mat) => (
                    <a
                      key={mat.id}
                      href={mat.url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-secondary text-xs text-foreground transition"
                    >
                      <Paperclip className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="truncate flex-1">{mat.title}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Class Live Q&A Chat */}
            <div className="flex-1 overflow-y-auto no-scrollbar p-3 space-y-2">
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                Class Q&A & Discussion
              </span>
              {classComments.map((c, i) => (
                <div key={i} className="text-xs space-y-0.5 p-2 rounded-xl bg-secondary/60">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-bold text-foreground">{c.user}</span>
                    <span className="text-muted-foreground">{c.time}</span>
                  </div>
                  <p className="text-foreground/90">{c.text}</p>
                </div>
              ))}
            </div>

            {/* Bottom Actions */}
            <div className="p-3 border-t border-border space-y-2">
              <button
                type="button"
                onClick={() => {
                  void triggerLightHaptic();
                  const next = !handRaised;
                  setHandRaised(next);
                  toast(next ? "Hand raised! Question submitted to instructor." : "Hand lowered");
                }}
                className={`w-full py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  handRaised
                    ? "bg-amber-500 text-black"
                    : "bg-secondary text-foreground hover:bg-secondary/80 border border-border"
                }`}
              >
                <Hand className="w-3.5 h-3.5" />
                <span>{handRaised ? "Question Asked ✋" : "Raise Hand to Ask Question"}</span>
              </button>

              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={commentInput}
                  onChange={(e) => setCommentInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSendClassChat();
                  }}
                  placeholder="Ask instructor…"
                  className="w-full bg-secondary border border-border rounded-xl px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={handleSendClassChat}
                  className="p-2 rounded-xl bg-blue-500 text-white shrink-0 hover:scale-105 active:scale-95 transition"
                >
                  <Send className="w-3 h-3" />
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ==================== CLASS DIRECTORY & SCHEDULER ==================== */
        <div className="flex-1 w-full h-full overflow-y-auto no-scrollbar p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
          {/* Header Banner */}
          <div className="rounded-3xl bg-gradient-to-r from-blue-950/70 via-zinc-900 to-cyan-950/60 border border-blue-500/30 p-6 sm:p-8 flex flex-col sm:flex-row items-center justify-between gap-6 shadow-xl">
            <div className="space-y-2 text-center sm:text-left max-w-xl">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 font-bold text-xs border border-blue-500/30">
                <GraduationCap className="w-3.5 h-3.5" />
                <span>VIRTUAL CLASSROOM & LECTURES</span>
              </div>
              <h2 className="font-display font-bold text-2xl sm:text-3xl text-white tracking-tight">
                Attend online classes & lessons
              </h2>
              <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                Connect with teachers and classmates in interactive virtual classrooms. Screen share code, lecture slides, and download verified study materials.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowCreateModal(true)}
              className="py-3 px-6 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-sm shadow-xl shadow-blue-500/25 hover:opacity-95 active:scale-95 transition flex items-center gap-2 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Schedule a Class</span>
            </button>
          </div>

          {/* Classes Grid */}
          <div className="space-y-4">
            <h3 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-blue-500" />
              <span>Upcoming Scheduled Lessons</span>
            </h3>

            {classes.length === 0 ? (
              <div className="py-16 text-center space-y-3 rounded-3xl bg-card border border-border p-8 max-w-md mx-auto">
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 text-blue-500 grid place-items-center mx-auto">
                  <GraduationCap className="w-7 h-7" />
                </div>
                <h4 className="font-display font-bold text-base text-foreground">No classes scheduled yet</h4>
                <p className="text-xs text-muted-foreground">
                  Schedule your first lesson or study session with lesson goals and materials.
                </p>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 rounded-2xl bg-blue-600 text-white font-bold text-xs shadow-md active:scale-95 transition"
                >
                  Create a Class
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {classes.map((cls) => (
                  <div
                    key={cls.id}
                    className="p-5 rounded-3xl bg-card border border-border space-y-4 shadow-sm hover:shadow-md transition flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold font-mono text-[10px] uppercase px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                          {cls.subject}
                        </span>
                        <span className="text-muted-foreground font-mono flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <span>{cls.durationMinutes} mins</span>
                        </span>
                      </div>
                      <h4 className="font-display font-bold text-base text-foreground leading-snug">
                        {cls.title}
                      </h4>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {cls.description}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
                      <div className="flex items-center gap-2">
                        <Avatar url={cls.teacherAvatar} name={cls.teacherName} size={28} />
                        <span className="font-bold text-foreground text-[11px] truncate max-w-[120px]">
                          {cls.teacherName}
                        </span>
                      </div>
                      <span className="text-muted-foreground text-[11px] font-mono">
                        {cls.attendanceCount} enrolled
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleJoinLesson(cls)}
                      className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs shadow-md active:scale-95 transition flex items-center justify-center gap-1.5"
                    >
                      <GraduationCap className="w-3.5 h-3.5" />
                      <span>Join Virtual Classroom</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Schedule Class Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="w-full max-w-md rounded-3xl bg-card border border-border p-6 shadow-2xl space-y-4"
            >
              <div className="flex items-center justify-between pb-1 border-b border-border">
                <h3 className="font-display font-bold text-base text-foreground">Schedule a Class</h3>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-7 h-7 rounded-full bg-secondary grid place-items-center text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Class Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Data Structures & Algorithms Revision"
                  className="w-full bg-secondary/80 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full bg-secondary/80 border border-border rounded-xl px-3.5 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">Duration (Minutes)</label>
                <div className="grid grid-cols-3 gap-2">
                  {[30, 45, 60].map((dur) => (
                    <button
                      key={dur}
                      type="button"
                      onClick={() => setDuration(dur)}
                      className={`py-2 rounded-xl border text-xs font-bold transition ${
                        duration === dur
                          ? "border-blue-500 bg-blue-500/10 text-blue-500"
                          : "border-border bg-secondary text-muted-foreground"
                      }`}
                    >
                      {dur} mins
                    </button>
                  ))}
                </div>
              </div>

              <button
                type="button"
                onClick={handleCreateClass}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold text-xs shadow-md shadow-blue-500/20 active:scale-95 transition"
              >
                Schedule Class & Open Enrollment
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
