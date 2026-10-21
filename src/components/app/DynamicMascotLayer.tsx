import { useEffect, useRef, useState } from "react";
import { Star, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { playCelebrationChime, playEntranceChime, playPopChime } from "@/lib/mascot-sound";
import type { SpawnMascotDetail } from "@/lib/location-mascot";

interface ConfettiPiece {
  id: number;
  x: number;
  y: number;
  rot: number;
  color: string;
  isStar: boolean;
  delay: number;
}

export function DynamicMascotLayer() {
  const [activeMascot, setActiveMascot] = useState<SpawnMascotDetail | null>(null);
  const [phase, setPhase] = useState<"burst" | "exit">("burst");
  const [confetti, setConfetti] = useState<ConfettiPiece[]>([]);
  const [isBlinking, setIsBlinking] = useState(false);

  const exitTimerRef = useRef<NodeJS.Timeout | null>(null);
  const cleanupTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Periodic blinking during presentation
  useEffect(() => {
    if (!activeMascot) return;
    const interval = setInterval(() => {
      setIsBlinking(true);
      const t = setTimeout(() => setIsBlinking(false), 200);
      return () => clearTimeout(t);
    }, 2400);
    return () => clearInterval(interval);
  }, [activeMascot]);

  useEffect(() => {
    const handleSpawn = (e: Event) => {
      const customEvent = e as CustomEvent<SpawnMascotDetail>;
      const detail = customEvent.detail;
      if (!detail) return;

      // Clear any pending timers
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);

      setActiveMascot(detail);
      setPhase("burst");
      setIsBlinking(false);

      // Play sound according to spawn type
      if (detail.type === "task-complete") {
        playCelebrationChime();
      } else if (detail.type === "welcome") {
        playEntranceChime();
      } else {
        playPopChime();
      }

      // Generate dynamic star confetti bursting from the click origin
      if (detail.type === "task-complete" || detail.type === "welcome") {
        const colors = [
          "#c084fc",
          "#f472b6",
          "#38bdf8",
          "#fbbf24",
          "#a855f7",
          "#ec4899",
          "#60a5fa",
        ];
        const pieces: ConfettiPiece[] = Array.from({ length: 18 }, (_, i) => {
          const angle = (i / 18) * 2 * Math.PI + (Math.random() - 0.5) * 0.35;
          const dist = 65 + Math.random() * 70;
          return {
            id: Date.now() + i,
            x: Math.cos(angle) * dist,
            y: Math.sin(angle) * dist - 35,
            rot: Math.floor(Math.random() * 360),
            color: colors[i % colors.length]!,
            isStar: i % 2 === 0,
            delay: Math.random() * 0.1,
          };
        });
        setConfetti(pieces);
      } else {
        setConfetti([]);
      }

      const totalDuration = detail.durationMs || 2800;
      const exitTime = Math.max(800, totalDuration - 600);

      // Transition to exit phase
      exitTimerRef.current = setTimeout(() => {
        setPhase("exit");
      }, exitTime);

      // Completely remove and unmount
      cleanupTimerRef.current = setTimeout(() => {
        setActiveMascot(null);
        setConfetti([]);
      }, totalDuration);
    };

    window.addEventListener("exam-rescue:spawn-mascot", handleSpawn);
    return () => {
      window.removeEventListener("exam-rescue:spawn-mascot", handleSpawn);
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      if (cleanupTimerRef.current) clearTimeout(cleanupTimerRef.current);
    };
  }, []);

  if (!activeMascot) return null;

  const isCelebration = activeMascot.type === "task-complete";
  const showBubbleAbove = activeMascot.y > 220;

  return (
    <div
      aria-live="polite"
      className="fixed inset-0 pointer-events-none z-[9999] overflow-hidden perspective-1000"
    >
      {/* Container anchored at the exact interaction origin (x, y) */}
      <div
        style={{
          position: "absolute",
          left: `${activeMascot.x}px`,
          top: `${activeMascot.y}px`,
          transformStyle: "preserve-3d",
        }}
        className={cn(
          "flex flex-col items-center justify-center",
          phase === "burst" ? "animate-location-burst" : "animate-location-exit",
        )}
      >
        {/* Soft glowing particle halo behind Archie */}
        <div
          className={cn(
            "pointer-events-none absolute -z-10 rounded-full blur-2xl transition-all duration-500",
            isCelebration
              ? "h-44 w-44 bg-gradient-to-tr from-primary/50 via-pink-400/50 to-amber-300/40 opacity-100 scale-125"
              : "h-36 w-36 bg-gradient-to-tr from-primary/35 via-[oklch(0.70_0.15_285)]/35 to-sky-300/30 opacity-90 scale-110",
          )}
        />

        {/* Orbiting Twinkle Stars */}
        <div className="pointer-events-none absolute -top-3 -left-3 text-amber-300 animate-star-twinkle">
          <Star className="h-4 w-4 fill-amber-300 drop-shadow-md" />
        </div>
        <div className="pointer-events-none absolute -bottom-2 -right-3 text-purple-300 animate-star-twinkle [animation-delay:0.8s]">
          <Sparkles className="h-4 w-4 fill-purple-300 drop-shadow-md" />
        </div>
        <div className="pointer-events-none absolute top-2 -right-4 text-sky-300 animate-star-twinkle [animation-delay:0.5s]">
          <Star className="h-3 w-3 fill-sky-300 drop-shadow-md" />
        </div>

        {/* Confetti Explosion from origin */}
        {confetti.map((c) => (
          <div
            key={c.id}
            className="animate-confetti pointer-events-none absolute z-50"
            style={
              {
                "--tx": `${c.x}px`,
                "--ty": `${c.y}px`,
                "--rot": `${c.rot}deg`,
                animationDelay: `${c.delay}s`,
                left: "0px",
                top: "0px",
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

        {/* Floating 3D Speech Bubble */}
        <div
          className={cn(
            "absolute z-30 min-w-[200px] max-w-[280px] rounded-2xl border border-border/80 bg-card/95 px-3.5 py-2.5 text-center shadow-2xl backdrop-blur-md animate-location-speech",
            showBubbleAbove ? "-top-24" : "top-32",
            isCelebration ? "ring-2 ring-primary/40 shadow-primary/30" : "ring-1 ring-border/40",
          )}
        >
          {/* Bubble Pointer Arrow */}
          <div
            className={cn(
              "absolute left-1/2 -translate-x-1/2 h-3.5 w-3.5 rotate-45 border-border/80 bg-card/95",
              showBubbleAbove ? "-bottom-1.5 border-b border-r" : "-top-1.5 border-t border-l",
            )}
          />

          <div className="flex items-center justify-center gap-1.5 text-[11px] font-bold text-primary">
            <Sparkles className="h-3 w-3" />
            <span>Archie · Study Copilot</span>
          </div>

          <p className="mt-1 text-xs font-semibold leading-snug text-foreground">
            {activeMascot.message}
          </p>
        </div>

        {/* 3D-Style Owl SVG Artwork */}
        <div className="relative h-28 w-28 sm:h-32 sm:w-32 drop-shadow-2xl">
          <svg
            viewBox="0 0 200 200"
            className="w-full h-full overflow-visible"
            aria-label="Archie 3D Study Companion"
          >
            <defs>
              <radialGradient id="dyn-owl-body" cx="45%" cy="35%" r="65%">
                <stop offset="0%" stopColor="#c4b5fd" />
                <stop offset="45%" stopColor="#9333ea" />
                <stop offset="85%" stopColor="#6b21a8" />
                <stop offset="100%" stopColor="#4c1d95" />
              </radialGradient>

              <radialGradient id="dyn-owl-belly" cx="50%" cy="30%" r="70%">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="55%" stopColor="#fdf2f8" />
                <stop offset="90%" stopColor="#f3e8ff" />
                <stop offset="100%" stopColor="#e9d5ff" />
              </radialGradient>

              <linearGradient id="dyn-owl-inner-ear" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fbcfe8" />
                <stop offset="100%" stopColor="#f472b6" />
              </linearGradient>

              <linearGradient id="dyn-owl-beak" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fde047" />
                <stop offset="60%" stopColor="#f59e0b" />
                <stop offset="100%" stopColor="#d97706" />
              </linearGradient>

              <linearGradient id="dyn-owl-cap" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#3b0764" />
                <stop offset="50%" stopColor="#581c87" />
                <stop offset="100%" stopColor="#2e1065" />
              </linearGradient>

              <linearGradient id="dyn-owl-tassel" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#fef08a" />
                <stop offset="60%" stopColor="#fbbf24" />
                <stop offset="100%" stopColor="#b45309" />
              </linearGradient>

              <linearGradient id="dyn-owl-glasses" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f43f5e" />
                <stop offset="50%" stopColor="#c084fc" />
                <stop offset="100%" stopColor="#38bdf8" />
              </linearGradient>

              <radialGradient id="dyn-owl-shadow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#1e1b4b" stopOpacity="0.5" />
                <stop offset="70%" stopColor="#1e1b4b" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#1e1b4b" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Dynamic Ground Shadow */}
            <ellipse
              cx="100"
              cy="185"
              rx="42"
              ry="8"
              fill="url(#dyn-owl-shadow)"
              className="animate-mascot-shadow"
            />

            {/* Little Feet */}
            <g id="dyn-owl-feet">
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
                isCelebration
                  ? "M 58 95 C 35 75 32 50 48 45 C 60 52 64 75 66 95 Z"
                  : "M 58 100 C 40 115 42 145 56 155 C 64 148 68 130 68 112 Z"
              }
              fill="#7e22ce"
              stroke="#581c87"
              strokeWidth="1.5"
            />
            <path
              d={
                isCelebration
                  ? "M 52 80 C 40 65 38 54 48 49 C 54 54 58 68 58 80 Z"
                  : "M 52 112 C 44 124 46 142 54 148 C 60 142 63 128 62 118 Z"
              }
              fill="#9333ea"
              opacity="0.8"
            />

            {/* Owl Main Body */}
            <path
              d="M 66 52 
                 C 68 38, 78 40, 84 56 
                 C 94 54, 106 54, 116 56 
                 C 122 40, 132 38, 134 52 
                 C 148 70, 154 98, 150 130 
                 C 146 162, 128 174, 100 174 
                 C 72 174, 54 162, 50 130 
                 C 46 98, 52 70, 66 52 Z"
              fill="url(#dyn-owl-body)"
            />

            {/* Ear Tufts Inner Detail */}
            <path
              d="M 70 50 C 72 44, 76 46, 78 54 Z"
              fill="url(#dyn-owl-inner-ear)"
              opacity="0.9"
            />
            <path
              d="M 130 50 C 128 44, 124 46, 122 54 Z"
              fill="url(#dyn-owl-inner-ear)"
              opacity="0.9"
            />

            {/* Fluffy Belly */}
            <ellipse cx="100" cy="126" rx="36" ry="32" fill="url(#dyn-owl-belly)" />
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
              r={isCelebration ? 9.5 : 7.5}
              fill="#f472b6"
              opacity={isCelebration ? 0.75 : 0.45}
            />
            <circle
              cx="133"
              cy="104"
              r={isCelebration ? 9.5 : 7.5}
              fill="#f472b6"
              opacity={isCelebration ? 0.75 : 0.45}
            />

            {/* Owl Eyes */}
            <ellipse cx="80" cy="90" rx="19" ry="20" fill="#ffffff" />
            <ellipse cx="120" cy="90" rx="19" ry="20" fill="#ffffff" />

            {/* Eye States */}
            {isCelebration ? (
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
            <g id="dyn-owl-glasses">
              <circle
                cx="80"
                cy="90"
                r="19"
                fill="none"
                stroke="url(#dyn-owl-glasses)"
                strokeWidth="2.5"
              />
              <circle
                cx="120"
                cy="90"
                r="19"
                fill="none"
                stroke="url(#dyn-owl-glasses)"
                strokeWidth="2.5"
              />
              <path
                d="M 98 88 Q 100 84 102 88"
                stroke="url(#dyn-owl-glasses)"
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
              fill="url(#dyn-owl-beak)"
              stroke="#b45309"
              strokeWidth="1"
            />
            <ellipse cx="100" cy="98" rx="2.5" ry="1.5" fill="#fef08a" opacity="0.8" />

            {/* Mortarboard Cap */}
            <g id="dyn-owl-cap">
              <polygon points="84,38 116,38 112,48 88,48" fill="#2e1065" />
              <polygon
                points="100,18 140,28 100,38 60,28"
                fill="url(#dyn-owl-cap)"
                stroke="#7e22ce"
                strokeWidth="1"
              />
              <circle cx="100" cy="28" r="3" fill="#fbbf24" />

              <g className="animate-tassel">
                <path
                  d="M 100 28 C 115 36 122 46 126 58"
                  stroke="url(#dyn-owl-tassel)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
                <ellipse cx="126" cy="60" rx="3" ry="5" fill="#f59e0b" />
                <circle cx="126" cy="57" r="2.5" fill="#fef08a" />
              </g>
            </g>

            {/* Right Wing */}
            <g className={isCelebration ? "" : "animate-wing-wave"}>
              <path
                d={
                  isCelebration
                    ? "M 142 95 C 165 75 168 50 152 45 C 140 52 136 75 134 95 Z"
                    : "M 134 100 C 158 90 166 110 156 128 C 144 122 138 110 134 100 Z"
                }
                fill="#7e22ce"
                stroke="#581c87"
                strokeWidth="1.5"
              />
              <path
                d={
                  isCelebration
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
    </div>
  );
}
