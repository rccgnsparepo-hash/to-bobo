import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, PhoneCall, PhoneOff, Users, ChevronUp, ChevronDown, Sparkles, Radio } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { triggerLightHaptic } from "@/lib/haptics";
import { playSound } from "@/lib/soundEngine";
import { useAuth } from "@/lib/auth";

export function FloatingLiveRoom() {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [joined, setJoined] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const sampleParticipants = [
    {
      id: "p1",
      name: "Alex Vance",
      handle: "alex",
      avatar_url: "/brand/avatar-1.png",
      isSpeaking: true,
    },
    {
      id: "p2",
      name: "Chioma Okoye",
      handle: "chioma",
      avatar_url: "/brand/avatar-2.png",
      isSpeaking: false,
    },
    {
      id: "p3",
      name: "Liam Chen",
      handle: "liam",
      avatar_url: "/brand/avatar-3.png",
      isSpeaking: false,
    },
  ];

  const handleToggleJoin = () => {
    void triggerLightHaptic();
    if (!joined) {
      playSound("call_connect");
      setJoined(true);
    } else {
      playSound("call_disconnect");
      setJoined(false);
    }
  };

  return (
    <div className="fixed bottom-20 lg:bottom-6 right-4 z-40">
      <motion.div
        layout
        transition={{ type: "spring", stiffness: 420, damping: 28 }}
        className="bg-[#0e1017]/95 border border-white/20 rounded-3xl p-3.5 shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-2xl text-white max-w-xs overflow-hidden"
      >
        {/* Header bar / Mini trigger */}
        <div
          onClick={() => setIsOpen((v) => !v)}
          className="flex items-center justify-between gap-3 cursor-pointer select-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 absolute -top-0.5 -right-0.5 animate-ping" />
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 flex items-center justify-center">
                <Radio className="w-4 h-4 animate-pulse" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold leading-none">Voice Lounge</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-white/10 rounded-full font-mono text-white/70">
                  {sampleParticipants.length + (joined ? 1 : 0)} live
                </span>
              </div>
              <p className="text-[10px] text-white/60 mt-0.5">Community Drop-in Audio</p>
            </div>
          </div>

          <button
            type="button"
            className="p-1 rounded-full text-white/50 hover:text-white transition"
          >
            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>

        {/* Live waveform equalizer */}
        <div className="flex items-center gap-1 h-3 my-2 px-1">
          {[40, 90, 60, 100, 70, 30, 80, 50, 95, 45].map((h, idx) => (
            <motion.div
              key={idx}
              animate={{ height: [`${h * 0.2}%`, `${h}%`, `${h * 0.4}%`] }}
              transition={{
                duration: 0.6 + (idx % 3) * 0.2,
                repeat: Infinity,
                repeatType: "reverse",
                ease: "easeInOut",
              }}
              className="flex-1 bg-snap rounded-full opacity-80"
              style={{ minHeight: "2px" }}
            />
          ))}
        </div>

        {/* Expanded Details (from video) */}
        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-3 pt-2 border-t border-white/10"
            >
              <div className="flex items-center justify-between text-[11px] text-white/60">
                <span>Participants ({sampleParticipants.length})</span>
                <span className="text-snap font-semibold">HD Audio</span>
              </div>

              {/* Avatars Stack */}
              <div className="space-y-2">
                {sampleParticipants.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="relative">
                        <Avatar url={p.avatar_url} name={p.name} size={28} />
                        {p.isSpeaking && (
                          <span className="absolute -inset-0.5 rounded-full border-2 border-snap animate-ping pointer-events-none" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-semibold block truncate">{p.name}</span>
                        <span className="text-[10px] text-white/50 truncate block">@{p.handle}</span>
                      </div>
                    </div>
                    {p.isSpeaking ? (
                      <span className="text-[10px] font-bold text-snap flex items-center gap-1">
                        <Mic className="w-3 h-3 text-snap animate-pulse" />
                        Speaking
                      </span>
                    ) : (
                      <span className="text-[10px] text-white/40">Listening</span>
                    )}
                  </div>
                ))}

                {joined && (
                  <div className="flex items-center justify-between gap-2 py-1 bg-white/5 px-2 rounded-xl">
                    <div className="flex items-center gap-2">
                      <Avatar
                        url={profile?.avatar_url}
                        name={profile?.display_name || "You"}
                        size={28}
                      />
                      <div>
                        <span className="text-xs font-bold text-snap">You (Connected)</span>
                        <span className="text-[10px] text-white/60 block">
                          {isMuted ? "Muted" : "Active mic"}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsMuted((v) => !v)}
                      className={`p-1.5 rounded-xl text-xs ${
                        isMuted ? "bg-red-500/20 text-red-400" : "bg-white/10 text-white"
                      }`}
                    >
                      {isMuted ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                )}
              </div>

              {/* Join / Leave Button */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleToggleJoin}
                  className={`w-full py-2.5 rounded-2xl text-xs font-bold flex items-center justify-center gap-2 transition active:scale-[0.98] ${
                    joined
                      ? "bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30"
                      : "bg-snap text-black shadow-md hover:brightness-105"
                  }`}
                >
                  {joined ? (
                    <>
                      <PhoneOff className="w-3.5 h-3.5" />
                      <span>Leave Lounge</span>
                    </>
                  ) : (
                    <>
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>Join Now</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
