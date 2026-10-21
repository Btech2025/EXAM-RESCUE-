/**
 * Event-driven Location-Aware Mascot Trigger System
 * Captures clicked elements' bounding rectangles and spawns the 3D mascot
 * right at the interaction origin.
 */

export interface SpawnMascotDetail {
  id: string;
  x: number;
  y: number;
  type: "task-complete" | "navigation" | "welcome" | "action";
  title?: string;
  message: string;
  durationMs?: number;
}

export function spawnLocationMascot({
  originRect,
  originEl,
  type = "action",
  title,
  message,
  durationMs = 2800,
}: {
  originRect?: { x: number; y: number; width: number; height: number };
  originEl?: HTMLElement | null;
  type?: "task-complete" | "navigation" | "welcome" | "action";
  title?: string;
  message: string;
  durationMs?: number;
}): void {
  if (typeof window === "undefined") return;

  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;

  if (originRect) {
    x = originRect.x + originRect.width / 2;
    y = originRect.y + originRect.height / 2;
  } else if (originEl) {
    const rect = originEl.getBoundingClientRect();
    x = rect.x + rect.width / 2;
    y = rect.y + rect.height / 2;
  }

  // Constrain coordinates within safe viewport boundaries
  const safeX = Math.max(90, Math.min(window.innerWidth - 90, x));
  const safeY = Math.max(100, Math.min(window.innerHeight - 80, y));

  const detail: SpawnMascotDetail = {
    id: `mascot-spawn-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    x: safeX,
    y: safeY,
    type,
    title,
    message,
    durationMs,
  };

  window.dispatchEvent(new CustomEvent("exam-rescue:spawn-mascot", { detail }));
}

/**
 * Convenience helper to trigger a spawn from a React/DOM mouse event target
 */
export function triggerMascotFromEvent(
  e: React.MouseEvent<HTMLElement> | MouseEvent,
  opts: {
    type?: "task-complete" | "navigation" | "welcome" | "action";
    title?: string;
    message: string;
    durationMs?: number;
  },
): void {
  const currentTarget = e.currentTarget as HTMLElement | null;
  if (!currentTarget) return;
  const rect = currentTarget.getBoundingClientRect();
  spawnLocationMascot({
    originRect: {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    },
    ...opts,
  });
}
