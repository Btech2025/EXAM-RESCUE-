import { useEffect, useState } from "react";
import { Sparkles, Star } from "lucide-react";
import { getTheme, type Theme } from "@/lib/theme";

export function MagicalBackground() {
  const [theme, setThemeState] = useState<Theme>(() => getTheme());

  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const custom = e as CustomEvent<{ theme: Theme }>;
      setThemeState(custom.detail?.theme ?? getTheme());
    };

    window.addEventListener("exam-rescue:theme-changed", handleThemeChange);
    return () => window.removeEventListener("exam-rescue:theme-changed", handleThemeChange);
  }, []);

  const isDark = theme === "dark";

  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden select-none transition-colors duration-500">
      {/* ── Base Mesh Background ── */}
      {isDark ? (
        <>
          <div className="absolute inset-0 bg-[#0e0725]" />
          <div className="absolute inset-0 bg-gradient-to-br from-[#1b0a38] via-[#241147] to-[#090b1e] opacity-95" />
          {/* Deep dark glowing orbs */}
          <div className="absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full bg-[oklch(0.58_0.2_285)]/20 blur-3xl animate-float" />
          <div className="absolute top-1/4 -right-24 h-[440px] w-[440px] rounded-full bg-sky-500/18 blur-3xl animate-float [animation-delay:2.5s]" />
          <div className="absolute -bottom-24 left-1/4 h-[380px] w-[380px] rounded-full bg-pink-500/15 blur-3xl animate-float [animation-delay:4s]" />
          <div className="absolute top-2/3 right-1/3 h-[320px] w-[320px] rounded-full bg-indigo-600/15 blur-3xl animate-float [animation-delay:1.5s]" />
          {/* Celestial rings */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[750px] w-[750px] rounded-full border border-white/[0.04] animate-orbit [animation-duration:60s]" />
        </>
      ) : (
        <>
          <div className="absolute inset-0 bg-[#f8f6ff]" />
          <div className="absolute inset-0 bg-gradient-to-br from-[#fcfaff] via-[#f5f1ff] to-[#ebe5fe] opacity-95" />
          {/* Soft airy pastel glowing orbs */}
          <div className="absolute -top-32 -left-32 h-[450px] w-[450px] rounded-full bg-purple-300/35 blur-3xl animate-float" />
          <div className="absolute top-1/4 -right-24 h-[460px] w-[460px] rounded-full bg-sky-200/45 blur-3xl animate-float [animation-delay:2.5s]" />
          <div className="absolute -bottom-24 left-1/4 h-[400px] w-[400px] rounded-full bg-pink-200/35 blur-3xl animate-float [animation-delay:4s]" />
          <div className="absolute top-2/3 right-1/3 h-[340px] w-[340px] rounded-full bg-indigo-200/30 blur-3xl animate-float [animation-delay:1.5s]" />
          {/* Subtle lavender rings */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[750px] w-[750px] rounded-full border border-purple-400/10 animate-orbit [animation-duration:60s]" />
        </>
      )}

      {/* Floating Twinkling Stars & Magic Particles */}
      <div className="absolute top-12 left-10 text-amber-400 animate-star-twinkle">
        <Star className="h-3.5 w-3.5 fill-amber-400" />
      </div>
      <div className="absolute top-28 right-16 text-purple-400 animate-star-twinkle [animation-delay:1.2s]">
        <Sparkles className="h-4 w-4" />
      </div>
      <div className="absolute top-1/3 left-1/6 text-sky-400 animate-star-twinkle [animation-delay:2.4s]">
        <Star className="h-3 w-3 fill-sky-400" />
      </div>
      <div className="absolute bottom-32 right-12 text-pink-400 animate-star-twinkle [animation-delay:3s]">
        <Sparkles className="h-3.5 w-3.5" />
      </div>
      <div className="absolute bottom-16 left-1/4 text-amber-400 animate-star-twinkle [animation-delay:1.8s]">
        <Star className="h-3 w-3 fill-amber-400" />
      </div>
      <div className="absolute top-2/3 right-1/4 text-purple-400 animate-star-twinkle [animation-delay:3.5s]">
        <Sparkles className="h-3 w-3" />
      </div>
    </div>
  );
}
