import { Check, X } from "lucide-react";
import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useAnimatedValue } from "@/hooks/use-animated-value";
import { cn } from "@/lib/utils";
import type { PriorityLevel, Status } from "@/lib/types";

const btn = {
  primary:
    "bg-primary text-primary-foreground hover:brightness-110 shadow-sm hover:shadow-md hover:shadow-primary/20",
  signal:
    "bg-signal text-signal-foreground hover:brightness-110 shadow-sm hover:shadow-md hover:shadow-signal/20",
  outline:
    "border border-input bg-card text-foreground hover:bg-surface hover:border-primary/40 hover:shadow-sm",
  ghost: "text-muted-foreground hover:bg-surface hover:text-foreground",
  danger:
    "border border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive/50",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof btn;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      {...p}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-all duration-200 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
        size === "sm"
          ? "h-8 px-3 text-xs"
          : size === "lg"
            ? "h-12 px-6 text-sm"
            : "h-10 px-4 text-sm",
        btn[variant],
        className,
      )}
    />
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("panel p-5 shadow-sm", className)}>{children}</div>;
}

export function PanelTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
        {children}
      </h3>
      {action}
    </div>
  );
}

const tones = {
  violet: "bg-primary/10 text-primary border-primary/20",
  lime: "bg-signal/10 text-signal border-signal/20",
  amber: "bg-warning/15 text-warning border-warning/30",
  red: "bg-destructive/10 text-destructive border-destructive/20",
  muted: "bg-muted text-muted-foreground border-border",
};
export function Badge({
  tone = "muted",
  children,
  className,
}: {
  tone?: keyof typeof tones;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap transition",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
export const PriorityBadge = ({
  level,
  verified = true,
}: {
  level: PriorityLevel;
  verified?: boolean | undefined;
}) =>
  verified === false ? (
    <Badge tone="muted">Priority not verified</Badge>
  ) : (
    <Badge tone={level === "High" ? "red" : level === "Medium" ? "amber" : "muted"}>
      {level === "High" ? "High Priority" : level === "Medium" ? "Medium Priority" : "Low Priority"}
    </Badge>
  );
export const StatusBadge = ({ status }: { status: Status }) => (
  <Badge tone={status === "Revised" ? "lime" : status === "Learning" ? "violet" : "muted"}>
    {status}
  </Badge>
);

export function Progress({
  value,
  tone = "primary",
  animate = true,
}: {
  value: number;
  tone?: "primary" | "signal" | "warning";
  animate?: boolean;
}) {
  const c = tone === "signal" ? "bg-signal" : tone === "warning" ? "bg-warning" : "bg-primary";
  const pct = Math.min(100, Math.max(0, value));
  return (
    <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className={cn(
          "h-full rounded-full transition-all duration-700 ease-out",
          c,
          animate && "animate-progress",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function CircularProgress({
  value,
  size = 68,
  strokeWidth = 6,
  tone = "primary",
  showValue = true,
  suffix = "%",
  label,
  className,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  tone?: "primary" | "signal" | "warning";
  showValue?: boolean;
  suffix?: string;
  label?: string;
  className?: string;
}) {
  const [mounted, setMounted] = useState(false);
  const animatedValue = useAnimatedValue(value, 800);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const pct = mounted ? Math.min(100, Math.max(0, value)) : 0;
  const offset = c * (1 - pct / 100);

  const strokeColor =
    tone === "signal" ? "stroke-signal" : tone === "warning" ? "stroke-warning" : "stroke-primary";

  return (
    <div
      className={cn("relative inline-flex shrink-0 items-center justify-center", className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        className="-rotate-90 transform"
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={strokeWidth}
          className="fill-none stroke-muted/60"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={cn(
            "fill-none transition-[stroke-dashoffset] duration-700 ease-out",
            strokeColor,
          )}
          style={{ "--ring-circumference": c } as React.CSSProperties}
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center select-none">
        {showValue && (
          <span className="font-mono text-sm font-bold tracking-tight text-foreground">
            {animatedValue}
            {suffix}
          </span>
        )}
        {label && (
          <span className="text-[9px] font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

export function Ring({
  value,
  size = 120,
  label,
  hero = false,
}: {
  value: number;
  size?: number;
  label?: string;
  hero?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const animatedValue = useAnimatedValue(value, 800);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const r = (size - 12) / 2;
  const c = 2 * Math.PI * r;
  const pct = mounted ? Math.min(100, Math.max(0, value)) : 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={10}
          className="fill-none stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={10}
          strokeLinecap="round"
          className="fill-none stroke-primary transition-[stroke-dashoffset] duration-700 ease-out"
          style={{ "--ring-circumference": c } as React.CSSProperties}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - pct / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className={cn("font-mono text-3xl font-bold", hero ? "text-white" : "text-foreground")}
        >
          {animatedValue}
        </span>
        {label && (
          <span
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wider",
              hero ? "text-white/70" : "text-muted-foreground",
            )}
          >
            {label}
          </span>
        )}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} />;
}

export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/30 backdrop-blur-sm sm:items-center sm:p-4 animate-in fade-in">
      <div className="panel max-h-[92vh] w-full max-w-2xl overflow-y-auto p-6 shadow-xl animate-in slide-in-from-bottom-4">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition hover:bg-surface hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export const inputCls =
  "h-10 w-full rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

export function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string | undefined;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
      {error && <span className="block text-xs text-destructive">{error}</span>}
    </label>
  );
}

export function PageHeader({
  title,
  sub,
  action,
}: {
  title: string;
  sub?: string | undefined;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-foreground sm:text-3xl">{title}</h1>
        {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  text,
  action,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="panel flex flex-col items-center px-6 py-14 text-center bg-hero">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/15 bg-white/10 text-[oklch(0.70_0.15_285)] backdrop-blur">
        {icon}
      </div>
      <h3 className="text-lg font-semibold" style={{ color: "var(--gradient-hero-text)" }}>
        {title}
      </h3>
      <p className="mt-1 max-w-sm text-sm" style={{ color: "var(--gradient-hero-muted)" }}>
        {text}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon,
  progress,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  progress?: number | undefined;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "panel group flex flex-col justify-between p-4 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md",
        className,
      )}
    >
      <div>
        <div className="flex items-center justify-between">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {label}
          </div>
          {icon && (
            <div className="text-primary transition-transform duration-200 group-hover:scale-110">
              {icon}
            </div>
          )}
        </div>
        <div className="mt-1.5 font-mono text-2xl font-bold text-foreground">{value}</div>
      </div>
      <div>
        {typeof progress === "number" && (
          <div className="mt-2.5">
            <Progress value={progress} tone="signal" />
          </div>
        )}
        {hint && <div className="mt-2 text-xs text-muted-foreground">{hint}</div>}
      </div>
    </div>
  );
}

/** Celebration sparkle shown briefly when a milestone is hit. */
export function Celebration({ show }: { show: boolean }) {
  const [active, setActive] = useState(false);
  useEffect(() => {
    if (show) {
      setActive(true);
      const t = setTimeout(() => setActive(false), 700);
      return () => clearTimeout(t);
    }
  }, [show]);
  if (!active) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center">
      <div className="animate-sparkle text-5xl">✦</div>
    </div>
  );
}

/** A section header with an icon chip, title, subtitle, and optional action. */
export function SectionHeader({
  icon,
  title,
  sub,
  action,
  tone = "primary",
}: {
  icon?: ReactNode;
  title: string;
  sub?: string;
  action?: ReactNode;
  tone?: "primary" | "signal" | "warning" | "muted";
}) {
  const chip = {
    primary: "bg-primary/10 text-primary",
    signal: "bg-signal/10 text-signal",
    warning: "bg-warning/15 text-warning",
    muted: "bg-muted text-muted-foreground",
  }[tone];
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        {icon && (
          <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl", chip)}>
            {icon}
          </div>
        )}
        <div>
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          {sub && <p className="text-sm text-muted-foreground">{sub}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

/** A premium toggle/check control with animated checkmark. */
export function CheckToggle({
  checked,
  onChange,
  label,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: ReactNode;
  ariaLabel?: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={() => onChange(!checked)}
      className="group flex items-center gap-3 text-left"
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all duration-200",
          checked
            ? "border-primary bg-primary text-primary-foreground scale-100"
            : "border-input bg-card group-hover:border-primary",
        )}
      >
        {checked && <Check className="animate-check h-4 w-4" strokeWidth={3} />}
      </span>
      {label && <span className="text-sm text-foreground">{label}</span>}
    </button>
  );
}

/** A drop zone for file uploads with a premium look. */
export function DropZone({
  icon,
  title,
  hint,
  accept,
  busy,
  onFile,
  className,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  accept?: string;
  busy?: boolean;
  onFile: (file: File | undefined) => void;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-primary/30 bg-primary/[0.04] p-6 text-center transition hover:border-primary/50 hover:bg-primary/[0.08]",
        busy && "pointer-events-none opacity-70",
        className,
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary transition group-hover:scale-110 group-hover:bg-primary/15">
        {icon}
      </span>
      <span className="text-sm font-semibold text-foreground">{busy ? "Reading…" : title}</span>
      {hint && <span className="text-xs text-muted-foreground">{hint}</span>}
      <input
        type="file"
        accept={accept}
        disabled={busy}
        onChange={(e) => onFile(e.target.files?.[0])}
        className="hidden"
      />
    </label>
  );
}
