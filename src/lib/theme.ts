export type Theme = "light" | "dark";

const THEME_KEY = "exam-rescue:theme";

export function getTheme(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "dark" || stored === "light") return stored;
  return "light"; // Default to light theme as requested!
}

export function setTheme(theme: Theme): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(THEME_KEY, theme);

  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);

  window.dispatchEvent(new CustomEvent("exam-rescue:theme-changed", { detail: { theme } }));
}

export function initTheme(): Theme {
  const current = getTheme();
  if (typeof window !== "undefined") {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(current);
  }
  return current;
}
