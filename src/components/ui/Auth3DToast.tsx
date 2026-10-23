import React, { createContext, useContext, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle, Info, RefreshCw, X } from "lucide-react";
import { playSound } from "@/lib/soundEngine";

export type ToastType = "success" | "error" | "warning" | "info";

export type AuthToastOptions = {
  id?: string;
  type: ToastType;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  durationMs?: number;
};

type ToastContextType = {
  show3DToast: (opts: AuthToastOptions) => void;
  dismiss3DToast: (id: string) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

let globalShowToast: ((opts: AuthToastOptions) => void) | null = null;

/**
 * Direct function to trigger 3D Toast from anywhere in the app without hooks.
 */
export function trigger3DToast(opts: AuthToastOptions) {
  if (globalShowToast) {
    globalShowToast(opts);
  }
}

export function Auth3DToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<AuthToastOptions[]>([]);

  const dismiss3DToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show3DToast = useCallback(
    (opts: AuthToastOptions) => {
      const id = opts.id || `toast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const toastItem: AuthToastOptions = {
        ...opts,
        id,
        durationMs: opts.durationMs ?? (opts.type === "error" ? 6000 : 4000),
      };

      // Sound cue
      if (opts.type === "success") {
        playSound("auth_success");
      } else if (opts.type === "error") {
        playSound("auth_error");
      } else {
        playSound("notification_chime");
      }

      setToasts((prev) => {
        // Prevent duplicate toasts with identical title
        const filtered = prev.filter((t) => t.title !== opts.title);
        return [toastItem, ...filtered.slice(0, 2)];
      });

      if (toastItem.durationMs && toastItem.durationMs > 0) {
        setTimeout(() => {
          dismiss3DToast(id);
        }, toastItem.durationMs);
      }
    },
    [dismiss3DToast]
  );

  globalShowToast = show3DToast;

  return (
    <ToastContext.Provider value={{ show3DToast, dismiss3DToast }}>
      {children}
      {/* 3D Toast Container */}
      <div className="fixed top-5 inset-x-4 md:inset-x-auto md:right-6 md:w-[400px] z-[99999] pointer-events-none flex flex-col gap-2.5">
        <AnimatePresence mode="popLayout">
          {toasts.map((toast) => (
            <motion.div
              key={toast.id}
              layout
              initial={{ opacity: 0, y: -24, scale: 0.9, rotateX: 18 }}
              animate={{ opacity: 1, y: 0, scale: 1, rotateX: 0 }}
              exit={{ opacity: 0, scale: 0.92, y: -20, rotateX: -12 }}
              transition={{
                type: "spring",
                stiffness: 420,
                damping: 28,
                mass: 0.8,
              }}
              style={{
                perspective: 1000,
                transformStyle: "preserve-3d",
              }}
              className="pointer-events-auto"
            >
              <div
                className={`relative overflow-hidden rounded-2xl p-4 border backdrop-blur-2xl shadow-2xl transition-all ${
                  toast.type === "success"
                    ? "bg-[#0d1f12]/90 border-emerald-500/40 shadow-[0_12px_32px_rgba(16,185,129,0.25)] text-emerald-100"
                    : toast.type === "error"
                      ? "bg-[#250e11]/90 border-red-500/40 shadow-[0_12px_32px_rgba(239,68,68,0.25)] text-red-100"
                      : toast.type === "warning"
                        ? "bg-[#251b0a]/90 border-amber-500/40 shadow-[0_12px_32px_rgba(245,158,11,0.25)] text-amber-100"
                        : "bg-[#0f1424]/90 border-blue-500/40 shadow-[0_12px_32px_rgba(59,130,246,0.25)] text-blue-100"
                }`}
              >
                {/* 3D Specular Light Sweep */}
                <div className="absolute inset-x-0 -top-px h-px bg-gradient-to-r from-transparent via-white/50 to-transparent pointer-events-none" />
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl pointer-events-none" />

                <div className="flex items-start gap-3 relative z-10">
                  {/* Status Icon with 3D Depth Pill */}
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border shadow-inner ${
                      toast.type === "success"
                        ? "bg-emerald-500/20 border-emerald-400/40 text-emerald-400"
                        : toast.type === "error"
                          ? "bg-red-500/20 border-red-400/40 text-red-400"
                          : toast.type === "warning"
                            ? "bg-amber-500/20 border-amber-400/40 text-amber-400"
                            : "bg-blue-500/20 border-blue-400/40 text-blue-400"
                    }`}
                  >
                    {toast.type === "success" && <CheckCircle2 className="w-5 h-5" />}
                    {toast.type === "error" && <XCircle className="w-5 h-5" />}
                    {toast.type === "warning" && <AlertTriangle className="w-5 h-5" />}
                    {toast.type === "info" && <Info className="w-5 h-5" />}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0 pr-1">
                    <h4 className="font-bold text-sm tracking-tight leading-tight text-white">
                      {toast.title}
                    </h4>
                    {toast.description && (
                      <p className="text-xs mt-1 text-white/80 leading-relaxed break-words">
                        {toast.description}
                      </p>
                    )}

                    {/* Optional Action / Retry Button */}
                    {toast.action && (
                      <button
                        type="button"
                        onClick={() => {
                          toast.action?.onClick();
                          if (toast.id) dismiss3DToast(toast.id);
                        }}
                        className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold bg-white/15 hover:bg-white/25 text-white transition active:scale-95 shadow-sm"
                      >
                        <RefreshCw className="w-3 h-3" />
                        {toast.action.label}
                      </button>
                    )}
                  </div>

                  {/* Dismiss Close Button */}
                  <button
                    type="button"
                    onClick={() => toast.id && dismiss3DToast(toast.id)}
                    className="p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition shrink-0"
                    aria-label="Dismiss toast"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function use3DToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    return {
      show3DToast: trigger3DToast,
      dismiss3DToast: () => {},
    };
  }
  return ctx;
}
