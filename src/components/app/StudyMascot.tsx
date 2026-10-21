import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkles, Trophy, Flame, Siren, Star, RefreshCw, Volume2, VolumeX, X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  isMascotSoundEnabled,
  setMascotSoundEnabled,
  playEntranceChime,
  playCelebrationChime,
  playPopChime,
} from "@/lib/mascot-sound";

export interface StudyMascotProps {
  mode?: "dashboard" | "rescue";
  progress?: number;
  name?: string;
  revisedTopics?: number;
  totalTopics?: number;
  className?: string;
  compact?: boolean;
}

const STUDY_TIPS = [
  "Active recall builds 3x stronger memory than passive highlighting! Try recalling key formulas from memory.",
  "The Pomodoro technique (25 min study, 5 min break) keeps your focus sharp and prevents burnout.",
  "Sleep is when your brain locks topics into long-term memory — rest well before exam day!",
  "Explaining a concept simply in your own words reveals gaps faster than re-reading notes.",
  "Tackle High-Priority topics first! Maximum marks for the time you spend.",
  "Take short quizzes often — testing yourself is the fastest way to lock in weak topics.",
];

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  rot: number;
  color: string;
  isStar: boolean;
  delay: number;
}

interface SparkleParticle {
  id: number;
  x: number;
  y: number;
  scale: number;
  delay: number;
}

export function StudyMascot({
  mode = "dashboard",
  progress = 0,
  name,
  revisedTopics,
  totalTopics,
  className,
  compact = false,
}: StudyMascotProps) {
  const [isBlinking, setIsBlinking] = useState(false);
  const [isCelebrating, setIsCelebrating] = useState(false);
  const [celebrationTitle, setCelebrationTitle] = useState<string>("");
  const [tipIndex, setTipIndex] = useState<number | null>(null);
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const [entranceSparkles, setEntranceSparkles] = useState<SparkleParticle[]>([]);
  const [bubbleDismissed, setBubbleDismissed] = useState(false);
  const [soundOn, setSoundOn] = useState(false);

  // 3D Entrance state tracking: only trigger entrance once per mount session, not on re-renders
  const [isEntering, setIsEntering] = useState(true);
  const hasEnteredRef = useRef(false);

  // 3D tilt on hover (Desktop)
  const [tilt, setTilt] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Initialize sound preference
  useEffect(() => {
    setSoundOn(isMascotSoundEnabled());
    const handleSoundChange = (e: Event) => {
      const custom = e as CustomEvent<{ enabled: boolean }>;
      setSoundOn(Boolean(custom.detail?.enabled));
    };
    window.addEventListener("exam-rescue:sound-changed", handleSoundChange);
    return () => window.removeEventListener("exam-rescue:sound-changed", handleSoundChange);
  }, []);

  // Periodic blinking effect
  useEffect(() => {
    const blinkInterval = setInterval(() => {
      setIsBlinking(true);
      const timer = setTimeout(() => setIsBlinking(false), 220);
      return () => clearTimeout(timer);
    }, 4200);

    return () => clearInterval(blinkInterval);
  }, []);

  // Magical 3D Welcome entrance when dashboard opens
  useEffect(() => {
    if (hasEnteredRef.current) return;
    hasEnteredRef.current = true;
    setIsEntering(true);

    // Spawn entrance magical sparkles
    const sparkles: SparkleParticle[] = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      x: (Math.random() - 0.5) * 80,
      y: (Math.random() - 0.5) * 80 - 10,
      scale: 0.8 + Math.random() * 0.6,
      delay: Math.random() * 0.4,
    }));
    setEntranceSparkles(sparkles);

    // Play soft entrance chime if sound is enabled
    const chimeTimer = setTimeout(() => {
      playEntranceChime();
    }, 350);

    const entranceTimer = setTimeout(() => {
      setIsEntering(false);
      setEntranceSparkles([]);
    }, 1400);

    return () => {
      clearTimeout(chimeTimer);
      clearTimeout(entranceTimer);
    };
  }, []);

  // Listen for study task/topic completion celebration events
  useEffect(() => {
    const handleCelebrate = (e: Event) => {
      const customEvent = e as CustomEvent<{ title?: string }>;
      const title = customEvent.detail?.title || "study topic";
      setCelebrationTitle(title);
      setIsCelebrating(true);
      setBubbleDismissed(false);
      setTipIndex(null);

      // Play soft celebration chime if sound is enabled
      playCelebrationChime();

      // Generate colorful confetti & stars burst
      const colors = ["#c084fc", "#f472b6", "#38bdf8", "#fbbf24", "#a855f7", "#ec4899", "#60a5fa"];
      const pieces: ConfettiPiece[] = Array.from({ length: 22 }, (_, i) => {
        const angle = (i / 22) * 2 * Math.PI + (Math.random() - 0.5) * 0.35;
        const dist = 75 + Math.random() * 75;
        return {
          id: Date.now() + i,
          x: Math.cos(angle) * dist,
          y: Math.sin(angle) * dist - 30,
          rot: Math.floor(Math.random() * 360),
          color: colors[i % colors.length]!,
          isStar: i % 2 === 0,
          delay: Math.random() * 0.15,
        };
      });
      setConfetti(pieces);

      const timer = setTimeout(() => {
        setIsCelebrating(false);
        setConfetti([]);
      }, 3600);

      return () => clearTimeout(timer);
    };

    window.addEventListener("exam-rescue:celebrate", handleCelebrate);
    return () => window.removeEventListener("exam-rescue:celebrate", handleCelebrate);
  }, []);

  // Determine speech bubble message based on mode, celebration, and actual progress
  const speechMessage = useMemo(() => {
    if (isCelebrating) {
      return celebrationTitle
        ? `Woohoo! You completed "${celebrationTitle}"! Keep this incredible momentum! ⭐`
        : "Awesome job! You crushed that study topic! One step closer to aceing this! 🎉";
    }

    if (tipIndex !== null) {
      return STUDY_TIPS[tipIndex % STUDY_TIPS.length];
    }

    if (mode === "rescue") {
      if (typeof revisedTopics === "number" && typeof totalTopics === "number") {
        if (revisedTopics === 0) {
          return "Rescue Mode active! Don't stress — start with Topic #1 below to get maximum marks fast! 🚨";
        }
        if (revisedTopics >= totalTopics && totalTopics > 0) {
          return "Incredible! All high-yield topics are revised and locked in. You're ready to ace this! 🏆";
        }
        return `Great rescue progress! ${revisedTopics} of ${totalTopics} topics revised. Let's finish the rest! ⚡`;
      }
      return "Rescue Mode is ready! I've ranked your syllabus by priority so you can study what matters most.";
    }

    // Dashboard mode progress reactions
    const pct = Math.round(progress);
    if (pct === 0) {
      return name
        ? `Hi ${name}! I'm Archie, your 3D study copilot. Check today's study mission below to get started! 📖`
        : "Welcome! I'm Archie, your 3D study copilot. Check today's study mission below to start! 📖";
    }
    if (pct < 35) {
      return `Solid start (${pct}% prepared)! Every focused minute levels up your readiness score. Keep going! ✨`;
    }
    if (pct < 70) {
      return `Halfway there (${pct}% prepared)! Your study consistency is looking really strong. You've got this! 🚀`;
    }
    if (pct < 100) {
      return `Final stretch (${pct}% prepared)! Finish these remaining topics and exam day will be a breeze! ⭐`;
    }
    return "100% prepared! Syllabus mastered, tasks conquered. Walk into your exam with total confidence! 🎓";
  }, [isCelebrating, celebrationTitle, tipIndex, mode, revisedTopics, totalTopics, progress, name]);

  const handleMascotClick = () => {
    // Play sound if enabled or give playful chime
    playPopChime();
    setBubbleDismissed(false);
    setTipIndex((prev) => (prev === null ? 0 : (prev + 1) % STUDY_TIPS.length));
  };

  const toggleSound = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !soundOn;
    setSoundOn(next);
    setMascotSoundEnabled(next);
    if (next) {
      playEntranceChime(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: x * 18, y: -y * 18 });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  const roundedPct = Math.round(progress);
  const isHappy = isCelebrating || roundedPct >= 75;

  return (
    <div
      className={cn(
        "relative flex flex-col items-center gap-2 select-none sm:flex-row sm:items-center sm:gap-4 perspective-1000",
        className,
      )}
    >
      {/* 3D Mascot Stage Container */}
      <div
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleMascotClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") handleMascotClick();
        }}
        title="Click Archie for study tips, 3D interaction & audio chime!"
        className={cn(
          "group relative flex shrink-0 cursor-pointer flex-col items-center justify-center transition-transform duration-200 active:scale-95",
          compact ? "h-24 w-24 sm:h-28 sm:w-28" : "h-32 w-32 sm:h-36 sm:w-36",
          isCelebrating && "z-40",
        )}
        style={{
          transform: `perspective(1000px) rotateY(${tilt.x}deg) rotateX(${tilt.y}deg)`,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Soft magical background aura with multi-layered glow */}
        <div
          className={cn(
            "pointer-events-none absolute inset-0 -z-10 rounded-full blur-xl transition-all duration-700",
            isCelebrating
              ? "scale-150 bg-gradient-to-tr from-primary/50 via-pink-400/50 to-amber-300/40 opacity-100"
              : "bg-gradient-to-tr from-primary/30 via-[oklch(0.70_0.15_285)]/30 to-pink-400/25 group-hover:scale-125 group-hover:opacity-100",
          )}
        />

        {/* Orbiting Sparkles */}
        <div className="pointer-events-none absolute inset-0 -z-5 animate-sparkle-orbit">
          <Sparkles className="h-3 w-3 text-amber-300 drop-shadow-sm" />
        </div>

        {/* Floating Twinkling Stars */}
        <div className="pointer-events-none absolute -top-1 -left-1 text-amber-300 animate-star-twinkle">
          <Star className="h-4 w-4 fill-amber-300 drop-shadow-sm" />
        </div>
        <div className="pointer-events-none absolute -bottom-1 -right-1 text-purple-300 animate-star-twinkle [animation-delay:1.2s]">
          <Sparkles className="h-4 w-4 fill-purple-300 drop-shadow-sm" />
        </div>
        <div className="pointer-events-none absolute top-3 -right-2 text-sky-300 animate-star-twinkle [animation-delay:0.7s]">
          <Star className="h-3 w-3 fill-sky-300 drop-shadow-sm" />
        </div>

        {/* Entrance Sparkles Burst */}
        {entranceSparkles.map((sp) => (
          <div
            key={sp.id}
            className="animate-sparkle pointer-events-none absolute z-30"
            style={{
              left: "50%",
              top: "50%",
              transform: `translate(${sp.x}px, ${sp.y}px) scale(${sp.scale})`,
              animationDelay: `${sp.delay}s`,
            }}
          >
            <Sparkles className="h-4 w-4 text-amber-300 fill-amber-300 drop-shadow" />
          </div>
        ))}

        {/* Confetti Explosion during Celebration */}
        {confetti.map((c) => (
          <div
            key={c.id}
            className="animate-confetti pointer-events-none absolute z-40"
            style={
              {
                "--tx": `${c.x}px`,
                "--ty": `${c.y}px`,
                "--rot": `${c.rot}deg`,
                animationDelay: `${c.delay}s`,
                left: "50%",
                top: "50%",
              } as React.CSSProperties
            }
          >
            {c.isStar ? (
              <Star className="h-4 w-4 drop-shadow-md" style={{ fill: c.color, color: c.color }} />
            ) : (
              <span
                className="block h-2.5 w-2.5 rounded-full shadow-md"
                style={{ backgroundColor: c.color }}
              />
            )}
          </div>
        ))}

        {/* Main 3D-Style Owl SVG with 3D Entrance & Pop-out Animations */}
        <div
          className={cn(
            "relative w-full h-full",
            isEntering
              ? "animate-mascot-entrance"
              : isCelebrating
                ? "animate-mascot-popout"
                : "animate-mascot-float",
          )}
          style={{ transformStyle: "preserve-3d" }}
        >
          <svg
            viewBox="0 0 200 200"
            className="w-full h-full drop-shadow-lg overflow-visible"
            aria-label="Archie the 3D Pop-out Exam Rescue Owl"
          >
            <defs>
              {/* 3D Body Gradient - soft lavender to electric violet */}
              <radialGradient id="owl-body" cx="45%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#c4b5fd" />
                <stop offset="45%" stopColor="#9333ea" />
                <stop offset="85%" stopColor="#6b21a8" />
                <stop offset="100%" stopColor="#4c1d95" />
              </radialGradient>

              {/* 3D Belly Gradient - soft cream to pale pink */}
              <radialGradient id="owl-belly" cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="55%" stopColor="#fdf2f8" />
                <stop offset="90%" stopColor="#f3e8ff" />
                <stop offset="100%" stopColor="#e9d5ff" />
              </radialGradient>

              {/* Inner Ear Gradient - rosy pastel pink */}
              <linearGradient id="owl-inner-ear" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fbcfe8" />
                <stop offset="100%" stopColor="#f472b6" />
              </linearGradient>

              {/* Golden Beak Gradient */}
              <linearGradient id="owl-beak" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fde047" />
                <stop offset="60%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>

              {/* Mortarboard Cap Gradient - deep purple velvet */}
              <linearGradient id="owl-cap" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#3b0764" />
                <stop offset="50%" stopColor="#581c87" />
                <stop offset="100%" stopColor="#2e1065" />
              </linearGradient>

              {/* Golden Tassel Gradient */}
              <linearGradient id="owl-tassel" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="60%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>

              {/* Glasses Rim Gradient - metallic rose violet */}
              <linearGradient id="owl-glasses" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f43f5e" />
                <stop offset="50%" stopColor="#c084fc" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>

              {/* Drop Shadow Gradient */}
              <radialGradient id="owl-shadow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#1e1b4b" stopOpacity="0.45" />
                <stop offset="70%" stopColor="#1e1b4b" stopOpacity="0.18" />
                <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Dynamic Ground Shadow */}
            <ellipse
              cx="100"
              cy="185"
              rx="42"
              ry="8"
              fill="url(#owl-shadow)"
              className="animate-mascot-shadow"
            />

            {/* Little Feet */}
            <g id="owl-feet">
              <ellipse cx="84" cy="172" rx="9" ry="5" fill="#f59e0b" />
              <ellipse cx="78" cy="172" rx="5" ry="4" fill="#fbbf24" />
              <ellipse cx="90" cy="172" rx="5" ry="4" fill="#fbbf24" />

              <ellipse cx="116" cy="172" rx="9" ry="5" fill="#f59e0b" />
              <ellipse cx="110" cy="172" rx="5" ry="4" fill="#fbbf24" />
              <ellipse cx="122" cy="172" rx="5" ry="4" fill="#fbbf24" />
            </g>

            {/* Left Wing (Resting or Raised) */}
            <path
              d={
                isCelebrating
                  ? "M 58 95 C 35 75 32 50 48 45 C 60 52 64 75 66 95 Z"
                  : "M 58 100 C 40 115 42 145 56 155 C 64 148 68 130 68 112 Z"
              }
              fill="#7e22ce"
              stroke="#581c87"
              strokeWidth="1.5"
            />
            {/* Wing Feather Layer */}
            <path
              d={
                isCelebrating
                  ? "M 52 80 C 40 65 38 54 48 49 C 54 54 58 68 58 80 Z"
                  : "M 52 112 C 44 124 46 142 54 148 C 60 142 63 128 62 118 Z"
              }
              fill="#9333ea"
              opacity="0.8"
            />

            {/* Owl Main Body with Ear Tufts */}
            <path
              d="M 66 52 
                 C 68 38, 78 40, 84 56 
                 C 94 54, 106 54, 116 56 
                 C 122 40, 132 38, 134 52 
                 C 148 70, 154 98, 150 130 
                 C 146 162, 128 174, 100 174 
                 C 72 174, 54 162, 50 130 
                 C 46 98, 52 70, 66 52 Z"
              fill="url(#owl-body)"
            />

            {/* Ear Tufts Inner Detail */}
            <path d="M 70 50 C 72 44, 76 46, 78 54 Z" fill="url(#owl-inner-ear)" opacity="0.9" />
            <path
              d="M 130 50 C 128 44, 124 46, 122 54 Z"
              fill="url(#owl-inner-ear)"
              opacity="0.9"
            />

            {/* Fluffy Belly */}
            <ellipse cx="100" cy="126" rx="36" ry="32" fill="url(#owl-belly)" />
            {/* Belly Feather Tufts */}
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

            {/* Rosy Blushing Cheeks */}
            <circle
              cx="67"
              cy="104"
              r={isHappy ? 9.5 : 7.5}
              fill="#f472b6"
              opacity={isHappy ? 0.75 : 0.45}
            />
            <circle
              cx="133"
              cy="104"
              r={isHappy ? 9.5 : 7.5}
              fill="#f472b6"
              opacity={isHappy ? 0.75 : 0.45}
            />

            {/* Owl Eyes */}
            {/* White Eye Sockets */}
            <ellipse cx="80" cy="90" rx="19" ry="20" fill="#ffffff" />
            <ellipse cx="120" cy="90" rx="19" ry="20" fill="#ffffff" />

            {/* Eyeball states: Celebration Happy Curves vs Normal Glossy Eyes vs Blinking */}
            {isHappy ? (
              // Joyful smiling eyes (^ ^)
              <g>
                <path
                  d="M 70 94 Q 80 80 90 94"
                  stroke="#3b0764"
                  strokeWidth="4"
                  strokeLinecap="round"
                  fill="none"
                />
                <path
                  d="M 110 94 Q 120 80 130 94"
                  stroke="#3b0764"
                  strokeWidth="4"
                  strokeLinecap="round"
                  fill="none"
                />
              </g>
            ) : isBlinking ? (
              // Closed eye lines during blink
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
              // Glossy expressive anime-style eyes
              <g>
                {/* Iris & Pupils */}
                <circle cx="82" cy="91" r="11" fill="#1e1035" />
                <circle cx="118" cy="91" r="11" fill="#1e1035" />
                <circle cx="82" cy="91" r="9" fill="#4c1d95" opacity="0.8" />
                <circle cx="118" cy="91" r="9" fill="#4c1d95" opacity="0.8" />

                {/* Big Glossy Catchlights */}
                <circle cx="79" cy="87" r="4.5" fill="#ffffff" />
                <circle cx="115" cy="87" r="4.5" fill="#ffffff" />
                {/* Secondary Catchlights */}
                <circle cx="85" cy="94" r="2" fill="#ffffff" />
                <circle cx="121" cy="94" r="2" fill="#ffffff" />
              </g>
            )}

            {/* Rose-Gold & Violet Academic Glasses */}
            <g id="owl-glasses">
              {/* Left Lens Frame */}
              <circle
                cx="80"
                cy="90"
                r="19"
                fill="none"
                stroke="url(#owl-glasses)"
                strokeWidth="2.5"
              />
              {/* Right Lens Frame */}
              <circle
                cx="120"
                cy="90"
                r="19"
                fill="none"
                stroke="url(#owl-glasses)"
                strokeWidth="2.5"
              />
              {/* Glasses Bridge */}
              <path
                d="M 98 88 Q 100 84 102 88"
                stroke="url(#owl-glasses)"
                strokeWidth="2.5"
                strokeLinecap="round"
                fill="none"
              />
              {/* Subtle Lens Glint Arcs */}
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

            {/* Cute Golden Amber Beak */}
            <path
              d="M 94 96 Q 100 93 106 96 Q 100 112 94 96 Z"
              fill="url(#owl-beak)"
              stroke="#b45309"
              strokeWidth="1"
            />
            {/* Beak Highlight */}
            <ellipse cx="100" cy="98" rx="2.5" ry="1.5" fill="#fef08a" opacity="0.8" />

            {/* Academic Mortarboard Graduation Cap */}
            <g id="owl-cap">
              {/* Cap Skull Base */}
              <polygon points="84,38 116,38 112,48 88,48" fill="#2e1065" />
              {/* Cap Diamond Top */}
              <polygon
                points="100,18 140,28 100,38 60,28"
                fill="url(#owl-cap)"
                stroke="#7e22ce"
                strokeWidth="1"
              />
              {/* Cap Top Center Button */}
              <circle cx="100" cy="28" r="3" fill="#fbbf24" />

              {/* Dangling Animated Golden Tassel */}
              <g className="animate-tassel">
                <path
                  d="M 100 28 C 115 36 122 46 126 58"
                  stroke="url(#owl-tassel)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
                {/* Tassel Fringe */}
                <ellipse cx="126" cy="60" rx="3" ry="5" fill="#f59e0b" />
                <circle cx="126" cy="57" r="2.5" fill="#fef08a" />
              </g>
            </g>

            {/* Right Wing: Waves enthusiastically or celebrates in 3D */}
            <g className={isCelebrating ? "" : "animate-wing-wave"}>
              <path
                d={
                  isCelebrating
                    ? "M 142 95 C 165 75 168 50 152 45 C 140 52 136 75 134 95 Z"
                    : "M 134 100 C 158 90 166 110 156 128 C 144 122 138 110 134 100 Z"
                }
                fill="#7e22ce"
                stroke="#581c87"
                strokeWidth="1.5"
              />
              {/* Wing Tip Gradient Accent */}
              <path
                d={
                  isCelebrating
                    ? "M 148 80 C 160 65 162 54 152 49 C 146 54 142 68 142 80 Z"
                    : "M 142 98 C 154 92 160 106 152 118 C 144 114 140 104 142 98 Z"
                }
                fill="#a855f7"
                opacity="0.8"
              />
            </g>
          </svg>
        </div>
      </div>

      {/* Floating 3D Speech Bubble */}
      {!bubbleDismissed && (
        <div
          className={cn(
            "relative max-w-sm rounded-2xl border border-border/80 bg-card/95 p-3.5 shadow-xl backdrop-blur-md transition-all duration-300 hover:border-primary/50 animate-speech-pop",
            isCelebrating && "ring-2 ring-primary/40 shadow-primary/20",
          )}
          style={{ transformStyle: "preserve-3d" }}
        >
          {/* Pointer Arrow pointing toward mascot on desktop / top on mobile */}
          <div className="hidden sm:block absolute -left-2 top-6 h-3.5 w-3.5 -rotate-45 border-l border-t border-border/80 bg-card/95" />
          <div className="sm:hidden absolute -top-1.5 left-1/2 -translate-x-1/2 h-3 w-3 rotate-45 border-l border-t border-border/80 bg-card/95" />

          {/* Mascot Badge & Header Controls */}
          <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-border/40">
            <div className="flex items-center gap-1.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-md bg-primary/15 text-primary">
                {mode === "rescue" ? (
                  <Siren className="h-3 w-3 text-signal" />
                ) : (
                  <Sparkles className="h-3 w-3 text-primary" />
                )}
              </span>
              <span className="font-display text-xs font-bold tracking-tight text-foreground">
                {mode === "rescue" ? "Archie · Rescue Copilot" : "Archie · 3D Study Copilot"}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleSound}
                className={cn(
                  "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold transition",
                  soundOn
                    ? "bg-primary/15 text-primary hover:bg-primary/25"
                    : "text-muted-foreground hover:bg-surface hover:text-foreground",
                )}
                title={soundOn ? "Mute mascot sounds" : "Enable magical chime sounds"}
              >
                {soundOn ? <Volume2 className="h-3 w-3" /> : <VolumeX className="h-3 w-3" />}
                <span className="hidden xs:inline">{soundOn ? "Sound" : "Muted"}</span>
              </button>

              <button
                type="button"
                onClick={handleMascotClick}
                className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-primary transition hover:bg-primary/10"
                title="Click for a study tip"
              >
                <RefreshCw className="h-2.5 w-2.5" />
                <span className="hidden xs:inline">Tip</span>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setBubbleDismissed(true);
                }}
                className="rounded-md p-0.5 text-muted-foreground hover:bg-surface hover:text-foreground"
                title="Dismiss speech bubble"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>

          {/* Dynamic Message Content */}
          <p className="mt-2 text-xs leading-relaxed text-foreground font-semibold transition-all duration-300">
            {speechMessage}
          </p>

          {/* Bottom Interactive Status Bar */}
          <div className="mt-2 flex items-center justify-between pt-1.5 border-t border-border/30 text-[10px] text-muted-foreground font-medium">
            <span className="flex items-center gap-1">
              {mode === "rescue" ? (
                <>
                  <Flame className="h-3 w-3 text-warning" />
                  <span>Focus on High Priority</span>
                </>
              ) : (
                <>
                  <Trophy className="h-3 w-3 text-primary" />
                  <span>{roundedPct}% Syllabus Ready</span>
                </>
              )}
            </span>
            <span className="italic text-primary font-medium">Click Archie to interact!</span>
          </div>
        </div>
      )}
    </div>
  );
}
