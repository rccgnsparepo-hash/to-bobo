import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Hourglass, Lock, Delete, Sparkles, AlertCircle } from "lucide-react";
import { useAppPrefs } from "@/lib/appPrefs";
import {
  todaySeconds,
  todayMinutes,
  isDailyLimitExceeded,
  grantGracePeriod,
  USAGE_EVENT,
} from "@/lib/usage";
import { toast } from "sonner";

export function ScreenTimeLockout() {
  const { prefs } = useAppPrefs();
  const [locked, setLocked] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const checkStatus = () => {
    if (prefs.dailyLimitMin > 0 && isDailyLimitExceeded(prefs.dailyLimitMin)) {
      setLocked(true);
    } else {
      setLocked(false);
    }
  };

  useEffect(() => {
    checkStatus();
    window.addEventListener(USAGE_EVENT, checkStatus);
    window.addEventListener("flick:grace-granted", checkStatus);
    return () => {
      window.removeEventListener(USAGE_EVENT, checkStatus);
      window.removeEventListener("flick:grace-granted", checkStatus);
    };
  }, [prefs.dailyLimitMin]);

  const handleDigit = (d: string) => {
    if (pin.length >= 4) return;
    const next = pin + d;
    setPin(next);
    setError(false);
    if (next.length === 4) {
      verifyPin(next);
    }
  };

  const handleBackspace = () => {
    setPin((p) => p.slice(0, -1));
    setError(false);
  };

  const verifyPin = (candidate: string) => {
    const valid = candidate === (prefs.screenTimePin || "1234");
    if (valid) {
      grantGracePeriod(15);
      toast.success("Passcode verified! +15 minutes added to your session.", {
        icon: <Sparkles className="w-4 h-4 text-snap" />,
      });
      setPin("");
      setLocked(false);
    } else {
      setError(true);
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate([100, 50, 100]);
      }
      setTimeout(() => {
        setPin("");
      }, 500);
    }
  };

  if (!mounted || !locked) return null;

  return createPortal(
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-2xl flex flex-col items-center justify-center p-6 text-foreground select-none"
      >
        <div className="w-full max-w-sm flex flex-col items-center text-center">
          {/* Pulsing icon */}
          <div className="relative mb-5">
            <div className="w-20 h-20 rounded-3xl bg-snap/15 border border-snap/30 text-snap flex items-center justify-center shadow-[0_0_40px_rgba(197,232,99,0.25)]">
              <Hourglass className="w-10 h-10 animate-pulse text-snap" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-background border border-border flex items-center justify-center text-muted-foreground">
              <Lock className="w-3.5 h-3.5" />
            </div>
          </div>

          <h1 className="font-display text-2xl sm:text-3xl tracking-tight text-foreground">
            Daily Screen Time Limit
          </h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xs leading-relaxed">
            You've reached your daily limit of{" "}
            <span className="text-foreground font-semibold">{prefs.dailyLimitMin} mins</span> on
            Flick. You've spent{" "}
            <span className="text-snap font-semibold">{todayMinutes()} mins</span> today.
          </p>

          <div className="mt-3 px-3 py-1 rounded-full bg-secondary/80 border border-border text-xs text-muted-foreground flex items-center gap-1.5">
            <span>Default Passcode:</span>
            <span className="font-mono font-bold text-foreground">1234</span>
          </div>

          {/* 4-digit PIN Dots */}
          <motion.div
            animate={error ? { x: [-10, 10, -8, 8, -4, 4, 0] } : {}}
            transition={{ duration: 0.4 }}
            className="flex items-center justify-center gap-4 my-6"
          >
            {[0, 1, 2, 3].map((idx) => {
              const filled = pin.length > idx;
              return (
                <div
                  key={idx}
                  className={`w-4 h-4 rounded-full transition-all duration-200 ${
                    filled
                      ? "bg-snap scale-125 shadow-[0_0_12px_rgba(197,232,99,0.7)]"
                      : error
                      ? "border-2 border-destructive bg-destructive/20"
                      : "border-2 border-muted-foreground/40 bg-secondary/40"
                  }`}
                />
              );
            })}
          </motion.div>

          {error && (
            <div className="text-xs text-destructive flex items-center gap-1 mb-4 font-medium">
              <AlertCircle className="w-3.5 h-3.5" />
              Incorrect passcode. Try 1234
            </div>
          )}

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
              <button
                key={digit}
                type="button"
                onClick={() => handleDigit(digit)}
                className="h-14 rounded-2xl bg-secondary/60 hover:bg-secondary border border-border/60 active:scale-95 transition text-xl font-semibold flex items-center justify-center text-foreground"
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPin("")}
              className="h-14 rounded-2xl hover:bg-secondary/40 transition text-xs font-semibold text-muted-foreground flex items-center justify-center"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => handleDigit("0")}
              className="h-14 rounded-2xl bg-secondary/60 hover:bg-secondary border border-border/60 active:scale-95 transition text-xl font-semibold flex items-center justify-center text-foreground"
            >
              0
            </button>
            <button
              type="button"
              onClick={handleBackspace}
              aria-label="Delete digit"
              className="h-14 rounded-2xl hover:bg-secondary/40 transition flex items-center justify-center text-muted-foreground active:scale-95"
            >
              <Delete className="w-5 h-5" />
            </button>
          </div>

          <p className="text-[11px] text-muted-foreground/80 mt-6 max-w-xs">
            TikTok-style digital wellbeing protection. Entering your PIN grants +15 minutes of screen time.
          </p>
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}
