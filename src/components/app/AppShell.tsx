import { Link } from "@tanstack/react-router";
import {
  Brain,
  BookOpenCheck,
  ChevronsLeft,
  FileSearch,
  Gauge,
  GraduationCap,
  LayoutDashboard,
  LifeBuoy,
  ListChecks,
  Menu,
  Settings,
  Siren,
  Target,
  X,
  LogOut,
  User as UserIcon,
  Sun,
  Moon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { DynamicMascotLayer } from "./DynamicMascotLayer";
import { AuthWelcomeScreen } from "./AuthWelcomeScreen";
import { PersonalStudySetup } from "./PersonalStudySetup";
import { MagicalBackground } from "./MagicalBackground";
import { getTheme, setTheme, type Theme } from "@/lib/theme";
import { getCurrentUser, logOut, type UserProfile } from "@/lib/auth";
import { spawnLocationMascot } from "@/lib/location-mascot";
import { loadState } from "@/lib/store";
import { cn } from "@/lib/utils";

const NAV = [
  { to: "/", label: "Overview", icon: LayoutDashboard },
  { to: "/rescue", label: "Rescue Mode", icon: Siren },
  { to: "/syllabus", label: "Syllabus Analyzer", icon: BookOpenCheck },
  { to: "/pyq", label: "PYQ Research", icon: FileSearch },
  { to: "/exams", label: "My Exams", icon: GraduationCap },
  { to: "/planner", label: "Study Planner", icon: ListChecks },
  { to: "/topics", label: "Topic Intelligence", icon: Brain },
  { to: "/practice", label: "Practice Arena", icon: Target },
  { to: "/readiness", label: "Readiness Report", icon: Gauge },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const NAV_MESSAGES: Record<string, string> = {
  "/": "Welcome back! Ready for your study mission? 🚀",
  "/rescue": "Let’s rescue this exam! Focusing on high-yield topics right now! 🚨✨",
  "/syllabus": "Syllabus Analyzer ready! Drop your PDF to uncover topic weights! 📑",
  "/pyq": "PYQ Research unlocked! Finding past exam patterns and trends! 📚",
  "/planner": "Ready for your next mission? Daily study sessions conquer any exam! 🚀",
  "/practice": "Practice makes permanent! Test your active recall right here! 🎯",
  "/readiness": "Readiness Report loaded! Let's check where you stand! 📊",
  "/topics": "Topic Intelligence active! Prioritize high-yield topics first! 🧠",
  "/exams": "Exam countdown synced! Keep an eye on the schedule! 🎓",
  "/settings": "Settings opened! Customize your revision targets! ⚙️",
};

function NavList({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const handleNavClick = (e: React.MouseEvent<HTMLElement>, to: string, label: string) => {
    onNavigate?.();
    const rect = e.currentTarget.getBoundingClientRect();
    spawnLocationMascot({
      originRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      type: "navigation",
      title: label,
      message: NAV_MESSAGES[to] || `Opening ${label}! Let's go! 🚀`,
      durationMs: 2500,
    });
  };

  return (
    <nav className="flex flex-col gap-1">
      {NAV.map(({ to, label, icon: Icon }) => (
        <Link
          key={to}
          to={to}
          onClick={(e) => handleNavClick(e, to, label)}
          activeOptions={{ exact: to === "/" }}
          className="group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-all duration-200 hover:bg-surface hover:text-foreground"
          activeProps={{
            className:
              "!bg-primary/10 !text-primary !font-semibold [&>.nav-bar]:opacity-100 [&>.nav-ic]:bg-primary/20",
          }}
          title={collapsed ? label : undefined}
        >
          <span className="nav-bar pointer-events-none absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary opacity-0 transition-opacity duration-200" />
          <span className="nav-ic flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-all duration-200 group-hover:scale-110 group-hover:bg-card">
            <Icon className="h-[18px] w-[18px]" />
          </span>
          {!collapsed && <span className="truncate">{label}</span>}
        </Link>
      ))}
    </nav>
  );
}

function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-[oklch(0.70_0.15_285)] text-primary-foreground shadow-md transition group-hover:shadow-lg">
        <LifeBuoy className="h-5 w-5" />
        <div className="absolute inset-0 rounded-xl bg-white/20 opacity-0 transition group-hover:opacity-100" />
      </div>
      {!collapsed && (
        <div className="leading-tight">
          <div className="font-display text-sm font-bold tracking-wide text-foreground">
            EXAM RESCUE
          </div>
          <div className="text-[10px] font-medium text-muted-foreground">Exam prep copilot</div>
        </div>
      )}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => getCurrentUser());
  const [collapsed, setCollapsed] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [theme, setThemeState] = useState<Theme>(() => getTheme());

  useEffect(() => {
    loadState();
    setCurrentUser(getCurrentUser());
    setReady(true);

    const handleAuthChange = (e: Event) => {
      const custom = e as CustomEvent<{ user: UserProfile | null }>;
      setCurrentUser(custom.detail?.user ?? getCurrentUser());
    };

    const handleThemeChange = (e: Event) => {
      const custom = e as CustomEvent<{ theme: Theme }>;
      setThemeState(custom.detail?.theme ?? getTheme());
    };

    window.addEventListener("exam-rescue:auth-changed", handleAuthChange);
    window.addEventListener("exam-rescue:theme-changed", handleThemeChange);
    return () => {
      window.removeEventListener("exam-rescue:auth-changed", handleAuthChange);
      window.removeEventListener("exam-rescue:theme-changed", handleThemeChange);
    };
  }, []);

  const toggleTheme = () => {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
  };

  if (!ready) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="skeleton h-12 w-48 rounded-xl" />
      </div>
    );
  }

  // 1. Not logged in: Show Animated Welcome & Login Screen with Big Mascot
  if (!currentUser) {
    return (
      <>
        <AuthWelcomeScreen />
        <DynamicMascotLayer />
      </>
    );
  }

  // 2. Logged in, but personal study setup not completed: Show Multi-step setup
  if (!currentUser.onboardingCompleted) {
    return (
      <>
        <PersonalStudySetup onComplete={() => setCurrentUser(getCurrentUser())} />
        <DynamicMascotLayer />
      </>
    );
  }

  // 3. Logged in and setup completed: Render personalized dashboard
  return (
    <div className="relative min-h-screen text-foreground select-none">
      <MagicalBackground />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-30 hidden flex-col border-r border-border/60 bg-card/90 backdrop-blur-xl p-3 transition-all duration-300 lg:flex shadow-xl",
          collapsed ? "w-[68px]" : "w-60",
        )}
      >
        <div className="group mb-6 flex items-center justify-between px-1 pt-2">
          <Logo collapsed={collapsed} />
        </div>
        <NavList collapsed={collapsed} />

        {/* User Profile, Theme Toggle & Log Out */}
        <div className="mt-auto border-t border-border/40 pt-3 space-y-2">
          {/* Theme Toggle Button */}
          <button
            type="button"
            onClick={toggleTheme}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:bg-surface hover:text-foreground"
            title={`Switch to ${theme === "light" ? "Dark (Celestial)" : "Light (Pastel Lavender)"} Theme`}
          >
            {theme === "light" ? (
              <>
                <Moon className="h-4 w-4 text-purple-600" />
                {!collapsed && <span>Dark Celestial Mode</span>}
              </>
            ) : (
              <>
                <Sun className="h-4 w-4 text-amber-400" />
                {!collapsed && <span>Light Theme</span>}
              </>
            )}
          </button>

          {!collapsed ? (
            <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-surface/50 border border-border/40">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/15 text-xs font-bold text-primary">
                  {currentUser.name ? currentUser.name[0]?.toUpperCase() : "U"}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-xs font-bold text-foreground">
                    {currentUser.name}
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {currentUser.email}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => logOut()}
                title="Log Out"
                className="p-1 rounded-md text-muted-foreground hover:bg-card hover:text-destructive transition"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => logOut()}
              title={`Log Out (${currentUser.name})`}
              className="flex w-full items-center justify-center p-2 rounded-lg text-muted-foreground hover:bg-surface hover:text-destructive transition"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}

          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition hover:bg-surface hover:text-foreground"
            aria-label="Toggle sidebar"
          >
            <ChevronsLeft
              className={cn("h-4 w-4 transition-transform duration-300", collapsed && "rotate-180")}
            />
            {!collapsed && "Collapse"}
          </button>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-card/90 px-4 py-3 backdrop-blur-md lg:hidden">
        <Logo />
        <div className="flex items-center gap-2">
          {/* Mobile Theme Toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-surface hover:text-foreground"
            title="Toggle Light / Dark Mode"
          >
            {theme === "light" ? (
              <Moon className="h-4 w-4 text-purple-600" />
            ) : (
              <Sun className="h-4 w-4 text-amber-400" />
            )}
          </button>

          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-surface border border-border/40 text-xs font-semibold text-foreground">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-primary/20 text-[10px] text-primary font-bold">
              {currentUser.name ? currentUser.name[0]?.toUpperCase() : "U"}
            </span>
            <span className="max-w-[100px] truncate">{currentUser.name}</span>
          </div>
          <button
            onClick={() => logOut()}
            title="Log Out"
            className="rounded-lg p-2 text-muted-foreground hover:bg-surface hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
          </button>
          <button
            onClick={() => setMobile(true)}
            className="rounded-lg p-2 text-muted-foreground transition hover:bg-surface hover:text-foreground"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      {mobile && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={() => setMobile(false)}
        >
          <div
            className="h-full w-72 border-r border-border/80 bg-card/95 backdrop-blur-xl p-4 animate-in slide-in-from-left duration-300 flex flex-col justify-between text-foreground"
            onClick={(e) => e.stopPropagation()}
          >
            <div>
              <div className="mb-6 flex items-center justify-between">
                <Logo />
                <button
                  onClick={() => setMobile(false)}
                  aria-label="Close menu"
                  className="text-muted-foreground transition hover:text-foreground"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <NavList onNavigate={() => setMobile(false)} />
            </div>

            <div className="border-t border-border/40 pt-4 space-y-3">
              <button
                type="button"
                onClick={toggleTheme}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-xs font-semibold bg-surface/70 border border-border/60 text-foreground transition hover:bg-surface"
              >
                <span>Theme</span>
                <span className="flex items-center gap-1.5 text-primary">
                  {theme === "light" ? (
                    <>
                      <Moon className="h-3.5 w-3.5" />
                      <span>Switch to Dark</span>
                    </>
                  ) : (
                    <>
                      <Sun className="h-3.5 w-3.5 text-amber-400" />
                      <span>Switch to Light</span>
                    </>
                  )}
                </span>
              </button>

              <div className="flex items-center justify-between">
                <div className="min-w-0 pr-2">
                  <div className="truncate text-xs font-bold text-foreground">
                    {currentUser.name}
                  </div>
                  <div className="truncate text-[10px] text-muted-foreground">
                    {currentUser.email}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => logOut()}
                  className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-destructive/10 text-destructive hover:bg-destructive/20"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  <span>Log Out</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className={cn("transition-all duration-300", collapsed ? "lg:pl-[68px]" : "lg:pl-60")}>
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
          <div
            key={typeof location !== "undefined" ? location.pathname : "root"}
            className="route-enter"
          >
            {children}
          </div>
        </div>
      </main>
      <DynamicMascotLayer />
    </div>
  );
}
