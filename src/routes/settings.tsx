import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button, Field, PageHeader, Panel, PanelTitle, inputCls } from "@/components/app/ui";
import { getCurrentUser, logOut, updateUserProfile } from "@/lib/auth";
import { actions, useAppState } from "@/lib/store";
import { getTheme, setTheme, type Theme } from "@/lib/theme";
import { LogOut, User, GraduationCap, Sun, Moon, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Exam Rescue" },
      { name: "description", content: "Profile, data, theme and study settings." },
      { property: "og:title", content: "Settings — Exam Rescue" },
      { property: "og:description", content: "Manage your Exam Rescue preferences." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const s = useAppState();
  const user = getCurrentUser();
  const [name, setName] = useState(user?.name || s.settings.name);
  const [university, setUniversity] = useState(user?.university || "");
  const [course, setCourse] = useState(user?.course || "");
  const [currentTheme, setCurrentTheme] = useState<Theme>(() => getTheme());

  useEffect(() => {
    const handleThemeChange = (e: Event) => {
      const custom = e as CustomEvent<{ theme: Theme }>;
      setCurrentTheme(custom.detail?.theme ?? getTheme());
    };
    window.addEventListener("exam-rescue:theme-changed", handleThemeChange);
    return () => window.removeEventListener("exam-rescue:theme-changed", handleThemeChange);
  }, []);

  const handleSelectTheme = (t: Theme) => {
    setTheme(t);
    toast.success(
      `Switched to ${t === "light" ? "Light (Pastel Lavender)" : "Dark (Celestial)"} theme!`,
    );
  };

  return (
    <div className="max-w-2xl space-y-5">
      <PageHeader title="Settings" />

      {/* ── Appearance & Theme ── */}
      <Panel>
        <PanelTitle>Appearance & Theme</PanelTitle>
        <p className="mb-4 text-xs text-muted-foreground">
          Choose between the airy Pastel Lavender Light Theme or the deep Celestial Violet Dark
          Theme.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Light Theme Option */}
          <button
            type="button"
            onClick={() => handleSelectTheme("light")}
            className={cn(
              "flex flex-col gap-2 p-4 rounded-xl border text-left transition-all relative",
              currentTheme === "light"
                ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/20"
                : "border-border/60 bg-surface/50 hover:bg-surface hover:border-border",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-400/20 text-amber-500">
                  <Sun className="h-4 w-4" />
                </div>
                <span className="text-sm font-bold text-foreground">Light Theme</span>
              </div>
              {currentTheme === "light" && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  <Check className="h-3 w-3 stroke-[3]" />
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Soft pastel lavender and purple background with crisp high-contrast cards.
            </p>
          </button>

          {/* Dark Theme Option */}
          <button
            type="button"
            onClick={() => handleSelectTheme("dark")}
            className={cn(
              "flex flex-col gap-2 p-4 rounded-xl border text-left transition-all relative",
              currentTheme === "dark"
                ? "border-primary bg-primary/10 shadow-md ring-2 ring-primary/20"
                : "border-border/60 bg-surface/50 hover:bg-surface hover:border-border",
            )}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/20 text-purple-400">
                  <Moon className="h-4 w-4" />
                </div>
                <span className="text-sm font-bold text-foreground">Dark Celestial</span>
              </div>
              {currentTheme === "dark" && (
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                  <Check className="h-3 w-3 stroke-[3]" />
                </span>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Deep midnight violet gradient mesh with luminous floating aurora orbs.
            </p>
          </button>
        </div>
      </Panel>

      {/* ── Student Account ── */}
      <Panel>
        <PanelTitle>Student Account</PanelTitle>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (name.length > 40) {
              toast.error("Name is too long");
              return;
            }
            actions.setName(name.trim());
            updateUserProfile({ name: name.trim(), university, course });
            toast.success("Profile saved successfully");
          }}
          className="space-y-4"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Field label="Your name">
                <input
                  className={inputCls}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </Field>
            </div>
            <div>
              <Field label="Email Address (read-only)">
                <input
                  className={inputCls}
                  disabled
                  value={user?.email || "student@examrescue.app"}
                />
              </Field>
            </div>
            <div>
              <Field label="University / College">
                <input
                  className={inputCls}
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                />
              </Field>
            </div>
            <div>
              <Field label="Course / Degree">
                <input
                  className={inputCls}
                  value={course}
                  onChange={(e) => setCourse(e.target.value)}
                />
              </Field>
            </div>
          </div>
          <div className="flex items-center justify-between pt-2">
            <Button type="submit">Save Changes</Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => logOut()}
              className="text-destructive hover:bg-destructive/10"
            >
              <LogOut className="mr-1.5 h-4 w-4" /> Log Out
            </Button>
          </div>
        </form>
      </Panel>

      {/* ── Data & Storage ── */}
      <Panel>
        <PanelTitle>Data & Storage</PanelTitle>
        <p className="mb-4 text-sm text-muted-foreground">
          Your exams and tasks are safely stored in your account session. You can clear your data or
          re-run setup whenever needed.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() => {
              updateUserProfile({ onboardingCompleted: false });
              toast.info("Re-running Personal Study Setup...");
            }}
          >
            Re-run Study Setup Wizard
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              if (confirm("Delete all exams, plans and quiz results for this account?")) {
                actions.clearAll();
                toast.success("All data cleared — start fresh");
              }
            }}
          >
            Clear all data
          </Button>
        </div>
      </Panel>
    </div>
  );
}
