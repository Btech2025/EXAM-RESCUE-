import { useEffect, useRef, useState } from "react";

/**
 * Animates a numeric value smoothly using requestAnimationFrame.
 * Automatically respects prefers-reduced-motion.
 */
export function useAnimatedValue(targetValue: number, duration = 800) {
  const [displayValue, setDisplayValue] = useState(targetValue);
  const prevRef = useRef(targetValue);

  useEffect(() => {
    const start = prevRef.current;
    const end = targetValue;
    if (start === end) return;

    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplayValue(end);
      prevRef.current = end;
      return;
    }

    let startTime: number | null = null;
    let rafId: number;

    const animate = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(1, elapsed / duration);
      // easeOutCubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(start + (end - start) * ease);
      setDisplayValue(current);

      if (progress < 1) {
        rafId = requestAnimationFrame(animate);
      } else {
        prevRef.current = end;
      }
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [targetValue, duration]);

  return displayValue;
}
