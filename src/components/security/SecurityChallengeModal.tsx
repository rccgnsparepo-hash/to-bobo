import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Lock,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  X,
  Loader2,
  Sparkles,
  Info,
} from "lucide-react";
import {
  fetchCaptchaChallenge,
  verifyCaptchaChallenge,
  sendPhoneCode,
  verifyPhoneCode,
  requestRegistrationPermit,
  type SecurityEvaluation,
  type SecurityChallengeData,
} from "@/lib/securityService";

interface Props {
  isOpen: boolean;
  evaluation: SecurityEvaluation;
  email: string;
  onSuccess: (permitToken: string, verifiedPhone?: string) => void;
  onCancel: () => void;
}

export function SecurityChallengeModal({ isOpen, evaluation, email, onSuccess, onCancel }: Props) {
  const isHighRisk = evaluation.riskTier === "high";
  const [currentStep, setCurrentStep] = useState<"challenge" | "phone">(
    isHighRisk ? "phone" : "challenge"
  );

  // Phone states
  const [phone, setPhone] = useState("");
  const [smsCode, setSmsCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneSending, setPhoneSending] = useState(false);
  const [phoneVerifying, setPhoneVerifying] = useState(false);
  const [demoCodeHint, setDemoCodeHint] = useState<string | null>(null);

  // Captcha challenge states
  const [challengeData, setChallengeData] = useState<SecurityChallengeData | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [challengeVerifying, setChallengeVerifying] = useState(false);
  const [challengeVerified, setChallengeVerified] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Load CAPTCHA challenge
  const loadChallenge = useCallback(async () => {
    try {
      setChallengeLoading(true);
      setErrorMessage(null);
      setSelectedOption(null);
      const data = await fetchCaptchaChallenge(email);
      setChallengeData(data);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to load challenge");
    } finally {
      setChallengeLoading(false);
    }
  }, [email]);

  useEffect(() => {
    if (isOpen) {
      setErrorMessage(null);
      if (isHighRisk) {
        setCurrentStep("phone");
      } else {
        setCurrentStep("challenge");
        loadChallenge();
      }
    }
  }, [isOpen, isHighRisk, loadChallenge]);

  if (!isOpen) return null;

  // Handle Phone Code Dispatch
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || phone.length < 7) {
      setErrorMessage("Please enter a valid phone number with country code (e.g. +1 555-0192).");
      return;
    }
    setPhoneSending(true);
    setErrorMessage(null);
    try {
      const res = await sendPhoneCode(phone, email);
      if (!res.success) {
        setErrorMessage(res.error || "Failed to dispatch SMS code");
      } else {
        setCodeSent(true);
        if (res.testCode) {
          setDemoCodeHint(res.testCode);
          setSmsCode(res.testCode); // Auto-fill for friction-free verification
        }
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to send code");
    } finally {
      setPhoneSending(false);
    }
  };

  // Handle Phone Code Verification
  const handleVerifyPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smsCode || smsCode.length < 4) {
      setErrorMessage("Please enter the 6-digit code received via SMS.");
      return;
    }
    setPhoneVerifying(true);
    setErrorMessage(null);
    try {
      const res = await verifyPhoneCode(phone, smsCode);
      if (!res.success) {
        setErrorMessage(res.error || "Verification failed");
      } else {
        setPhoneVerified(true);
        // Move to challenge step if high risk requires both
        setCurrentStep("challenge");
        loadChallenge();
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Verification failed");
    } finally {
      setPhoneVerifying(false);
    }
  };

  // Handle Captcha submission
  const handleVerifyCaptcha = async () => {
    if (!challengeData || !selectedOption) {
      setErrorMessage("Please select an answer to continue.");
      return;
    }

    setChallengeVerifying(true);
    setErrorMessage(null);
    try {
      const res = await verifyCaptchaChallenge(challengeData.token, selectedOption);
      if (!res.success) {
        setErrorMessage(res.error || "Incorrect answer. Please try again.");
        loadChallenge();
      } else {
        setChallengeVerified(true);
        // Request the authoritative permit token
        const permit = await requestRegistrationPermit({
          email,
          riskTier: evaluation.riskTier,
          riskScore: evaluation.riskScore,
          featureLimits: evaluation.featureLimits,
        });

        setTimeout(() => {
          onSuccess(permit, phoneVerified ? phone : undefined);
        }, 600);
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to verify challenge");
    } finally {
      setChallengeVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.94, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 15 }}
        className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-6 shadow-2xl relative text-zinc-100 overflow-hidden"
      >
        {/* Ambient Top Glow */}
        <div
          className={`absolute top-0 left-0 right-0 h-1.5 ${
            isHighRisk
              ? "bg-gradient-to-r from-amber-500 via-rose-500 to-amber-500"
              : "bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500"
          }`}
        />

        {/* Close Button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-2 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900 rounded-full transition-colors"
          title="Cancel"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header Icon & Title */}
        <div className="flex items-start gap-4 mb-5">
          <div
            className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border ${
              isHighRisk
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                : "bg-emerald-500/10 border-emerald-500/30 text-emerald-400"
            }`}
          >
            {isHighRisk ? <ShieldAlert className="w-6 h-6" /> : <ShieldCheck className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight">
                {isHighRisk ? "Enhanced Identity Verification" : "Flick Bot Shield Verification"}
              </h2>
            </div>
            <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
              {isHighRisk
                ? "To protect against multi-account abuse and automated creation, we require verified phone binding and human proof."
                : "Confirm you're human before completing your Flick account creation."}
            </p>
          </div>
        </div>

        {/* Reasons Banner */}
        {evaluation.reasons && evaluation.reasons.length > 0 && (
          <div className="mb-4 p-3 rounded-xl bg-zinc-900/80 border border-zinc-800/80 text-xs">
            <div className="flex items-center gap-1.5 text-zinc-400 font-medium mb-1">
              <Info className="w-3.5 h-3.5 text-zinc-400" />
              <span>Security Signal Triggers:</span>
            </div>
            <ul className="list-disc list-inside space-y-0.5 text-zinc-400 pl-1">
              {evaluation.reasons.slice(0, 2).map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Error message */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2"
            >
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* STEP 1: PHONE VERIFICATION (For High Risk) */}
        {currentStep === "phone" && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold text-zinc-300">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-[10px]">
                1
              </span>
              <span>Step 1: Verified Phone Binding</span>
            </div>

            {!codeSent ? (
              <form onSubmit={handleSendCode} className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Mobile Phone Number (E.164 with Country Code)
                  </label>
                  <div className="relative">
                    <Smartphone className="w-4 h-4 text-zinc-500 absolute left-3.5 top-3" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+1 (555) 234-5678"
                      className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-10 pr-3 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500 transition-colors"
                      required
                    />
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-1">
                    Each phone number can only be bound to one active Flick account.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={phoneSending}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {phoneSending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending SMS Code...</span>
                    </>
                  ) : (
                    <span>Send Verification Code</span>
                  )}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyPhone} className="space-y-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center justify-between">
                  <span>SMS sent to {phone}</span>
                  <button
                    type="button"
                    onClick={() => setCodeSent(false)}
                    className="text-[11px] underline text-amber-400 hover:text-amber-200"
                  >
                    Change
                  </button>
                </div>

                {demoCodeHint && (
                  <div className="p-2 rounded-lg bg-zinc-900 border border-zinc-800 text-[11px] text-zinc-400 flex items-center justify-between">
                    <span>Demo SMS code auto-filled:</span>
                    <span className="font-mono font-bold text-amber-400 tracking-wider">
                      {demoCodeHint}
                    </span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-zinc-400 mb-1.5">
                    Enter 6-Digit SMS Code
                  </label>
                  <input
                    type="text"
                    maxLength={6}
                    value={smsCode}
                    onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="123456"
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2.5 text-center font-mono text-lg tracking-widest text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-amber-500"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={phoneVerifying}
                  className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {phoneVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Verifying Code...</span>
                    </>
                  ) : (
                    <span>Confirm Phone & Continue</span>
                  )}
                </button>
              </form>
            )}
          </div>
        )}

        {/* STEP 2: BOT SHIELD / CAPTCHA CHALLENGE */}
        {currentStep === "challenge" && (
          <div className="space-y-4">
            {isHighRisk && (
              <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Phone Verified: {phone}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-zinc-300">
                {isHighRisk ? "Step 2: Proof-of-Human Challenge" : "Interactive Proof Challenge"}
              </span>
              <button
                onClick={loadChallenge}
                disabled={challengeLoading}
                className="text-xs text-zinc-400 hover:text-zinc-200 flex items-center gap-1 transition-colors"
                title="Reload Challenge"
              >
                <RefreshCw className={`w-3 h-3 ${challengeLoading ? "animate-spin" : ""}`} />
                <span>New Challenge</span>
              </button>
            </div>

            {challengeLoading ? (
              <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-400 text-xs">
                <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
                <span>Generating secure challenge...</span>
              </div>
            ) : challengeData ? (
              <div className="space-y-3">
                <div className="p-3.5 rounded-2xl bg-zinc-900 border border-zinc-800 text-sm font-medium text-zinc-200">
                  {challengeData.question}
                </div>

                <div className="space-y-2">
                  {challengeData.options.map((option, idx) => {
                    const isSelected = selectedOption === option;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedOption(option)}
                        className={`w-full p-3 rounded-xl text-left text-sm font-medium transition-all flex items-center justify-between border cursor-pointer ${
                          isSelected
                            ? "bg-emerald-500/15 border-emerald-500/50 text-emerald-300 shadow-sm"
                            : "bg-zinc-900/60 border-zinc-800/80 text-zinc-300 hover:bg-zinc-900 hover:border-zinc-700"
                        }`}
                      >
                        <span>{option}</span>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={handleVerifyCaptcha}
                  disabled={!selectedOption || challengeVerifying || challengeVerified}
                  className="w-full mt-2 py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {challengeVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Validating cryptographic proof...</span>
                    </>
                  ) : challengeVerified ? (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Verified! Issuing Registration Permit...</span>
                    </>
                  ) : (
                    <span>Verify & Continue Registration</span>
                  )}
                </button>
              </div>
            ) : null}
          </div>
        )}

        {/* Security Assurance Footer */}
        <div className="mt-5 pt-3 border-t border-zinc-900 flex items-center justify-between text-[11px] text-zinc-500">
          <span className="flex items-center gap-1">
            <Lock className="w-3 h-3 text-zinc-400" />
            <span>Flick Abuse Prevention Protocol</span>
          </span>
          <span className="font-mono text-zinc-600">{evaluation.incidentId || "FLK-SEC"}</span>
        </div>
      </motion.div>
    </div>
  );
}
