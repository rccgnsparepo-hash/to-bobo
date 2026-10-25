import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Swords,
  Brain,
  Sparkles,
  Trophy,
  Flame,
  Zap,
  Clock,
  CheckCircle2,
  XCircle,
  ArrowRight,
  RotateCcw,
  Crown,
  Users,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/Avatar";
import { DuelModal } from "@/components/duel/DuelModal";
import { type TopFlicker } from "@/lib/topFlickers";
import { soundEngine } from "@/lib/soundEngine";
import { triggerLightHaptic, triggerSuccessHaptic } from "@/lib/haptics";
import { fireAuthConfetti, fireSparkleConfetti } from "@/lib/confetti";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

type ArenaTab = "mind-duel" | "blitz-1v1" | "daily-quests";

type MindQuestion = {
  id: number;
  question: string;
  category: string;
  options: {
    id: string;
    text: string;
    isTarget: boolean; // The hilarious/counter-intuitive satirical target answer
    punchline: string;
  }[];
};

const MIND_QUESTIONS: MindQuestion[] = [
  {
    id: 1,
    question: "What gets wetter and wetter the more it dries?",
    category: "Elemental Paradox",
    options: [
      { id: "a", text: "A towel that has given up on its dreams", isTarget: true, punchline: "Classic textile depression — 100% absorbs tears" },
      { id: "b", text: "An angry sponge having an existential crisis", isTarget: false, punchline: "Sponges only absorb water, not life lessons" },
      { id: "c", text: "A raincloud in severe denial", isTarget: false, punchline: "Clouds don't dry, they just precipitate drama" },
      { id: "d", text: "Your dad's dinner conversation", isTarget: false, punchline: "That gets drier by the minute" },
    ],
  },
  {
    id: 2,
    question: "What has keys that cannot open locks, empty space but no rooms, and allows you to enter but never leave?",
    category: "Hardware Logic",
    options: [
      { id: "a", text: "A keyboard typing frantic essays at 3 AM", isTarget: true, punchline: "Shift + Enter your way into insomnia" },
      { id: "b", text: "An escaped grand piano playing jazz in the woods", isTarget: false, punchline: "Only Mozart understands this one" },
      { id: "c", text: "An IKEA parking lot on a Saturday afternoon", isTarget: false, punchline: "You can leave IKEA... eventually" },
      { id: "d", text: "A locked diary with literally nothing written inside", isTarget: false, punchline: "Empty yes, but has zero keys" },
    ],
  },
  {
    id: 3,
    question: "If you're sprinting in a race and you overtake the person in second place, what position are you in?",
    category: "Kinetic Geometry",
    options: [
      { id: "a", text: "Second place (obviously, stop overthinking)", isTarget: true, punchline: "You took their spot! First place is still ahead!" },
      { id: "b", text: "First place in my mom's heart", isTarget: false, punchline: "Wholesome, but track judges disagree" },
      { id: "c", text: "Out of breath and questioning my life choices", isTarget: false, punchline: "Cardio is painful, but mathematically second" },
      { id: "d", text: "Disqualified for taking an electric scooter", isTarget: false, punchline: "Modern problems, illegal solutions" },
    ],
  },
  {
    id: 4,
    question: "What must be completely broken before you can officially use it?",
    category: "Structural Physics",
    options: [
      { id: "a", text: "An egg", isTarget: true, punchline: "Omelet rules apply: shell must perish" },
      { id: "b", text: "The fundamental laws of quantum physics", isTarget: false, punchline: "Einstein is watching you" },
      { id: "c", text: "My home Wi-Fi when guests arrive", isTarget: false, punchline: "That's just normal Comcast behavior" },
      { id: "d", text: "A promise made on New Year's Eve", isTarget: false, punchline: "Too real, abort mission" },
    ],
  },
  {
    id: 5,
    question: "I have branches, but no fruit, trunk, or leaves. What am I?",
    category: "Organic Cryptography",
    options: [
      { id: "a", text: "A bank charging you $12 for having $3", isTarget: true, punchline: "The financial forest never sleeps" },
      { id: "b", text: "A dramatic family tree during the holidays", isTarget: false, punchline: "That definitely has leaves of absence" },
      { id: "c", text: "A Wi-Fi router with only 1 flickering bar", isTarget: false, punchline: "Has antennas, not branches" },
      { id: "d", text: "A coat rack having an identity crisis", isTarget: false, punchline: "Close, but furniture isn't poetic" },
    ],
  },
  {
    id: 6,
    question: "What goes up and never, ever comes back down?",
    category: "Temporal Mechanics",
    options: [
      { id: "a", text: "Your age and the price of iced coffee", isTarget: true, punchline: "Time marches on and cold brew hits $8" },
      { id: "b", text: "A rogue helium balloon drifting into the stratosphere", isTarget: false, punchline: "Gravity pops it at 30,000 feet" },
      { id: "c", text: "Screen time notifications on Sunday morning", isTarget: false, punchline: "It only goes higher, never lower" },
      { id: "d", text: "Blood pressure during a live 5-second duel", isTarget: false, punchline: "Heart rate spikes to 180 BPM" },
    ],
  },
  {
    id: 7,
    question: "What can travel around the entire world while staying safely in a corner?",
    category: "Global Vector",
    options: [
      { id: "a", text: "A postage stamp on an overseas postcard", isTarget: true, punchline: "Licked once, circumnavigates the globe" },
      { id: "b", text: "An introvert in row 32F on an international flight", isTarget: false, punchline: "Noise cancelling headphones engaged" },
      { id: "c", text: "A spider quietly planning planetary conquest", isTarget: false, punchline: "The corner is its entire jurisdiction" },
      { id: "d", text: "A dust bunny gathering cosmic wisdom", isTarget: false, punchline: "Only travels under the sofa" },
    ],
  },
  {
    id: 8,
    question: "What belongs entirely to you, but everyone else uses it way more than you do?",
    category: "Social Identity",
    options: [
      { id: "a", text: "Your actual first name", isTarget: true, punchline: "Everyone shouts it, you rarely say it" },
      { id: "b", text: "Your Netflix password shared with 11 relatives", isTarget: false, punchline: "Screen limit exceeded error incoming" },
      { id: "c", text: "Your phone charger stolen by your roommate", isTarget: false, punchline: "That's called involuntary donation" },
      { id: "d", text: "Your remaining patience on a Monday morning", isTarget: false, punchline: "Depleted before 9:05 AM" },
    ],
  },
  {
    id: 9,
    question: "The more of this you take from it, the larger it becomes. What is it?",
    category: "Dimensional Space",
    options: [
      { id: "a", text: "A hole in the backyard", isTarget: true, punchline: "Dig deeper, expand void" },
      { id: "b", text: "Screenshots you will never look at again", isTarget: false, punchline: "Camera roll storage at 99%" },
      { id: "c", text: "An awkward pause on a first date", isTarget: false, punchline: "Silence deafens the restaurant" },
      { id: "d", text: "Free pens from the hotel lobby", isTarget: false, punchline: "Pocket full of plastic" },
    ],
  },
  {
    id: 10,
    question: "What can you easily catch, but can never physically throw?",
    category: "Bio-Physical Anomaly",
    options: [
      { id: "a", text: "A cold or sudden feelings for someone", isTarget: true, punchline: "Tissues and emotional damage included" },
      { id: "b", text: "A boomerang thrown by a novice", isTarget: false, punchline: "Those never come back anyway" },
      { id: "c", text: "The Wi-Fi signal in the basement", isTarget: false, punchline: "You can't catch what doesn't exist" },
      { id: "d", text: "A subway train that left 10 seconds early", isTarget: false, punchline: "Doors closed in your face" },
    ],
  },
];

type DailyChallenge = {
  id: string;
  title: string;
  prompt: string;
  for_date: string;
};

export default function ChallengesPage() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<ArenaTab>("mind-duel");

  // Mind Duel state
  const [qIndex, setQIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [streak, setStreak] = useState(0);
  const [multiplier, setMultiplier] = useState(1);
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(12);
  const [gameActive, setGameActive] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [bestMindScore, setBestMindScore] = useState(() => {
    try {
      return parseInt(localStorage.getItem("flick:mind_arena_best") || "0", 10);
    } catch {
      return 0;
    }
  });

  // Real flickers from database for 1v1 blitz
  const [realFlickers, setRealFlickers] = useState<TopFlicker[]>([]);
  const [loadingFlickers, setLoadingFlickers] = useState(true);
  const [selectedDuelOpponent, setSelectedDuelOpponent] = useState<TopFlicker | null>(null);
  const [customDuelRoomId, setCustomDuelRoomId] = useState<string | undefined>(undefined);

  // Daily challenges
  const [challenges, setChallenges] = useState<DailyChallenge[]>([]);

  const questionTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Handle URL duel challenge query (e.g. from push notifications: /challenges?duel=...&challenger=...)
  useEffect(() => {
    const duelId = searchParams.get("duel");
    const challengerId = searchParams.get("challenger");
    if (duelId && challengerId && user && challengerId !== user.id) {
      setCustomDuelRoomId(duelId);
      // Fetch challenger profile
      supabase
        .from("profiles")
        .select("id, handle, display_name, avatar_url")
        .eq("id", challengerId)
        .single()
        .then(({ data }) => {
          if (data) {
            setSelectedDuelOpponent({
              id: data.id,
              handle: data.handle || "flicker",
              display_name: data.display_name || "Flicker",
              avatar_url: data.avatar_url,
              bio: null,
              rank: 1,
              flicksCount: 1,
              recentFlicksCount: 1,
              likesReceived: 10,
              commentsReceived: 5,
              resharesReceived: 2,
              engagementScore: 100,
              badgeTitle: "Challenger",
              badgeIcon: "⚔️",
              badgeColor: "from-red-500 to-amber-500",
              haloColor: "rgba(239, 68, 68, 0.5)",
            });
          }
        });
    }
  }, [searchParams, user]);

  // Load real profiles from database
  useEffect(() => {
    let alive = true;
    const loadRealUsers = async () => {
      setLoadingFlickers(true);
      try {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, handle, display_name, avatar_url, bio")
          .limit(30);

        if (alive && profiles) {
          const mapped: TopFlicker[] = profiles
            .filter((p) => !user || p.id !== user.id)
            .map((p, idx) => ({
              id: p.id,
              handle: p.handle || `flicker_${idx + 1}`,
              display_name: p.display_name || `Flicker ${idx + 1}`,
              avatar_url: p.avatar_url,
              bio: p.bio,
              rank: idx + 1,
              flicksCount: 5 + idx * 2,
              recentFlicksCount: 3,
              likesReceived: 25 + idx * 10,
              commentsReceived: 10 + idx * 3,
              resharesReceived: 4 + idx,
              engagementScore: 350 + (30 - idx) * 45,
              badgeTitle: idx === 0 ? "👑 Arena Titan" : idx < 3 ? "💎 Diamond Striker" : "⚡ Apex Flicker",
              badgeIcon: idx === 0 ? "👑" : idx < 3 ? "💎" : "⚡",
              badgeColor: idx === 0 ? "from-amber-400 to-yellow-500" : "from-cyan-400 to-blue-500",
              haloColor: idx === 0 ? "rgba(245, 158, 11, 0.45)" : "rgba(6, 182, 212, 0.4)",
            }));

          setRealFlickers(mapped);
        }
      } catch (e) {
        console.warn("Failed to load profiles for arena:", e);
      } finally {
        if (alive) setLoadingFlickers(false);
      }
    };

    void loadRealUsers();

    // Load daily challenges
    supabase
      .from("daily_challenges")
      .select("*")
      .order("for_date", { ascending: false })
      .limit(20)
      .then(({ data }) => {
        if (alive && data) setChallenges(data as DailyChallenge[]);
      });

    return () => {
      alive = false;
    };
  }, [user?.id]);

  // Mind Duel timer loop
  useEffect(() => {
    if (!gameActive || isAnswered || gameOver) return;

    questionTimerRef.current = setInterval(() => {
      setTimerSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(questionTimerRef.current!);
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (questionTimerRef.current) clearInterval(questionTimerRef.current);
    };
  }, [gameActive, isAnswered, gameOver, qIndex]);

  const startMindGame = () => {
    setQIndex(0);
    setScore(0);
    setStreak(0);
    setMultiplier(1);
    setSelectedOptionId(null);
    setIsAnswered(false);
    setTimerSeconds(12);
    setGameOver(false);
    setGameActive(true);
    triggerLightHaptic();
    soundEngine.play("notification_chime");
  };

  const handleTimeUp = () => {
    setIsAnswered(true);
    setStreak(0);
    setMultiplier(1);
    soundEngine.play("auth_error");
    triggerLightHaptic();
    toast.error("Time's up! Speed matters in the arena.");
  };

  const handlePickOption = (optionId: string, isTarget: boolean) => {
    if (isAnswered) return;
    if (questionTimerRef.current) clearInterval(questionTimerRef.current);

    setSelectedOptionId(optionId);
    setIsAnswered(true);

    if (isTarget) {
      // Correct! Target absurd / clever answer matched!
      triggerSuccessHaptic();
      soundEngine.play("auth_success");
      const speedBonus = Math.max(1, timerSeconds) * 15;
      const roundPoints = Math.round((100 + speedBonus) * multiplier);
      const newScore = score + roundPoints;
      const newStreak = streak + 1;
      const nextMult = newStreak >= 4 ? 3 : newStreak >= 2 ? 2 : 1.5;

      setScore(newScore);
      setStreak(newStreak);
      setMultiplier(nextMult);

      if (newScore > bestMindScore) {
        setBestMindScore(newScore);
        try {
          localStorage.setItem("flick:mind_arena_best", String(newScore));
        } catch {}
      }

      if (newStreak >= 3) {
        fireSparkleConfetti();
      }
    } else {
      // Missed
      triggerLightHaptic();
      soundEngine.play("auth_error");
      setStreak(0);
      setMultiplier(1);
    }
  };

  const nextQuestion = () => {
    if (qIndex + 1 < MIND_QUESTIONS.length) {
      setQIndex((prev) => prev + 1);
      setSelectedOptionId(null);
      setIsAnswered(false);
      setTimerSeconds(12);
      triggerLightHaptic();
    } else {
      setGameOver(true);
      setGameActive(false);
      fireAuthConfetti();
      soundEngine.play("verification_badge");
    }
  };

  const currentQ = MIND_QUESTIONS[qIndex];

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Top Banner Header */}
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur-xl border-b border-border/70 px-4 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-red-500 text-white grid place-items-center shadow-lg shadow-amber-500/20">
            <Swords className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-display text-lg font-black tracking-tight text-foreground flex items-center gap-2">
              Flick Arena ⚡️
            </h1>
            <p className="text-[11px] text-muted-foreground font-medium">
              Realtime mind competitions, blitz duels & quests
            </p>
          </div>
        </div>

        {/* Tab Selector Buttons */}
        <div className="flex items-center gap-1 p-1 bg-secondary/80 rounded-2xl border border-border/80">
          <button
            onClick={() => {
              setActiveTab("mind-duel");
              triggerLightHaptic();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "mind-duel"
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Brain className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Mind Arena</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("blitz-1v1");
              triggerLightHaptic();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "blitz-1v1"
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Swords className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">1v1 Blitz</span>
          </button>

          <button
            onClick={() => {
              setActiveTab("daily-quests");
              triggerLightHaptic();
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === "daily-quests"
                ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Trophy className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Quests</span>
          </button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 sm:p-6 space-y-6">
        {/* ============================================================== */}
        {/* TAB 1: THE MIND ARENA (RIDDLE & BRAIN COMPETITION)             */}
        {/* ============================================================== */}
        {activeTab === "mind-duel" && (
          <div className="space-y-6">
            {/* Live Arena Scoreboard Header */}
            <div className="flex items-center justify-between p-4 rounded-3xl border border-border/80 bg-card/60 backdrop-blur-xl shadow-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 grid place-items-center font-black">
                  <Flame className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                    Arena Score
                  </div>
                  <div className="text-xl font-black text-foreground font-mono">
                    {score} <span className="text-xs text-primary font-bold">PTS</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-right">
                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                    Streak
                  </div>
                  <div className="text-lg font-black text-amber-400 font-mono flex items-center justify-end gap-1">
                    <span>🔥 {streak}</span>
                    {multiplier > 1 && (
                      <span className="text-xs px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 font-bold">
                        {multiplier}x
                      </span>
                    )}
                  </div>
                </div>

                <div className="border-l border-border pl-4">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-muted-foreground">
                    Best
                  </div>
                  <div className="text-lg font-black text-primary font-mono">
                    {bestMindScore}
                  </div>
                </div>
              </div>
            </div>

            {/* Inactive Start Card */}
            {!gameActive && !gameOver && (
              <div className="relative overflow-hidden rounded-3xl border border-primary/30 bg-gradient-to-br from-card via-card/70 to-primary/10 p-6 sm:p-8 text-center space-y-5 shadow-2xl">
                <div className="w-16 h-16 rounded-3xl bg-primary/20 border border-primary/40 text-primary mx-auto grid place-items-center shadow-lg shadow-primary/25">
                  <Brain className="w-8 h-8 animate-bounce" />
                </div>

                <div className="space-y-2">
                  <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 border border-primary/30 text-primary text-xs font-black uppercase tracking-wider">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Lateral Brain Competitions</span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-foreground tracking-tight">
                    Welcome to the Mind Arena
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">
                    Test your reflexes and lateral logic against cryptic riddles and brain busters.
                    Speed and clever thinking earn maximum combo multipliers!
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    onClick={startMindGame}
                    className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-primary text-primary-foreground font-black text-sm tracking-wide shadow-xl shadow-primary/30 hover:opacity-90 active:scale-95 transition flex items-center justify-center gap-2 mx-auto"
                  >
                    <Zap className="w-4 h-4 fill-current" />
                    <span>Enter Mind Arena (Start)</span>
                  </button>
                </div>
              </div>
            )}

            {/* Active Question Card */}
            {gameActive && currentQ && (
              <div className="space-y-4">
                {/* Timer & Category Bar */}
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-extrabold text-primary tracking-wider uppercase flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5" />
                    {currentQ.category} &bull; #{qIndex + 1} of {MIND_QUESTIONS.length}
                  </span>

                  <div
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-black border ${
                      timerSeconds <= 4
                        ? "bg-red-500/20 text-red-400 border-red-500/40 animate-pulse"
                        : "bg-secondary text-foreground border-border"
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{timerSeconds}s</span>
                  </div>
                </div>

                {/* Question Prompt */}
                <div className="rounded-3xl border border-border bg-card/80 backdrop-blur-xl p-6 sm:p-7 shadow-xl">
                  <h3 className="text-lg sm:text-xl font-black text-foreground leading-snug">
                    "{currentQ.question}"
                  </h3>

                  {/* Options Grid */}
                  <div className="mt-6 space-y-3">
                    {currentQ.options.map((opt) => {
                      const isPicked = selectedOptionId === opt.id;
                      let btnStyle = "bg-secondary/60 hover:bg-secondary text-foreground border-border";

                      if (isAnswered) {
                        if (opt.isTarget) {
                          btnStyle = "bg-emerald-500/20 border-emerald-500/60 text-emerald-300 font-bold";
                        } else if (isPicked && !opt.isTarget) {
                          btnStyle = "bg-red-500/20 border-red-500/60 text-red-300";
                        } else {
                          btnStyle = "opacity-40 border-transparent bg-secondary/30";
                        }
                      }

                      return (
                        <button
                          key={opt.id}
                          disabled={isAnswered}
                          onClick={() => handlePickOption(opt.id, opt.isTarget)}
                          className={`w-full text-left p-4 rounded-2xl border text-xs sm:text-sm transition-all active:scale-[0.99] flex items-center justify-between gap-3 ${btnStyle}`}
                        >
                          <span className="font-medium leading-relaxed">{opt.text}</span>
                          {isAnswered && opt.isTarget && (
                            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          )}
                          {isAnswered && isPicked && !opt.isTarget && (
                            <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Punchline explanation after answering */}
                  {isAnswered && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-5 p-4 rounded-2xl bg-primary/10 border border-primary/20 space-y-3"
                    >
                      <p className="text-xs text-foreground/90 font-medium">
                        💡{" "}
                        <span className="font-bold">
                          {currentQ.options.find((o) => o.isTarget)?.punchline}
                        </span>
                      </p>

                      <button
                        onClick={nextQuestion}
                        className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-primary/25 hover:opacity-90 transition active:scale-95"
                      >
                        <span>
                          {qIndex + 1 < MIND_QUESTIONS.length ? "Next Challenge" : "View Results"}
                        </span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </motion.div>
                  )}
                </div>
              </div>
            )}

            {/* Game Over / Results Card */}
            {gameOver && (
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="rounded-3xl border border-primary/40 bg-gradient-to-b from-card via-card/80 to-primary/15 p-6 sm:p-8 text-center space-y-5 shadow-2xl"
              >
                <div className="w-16 h-16 rounded-3xl bg-amber-500/20 text-amber-400 border border-amber-500/30 mx-auto grid place-items-center">
                  <Crown className="w-8 h-8" />
                </div>

                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-foreground">Gauntlet Completed!</h3>
                  <p className="text-xs text-muted-foreground">
                    Mind Arena session results
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-secondary/50 border border-border inline-block min-w-[200px]">
                  <div className="text-[11px] font-extrabold uppercase text-muted-foreground">
                    Final Score
                  </div>
                  <div className="text-3xl font-black text-primary font-mono">{score}</div>
                </div>

                <div className="pt-2 flex items-center justify-center gap-3">
                  <button
                    onClick={startMindGame}
                    className="py-3 px-6 rounded-2xl bg-primary text-primary-foreground font-bold text-xs flex items-center gap-2 shadow-lg shadow-primary/25 hover:opacity-90 active:scale-95 transition"
                  >
                    <RotateCcw className="w-4 h-4" />
                    <span>Play Again</span>
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 2: 1V1 REALTIME BLITZ DUEL (LIVE OPPONENTS)                */}
        {/* ============================================================== */}
        {activeTab === "blitz-1v1" && (
          <div className="space-y-5">
            <div className="p-5 rounded-3xl border border-red-500/30 bg-gradient-to-r from-red-500/10 via-card to-amber-500/10 backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-red-500/20 text-red-400 text-[11px] font-black uppercase tracking-wider">
                    <Flame className="w-3.5 h-3.5 animate-pulse" />
                    Live 1v1 Blitz
                  </span>
                  <h2 className="text-xl font-black text-foreground tracking-tight">
                    Realtime Peer-to-Peer Duels
                  </h2>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Challenge active flickers to 5-second rapid speed battles. Instant live broadcast
                    and push notifications guarantee opponent alerts!
                  </p>
                </div>
              </div>
            </div>

            {/* List of Real Active Flickers from Database */}
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-primary" />
                  Active Community Flickers ({realFlickers.length})
                </h3>
              </div>

              {loadingFlickers ? (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  Loading active flickers…
                </div>
              ) : realFlickers.length === 0 ? (
                <div className="p-8 text-center text-xs text-muted-foreground border border-border rounded-2xl bg-card/40">
                  No other accounts found in database yet. Sign up another account to duel!
                </div>
              ) : (
                <div className="rounded-3xl border border-border bg-card/40 divide-y divide-border/60 overflow-hidden shadow-lg">
                  {realFlickers.map((flicker) => (
                    <div
                      key={flicker.id}
                      className="p-4 flex items-center justify-between gap-3 hover:bg-secondary/40 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Avatar
                          url={flicker.avatar_url}
                          name={flicker.display_name}
                          size={42}
                        />
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-foreground truncate flex items-center gap-1.5">
                            <span>{flicker.display_name}</span>
                            <span className="text-[11px] text-amber-400">{flicker.badgeIcon}</span>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            @{flicker.handle}
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => {
                          setSelectedDuelOpponent(flicker);
                          setCustomDuelRoomId(undefined);
                          triggerLightHaptic();
                        }}
                        className="py-2 px-3.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs transition active:scale-95 shadow-md shadow-red-600/30 flex items-center gap-1.5 shrink-0"
                      >
                        <Swords className="w-3.5 h-3.5" />
                        <span>Duel ⚔️</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* TAB 3: DAILY COMMUNITY QUESTS                                  */}
        {/* ============================================================== */}
        {activeTab === "daily-quests" && (
          <div className="space-y-4">
            <div className="p-5 rounded-3xl border border-primary/30 bg-card/60 backdrop-blur-xl">
              <h2 className="text-lg font-black text-foreground flex items-center gap-2">
                <Trophy className="w-5 h-5 text-primary" />
                Daily Creative Quests
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Post stories and flicks fulfilling today's creative prompts to earn streak badges.
              </p>
            </div>

            {challenges.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground border border-border rounded-2xl bg-card/30">
                No quests active for today. Check back tomorrow!
              </div>
            ) : (
              <div className="space-y-3">
                {challenges.map((c) => (
                  <div
                    key={c.id}
                    className="p-5 rounded-3xl border border-border bg-card/50 hover:border-primary/40 transition space-y-2 shadow-md"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-extrabold uppercase tracking-wider text-primary">
                        {c.for_date}
                      </span>
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                        Active
                      </span>
                    </div>
                    <h3 className="font-bold text-base text-foreground">{c.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{c.prompt}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Live Duel Modal Integration */}
      {selectedDuelOpponent && (
        <DuelModal
          open={Boolean(selectedDuelOpponent)}
          onClose={() => {
            setSelectedDuelOpponent(null);
            setCustomDuelRoomId(undefined);
          }}
          opponent={selectedDuelOpponent}
          customRoomId={customDuelRoomId}
        />
      )}
    </div>
  );
}
