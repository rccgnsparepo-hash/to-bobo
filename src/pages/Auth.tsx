import { useEffect, useState, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { motion, AnimatePresence } from "framer-motion";
import { trigger3DToast } from "@/components/ui/Auth3DToast";
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  Loader2,
  Sparkles,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  Check,
  RefreshCw,
  Shield,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { sendFirebasePasswordReset } from "@/lib/firebaseAuth";
import { fireAuthConfetti } from "@/lib/confetti";
import { notificationAudio } from "@/lib/notificationAudio";

type FeedbackState = {
  type: "error" | "success" | "warning" | "info";
  title: string;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
} | null;

export default function AuthPage() {
  const nav = useNavigate();
  const { session } = useAuth();
  const [params] = useSearchParams();
  const rawNext = params.get("next") ?? "";
  const next = /^\/(?!\/)/.test(rawNext) ? rawNext : "";

  const [mode, setMode] = useState<"signin" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);
  const [statusStep, setStatusStep] = useState<string>("");
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [isSuccessAnimated, setIsSuccessAnimated] = useState(false);
  const [successModal, setSuccessModal] = useState<{
    title: string;
    description: string;
    email: string;
    actionLabel?: string;
    onProceed: () => void;
  } | null>(null);

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

  // When already signed in or when login finishes
  useEffect(() => {
    if (!session || isRecovery) return;
    if (!isSuccessAnimated) {
      trigger3DToast({
        type: "success",
        title: "Welcome back!",
        description: "You're safely signed into Flick.",
      });
      if (next) window.location.replace(next);
      else nav("/", { replace: true });
    }
  }, [session, isRecovery, nav, next, isSuccessAnimated]);

  const validateInputs = (): boolean => {
    setFeedback(null);
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      setFeedback({
        type: "warning",
        title: "Invalid Email Address",
        message: "Please enter a valid email address (e.g. name@example.com).",
      });
      trigger3DToast({
        type: "warning",
        title: "Invalid Email Address",
        description: "Please check your email address format.",
      });
      return false;
    }

    if (password.length < 6) {
      setFeedback({
        type: "warning",
        title: "Password Too Short",
        message: "Your password must contain at least 6 characters.",
      });
      trigger3DToast({
        type: "warning",
        title: "Password Too Short",
        description: "Password must be at least 6 characters.",
      });
      return false;
    }

    if (mode === "signup") {
      const cleanHandle = handle.trim().replace(/^@/, "");
      if (cleanHandle.length < 2) {
        setFeedback({
          type: "warning",
          title: "Handle Required",
          message: "Please choose a unique @handle with at least 2 characters.",
        });
        trigger3DToast({
          type: "warning",
          title: "Handle Required",
          description: "Choose a handle with at least 2 characters.",
        });
        return false;
      }
    }

    return true;
  };

  const executeSignUp = async () => {
    setBusy(true);
    setStatusStep("Registering profile & secure keys...");
    try {
      const cleanHandle = handle.trim().replace(/^@/, "").toLowerCase();
      const returnUrl = next ? window.location.origin + next : window.location.origin;

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

      // Safe profile provision in case database trigger is pending
      if (data.user) {
        try {
          await supabase
            .from("profiles")
            .upsert(
              {
                id: data.user.id,
                handle: cleanHandle || email.split("@")[0].toLowerCase(),
                display_name: cleanHandle || email.split("@")[0],
                avatar_url: `https://api.dicebear.com/7.x/identicon/svg?seed=${cleanHandle}`,
              },
              { onConflict: "id" }
            );
        } catch (profErr) {
          console.warn("Profile upsert notice:", profErr);
        }
      }

      // Sweet Success animation with confetti burst and Optimus Prime voice
      setIsSuccessAnimated(true);
      fireAuthConfetti();
      void notificationAudio.playWelcomeToFlickAudio();

      setSuccessModal({
        title: "Success!",
        description: data.session
          ? "Your Flick account was created and verified."
          : "We have sent an email verification to",
        email: email.trim(),
        actionLabel: data.session ? "PROCEED TO FLICK" : "GO TO SIGN IN",
        onProceed: () => {
          if (data.session) {
            if (next) window.location.replace(next);
            else nav("/", { replace: true });
          } else {
            setSuccessModal(null);
            setMode("signin");
            trigger3DToast({
              type: "success",
              title: "Verification Email Sent",
              description: "Please check your inbox or sign in with your credentials.",
            });
          }
        },
      });
    } catch (err: any) {
      setFeedback({
        type: "error",
        title: "Sign Up Failed",
        message: err.message || "Failed to create account. Please try again.",
      });
      trigger3DToast({
        type: "error",
        title: "Registration Failed",
        description: err.message || "Could not register account.",
      });
    } finally {
      setBusy(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy || isSuccessAnimated) return;

    if (!validateInputs()) return;

    if (!navigator.onLine) {
      // Check if user has an existing cached offline session for this email
      try {
        const cached = localStorage.getItem("flick:offline_auth_session");
        if (cached && mode === "signin") {
          const parsed = JSON.parse(cached);
          if (
            parsed?.user?.email?.toLowerCase() === email.trim().toLowerCase() ||
            !email.trim()
          ) {
            setIsSuccessAnimated(true);
            fireAuthConfetti();
            setSuccessModal({
              title: "Success!",
              description: "Loaded your cached offline Flick profile and drafts.",
              email: parsed?.user?.email || email.trim(),
              actionLabel: "PROCEED OFFLINE",
              onProceed: () => {
                if (next) window.location.replace(next);
                else nav("/", { replace: true });
              },
            });
            return;
          }
        }
      } catch {}

      const errorState: FeedbackState = {
        type: "error",
        title: "No Internet Connection",
        message: "Check your WiFi or mobile network connection and try again.",
        action: {
          label: "Retry Now",
          onClick: () => void submit(e),
        },
      };
      setFeedback(errorState);
      trigger3DToast({
        type: "error",
        title: "Connection Failed",
        description: "Check your internet connection and try again.",
      });
      return;
    }

    setBusy(true);
    setFeedback(null);
    setStatusStep(mode === "signup" ? "Creating your Flick account..." : "Verifying credentials...");

    try {
      if (mode === "signup") {
        await executeSignUp();
      } else {
        setStatusStep("Authenticating session...");
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) throw error;

        // Sweet Success animation with confetti burst (as seen in video at 0:15!)
        setIsSuccessAnimated(true);
        fireAuthConfetti();

        setSuccessModal({
          title: "Success!",
          description: "You have securely authenticated into Flick.",
          email: email.trim(),
          actionLabel: "PROCEED",
          onProceed: () => {
            if (next) window.location.replace(next);
            else nav("/", { replace: true });
          },
        });
      }
    } catch (err: unknown) {
      setIsSuccessAnimated(false);
      const rawMsg = (err as Error).message || "";
      const lower = rawMsg.toLowerCase();

      let friendlyTitle = "Authentication Failed";
      let friendlyMessage = rawMsg || "Unable to complete request. Please try again.";

      if (lower.includes("invalid login credentials") || lower.includes("invalid grant")) {
        friendlyTitle = "Incorrect Email or Password";
        friendlyMessage =
          "The credentials you entered do not match any Flick account. Please double-check your email and password, or use 'Forgot password' below.";
      } else if (lower.includes("user already registered")) {
        friendlyTitle = "Account Already Exists";
        friendlyMessage =
          "An account with this email is already registered. Please switch to 'Sign In' to access your account.";
      } else if (lower.includes("rate limit") || lower.includes("too many requests")) {
        friendlyTitle = "Too Many Attempts";
        friendlyMessage =
          "For your security, please wait a minute before making another sign-in attempt.";
      } else if (lower.includes("network") || lower.includes("fetch")) {
        friendlyTitle = "Network Connection Issue";
        friendlyMessage =
          "Unable to reach the authentication gateway. Please check your internet connection.";
      } else if (lower.includes("security evaluation") || lower.includes("status 404")) {
        friendlyTitle = "Service Reconnected";
        friendlyMessage =
          "Security service was reconnected. Please tap 'Try Again' to complete your registration.";
      }

      setFeedback({
        type: "error",
        title: friendlyTitle,
        message: friendlyMessage,
        action: {
          label: "Try Again",
          onClick: () => {
            setFeedback(null);
          },
        },
      });

      trigger3DToast({
        type: "error",
        title: friendlyTitle,
        description: friendlyMessage,
        durationMs: 7000,
      });
    } finally {
      setBusy(false);
      setStatusStep("");
    }
  };

  const handleGoogleSignIn = async () => {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    setStatusStep("Connecting with Google OAuth...");

    const returnUrl = next ? window.location.origin + next : window.location.origin;

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: returnUrl,
        },
      });
      if (error) {
        setFeedback({
          type: "warning",
          title: "Google Sign-in Notice",
          message:
            "Google OAuth is not configured on this instance. Please use email and password to sign in or register below.",
        });
        trigger3DToast({
          type: "warning",
          title: "Google Sign-in Notice",
          description: "Please sign in or create an account using your email and password.",
        });
      }
    } catch {
      setFeedback({
        type: "error",
        title: "Google Sign-in Error",
        message: "Unable to initiate Google authentication. Please use email and password.",
      });
    } finally {
      setBusy(false);
      setStatusStep("");
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetBusy(true);
    try {
      const result = await sendFirebasePasswordReset(resetEmail.trim());
      setFeedback({
        type: "success",
        title: "Password Reset Sent",
        message: result.message,
      });
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
      setFeedback({
        type: "error",
        title: "Password Too Short",
        message: "Password must be at least 6 characters.",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback({
        type: "error",
        title: "Passwords Do Not Match",
        message: "Please confirm that both passwords match exactly.",
      });
      return;
    }
    setUpdateBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      fireAuthConfetti();
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
      setFeedback({
        type: "error",
        title: "Update Failed",
        message: (err as Error).message || "Could not update password.",
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
        <Link
          to="/"
          className="flex items-center gap-3 font-display text-4xl text-snap tracking-tight z-10"
        >
          <img
            src="/brand/logo.png"
            alt="Logo"
            className="h-10 w-auto object-contain"
            onError={(e) => {
              (e.currentTarget as HTMLElement).style.display = "none";
            }}
          />
          <span>
            FLICK<span className="text-white">.</span>
          </span>
        </Link>
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 pointer-events-none mix-blend-luminosity"
          style={{ backgroundImage: "url('/brand/auth-template-1.png')" }}
        />
        <div className="absolute -left-32 top-1/4 w-[480px] h-[480px] rounded-full bg-snap/20 blur-[100px] pointer-events-none" />
        <div className="absolute -right-20 bottom-1/4 w-[360px] h-[360px] rounded-full bg-emerald-500/15 blur-[90px] pointer-events-none" />

        <div className="relative space-y-6 z-10 max-w-md">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-snap/15 border border-snap/30 text-snap text-xs font-bold tracking-wide">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Next-Gen Realtime Social & Multi-Tenant</span>
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
          <span>v2.2 · 2026 · Flick Engine</span>
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
        <div className="w-full max-w-md space-y-5">
          <div>
            <Link
              to="/"
              className="md:hidden flex items-center gap-2.5 mb-6 font-display text-4xl text-snap"
            >
              <img
                src="/brand/logo.png"
                alt="Logo"
                className="h-8 w-auto object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                }}
              />
              <span>
                flick<span className="text-foreground">.</span>
              </span>
            </Link>

            {/* Video-Style Tab Switcher */}
            {!isRecovery && (
              <div className="flex p-1 bg-secondary/80 rounded-2xl mb-4 border border-border">
                <button
                  type="button"
                  onClick={() => {
                    setFeedback(null);
                    setMode("signin");
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                    mode === "signin"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFeedback(null);
                    setMode("signup");
                  }}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                    mode === "signup"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Sign Up
                </button>
              </div>
            )}

            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-snap">
              {isRecovery ? "Security" : mode === "signup" ? "Get Started" : "Welcome Back"}
            </span>
            <h2 className="font-display text-3xl md:text-4xl mt-1 tracking-tight">
              {isRecovery
                ? "Set new password"
                : mode === "signup"
                  ? "Create your account"
                  : "Sign in to Flick"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1.5">
              {isRecovery
                ? "Enter and confirm your new secure account password below."
                : mode === "signup"
                  ? "Join the network, connect with flickers and start sharing."
                  : "Enter your credentials to access your flicks and chats."}
            </p>
          </div>

          {/* PROMINENT INLINE FEEDBACK BANNER (Instant feedback for login/signup) */}
          <AnimatePresence mode="wait">
            {feedback && (
              <motion.div
                key={feedback.title}
                initial={{ opacity: 0, y: -12, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 450, damping: 25 }}
                className={`p-4 rounded-2xl border backdrop-blur-xl relative overflow-hidden shadow-lg ${
                  feedback.type === "error"
                    ? "bg-red-500/15 border-red-500/40 text-red-100 shadow-red-500/10"
                    : feedback.type === "success"
                      ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-100 shadow-emerald-500/10"
                      : feedback.type === "warning"
                        ? "bg-amber-500/15 border-amber-500/40 text-amber-100 shadow-amber-500/10"
                        : "bg-blue-500/15 border-blue-500/40 text-blue-100 shadow-blue-500/10"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`p-1.5 rounded-xl shrink-0 ${
                      feedback.type === "error"
                        ? "bg-red-500/20 text-red-400"
                        : feedback.type === "success"
                          ? "bg-emerald-500/20 text-emerald-400"
                          : feedback.type === "warning"
                            ? "bg-amber-500/20 text-amber-400"
                            : "bg-blue-500/20 text-blue-400"
                    }`}
                  >
                    {feedback.type === "error" && <AlertCircle className="w-5 h-5" />}
                    {feedback.type === "success" && <CheckCircle2 className="w-5 h-5" />}
                    {feedback.type === "warning" && <AlertTriangle className="w-5 h-5" />}
                    {feedback.type === "info" && <Info className="w-5 h-5" />}
                  </div>

                  <div className="flex-1 min-w-0 pr-1">
                    <h4 className="font-bold text-sm leading-tight">{feedback.title}</h4>
                    <p className="text-xs mt-1 leading-relaxed opacity-90">{feedback.message}</p>

                    {feedback.action && (
                      <button
                        type="button"
                        onClick={feedback.action.onClick}
                        className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-white/20 hover:bg-white/30 text-white transition active:scale-95"
                      >
                        <RefreshCw className="w-3 h-3" />
                        <span>{feedback.action.label}</span>
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

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
                  <div className="space-y-1">
                    <div className="relative">
                      <User className="w-4 h-4 text-muted-foreground absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        required
                        value={handle}
                        onChange={(e) => setHandle(e.target.value)}
                        placeholder="@handle (e.g. alex)"
                        className="w-full pl-10 pr-4 py-3 rounded-2xl bg-secondary/50 border border-border focus:outline-none focus:border-snap focus:ring-1 focus:ring-snap text-sm placeholder:text-muted-foreground transition"
                      />
                    </div>
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

                {/* ANIMATED MORPHING SUBMIT BUTTON WITH CONFETTI SUCCESS STATE (AS SEEN IN VIDEO) */}
                <motion.button
                  whileTap={{ scale: 0.98 }}
                  disabled={busy || isSuccessAnimated}
                  type="submit"
                  className={`w-full py-3.5 rounded-2xl font-bold text-sm shadow-lg flex items-center justify-center gap-2 transition-all duration-300 ${
                    isSuccessAnimated
                      ? "bg-emerald-500 text-white shadow-emerald-500/40 scale-[1.02]"
                      : "bg-snap text-snap-foreground shadow-snap/20 hover:brightness-105 disabled:opacity-60"
                  }`}
                >
                  {isSuccessAnimated ? (
                    <motion.div
                      initial={{ scale: 0.5, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className="flex items-center gap-2"
                    >
                      <Check className="w-5 h-5 text-white stroke-[3]" />
                      <span>Success! Welcome to Flick</span>
                    </motion.div>
                  ) : busy ? (
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{statusStep || "Processing..."}</span>
                    </div>
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
                  onClick={() => {
                    setFeedback(null);
                    setMode(mode === "signup" ? "signin" : "signup");
                  }}
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

      {/* Video-Inspired Success! Modal Card (matching Video 0:15) */}
      <AnimatePresence>
        {successModal && (
          <div className="fixed inset-0 z-[1100] bg-black/85 backdrop-blur-xl flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.88, opacity: 0, y: 24 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 16 }}
              transition={{ type: "spring", stiffness: 450, damping: 28 }}
              className="w-full max-w-sm rounded-[32px] p-8 shadow-2xl relative overflow-hidden text-center text-white"
              style={{
                background: "linear-gradient(180deg, #2546e8 0%, #162eb0 100%)",
                boxShadow: "0 25px 60px -15px rgba(22, 46, 176, 0.6)",
              }}
            >
              {/* Background celebration shapes */}
              <div className="absolute top-4 left-6 w-8 h-8 rounded-full border border-white/20 opacity-40 pointer-events-none" />
              <div className="absolute top-12 right-6 w-5 h-5 rotate-45 border-2 border-white/20 opacity-30 pointer-events-none" />
              <div className="absolute bottom-16 left-8 w-3 h-3 rounded-full bg-white/30 pointer-events-none" />
              <div className="absolute bottom-20 right-10 w-4 h-4 rotate-12 border border-white/25 pointer-events-none" />

              {/* Title */}
              <h3 className="font-display text-3xl font-extrabold tracking-tight mb-6">
                {successModal.title}
              </h3>

              {/* Big 3D Checkmark Badge matching frame 0:15 in video */}
              <div className="relative mx-auto w-32 h-32 flex items-center justify-center mb-6">
                <div className="absolute inset-0 bg-white/10 rounded-3xl rotate-6 blur-sm" />
                <div className="absolute inset-0 bg-white/15 rounded-3xl -rotate-3" />
                <div className="relative w-28 h-28 bg-white rounded-3xl shadow-2xl flex items-center justify-center transform hover:scale-105 transition">
                  <Check className="w-16 h-16 text-[#2546e8] stroke-[3.5]" />
                </div>
              </div>

              {/* Message & Email */}
              <div className="space-y-1 mb-8">
                <p className="text-sm text-white/85 font-medium leading-relaxed">
                  {successModal.description}
                </p>
                {successModal.email && (
                  <p className="text-sm font-bold text-white tracking-wide break-all">
                    {successModal.email}
                  </p>
                )}
              </div>

              {/* Proceed Button matching video */}
              <motion.button
                whileTap={{ scale: 0.96 }}
                type="button"
                onClick={successModal.onProceed}
                className="w-full py-4 rounded-2xl bg-[#0b102b] hover:bg-[#070b1f] text-white font-extrabold text-sm tracking-wider uppercase transition shadow-xl cursor-pointer"
              >
                {successModal.actionLabel || "PROCEED"}
              </motion.button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </main>
  );
}
