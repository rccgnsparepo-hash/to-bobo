import { useState } from "react";
import {
  GraduationCap,
  ShieldCheck,
  BookOpen,
  Lock,
  User,
  Hash,
  School,
  ArrowRight,
  Database,
  AlertTriangle,
  X,
  Eye,
  EyeOff,
  CheckCircle2,
  Mail,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { triggerLightHaptic, triggerMediumHaptic } from "@/lib/haptics";
import { CampusStorageService } from "@/lib/class/campusStorageService";
import {
  COLLEGE_DEFINITIONS,
  TEACHER_VERIFICATION_KEY,
  type AcademicLevel,
  type AcademicProfile,
  type CampusCollege,
} from "@/lib/class/types";

interface Props {
  isOpen: boolean;
  onSuccess: (profile: AcademicProfile) => void;
  onClose?: () => void;
  currentUserId?: string;
  defaultRole?: "student" | "lecturer";
}

const COLLEGES: CampusCollege[] = ["CBAS", "CHMS", "CHAS"];
const LEVELS: AcademicLevel[] = [100, 200, 300, 400, 500, 600];

export function AcademicAuthModal({
  isOpen,
  onSuccess,
  onClose,
  currentUserId,
  defaultRole = "student",
}: Props) {
  const [authMode, setAuthMode] = useState<"login" | "register" | "forgot">("login");
  const [role, setRole] = useState<"student" | "lecturer">(defaultRole);

  // College selection (CBAS, CHMS, CHAS - strictly separated)
  const [college, setCollege] = useState<CampusCollege>("CBAS");
  const [department, setDepartment] = useState<string>(
    COLLEGE_DEFINITIONS.CBAS.departments[0]
  );
  const [customDept, setCustomDept] = useState("");

  // Credentials
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [matricNo, setMatricNo] = useState("");
  const [staffId, setStaffId] = useState("");
  const [level, setLevel] = useState<AcademicLevel>(100);
  const [coursesTaughtInput, setCoursesTaughtInput] = useState("");
  const [teacherKey, setTeacherKey] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const currentCollegeInfo = COLLEGE_DEFINITIONS[college];
  const resolvedDept = department === "Other" ? customDept.trim() : department;

  const handleCollegeChange = (col: CampusCollege) => {
    setCollege(col);
    setDepartment(COLLEGE_DEFINITIONS[col].departments[0]);
    setCustomDept("");
    setErrorMsg(null);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes("@")) {
      setErrorMsg("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setResetSuccessMsg(null);

    const result = await CampusStorageService.sendPasswordResetEmail(cleanEmail);
    setIsSubmitting(false);

    if (result.success) {
      setResetSuccessMsg(result.message);
      toast.success("Password reset email sent via Supabase Auth!");
    } else {
      setErrorMsg(result.message);
      toast.error("Failed to send reset email.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // ================= REGISTER WORKFLOW =================
    if (authMode === "register") {
      if (!fullName.trim()) {
        setErrorMsg("Full name is required.");
        return;
      }
      if (!email.trim() || !email.includes("@")) {
        setErrorMsg("A valid email address is required for secure authentication and recovery.");
        return;
      }
      if (!password || password.length < 6) {
        setErrorMsg("Password must be at least 6 characters long.");
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg("Passwords do not match. Please re-enter.");
        return;
      }
      if (!resolvedDept) {
        setErrorMsg("Please specify your department.");
        return;
      }

      if (role === "student") {
        if (!matricNo.trim()) {
          setErrorMsg("Matriculation number is required for students.");
          return;
        }
      } else {
        if (teacherKey.trim() !== TEACHER_VERIFICATION_KEY) {
          void triggerMediumHaptic();
          setErrorMsg("Invalid Teacher Security Code. Only verified faculty holding key (A1B2C3D4E5) may register as lecturer.");
          return;
        }
        if (!staffId.trim()) {
          setErrorMsg("Staff ID or Faculty email is required.");
          return;
        }
      }

      setIsSubmitting(true);
      void triggerLightHaptic();

      const coursesArray = coursesTaughtInput
        .split(/[,;\n]+/)
        .map((c) => c.trim().toUpperCase())
        .filter(Boolean);

      const result = await CampusStorageService.registerAcademicUser({
        role,
        fullName: fullName.trim(),
        email: email.trim(),
        matricNo: role === "student" ? matricNo.trim() : undefined,
        staffId: role === "lecturer" ? staffId.trim() : undefined,
        college,
        department: resolvedDept,
        level: role === "student" ? level : undefined,
        coursesTaught: role === "lecturer" ? coursesArray : undefined,
        password,
        teacherKey: role === "lecturer" ? teacherKey.trim() : undefined,
        userId: currentUserId,
      });

      setIsSubmitting(false);

      if (result.success && result.profile) {
        toast.success(`Account registered for ${result.profile.fullName} in ${college}!`);
        onSuccess(result.profile);
      } else {
        setErrorMsg(result.error || "Registration failed.");
      }
    } else {
      // ================= LOGIN WORKFLOW =================
      const identifier = role === "student" ? matricNo.trim() : staffId.trim();
      if (!identifier) {
        setErrorMsg(role === "student" ? "Please enter your Matriculation Number." : "Please enter your Staff ID.");
        return;
      }
      if (!password) {
        setErrorMsg("Please enter your password.");
        return;
      }

      setIsSubmitting(true);
      void triggerLightHaptic();

      const result = await CampusStorageService.loginAcademicUser({
        role,
        identifier,
        password,
        college,
        teacherKey: role === "lecturer" ? teacherKey.trim() : undefined,
      });

      setIsSubmitting(false);

      if (result.success && result.profile) {
        toast.success(`Welcome back ${result.profile.fullName} · ${college} ${result.profile.role === "student" ? `${result.profile.level}L` : "Faculty"}`);
        onSuccess(result.profile);
      } else {
        setErrorMsg(result.error || "Login failed.");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto no-scrollbar">
      <div className="w-full max-w-xl rounded-[24px] bg-[#141417] border border-[#2a2a32] p-6 sm:p-8 shadow-2xl text-white space-y-5 my-8 relative">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 border border-white/10 grid place-items-center text-zinc-400 hover:text-white transition"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Header */}
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#4a5cff]/20 text-[#8898ff] border border-[#4a5cff]/30 text-xs font-mono font-bold uppercase tracking-wider">
            <School className="w-3.5 h-3.5 text-[#ff4f8b]" />
            <span>Flick Academic Security Portal</span>
          </div>
          <h2 className="font-bricolage text-2xl sm:text-3xl font-extrabold tracking-tight">
            {authMode === "login"
              ? "Secure Portal Sign In"
              : authMode === "register"
              ? "Register Academic Account"
              : "Reset Password via Email"}
          </h2>
          <p className="text-xs text-zinc-400">
            {authMode === "login"
              ? "Sign in with your password and credentials from anywhere."
              : authMode === "register"
              ? "Create your verified student or faculty profile across CBAS, CHMS, and CHAS."
              : "We'll dispatch a secure Supabase password recovery link to your email."}
          </p>
        </div>

        {/* Login / Register Segment Switcher (Hidden in forgot mode) */}
        {authMode !== "forgot" ? (
          <div className="grid grid-cols-2 p-1 rounded-2xl bg-black/50 border border-[#2a2a32]">
            <button
              type="button"
              onClick={() => {
                setAuthMode("login");
                setErrorMsg(null);
                setResetSuccessMsg(null);
              }}
              className={`py-2 rounded-xl text-xs font-bold font-mono uppercase tracking-wider transition ${
                authMode === "login"
                  ? "bg-[#4a5cff] text-white shadow-md shadow-[#4a5cff]/30"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Sign In (Login)
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthMode("register");
                setErrorMsg(null);
                setResetSuccessMsg(null);
              }}
              className={`py-2 rounded-xl text-xs font-bold font-mono uppercase tracking-wider transition ${
                authMode === "register"
                  ? "bg-[#4a5cff] text-white shadow-md shadow-[#4a5cff]/30"
                  : "text-zinc-400 hover:text-white"
              }`}
            >
              Create Account (Register)
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setAuthMode("login");
              setErrorMsg(null);
              setResetSuccessMsg(null);
            }}
            className="text-xs font-mono text-[#8898ff] hover:text-white transition flex items-center gap-1.5"
          >
            <span>← Back to Sign In</span>
          </button>
        )}

        {/* Error & Success Alerts */}
        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMsg}</span>
          </div>
        )}

        {resetSuccessMsg && (
          <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{resetSuccessMsg}</span>
          </div>
        )}

        {/* ================= FORGOT PASSWORD VIEW ================= */}
        {authMode === "forgot" ? (
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#4a5cff]" />
                <span>Account Recovery Email Address *</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your registered email address"
                className="w-full bg-black/40 border border-[#2a2a32] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#4a5cff]"
                required
                autoFocus
              />
              <p className="text-[11px] text-zinc-400">
                You will receive a secure password reset link via Supabase Auth.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl bg-[#4a5cff] hover:bg-[#3d4ee0] text-white font-bold text-xs tracking-wide shadow-lg shadow-[#4a5cff]/30 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <Mail className="w-4 h-4" />
              <span>{isSubmitting ? "Dispatching Email..." : "Send Supabase Reset Link"}</span>
            </button>
          </form>
        ) : (
          /* ================= LOGIN & REGISTER VIEW ================= */
          <>
            {/* Role Selector Tabs (Student vs Lecturer) */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setRole("student");
                  setErrorMsg(null);
                }}
                className={`p-3 rounded-2xl border text-left transition flex items-center gap-3 ${
                  role === "student"
                    ? "bg-[#4a5cff]/15 border-[#4a5cff] text-white shadow-sm"
                    : "bg-black/30 border-[#2a2a32] text-zinc-400 hover:border-zinc-600"
                }`}
              >
                <div className={`w-8 h-8 rounded-xl grid place-items-center ${role === "student" ? "bg-[#4a5cff] text-white" : "bg-black/50 text-zinc-500"}`}>
                  <GraduationCap className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Student</div>
                  <div className="text-[10px] text-zinc-400">100L to 600L</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRole("lecturer");
                  setErrorMsg(null);
                }}
                className={`p-3 rounded-2xl border text-left transition flex items-center gap-3 ${
                  role === "lecturer"
                    ? "bg-[#4a5cff]/15 border-[#4a5cff] text-white shadow-sm"
                    : "bg-black/30 border-[#2a2a32] text-zinc-400 hover:border-zinc-600"
                }`}
              >
                <div className={`w-8 h-8 rounded-xl grid place-items-center ${role === "lecturer" ? "bg-[#4a5cff] text-white" : "bg-black/50 text-zinc-500"}`}>
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white">Faculty / Lecturer</div>
                  <div className="text-[10px] text-zinc-400">Teacher Key Required</div>
                </div>
              </button>
            </div>

            {/* THREE COLLEGES SELECTOR (CBAS, CHMS, CHAS) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-zinc-300 flex items-center justify-between font-mono uppercase tracking-wider">
                <span>Select College *</span>
                <span className="text-[#8898ff] font-normal">{currentCollegeInfo.name}</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                {COLLEGES.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => handleCollegeChange(col)}
                    className={`py-3 px-2 rounded-xl text-center font-mono font-bold text-xs transition border ${
                      college === col
                        ? "bg-[#4a5cff] text-white border-[#4a5cff] shadow-lg shadow-[#4a5cff]/25"
                        : "bg-black/40 text-zinc-400 border-[#2a2a32] hover:border-zinc-600"
                    }`}
                  >
                    <div className="text-sm font-extrabold">{col}</div>
                    <div className="text-[9px] uppercase tracking-tighter opacity-80 mt-0.5 truncate">
                      {col === "CBAS" ? "Basic & Applied" : col === "CHMS" ? "Humanities & Mgt" : "Health & Allied"}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* FORM */}
            <form onSubmit={handleSubmit} className="space-y-3.5">
              {/* REGISTER-ONLY: Full Name & Email */}
              {authMode === "register" && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                      <User className="w-3.5 h-3.5 text-[#4a5cff]" />
                      <span>Full Name *</span>
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder={role === "student" ? "e.g. Samuel Adeyemi" : "e.g. Dr. Kenneth Okon"}
                      className="w-full bg-black/40 border border-[#2a2a32] rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#4a5cff]"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-[#4a5cff]" />
                      <span>Email Address (For password reset & recovery) *</span>
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="e.g. student@university.edu"
                      className="w-full bg-black/40 border border-[#2a2a32] rounded-xl px-3.5 py-2 text-xs text-white placeholder-zinc-600 focus:outline-none focus:border-[#4a5cff]"
                      required
                    />
                  </div>
                </>
              )}

              {/* Student: Matric Number */}
              {role === "student" ? (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-[#4a5cff]" />
                    <span>Matriculation Number *</span>
                  </label>
                  <input
                    type="text"
                    value={matricNo}
                    onChange={(e) => setMatricNo(e.target.value.toUpperCase())}
                    placeholder="e.g. U2021/557001 or FUPRE/21/ENG/1029"
                    className="w-full bg-black/40 border border-[#2a2a32] rounded-xl px-3.5 py-2 text-xs text-white uppercase font-mono tracking-wider focus:outline-none focus:border-[#4a5cff]"
                    required
                  />
                </div>
              ) : (
                /* Lecturer: Staff ID */
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <Hash className="w-3.5 h-3.5 text-[#4a5cff]" />
                    <span>Staff ID or Faculty Email *</span>
                  </label>
                  <input
                    type="text"
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value.toUpperCase())}
                    placeholder="e.g. STF-8821 or prof.okon@university.edu"
                    className="w-full bg-black/40 border border-[#2a2a32] rounded-xl px-3.5 py-2 text-xs text-white uppercase font-mono focus:outline-none focus:border-[#4a5cff]"
                    required
                  />
                </div>
              )}

              {/* REGISTER-ONLY: Department & Level */}
              {authMode === "register" && (
                <>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
                      <span>Department in {college} *</span>
                      <span className="text-[10px] font-mono text-zinc-400">Strictly Filtered</span>
                    </label>
                    <select
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      className="w-full bg-black/40 border border-[#2a2a32] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-[#4a5cff]"
                    >
                      {currentCollegeInfo.departments.map((dept) => (
                        <option key={dept} value={dept} className="bg-[#141417] text-white">
                          {dept}
                        </option>
                      ))}
                      <option value="Other" className="bg-[#141417] text-white">
                        Other Department in {college}…
                      </option>
                    </select>
                  </div>

                  {department === "Other" && (
                    <input
                      type="text"
                      value={customDept}
                      onChange={(e) => setCustomDept(e.target.value)}
                      placeholder={`Specify department in ${college}`}
                      className="w-full bg-black/40 border border-[#2a2a32] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#4a5cff]"
                      required
                    />
                  )}

                  {/* Student Levels 100L - 600L */}
                  {role === "student" && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-300 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <BookOpen className="w-3.5 h-3.5 text-[#4a5cff]" />
                          <span>Academic Level *</span>
                        </span>
                        <span className="text-[11px] font-mono text-[#8898ff]">{level} Level</span>
                      </label>
                      <div className="grid grid-cols-6 gap-1.5">
                        {LEVELS.map((lvl) => (
                          <button
                            key={lvl}
                            type="button"
                            onClick={() => setLevel(lvl)}
                            className={`py-2 rounded-xl text-xs font-bold font-mono transition border ${
                              level === lvl
                                ? "bg-[#4a5cff] text-white border-[#4a5cff] shadow-md shadow-[#4a5cff]/30"
                                : "bg-black/30 text-zinc-400 border-[#2a2a32] hover:border-zinc-500"
                            }`}
                          >
                            {lvl}L
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Lecturer: Courses Taught */}
                  {role === "lecturer" && (
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                        <BookOpen className="w-3.5 h-3.5 text-[#4a5cff]" />
                        <span>Courses Taught (Optional)</span>
                      </label>
                      <input
                        type="text"
                        value={coursesTaughtInput}
                        onChange={(e) => setCoursesTaughtInput(e.target.value)}
                        placeholder="e.g. CSC 301, MTH 101, CYB 402"
                        className="w-full bg-black/40 border border-[#2a2a32] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#4a5cff]"
                      />
                    </div>
                  )}
                </>
              )}

              {/* Lecturer Teacher Security Key (Required for both login & register) */}
              {role === "lecturer" && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Teacher Security Key *</span>
                    </label>
                    <span className="text-[10px] font-mono text-amber-400">Code (A1B2C3D4E5)</span>
                  </div>
                  <input
                    type="password"
                    value={teacherKey}
                    onChange={(e) => setTeacherKey(e.target.value)}
                    placeholder="Enter (A1B2C3D4E5)"
                    className="w-full bg-black/60 border border-amber-500/40 rounded-xl px-3 py-1.5 text-xs text-white font-mono tracking-widest focus:outline-none focus:border-amber-400"
                    required
                  />
                </div>
              )}

              {/* Password */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-[#4a5cff]" />
                    <span>Password *</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-[11px] text-zinc-400 hover:text-white flex items-center gap-1"
                  >
                    {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                    <span>{showPassword ? "Hide" : "Show"}</span>
                  </button>
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your secure password"
                  className="w-full bg-black/40 border border-[#2a2a32] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#4a5cff]"
                  required
                />
                {authMode === "login" && (
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setAuthMode("forgot");
                        setErrorMsg(null);
                        setResetSuccessMsg(null);
                      }}
                      className="text-[11px] font-mono text-[#8898ff] hover:text-white transition hover:underline"
                    >
                      Forgot password? Reset via email
                    </button>
                  </div>
                )}
              </div>

              {/* Confirm Password (Register Only) */}
              {authMode === "register" && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-zinc-300 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-[#4a5cff]" />
                    <span>Confirm Password *</span>
                  </label>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password to confirm"
                    className="w-full bg-black/40 border border-[#2a2a32] rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-[#4a5cff]"
                    required
                  />
                </div>
              )}

              {/* Submit Action */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3.5 rounded-xl bg-[#4a5cff] hover:bg-[#3d4ee0] text-white font-bold text-xs tracking-wide shadow-lg shadow-[#4a5cff]/30 active:scale-95 transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
              >
                <span>
                  {isSubmitting
                    ? "Verifying Credentials..."
                    : authMode === "login"
                    ? `Sign In to ${college}`
                    : `Register as ${role === "student" ? "Student" : "Verified Lecturer"}`}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </>
        )}

        {/* Multi-Tenant 30GB Footer */}
        <div className="pt-2 border-t border-[#2a2a32] flex items-center justify-between text-[11px] text-zinc-400 font-mono">
          <div className="flex items-center gap-1.5">
            <Database className="w-3.5 h-3.5 text-[#4a5cff]" />
            <span>Dedicated 30.00 GB Modal Architecture</span>
          </div>
          <span className="text-[#8898ff] font-bold">Partitioned by College</span>
        </div>
      </div>
    </div>
  );
}
