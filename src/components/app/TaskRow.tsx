import { Check } from "lucide-react";
import { toast } from "sonner";
import { PriorityBadge } from "./ui";
import { fmtMin } from "@/lib/engine";
import { spawnLocationMascot } from "@/lib/location-mascot";
import { actions } from "@/lib/store";
import type { Task } from "@/lib/types";
import { cn } from "@/lib/utils";

export function TaskRow({ task, sub }: { task: Task; sub?: string | undefined }) {
  const distinctSubtopics = (task.subtopics ?? []).filter(
    (s) =>
      s.trim() &&
      s.trim().toLowerCase() !== (task.topicName ?? "").trim().toLowerCase() &&
      !task.title.toLowerCase().includes(s.trim().toLowerCase()),
  );

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={task.done}
      onClick={(e) => {
        const completing = !task.done;
        actions.toggleTask(task.id);
        if (completing) {
          toast.success("Task completed", { description: task.title });
          const rect = e.currentTarget.getBoundingClientRect();
          spawnLocationMascot({
            originRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
            type: "task-complete",
            title: task.title,
            message: "You did it! 🎉",
            durationMs: 3000,
          });
        }
      }}
      className={cn(
        "group flex w-full items-center gap-3 rounded-xl border bg-card p-3 text-left transition-all duration-300 hover:border-primary/40 hover:shadow-sm active:scale-[0.99]",
        task.done && "border-signal/30 bg-signal/[0.04] opacity-80",
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition-all duration-300",
          task.done
            ? "animate-check-box border-signal bg-signal text-signal-foreground shadow-sm shadow-signal/30 ring-2 ring-signal/20"
            : "border-input group-hover:border-primary/70 group-hover:scale-105",
        )}
      >
        {task.done && <Check className="animate-check h-3.5 w-3.5" strokeWidth={3} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-1.5">
          {task.unit && (
            <span className="inline-flex shrink-0 items-center rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary">
              {task.unit}
            </span>
          )}
          <span
            className={cn(
              "truncate text-sm transition-all duration-300",
              task.done
                ? "line-through text-muted-foreground opacity-75 font-medium"
                : "font-semibold text-foreground",
            )}
          >
            {task.title}
          </span>
        </span>
        {distinctSubtopics.length > 0 && (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            Subtopics: {distinctSubtopics.join(", ")}
          </span>
        )}
        {sub && <span className="block text-xs text-muted-foreground font-medium">{sub}</span>}
      </span>
      <span className="shrink-0">
        <PriorityBadge level={task.priority} verified={task.priorityVerified} />
      </span>
      <span className="font-mono text-xs text-muted-foreground">{fmtMin(task.minutes)}</span>
    </button>
  );
}
