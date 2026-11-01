import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  GraduationCap,
  Plus,
  ArrowRight,
  Sparkles,
  KeyRound,
  FileText,
  Users,
  Compass,
  School,
  Database,
  Radio,
  LogOut,
  UserCheck,
  BookOpen,
  Calendar,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { FlickClassService } from "@/lib/class/flickClassService";
import { CampusStorageService } from "@/lib/class/campusStorageService";
import type {
  ClassRoom,
  ClassMember,
  ClassSlide,
  ClassRole,
  AcademicProfile,
  AcademicLevel,
  SlideBankDeck,
} from "@/lib/class/types";
import { ClassroomEntrance } from "@/components/class/ClassroomEntrance";
import { ClassroomExitTransition } from "@/components/class/ClassroomExitTransition";
import { ClassHeader } from "@/components/class/ClassHeader";
import { SlideStage } from "@/components/class/SlideStage";
import { LecturerNotes } from "@/components/class/LecturerNotes";
import { ClassVoiceGrid } from "@/components/class/ClassVoiceGrid";
import { CreateClassModal } from "@/components/class/CreateClassModal";
import { AcademicAuthModal } from "@/components/class/AcademicAuthModal";
import { CampusTimetableZone } from "@/components/class/CampusTimetableZone";
import { CampusSlideBankZone } from "@/components/class/CampusSlideBankZone";
import { AudioLevelMeter } from "@/lib/class/audioLevelMeter";
import { toast } from "sonner";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";

export default function ClassroomPage() {
  const { roomId } = useParams<{ roomId?: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, profile: socialProfile } = useAuth();

  // Academic Profile State
  const [academicProfile, setAcademicProfile] = useState<AcademicProfile | null>(() =>
    CampusStorageService.getAcademicProfile()
  );
  const [showAuthModal, setShowAuthModal] = useState<boolean>(() => !CampusStorageService.getAcademicProfile());

  // Hub View Tabs (Slide Bank vs Timetable)
  const [hubTab, setHubTab] = useState<"slides" | "timetable">("slides");

  // Entrance & Exit Warp Transitions
  const [hasEntered, setHasEntered] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return Boolean(sessionStorage.getItem("flick:class:entered"));
  });
  const [isWarpingIn, setIsWarpingIn] = useState(false);
  const [entranceCompleted, setEntranceCompleted] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return Boolean(sessionStorage.getItem("flick:class:entered"));
  });
  const [isAppOpen, setIsAppOpen] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return Boolean(sessionStorage.getItem("flick:class:entered"));
  });
  const [entranceCoords, setEntranceCoords] = useState<{ x: number; y: number }>({
    x: typeof window !== "undefined" ? window.innerWidth / 2 : 500,
    y: typeof window !== "undefined" ? window.innerHeight * 0.6 : 500,
  });

  const [isExitingWorld, setIsExitingWorld] = useState(false);
  const [exitDestination, setExitDestination] = useState<string>("/space?tab=classes");

  // Room state
  const [room, setRoom] = useState<ClassRoom | null>(null);
  const [loadingRoom, setLoadingRoom] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [joinInputCode, setJoinInputCode] = useState("");
  const [activeRoomsList, setActiveRoomsList] = useState<ClassRoom[]>([]);

  // Role and member state
  const [myRole, setMyRole] = useState<ClassRole>("student");
  const [members, setMembers] = useState<ClassMember[]>([]);

  // Slide state
  const [lecturerSlideIndex, setLecturerSlideIndex] = useState(0);
  const [studentBrowseIndex, setStudentBrowseIndex] = useState(0);
  const [isFollowingLecturer, setIsFollowingLecturer] = useState(true);

  // Notes state
  const [lecturerNotes, setLecturerNotes] = useState("");
  const [isLecturerTyping, setIsLecturerTyping] = useState(false);

  // Voice & Audio Metering state
  const [isMicActive, setIsMicActive] = useState(false);
  const [myAudioLevel, setMyAudioLevel] = useState(0);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);

  // Mobile column active tab
  const [mobileTab, setMobileTab] = useState<"slides" | "voice" | "notes">("slides");

  // Refs
  const nextSlideButtonRef = useRef<HTMLButtonElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioMeterRef = useRef<AudioLevelMeter | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);
  const subscriptionRef = useRef<ReturnType<typeof FlickClassService.subscribeToRoom> | null>(null);

  // Sync active rooms and academic profile
  useEffect(() => {
    setActiveRoomsList(FlickClassService.getAllActiveRooms());
    const onProfileChanged = () => {
      setAcademicProfile(CampusStorageService.getAcademicProfile());
    };
    window.addEventListener("flick:academic-profile-changed", onProfileChanged);
    return () => window.removeEventListener("flick:academic-profile-changed", onProfileChanged);
  }, []);

  // 1. Fetch Room if roomId provided
  useEffect(() => {
    let active = true;
    const targetCode = roomId || searchParams.get("code");

    if (!targetCode) {
      setRoom(null);
      setLoadingRoom(false);
      return;
    }

    (async () => {
      setLoadingRoom(true);
      const fetched = await FlickClassService.getRoom(targetCode);
      if (!active) return;

      if (fetched) {
        setRoom(fetched);
        setLecturerSlideIndex(fetched.current_slide_index || 0);
        setStudentBrowseIndex(fetched.current_slide_index || 0);
        setLecturerNotes(fetched.lecturer_notes || "");

        // Determine real role
        const isOwner =
          (user?.id && fetched.lecturer_id === user.id) ||
          academicProfile?.role === "lecturer";
        const initialRole: ClassRole = isOwner ? "lecturer" : "student";
        setMyRole(initialRole);

        // Only add genuine active user to the room member list
        const myName =
          academicProfile?.fullName ||
          socialProfile?.display_name ||
          (isOwner ? fetched.lecturer_name : "Student Member");

        const currentMember: ClassMember = {
          id: `mem_${user?.id || academicProfile?.id || "guest"}`,
          room_id: fetched.id,
          user_id: user?.id || academicProfile?.id || `user_${Date.now()}`,
          name: myName,
          handle: academicProfile?.matricNo || socialProfile?.handle || "student",
          avatar_url: socialProfile?.avatar_url || null,
          role: initialRole,
          matric_no: academicProfile?.matricNo,
          academic_level: academicProfile?.level,
          college: academicProfile?.college,
          department: academicProfile?.department,
          is_muted: !isOwner,
          hand_raised: false,
        };

        setMembers([currentMember]);
      } else {
        toast.error(`Class room "${targetCode}" not found or has ended.`);
        navigate("/class");
      }
      setLoadingRoom(false);
    })();

    return () => {
      active = false;
    };
  }, [roomId, searchParams, user?.id, academicProfile, socialProfile, navigate]);

  // 2. Real-Time Channel Subscription
  useEffect(() => {
    if (!room) return;

    const sub = FlickClassService.subscribeToRoom(room.id, {
      onSlideChange: (event) => {
        setLecturerSlideIndex(event.slideIndex);
        if (isFollowingLecturer) {
          setStudentBrowseIndex(event.slideIndex);
        }
      },
      onNotesDiff: (event) => {
        setLecturerNotes(event.text);
        setIsLecturerTyping(event.isTyping);

        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (event.isTyping) {
          typingTimeoutRef.current = window.setTimeout(() => {
            setIsLecturerTyping(false);
          }, 1500);
        }
      },
      onMuteCommand: (target) => {
        if (target === "all" || target === user?.id) {
          stopMicrophone();
          setIsMicActive(false);
          toast("You were muted by the lecturer");
        }
      },
      onKickCommand: (targetUserId) => {
        if (targetUserId === user?.id) {
          toast.error("You were removed from this room");
          handleExitWorld("/class");
        }
      },
    });

    subscriptionRef.current = sub;

    return () => {
      sub.unsubscribe();
      subscriptionRef.current = null;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [room?.id, isFollowingLecturer, user?.id]);

  // 3. Audio Cleanup
  useEffect(() => {
    return () => {
      stopMicrophone();
    };
  }, []);

  const stopMicrophone = () => {
    if (audioMeterRef.current) {
      audioMeterRef.current.stop();
      audioMeterRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
    setMyAudioLevel(0);
  };

  const handleToggleMic = async () => {
    void triggerLightHaptic();
    if (isMicActive) {
      stopMicrophone();
      setIsMicActive(false);
      setMembers((prev) =>
        prev.map((m) => (m.user_id === user?.id ? { ...m, is_muted: true, audio_level: 0 } : m))
      );
      toast("Microphone muted");
    } else {
      setMicError(null);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        mediaStreamRef.current = stream;

        audioMeterRef.current = new AudioLevelMeter(
          stream,
          (level) => setMyAudioLevel(level),
          (speaking) => {
            setMembers((prev) =>
              prev.map((m) =>
                m.user_id === user?.id ? { ...m, is_speaking: speaking } : m
              )
            );
          }
        );

        setIsMicActive(true);
        setMembers((prev) =>
          prev.map((m) => (m.user_id === user?.id ? { ...m, is_muted: false } : m))
        );
        toast.success("Microphone active");
      } catch {
        setMicError("Microphone permission denied. Check your browser settings.");
        toast.error("Could not access microphone");
      }
    }
  };

  const handleToggleHand = () => {
    void triggerMediumHaptic();
    const next = !isHandRaised;
    setIsHandRaised(next);
    setMembers((prev) =>
      prev.map((m) => (m.user_id === user?.id ? { ...m, hand_raised: next } : m))
    );
    toast(next ? "Hand raised! Lecturer notified." : "Hand lowered");
  };

  const handleSlideChange = (newIndex: number) => {
    setStudentBrowseIndex(newIndex);
    if (myRole === "lecturer" || myRole === "co_host") {
      setLecturerSlideIndex(newIndex);
      setIsFollowingLecturer(true);
      if (room) {
        void FlickClassService.updateRoomSlideIndex(room.id, newIndex);
        subscriptionRef.current?.broadcastSlideChange(newIndex, user?.id || "host");
      }
    } else {
      setIsFollowingLecturer(newIndex === lecturerSlideIndex);
    }
  };

  const handleJumpToLecturer = () => {
    void triggerLightHaptic();
    setStudentBrowseIndex(lecturerSlideIndex);
    setIsFollowingLecturer(true);
    toast.success(`Jumped to lecturer's slide (${lecturerSlideIndex + 1})`);
  };

  const handleNotesChange = (text: string) => {
    setLecturerNotes(text);
    if (room) {
      void FlickClassService.updateLecturerNotes(room.id, text);
      subscriptionRef.current?.broadcastNotesDiff({
        text,
        isTyping: true,
        senderId: user?.id || "lecturer",
        timestamp: Date.now(),
      });
    }
  };

  // Exact Entrance Warp Sequence from HTML
  const startEntranceWarp = (coords?: { x: number; y: number }) => {
    if (coords) setEntranceCoords(coords);
    void triggerMediumHaptic();
    setIsWarpingIn(true);

    setTimeout(() => {
      setIsAppOpen(true);
      setHasEntered(true);
      sessionStorage.setItem("flick:class:entered", "1");
    }, 1000);

    setTimeout(() => {
      setEntranceCompleted(true);
      setIsWarpingIn(false);
      nextSlideButtonRef.current?.focus();
    }, 2500);
  };

  const skipEntrance = () => {
    setHasEntered(true);
    setIsAppOpen(true);
    setEntranceCompleted(true);
    setIsWarpingIn(false);
    sessionStorage.setItem("flick:class:entered", "1");
    nextSlideButtonRef.current?.focus();
  };

  // Exit World Transition Trigger (Cosmic Warp Back to Flick)
  const handleExitWorld = (destination: string = "/space?tab=classes") => {
    void triggerMediumHaptic();
    stopMicrophone();
    if (room && myRole === "lecturer") {
      void FlickClassService.closeRoom(room.id);
    }
    setExitDestination(destination);
    setIsExitingWorld(true);
  };

  const handleExitCompleted = () => {
    setIsExitingWorld(false);
    sessionStorage.removeItem("flick:class:entered");
    navigate(exitDestination);
  };

  // Room creation callback
  const handleCreateRoom = async (params: {
    title: string;
    courseCode?: string;
    academicLevel?: AcademicLevel;
    department?: string;
    slides: ClassSlide[];
    slidesDownloadable: boolean;
    notesDownloadable: boolean;
  }) => {
    const lecturerId = user?.id || academicProfile?.id || `lec_${Date.now()}`;
    const lecturerName =
      academicProfile?.fullName || socialProfile?.display_name || "Lecturer";

    const created = await FlickClassService.createRoom({
      title: params.title,
      courseCode: params.courseCode,
      academicLevel: params.academicLevel || academicProfile?.level || 100,
      department: params.department || academicProfile?.department,
      lecturerId,
      lecturerName,
      lecturerAvatar: socialProfile?.avatar_url,
      slides: params.slides,
      slidesDownloadable: params.slidesDownloadable,
      notesDownloadable: params.notesDownloadable,
    });

    setRoom(created);
    setMyRole("lecturer");
    navigate(`/class/${created.join_code}`);
    toast.success(`Lecture live! 6-Character Join Code: ${created.join_code}`);
  };

  // Quick join by code
  const handleJoinByCode = (code: string) => {
    if (!code.trim()) return;
    navigate(`/class/${code.trim().toUpperCase()}`);
  };

  // Launch deck from Slide Bank into a live lecture room
  const handleLaunchDeckInLiveRoom = (deck: SlideBankDeck) => {
    void handleCreateRoom({
      title: deck.deckTitle,
      courseCode: deck.courseCode,
      academicLevel: deck.level,
      department: deck.department,
      slides: deck.slides,
      slidesDownloadable: deck.downloadable,
      notesDownloadable: true,
    });
  };

  // RENDER: Exit Transition (Leaving Lecture World back to Flick)
  if (isExitingWorld) {
    return (
      <ClassroomExitTransition
        title="Returning to Flick"
        onComplete={handleExitCompleted}
      />
    );
  }

  // RENDER: Entrance Gate (before entering, show full-screen starfield gate)
  if (!entranceCompleted && !isWarpingIn) {
    return (
      <ClassroomEntrance
        title="Flick Class"
        courseCode={room?.course_code || undefined}
        onEnter={startEntranceWarp}
        onSkip={skipEntrance}
        isTransitioning={false}
      />
    );
  }

  return (
    <>
      {/* During Warp-In: Keep the starfield tunnel flying through on top until circular reveal finishes */}
      {isWarpingIn && (
        <ClassroomEntrance
          title="Flick Class"
          courseCode={room?.course_code || undefined}
          onEnter={() => {}}
          onSkip={skipEntrance}
          isTransitioning={true}
        />
      )}

      <div
        className="min-h-screen bg-[#0a0a0a] text-white flex flex-col select-none overflow-x-hidden"
        style={{
          clipPath: isWarpingIn
            ? isAppOpen
              ? `circle(160vmax at ${entranceCoords.x}px ${entranceCoords.y}px)`
              : `circle(0px at ${entranceCoords.x}px ${entranceCoords.y}px)`
            : "none",
          transition: isWarpingIn ? "clip-path 1.3s cubic-bezier(.7,0,.2,1)" : "none",
        }}
      >
        <div
          className="flex-1 flex flex-col h-full"
          style={{
            transform: isWarpingIn && !isAppOpen ? "scale(1.14)" : "none",
            filter: isWarpingIn && !isAppOpen ? "blur(10px)" : "none",
            transition: isWarpingIn
              ? "transform 1.4s cubic-bezier(.2,.7,.2,1), filter 1.2s"
              : "none",
          }}
        >
        {/* =========================================================================
            CAMPUS ACADEMIC HEADER BAR (Shared across Hub and Live Class)
            ========================================================================= */}
        <div className="w-full bg-[#141417] border-b border-[#2a2a32] px-4 py-2.5 flex items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => handleExitWorld("/space?tab=classes")}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/40 hover:bg-black/70 border border-[#2a2a32] text-zinc-300 hover:text-white transition cursor-pointer"
              title="Exit Lecture Zone and return to Flick Social"
            >
              <Compass className="w-3.5 h-3.5 text-[#4a5cff]" />
              <span className="font-mono text-[11px] font-bold">← Flick Social</span>
            </button>

            {academicProfile ? (
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[#4a5cff]" />
                <span className="font-bold text-white truncate max-w-[180px] sm:max-w-xs">
                  {academicProfile.fullName}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#4a5cff]/20 text-[#8898ff] border border-[#4a5cff]/30">
                  {academicProfile.college} · {academicProfile.role === "lecturer"
                    ? "Faculty (Verified)"
                    : `${academicProfile.level}L ${academicProfile.matricNo}`}
                </span>
              </div>
            ) : (
              <div className="text-zinc-400 text-[11px]">
                Guest Mode · Academic ID required for attendance
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {academicProfile ? (
              <button
                type="button"
                onClick={() => {
                  CampusStorageService.logoutAcademicProfile();
                  setShowAuthModal(true);
                }}
                className="text-[11px] font-mono text-zinc-400 hover:text-rose-400 transition flex items-center gap-1 cursor-pointer"
                title="Switch or log out academic account"
              >
                <LogOut className="w-3 h-3" />
                <span className="hidden sm:inline">Log Out</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowAuthModal(true)}
                className="px-3.5 py-1 rounded-xl bg-[#4a5cff] text-white text-xs font-bold cursor-pointer"
              >
                Sign In
              </button>
            )}
          </div>
        </div>

        {/* =========================================================================
            VIEW A: ACTIVE LECTURE ROOM (/class/:roomId)
            ========================================================================= */}
        {room ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35 }}
            className="flex-1 flex flex-col h-full overflow-hidden"
          >
            {/* Room Header HUD */}
            <ClassHeader
              roomTitle={room.title}
              courseCode={room.course_code}
              joinCode={room.join_code}
              role={myRole}
              isLive={room.is_live}
              onLeaveRoom={() => handleExitWorld("/class")}
              onRoleSwitch={setMyRole}
            />

            {/* Mobile Tab Segmented Switcher */}
            <div className="flex md:hidden border-b border-[#2a2a32] bg-[#141417] p-1.5 gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setMobileTab("slides")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition ${
                  mobileTab === "slides" ? "bg-[#4a5cff] text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                Slides ({room.slides_data.length > 0 ? `${studentBrowseIndex + 1}/${room.slides_data.length}` : "0"})
              </button>
              <button
                type="button"
                onClick={() => setMobileTab("voice")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center justify-center gap-1 ${
                  mobileTab === "voice" ? "bg-[#4a5cff] text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Voice ({members.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setMobileTab("notes")}
                className={`flex-1 py-1.5 rounded-lg text-xs font-mono font-bold transition flex items-center justify-center gap-1 ${
                  mobileTab === "notes" ? "bg-[#4a5cff] text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Notes</span>
                {isLecturerTyping && <span className="w-1.5 h-1.5 rounded-full bg-[#ff4f8b] animate-ping" />}
              </button>
            </div>

            {/* Two Column Layout */}
            <main className="flex-1 p-3 sm:p-5 overflow-hidden flex flex-col md:flex-row gap-4 max-w-[1720px] w-full mx-auto">
              {/* Left Column: 16:9 Slides */}
              <section
                className={`flex-1 flex flex-col min-w-0 h-full overflow-hidden ${
                  mobileTab === "slides" ? "flex" : "hidden md:flex"
                }`}
              >
                <SlideStage
                  slides={room.slides_data || []}
                  lecturerSlideIndex={lecturerSlideIndex}
                  currentSlideIndex={studentBrowseIndex}
                  role={myRole}
                  lecturerName={room.lecturer_name}
                  slidesDownloadable={room.slides_downloadable}
                  onSlideChange={handleSlideChange}
                  onUploadSlides={(newSlides) => {
                    void FlickClassService.updateRoomSlides(room.id, newSlides, 1024 * 1024 * newSlides.length);
                    setRoom({ ...room, slides_data: newSlides, total_slides: newSlides.length });
                    setStudentBrowseIndex(0);
                    setLecturerSlideIndex(0);
                  }}
                  onToggleDownloadable={(allowed) => {
                    setRoom({ ...room, slides_downloadable: allowed });
                  }}
                  onJumpToLecturer={handleJumpToLecturer}
                  isFollowingLecturer={isFollowingLecturer}
                  nextSlideButtonRef={nextSlideButtonRef}
                />
              </section>

              {/* Right Column: Voice & Live Keystroke Notes */}
              <aside
                className={`w-full md:w-[340px] lg:w-[360px] flex-col gap-3 shrink-0 h-full overflow-hidden ${
                  mobileTab !== "slides" ? "flex" : "hidden md:flex"
                }`}
              >
                {/* Voice Grid */}
                <div
                  className={`flex-1 min-h-[220px] overflow-hidden ${
                    mobileTab === "notes" ? "hidden md:flex" : "flex"
                  }`}
                >
                  <ClassVoiceGrid
                    members={members}
                    currentUserId={user?.id || academicProfile?.id || ""}
                    role={myRole}
                    isMicActive={isMicActive}
                    myAudioLevel={myAudioLevel}
                    isHandRaised={isHandRaised}
                    micError={micError}
                    onToggleMic={handleToggleMic}
                    onToggleHand={handleToggleHand}
                    onMuteAll={() => {
                      subscriptionRef.current?.broadcastMute("all");
                      toast("Sent mute all signal to students");
                    }}
                    onMuteMember={(targetUserId) => {
                      subscriptionRef.current?.broadcastMute(targetUserId);
                      toast("Muted student");
                    }}
                    onRemoveMember={(targetUserId) => {
                      subscriptionRef.current?.broadcastKick(targetUserId);
                      setMembers((prev) => prev.filter((m) => m.user_id !== targetUserId));
                      toast("Removed member from room");
                    }}
                    onCallOnStudent={(targetUserId) => {
                      setMembers((prev) =>
                        prev.map((m) =>
                          m.user_id === targetUserId ? { ...m, hand_raised: false } : m
                        )
                      );
                      toast.success("Called on student to speak");
                    }}
                  />
                </div>

                {/* Realtime Keystroke Notes */}
                <div
                  className={`flex-1 min-h-[240px] overflow-hidden ${
                    mobileTab === "voice" ? "hidden md:flex" : "flex"
                  }`}
                >
                  <LecturerNotes
                    roomId={room.id}
                    initialNotes={lecturerNotes}
                    role={myRole}
                    isLecturerTyping={isLecturerTyping}
                    notesDownloadable={room.notes_downloadable}
                    onNotesChange={handleNotesChange}
                    onToggleDownloadable={(allowed) => {
                      setRoom({ ...room, notes_downloadable: allowed });
                    }}
                    senderId={user?.id || academicProfile?.id || "guest"}
                  />
                </div>
              </aside>
            </main>
          </motion.div>
        ) : (
          /* =========================================================================
              VIEW B: CAMPUS LECTURE HUB (/class)
              Features Slide Bank across CBAS/CHMS/CHAS, Levels 100L-600L & Timetables
              ========================================================================= */
          <div className="flex-1 w-full max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-8 overflow-y-auto no-scrollbar">
            {/* Top Hero Banner */}
            <div className="rounded-[24px] bg-gradient-to-r from-[#141417] via-[#121218] to-[#1a1526] border border-[#2a2a32] p-6 sm:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-80 bg-[#4a5cff]/10 rounded-full blur-3xl pointer-events-none" />

              <div className="space-y-3 text-center md:text-left max-w-xl relative z-10">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#4a5cff]/20 text-[#8898ff] border border-[#4a5cff]/30 text-xs font-mono font-bold uppercase tracking-wider">
                  <School className="w-3.5 h-3.5 text-[#ff4f8b]" />
                  <span>3 Colleges: CBAS · CHMS · CHAS</span>
                </div>
                <h1 className="font-bricolage text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight">
                  Flick Class Space
                </h1>
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">
                  Campus lecture zone for synchronized PDF slide decks, live professor notes, and level slide banks (100L – 600L).
                </p>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto relative z-10 shrink-0">
                {academicProfile?.role === "lecturer" ? (
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(true)}
                    className="w-full sm:w-auto py-3.5 px-6 rounded-xl bg-[#4a5cff] hover:bg-[#3d4ee0] text-white font-bold text-xs shadow-lg shadow-[#4a5cff]/30 transition active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Launch Live Lecture</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      if (!academicProfile) setShowAuthModal(true);
                      else toast.info(`Signed in as ${academicProfile.fullName} (${academicProfile.college} · ${academicProfile.level}L).`);
                    }}
                    className="w-full sm:w-auto py-3.5 px-6 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-bold text-xs transition active:scale-95 flex items-center justify-center gap-2"
                  >
                    <UserCheck className="w-4 h-4 text-[#C5E863]" />
                    <span>{academicProfile ? `${academicProfile.college} ${academicProfile.level}L` : "Student Sign In"}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Quick Join By 6-Character Code */}
            <div className="p-4 sm:p-5 rounded-[20px] bg-[#141417] border border-[#2a2a32] flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-black/40 border border-[#2a2a32] grid place-items-center text-[#4a5cff]">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-white uppercase font-mono tracking-wider">
                    Join Lecture by Code
                  </h4>
                  <p className="text-[11px] text-zinc-400">
                    Enter 6-character room code provided by your lecturer.
                  </p>
                </div>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleJoinByCode(joinInputCode);
                }}
                className="flex items-center gap-2 w-full sm:w-auto"
              >
                <input
                  type="text"
                  value={joinInputCode}
                  onChange={(e) => setJoinInputCode(e.target.value.toUpperCase())}
                  placeholder="e.g. FLK892"
                  maxLength={6}
                  className="w-full sm:w-40 bg-black/50 border border-[#2a2a32] rounded-xl px-3.5 py-2 text-xs text-white font-mono uppercase tracking-widest placeholder:text-zinc-600 focus:outline-none focus:border-[#4a5cff]"
                />
                <button
                  type="submit"
                  disabled={!joinInputCode.trim()}
                  className="py-2 px-4 rounded-xl bg-[#4a5cff] text-white font-bold text-xs shadow-md disabled:opacity-50 active:scale-95 transition cursor-pointer"
                >
                  Join
                </button>
              </form>
            </div>

            {/* Active Live Rooms List */}
            {activeRoomsList.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-white uppercase tracking-wider">
                  <Radio className="w-4 h-4 text-[#ff4f8b] animate-pulse" />
                  <span>Currently Live Classrooms ({activeRoomsList.length})</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
                  {activeRoomsList.map((r) => (
                    <div
                      key={r.id}
                      className="p-4 rounded-[18px] bg-[#141417] border border-[#4a5cff]/30 space-y-3 shadow-lg flex flex-col justify-between"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-[#ff4f8b]/20 text-[#ff4f8b] border border-[#ff4f8b]/30">
                            LIVE NOW
                          </span>
                          <span className="text-xs font-mono text-zinc-400">
                            Code: {r.join_code}
                          </span>
                        </div>
                        <h4 className="font-bricolage text-base font-bold text-white">
                          {r.title}
                        </h4>
                        <p className="text-xs text-zinc-400">
                          Instructor: {r.lecturer_name} {r.course_code ? `(${r.course_code})` : ""}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => navigate(`/class/${r.join_code}`)}
                        className="w-full py-2 rounded-xl bg-[#4a5cff] text-white text-xs font-bold flex items-center justify-center gap-2 shadow-md active:scale-95 transition cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Enter Live Room</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* HUB SEGMENTED NAVIGATION: Bank of Slides vs Timetable */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 border-b border-[#2a2a32] pb-3">
                <button
                  type="button"
                  onClick={() => {
                    void triggerLightHaptic();
                    setHubTab("slides");
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition cursor-pointer ${
                    hubTab === "slides"
                      ? "bg-[#4a5cff] text-white shadow-md shadow-[#4a5cff]/30"
                      : "bg-[#141417] text-zinc-400 hover:text-white border border-[#2a2a32]"
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>Bank of Slides (CBAS · CHMS · CHAS)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    void triggerLightHaptic();
                    setHubTab("timetable");
                  }}
                  className={`px-4 py-2 rounded-xl text-xs font-mono font-bold flex items-center gap-2 transition cursor-pointer ${
                    hubTab === "timetable"
                      ? "bg-[#4a5cff] text-white shadow-md shadow-[#4a5cff]/30"
                      : "bg-[#141417] text-zinc-400 hover:text-white border border-[#2a2a32]"
                  }`}
                >
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Campus Timetable (100L – 600L)</span>
                </button>
              </div>

              {/* Render Selected Hub Tab */}
              {hubTab === "slides" ? (
                <CampusSlideBankZone
                  profile={academicProfile}
                  onLaunchDeckInLiveRoom={handleLaunchDeckInLiveRoom}
                />
              ) : (
                <CampusTimetableZone
                  profile={academicProfile}
                  onGoLiveWithCourse={(slot) => {
                    void handleCreateRoom({
                      title: `${slot.courseCode}: ${slot.courseTitle}`,
                      courseCode: slot.courseCode,
                      academicLevel: slot.level,
                      department: slot.department,
                      slides: [],
                      slidesDownloadable: true,
                      notesDownloadable: true,
                    });
                  }}
                  onJoinRoomByCode={handleJoinByCode}
                />
              )}
            </div>
          </div>
        )}

        {/* Academic Authentication Modal */}
        <AcademicAuthModal
          isOpen={showAuthModal}
          currentUserId={user?.id}
          defaultRole={academicProfile?.role || "student"}
          onSuccess={(prof) => {
            setAcademicProfile(prof);
            setShowAuthModal(false);
            setMyRole(prof.role === "lecturer" ? "lecturer" : "student");
          }}
          onClose={academicProfile ? () => setShowAuthModal(false) : undefined}
        />

        {/* Create Class Modal */}
        <CreateClassModal
          isOpen={showCreateModal}
          defaultLevel={academicProfile?.level || 100}
          defaultDepartment={academicProfile?.department || "Computer Science"}
          onClose={() => setShowCreateModal(false)}
          onCreateRoom={handleCreateRoom}
        />
      </div>
    </div>
    </>
  );
}
