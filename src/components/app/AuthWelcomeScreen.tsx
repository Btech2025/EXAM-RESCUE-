import { useState, useEffect } from "react";
import {
  Sparkles,
  Star,
  Lock,
  Mail,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  GraduationCap,
  CheckCircle2,
  AlertCircle,
  Zap,
  Sun,
  Moon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { signUp, logIn, logInAsDemo } from "@/lib/auth";
import { getTheme, setTheme, type Theme } from "@/lib/theme";
import { MagicalBackground } from "./MagicalBackground";
import { playCelebrationChime, playPopChime, playEntranceChime } from "@/lib/mascot-sound";

export function AuthWelcomeScreen() {
  const [tab, setTab] = useState<"login" | "signup">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBlinking, setIsBlinking] = useState(false);

  const [theme, setThemeState] = useState<Theme>(() => getTheme());

  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const custom = e as CustomEvent<{ theme: Theme }>;
      setThemeState(custom.detail?.theme ?? getTheme());
    };
    window.addEventListener("exam-rescue:theme-changed", handleThemeChange);
    return () => window.removeEventListener("exam-rescue:theme-changed", handleThemeChange);
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
  };

  // Periodic mascot blinking
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      const timer = setTimeout(() => setIsBlinking(false), 220);
      return () => clearTimeout(timer);
    }, 3800);
    return () => clearInterval(blinkInterval);
  }, []);

  // Soft entrance chime on initial load
  useEffect(() => {
    const timer = setTimeout(() => {
      playEntranceChime();
    }, 400);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (tab === "signup") {
        const res = await signUp(name, email, password);
        if (!res.success) {
          setError(res.error || "Failed to create account.");
          setLoading(false);
          return;
        }
        playCelebrationChime(true);
      } else {
        const res = await logIn(email, password);
        if (!res.success) {
          setError(res.error || "Invalid credentials.");
          setLoading(false);
          return;
        }
        playCelebrationChime(true);
      }
    } catch {
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    playPopChime(true);
    logInAsDemo();
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden text-foreground flex flex-col justify-between select-none">
      <MagicalBackground />

      {/* ── Top Header Brand ── */}
      <header className="relative z-10 mx-auto w-full max-w-6xl px-6 py-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-[oklch(0.70_0.15_285)] shadow-lg shadow-primary/30">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-display text-lg font-bold tracking-tight text-foreground">
              EXAM RESCUE
            </div>
            <div className="text-[10px] font-medium text-muted-foreground">
              AI Exam Preparation Copilot
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Theme Toggle Button */}
          <button
            onClick={toggleTheme}
            type="button"
            className="flex items-center gap-1.5 rounded-full border border-border/80 bg-card/80 px-3.5 py-1.5 text-xs font-semibold text-foreground backdrop-blur transition hover:bg-card hover:border-primary/40 shadow-sm"
            title={`Switch to ${theme === "light" ? "Dark (Celestial)" : "Light (Pastel Lavender)"} Theme`}
          >
            {theme === "light" ? (
              <>
                <Moon className="h-3.5 w-3.5 text-purple-600" />
                <span className="hidden sm:inline">Dark</span>
              </>
            ) : (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-400" />
                <span className="hidden sm:inline">Light</span>
              </>
            )}
          </button>

          <button
            onClick={handleDemoLogin}
            type="button"
            className="flex items-center gap-1.5 rounded-full border border-border/80 bg-card/80 px-3.5 py-1.5 text-xs font-semibold text-foreground backdrop-blur transition hover:bg-card hover:border-primary/40 shadow-sm"
          >
            <Zap className="h-3.5 w-3.5 text-amber-500" />
            <span>Try Demo Account</span>
          </button>
        </div>
      </header>

      {/* ── Main Stage: Big Mascot & Welcoming Auth Panel ── */}
      <main className="relative z-10 mx-auto w-full max-w-6xl px-6 py-4 flex-1 flex flex-col lg:flex-row items-center justify-center gap-10 lg:gap-14">
        {/* Left Column: Big 3D Welcoming Mascot & Hero Intro */}
        <div className="flex-1 flex flex-col items-center lg:items-start text-center lg:text-left max-w-lg">
          {/* 3D Mascot Stage */}
          <div className="relative mb-5 flex flex-col items-center">
            {/* Mascot Glowing Halo Aura */}
            <div className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-gradient-to-tr from-primary/50 via-pink-400/40 to-sky-400/30 blur-2xl scale-125" />

            {/* Orbiting Sparkles */}
            <div className="pointer-events-none absolute inset-0 -z-5 animate-sparkle-orbit">
              <Sparkles className="h-4 w-4 text-amber-300 drop-shadow" />
            </div>

            {/* Big 3D Owl Mascot Figure */}
            <div className="relative h-44 w-44 sm:h-52 sm:w-52 drop-shadow-2xl animate-mascot-entrance">
              <svg
                viewBox="0 0 200 200"
                className="w-full h-full overflow-visible"
                aria-label="Big Archie Welcoming Owl Mascot"
              >
                <defs>
                  <radialGradient id="welcome-body" cx="45%" cy="35%" r="65%">
                    <stop offset="0%" stopColor="#c4b5fd" />
                    <stop offset="45%" stopColor="#9333ea" />
                    <stop offset="85%" stopColor="#6b21a8" />
                    <stop offset="100%" stopColor="#4c1d95" />
                  </radialGradient>
                  <radialGradient id="welcome-belly" cx="50%" cy="30%" r="70%">
                    <stop offset="0%" stopColor="#ffffff" />
                    <stop offset="55%" stopColor="#fdf2f8" />
                    <stop offset="90%" stopColor="#f3e8ff" />
                    <stop offset="100%" stopColor="#e9d5ff" />
                  </radialGradient>
                  <linearGradient id="welcome-inner-ear" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fbcfe8" />
                    <stop offset="100%" stopColor="#f472b6" />
                  </linearGradient>
                  <linearGradient id="welcome-beak" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fde047" />
                    <stop offset="60%" stopColor="#f59e0b" />
                    <stop offset="100%" stopColor="#d97706" />
                  </linearGradient>
                  <linearGradient id="welcome-cap" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#3b0764" />
                    <stop offset="50%" stopColor="#581c87" />
                    <stop offset="100%" stopColor="#2e1065" />
                  </linearGradient>
                  <linearGradient id="welcome-tassel" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#fef08a" />
                    <stop offset="60%" stopColor="#fbbf24" />
                    <stop offset="100%" stopColor="#b45309" />
                  </linearGradient>
                  <linearGradient id="welcome-glasses" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#f43f5e" />
                    <stop offset="50%" stopColor="#c084fc" />
                    <stop offset="100%" stopColor="#38bdf8" />
                  </linearGradient>
                  <radialGradient id="welcome-shadow" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#1e1b4b" stopOpacity="0.5" />
                    <stop offset="70%" stopColor="#1e1b4b" stopOpacity="0.18" />
                    <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0" />
                  </radialGradient>
                </defs>

                {/* Ground Shadow */}
                <ellipse
                  cx="100"
                  cy="185"
                  rx="44"
                  ry="9"
                  fill="url(#welcome-shadow)"
                  className="animate-mascot-shadow"
                />

                {/* Feet */}
                <g id="welcome-feet">
                  <ellipse cx="84" cy="172" rx="9" ry="5" fill="#f59e0b" />
                  <ellipse cx="78" cy="172" rx="5" ry="4" fill="#fbbf24" />
                  <ellipse cx="90" cy="172" rx="5" ry="4" fill="#fbbf24" />

                  <ellipse cx="116" cy="172" rx="9" ry="5" fill="#f59e0b" />
                  <ellipse cx="110" cy="172" rx="5" ry="4" fill="#fbbf24" />
                  <ellipse cx="122" cy="172" rx="5" ry="4" fill="#fbbf24" />
                </g>

                {/* Left Wing (Resting) */}
                <path
                  d="M 58 100 C 40 115 42 145 56 155 C 64 148 68 130 68 112 Z"
                  fill="#7e22ce"
                  stroke="#581c87"
                  strokeWidth="1.5"
                />
                <path
                  d="M 52 112 C 44 124 46 142 54 148 C 60 142 63 128 62 118 Z"
                  fill="#9333ea"
                  opacity="0.85"
                />

                {/* Body */}
                <path
                  d="M 66 52 C 68 38, 78 40, 84 56 C 94 54, 106 54, 116 56 C 122 40, 132 38, 134 52 C 148 70, 154 98, 150 130 C 146 162, 128 174, 100 174 C 72 174, 54 162, 50 130 C 46 98, 52 70, 66 52 Z"
                  fill="url(#welcome-body)"
                />

                {/* Ear details */}
                <path
                  d="M 70 50 C 72 44, 76 46, 78 54 Z"
                  fill="url(#welcome-inner-ear)"
                  opacity="0.9"
                />
                <path
                  d="M 130 50 C 128 44, 124 46, 122 54 Z"
                  fill="url(#welcome-inner-ear)"
                  opacity="0.9"
                />

                {/* Belly */}
                <ellipse cx="100" cy="126" rx="36" ry="32" fill="url(#welcome-belly)" />
                <path
                  d="M 94 116 Q 100 120 106 116"
                  stroke="#c084fc"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M 86 128 Q 94 133 102 128"
                  stroke="#c084fc"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M 98 140 Q 106 145 114 140"
                  stroke="#c084fc"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />

                {/* Cheeks */}
                <circle cx="67" cy="104" r="8.5" fill="#f472b6" opacity="0.65" />
                <circle cx="133" cy="104" r="8.5" fill="#f472b6" opacity="0.65" />

                {/* Eyes */}
                <ellipse cx="80" cy="90" rx="19" ry="20" fill="#ffffff" />
                <ellipse cx="120" cy="90" rx="19" ry="20" fill="#ffffff" />

                {isBlinking ? (
                  <g>
                    <path
                      d="M 68 91 Q 80 95 92 91"
                      stroke="#3b0764"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      fill="none"
                    />
                    <path
                      d="M 108 91 Q 120 95 132 91"
                      stroke="#3b0764"
                      strokeWidth="3.5"
                      strokeLinecap="round"
                      fill="none"
                    />
                  </g>
                ) : (
                  <g>
                    <circle cx="82" cy="91" r="11" fill="#1e1035" />
                    <circle cx="118" cy="91" r="11" fill="#1e1035" />
                    <circle cx="82" cy="91" r="9" fill="#4c1d95" opacity="0.8" />
                    <circle cx="118" cy="91" r="9" fill="#4c1d95" opacity="0.8" />
                    <circle cx="79" cy="87" r="4.5" fill="#ffffff" />
                    <circle cx="115" cy="87" r="4.5" fill="#ffffff" />
                    <circle cx="85" cy="94" r="2" fill="#ffffff" />
                    <circle cx="121" cy="94" r="2" fill="#ffffff" />
                  </g>
                )}

                {/* Glasses */}
                <g id="welcome-glasses">
                  <circle
                    cx="80"
                    cy="90"
                    r="19"
                    fill="none"
                    stroke="url(#welcome-glasses)"
                    strokeWidth="2.5"
                  />
                  <circle
                    cx="120"
                    cy="90"
                    r="19"
                    fill="none"
                    stroke="url(#welcome-glasses)"
                    strokeWidth="2.5"
                  />
                  <path
                    d="M 98 88 Q 100 84 102 88"
                    stroke="url(#welcome-glasses)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    fill="none"
                  />
                  <path
                    d="M 70 82 A 16 16 0 0 1 82 74"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    opacity="0.65"
                    fill="none"
                  />
                  <path
                    d="M 110 82 A 16 16 0 0 1 122 74"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    opacity="0.65"
                    fill="none"
                  />
                </g>

                {/* Beak */}
                <path
                  d="M 94 96 Q 100 93 106 96 Q 100 112 94 96 Z"
                  fill="url(#welcome-beak)"
                  stroke="#b45309"
                  strokeWidth="1"
                />
                <ellipse cx="100" cy="98" rx="2.5" ry="1.5" fill="#fef08a" opacity="0.8" />

                {/* Cap & Tassel */}
                <g id="welcome-cap">
                  <polygon points="84,38 116,38 112,48 88,48" fill="#2e1065" />
                  <polygon
                    points="100,18 140,28 100,38 60,28"
                    fill="url(#welcome-cap)"
                    stroke="#7e22ce"
                    strokeWidth="1"
                  />
                  <circle cx="100" cy="28" r="3" fill="#fbbf24" />
                  <g className="animate-tassel">
                    <path
                      d="M 100 28 C 115 36 122 46 126 58"
                      stroke="url(#welcome-tassel)"
                      strokeWidth="2"
                      strokeLinecap="round"
                      fill="none"
                    />
                    <ellipse cx="126" cy="60" rx="3" ry="5" fill="#f59e0b" />
                    <circle cx="126" cy="57" r="2.5" fill="#fef08a" />
                  </g>
                </g>

                {/* Right Wing (Waving enthusiastically) */}
                <g className="animate-wing-wave">
                  <path
                    d="M 134 100 C 158 90 166 110 156 128 C 144 122 138 110 134 100 Z"
                    fill="#7e22ce"
                    stroke="#581c87"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M 142 98 C 154 92 160 106 152 118 C 144 114 140 104 142 98 Z"
                    fill="#a855f7"
                    opacity="0.8"
                  />
                </g>
              </svg>
            </div>

            {/* Mascot Welcome Speech Bubble (Exact Prompt Phrase) */}
            <div className="relative mt-3 max-w-sm rounded-2xl border border-primary/30 bg-card/95 px-4 py-3 shadow-2xl backdrop-blur-md animate-speech-pop text-left">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-500">
                <Sparkles className="h-3.5 w-3.5" />
                <span>Archie</span>
              </div>
              <p className="mt-1 text-sm font-semibold text-foreground leading-snug">
                Welcome to Exam Rescue! 🦉 Let&apos;s conquer your exams!
              </p>
            </div>
          </div>

          <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-foreground leading-tight">
            Stop Guessing. <br />
            <span className="bg-gradient-to-r from-primary via-pink-500 to-indigo-500 bg-clip-text text-transparent">
              Start Conquering.
            </span>
          </h1>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-md">
            Personalized syllabus prioritization, daily revision milestones, and emergency Rescue
            Mode built specifically for your upcoming exams.
          </p>

          <div className="mt-6 flex flex-wrap gap-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-signal" />
              <span>Priority weighted</span>
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-signal" />
              <span>Real syllabus mapping</span>
            </span>
            <span>·</span>
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-signal" />
              <span>Zero sample slop</span>
            </span>
          </div>
        </div>

        {/* Right Column: Attractive Sign Up & Log In Card */}
        <div className="w-full max-w-md">
          <div className="relative rounded-3xl border border-border/80 bg-card/95 p-6 sm:p-8 shadow-2xl backdrop-blur-xl">
            {/* Glowing Card Highlight */}
            <div className="pointer-events-none absolute -inset-0.5 rounded-3xl bg-gradient-to-tr from-primary/20 to-pink-500/15 blur-lg -z-10" />

            {/* Tab Switcher */}
            <div className="grid grid-cols-2 p-1 rounded-2xl bg-surface border border-border/60 mb-6">
              <button
                type="button"
                onClick={() => {
                  setTab("signup");
                  setError(null);
                  playPopChime();
                }}
                className={cn(
                  "py-2.5 text-xs font-bold rounded-xl transition-all duration-200",
                  tab === "signup"
                    ? "bg-gradient-to-r from-primary to-[oklch(0.70_0.15_285)] text-white shadow-md"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Sign Up
              </button>
              <button
                type="button"
                onClick={() => {
                  setTab("login");
                  setError(null);
                  playPopChime();
                }}
                className={cn(
                  "py-2.5 text-xs font-bold rounded-xl transition-all duration-200",
                  tab === "login"
                    ? "bg-gradient-to-r from-primary to-[oklch(0.70_0.15_285)] text-white shadow-md"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                Log In
              </button>
            </div>

            {error && (
              <div className="mb-5 flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-500">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Auth Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {tab === "signup" && (
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1.5">
                    Your Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Alex Sharma"
                      className="w-full rounded-xl border border-input bg-surface/60 pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:outline-none transition"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="student@university.edu"
                    className="w-full rounded-xl border border-input bg-surface/60 pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:outline-none transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full rounded-xl border border-input bg-surface/60 pl-10 pr-10 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((p) => !p)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary via-[oklch(0.70_0.15_285)] to-pink-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/30 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
              >
                <span>
                  {loading
                    ? "Processing..."
                    : tab === "signup"
                      ? "Create Account & Start"
                      : "Log In to Dashboard"}
                </span>
                <ArrowRight className="h-4 w-4" />
              </button>
            </form>

            <div className="mt-5 text-center">
              <span className="text-xs text-muted-foreground">
                {tab === "signup" ? "Already have an account?" : "Need an account?"}
              </span>{" "}
              <button
                type="button"
                onClick={() => {
                  setTab((t) => (t === "signup" ? "login" : "signup"));
                  setError(null);
                }}
                className="text-xs font-semibold text-primary hover:underline ml-1"
              >
                {tab === "signup" ? "Log In here" : "Sign Up now"}
              </button>
            </div>
          </div>
        </div>
      </main>

      {/* ── Footer ── */}
      <footer className="relative z-10 py-4 text-center text-xs text-muted-foreground">
        Exam Rescue · Your Private AI-Powered Study Compass
      </footer>
    </div>
  );
}
