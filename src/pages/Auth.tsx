import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import { trigger3DToast } from "@/components/ui/Auth3DToast";
import { Mail, Lock, User, ArrowRight, Loader2, Sparkles, KeyRound } from "lucide-react";
import { sendFirebasePasswordReset } from "@/lib/firebaseAuth";

export default function AuthPage() {
  const nav = useNavigate();
  const { session } = useAuth();
  const [params] = useSearchParams();
  const rawNext = params.get("next") ?? "";
  const next = /^\/(?!\/)/.test(rawNext) ? rawNext : "";
  const returnUrl = next ? window.location.origin + next : window.location.origin;

  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetBusy, setResetBusy] = useState(false);

  // Recovery state for resetting password
  const [isRecovery, setIsRecovery] = useState(() => {
    if (typeof window === "undefined") return false;
    const urlParams = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    return (
      urlParams.get("reset") === "true" ||
      hash.includes("type=recovery") ||
      urlParams.get("type") === "recovery"
    );
  });
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [updateBusy, setUpdateBusy] = useState(false);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });
    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session || isRecovery) return;
    trigger3DToast({
      type: "success",
      title: "Welcome back!",
      description: "You're safely signed into Flick.",
    });
    if (next) window.location.replace(next);
    else nav("/", { replace: true });
  }, [session, isRecovery, nav, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    if (!navigator.onLine) {
      trigger3DToast({
        type: "error",
        title: "Connection Failed",
        description: "Check your internet connection and try again.",
        action: {
          label: "Retry",
          onClick: () => {
            void submit(e);
          },
        },
      });
      return;
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const cleanHandle = handle.trim().replace(/^@/, "").toLowerCase();
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: returnUrl,
            data: {
              handle: cleanHandle || email.split("@")[0].toLowerCase(),
              display_name: cleanHandle || email.split("@")[0],
            },
          },
        });
        if (error) throw error;

        if (data.session) {
          trigger3DToast({
            type: "success",
            title: "Welcome to Flick! ⚡️",
            description: "Your account was successfully created.",
          });
        } else {
          trigger3DToast({
            type: "info",
            title: "Account Created",
            description: "Please check your email to confirm your account, or sign in directly.",
          });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        // Navigation and success toast are handled by session change listener above
      }
    } catch (err: unknown) {
      const msg = (err as Error).message || "";
      if (
        msg.toLowerCase().includes("invalid login credentials") ||
        msg.toLowerCase().includes("invalid grant")
      ) {
        trigger3DToast({
          type: "error",
          title: "Incorrect Email or Password",
          description: "Double-check your credentials and try again, or reset your password.",
        });
      } else if (msg.toLowerCase().includes("network") || msg.toLowerCase().includes("fetch")) {
        trigger3DToast({
          type: "error",
          title: "Connection Failed",
          description: "Connection error. Check your internet connection and try again.",
          action: {
            label: "Retry",
            onClick: () => {
              void submit(e);
            },
          },
        });
      } else {
        trigger3DToast({
          type: "error",
          title: "Authentication Failed",
          description: msg || "Unable to complete request. Please try again.",
        });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: returnUrl,
        },
      });
      if (error) {
        console.error("[Google OAuth Diagnostic] Supabase OAuth returned error:", error);
        trigger3DToast({
          type: "warning",
          title: "Google Sign-in Couldn't Be Completed",
          description:
            "Google OAuth is not configured on this project yet. Please use email and password to sign in or register below.",
        });
      }
    } catch (err) {
      console.error("[Google OAuth Diagnostic] OAuth Exception:", err);
      trigger3DToast({
        type: "error",
        title: "Google Sign-in Failed",
        description: "Could not initiate Google authentication. Please sign in with email.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetBusy(true);
    try {
      const result = await sendFirebasePasswordReset(resetEmail.trim());
      trigger3DToast({
        type: "success",
        title: "Password Reset Sent",
        description: result.message,
      });
      setShowForgotModal(false);
      setResetEmail("");
    } catch (err) {
      trigger3DToast({
        type: "error",
        title: "Password Reset Failed",
        description: (err as Error).message || "Could not send reset email.",
      });
    } finally {
      setResetBusy(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      trigger3DToast({
        type: "error",
        title: "Password Too Short",
        description: "Password must be at least 6 characters.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      trigger3DToast({
        type: "error",
        title: "Passwords Don't Match",
        description: "Please confirm your new password matches.",
      });
      return;
    }
    setUpdateBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      trigger3DToast({
        type: "success",
        title: "Password Updated! ⚡️",
        description: "Your new password is now active. Welcome back!",
      });
      setIsRecovery(false);
      setNewPassword("");
      setConfirmPassword("");
      nav("/", { replace: true });
    } catch (err: unknown) {
      trigger3DToast({
        type: "error",
        title: "Update Failed",
        description: (err as Error).message || "Could not update password.",
      });
    } finally {
      setUpdateBusy(false);
    }
  };

  return (
    <main className="min-h-screen grid grid-cols-1 md:grid-cols-2 overflow-hidden bg-background">
      {/* Noir Brand Left Panel */}
      <motion.section
        initial={{ x: "-100%" }}
        animate={{ x: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="surface-noir relative hidden md:flex flex-col justify-between p-12 overflow-hidden border-r border-white/10"
      >
        <Link to="/" className="flex items-center gap-3 font-display text-4xl text-snap tracking-tight z-10">
          <img
            src="/brand/logo.png"
            alt="Logo"
            className="h-10 w-auto object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = "none";
            }}
          />
          <span>FLICK<span className="text-white">.</span></span>
        </Link>
        <div className="absolute inset-0 bg-cover bg-center opacity-30 pointer-events-none mix-blend-luminosity" style={{ backgroundImage: "url('/brand/auth-template-1.png')" }} />
        <div className="absolute -left-32 top-1/4 w-[480px] h-[480px] rounded-full bg-snap/20 blur-[100px] pointer-events-none" />
        <div className="absolute -right-20 bottom-1/4 w-[360px] h-[360px] rounded-full bg-emerald-500/15 blur-[90px] pointer-events-none" />

        <div className="relative space-y-6 z-10 max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-snap/15 border border-snap/30 text-snap text-xs font-bold tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Next-Gen Realtime Social</span>
          </div>
          <h1 className="font-display text-6xl xl:text-7xl leading-[0.9] text-white">
            Share
            <br />
            moments
            <br />
            <span className="text-snap underline decoration-snap/40 underline-offset-8">
              instantly
            </span>
            .
          </h1>
          <p className="text-white/70 text-sm leading-relaxed">
            Fast moments, real conversations, zero clutter.
          </p>
        </div>
        <div className="relative text-[11px] uppercase tracking-[0.3em] text-white/50 z-10 flex items-center justify-between">
          <span>v2.0 · 2026 · Flick Engine</span>
          <span>End-to-End Realtime</span>
        </div>
      </motion.section>

      {/* Form Panel Right */}
      <motion.section
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="relative flex items-center justify-center p-6 md:p-12 overflow-y-auto"
      >
        <div className="w-full max-w-sm space-y-6">
          <div>
            <Link to="/" className="md:hidden flex items-center gap-2.5 mb-6 font-display text-4xl text-snap">
              <img
                src="/brand/logo.png"
                alt="Logo"
                className="h-8 w-auto object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                }}
              />
              <span>flick<span className="text-foreground">.</span></span>
            </Link>
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-snap">
              {isRecovery ? "Security" : mode === "signup" ? "Get Started" : "Welcome Back"}
            </span>
            <h2 className="font-display text-3xl md:text-4xl mt-1 tracking-tight">
              {isRecovery ? "Set new password" : mode === "signup" ? "Create your account" : "Sign in to Flick"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1.5">
              {isRecovery
                ? "Enter and confirm your new secure account password below."
                : mode === "signup"
                ? "Join the network, connect with flickers and start sharing."
                : "Enter your credentials to access your flicks and chats."}
            </p>
          </div>

          {isRecovery ? (
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="relative">
                <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="New password (min 6 chars)"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-secondary/50 border border-border focus:outline-none focus:border-snap focus:ring-1 focus:ring-snap text-sm placeholder:text-muted-foreground transition"
                />
              </div>

              <div className="relative">
                <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-secondary/50 border border-border focus:outline-none focus:border-snap focus:ring-1 focus:ring-snap text-sm placeholder:text-muted-foreground transition"
                />
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                disabled={updateBusy}
                type="submit"
                className="w-full py-3.5 rounded-2xl bg-snap text-snap-foreground font-bold text-sm disabled:opacity-60 shadow-lg shadow-snap/20 flex items-center justify-center gap-2 hover:brightness-105 transition"
              >
                {updateBusy ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Updating password...</span>
                  </>
                ) : (
                  <>
                    <span>Save New Password & Continue</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsRecovery(false);
                    setMode("signin");
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground transition underline-offset-4 hover:underline"
                >
                  Back to Sign In
                </button>
              </div>
            </form>
          ) : (
            <>
              {/* Google Sign-in Action */}
              <button
                type="button"
                disabled={busy}
                onClick={handleGoogleSignIn}
                className="w-full py-3 px-4 rounded-2xl bg-secondary/80 hover:bg-secondary border border-border flex items-center justify-center gap-3 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-60 shadow-sm"
              >
                <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>

              <div className="relative flex items-center justify-center">
                <div className="border-t border-border w-full" />
                <span className="bg-background px-3 text-[11px] uppercase tracking-wider text-muted-foreground shrink-0">
                  or continue with email
                </span>
              </div>

              <form onSubmit={submit} className="space-y-3.5">
                {mode === "signup" && (
                  <div className="relative">
                    <User className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      required
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      placeholder="@handle"
                      className="w-full pl-10 pr-4 py-3 rounded-2xl bg-secondary/50 border border-border focus:outline-none focus:border-snap focus:ring-1 focus:ring-snap text-sm placeholder:text-muted-foreground transition"
                    />
                  </div>
                )}

                <div className="relative">
                  <Mail className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl bg-secondary/50 border border-border focus:outline-none focus:border-snap focus:ring-1 focus:ring-snap text-sm placeholder:text-muted-foreground transition"
                  />
                </div>

                <div className="relative">
                  <Lock className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="password (min 6 chars)"
                    className="w-full pl-10 pr-4 py-3 rounded-2xl bg-secondary/50 border border-border focus:outline-none focus:border-snap focus:ring-1 focus:ring-snap text-sm placeholder:text-muted-foreground transition"
                  />
                </div>

                {mode === "signin" && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => setShowForgotModal(true)}
                      className="text-xs text-snap hover:underline font-medium"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <motion.button
                  whileTap={{ scale: 0.98 }}
                  disabled={busy}
                  type="submit"
                  className="w-full py-3.5 rounded-2xl bg-snap text-snap-foreground font-bold text-sm disabled:opacity-60 shadow-lg shadow-snap/20 flex items-center justify-center gap-2 hover:brightness-105 transition"
                >
                  {busy ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Processing...</span>
                    </>
                  ) : (
                    <>
                      <span>{mode === "signup" ? "Create Flick Account" : "Sign in"}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>
              </form>

              <div className="text-center pt-2">
                <button
                  type="button"
                  onClick={() => setMode(mode === "signup" ? "signin" : "signup")}
                  className="text-xs text-muted-foreground hover:text-foreground transition underline-offset-4 hover:underline"
                >
                  {mode === "signup"
                    ? "Already have an account? Sign in →"
                    : "New to Flick? Create an account →"}
                </button>
              </div>
            </>
          )}
        </div>
      </motion.section>

      {/* Forgot Password Modal */}
      <AnimatePresence>
        {showForgotModal && (
          <div className="fixed inset-0 z-[1000] bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              className="w-full max-w-md bg-card border border-border rounded-3xl p-6 shadow-2xl relative"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className="w-9 h-9 rounded-xl bg-snap/15 border border-snap/30 text-snap flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-lg">Reset Password</h3>
                  <p className="text-xs text-muted-foreground">Enter your registered email</p>
                </div>
              </div>
              <form onSubmit={handleResetPassword} className="space-y-4 mt-4">
                <input
                  type="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  className="w-full px-4 py-3 rounded-2xl bg-secondary border border-border text-sm focus:outline-none focus:ring-1 focus:ring-snap"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForgotModal(false)}
                    className="flex-1 py-2.5 rounded-xl bg-secondary font-semibold text-xs hover:bg-secondary/70 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={resetBusy}
                    className="flex-1 py-2.5 rounded-xl bg-snap text-snap-foreground font-bold text-xs hover:brightness-105 transition disabled:opacity-60"
                  >
                    {resetBusy ? "Sending..." : "Send Reset Link"}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
