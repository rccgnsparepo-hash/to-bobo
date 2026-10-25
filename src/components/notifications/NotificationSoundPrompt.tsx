import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Volume2, X, SlidersHorizontal, Bell } from "lucide-react";
import { triggerLightHaptic } from "@/lib/haptics";
import { playSound } from "@/lib/soundEngine";
import { SettingsDetail } from "@/components/settings/SettingsDetail";

const PROMPT_DISMISSED_KEY = "flick:faaaah_sound_prompt_dismissed_v2";

export function NotificationSoundPrompt() {
  const [show, setShow] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    // Check if dismissed before
    const isDismissed = localStorage.getItem(PROMPT_DISMISSED_KEY);
    if (!isDismissed) {
      // Delay initial presentation by 2.5s for seamless page entry
      const timer = setTimeout(() => {
        setShow(true);
      }, 2500);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = () => {
    setShow(false);
    triggerLightHaptic();
    try {
      localStorage.setItem(PROMPT_DISMISSED_KEY, "true");
    } catch {}
  };

  const openSettings = () => {
    dismiss();
    setSettingsOpen(true);
  };

  return (
    <>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.95 }}
            className="fixed top-14 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md p-3.5 rounded-2xl bg-[#141724]/95 border-2 border-snap/40 backdrop-blur-xl shadow-2xl flex items-center justify-between gap-3 text-white"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-snap/20 border border-snap/30 text-snap flex items-center justify-center shrink-0">
                <Volume2 className="w-5 h-5 animate-pulse" />
              </div>
              <div className="min-w-0">
                <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                  <span>Custom Sound Alert</span>
                  <span className="px-1.5 py-0.2 rounded bg-snap text-black text-[9px] font-black uppercase">New</span>
                </div>
                <p className="text-[11px] text-zinc-300 leading-tight mt-0.5 truncate">
                  Turn the signature &ldquo;Faaaaah&rdquo; notification sound ON or OFF in Settings.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={openSettings}
                className="px-2.5 py-1.5 rounded-xl bg-snap text-black font-extrabold text-xs hover:brightness-110 active:scale-95 transition shadow-sm"
              >
                Settings
              </button>
              <button
                type="button"
                onClick={dismiss}
                className="p-1.5 text-zinc-400 hover:text-white rounded-lg transition"
                aria-label="Dismiss sound tip"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {settingsOpen && (
        <SettingsDetail panel="notifications" onClose={() => setSettingsOpen(false)} />
      )}
    </>
  );
}
