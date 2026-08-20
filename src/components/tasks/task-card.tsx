"use client";

import { CalendarDays, GitBranch } from "lucide-react";

import {
  DaysRemainingBadge,
  PersonAvatar,
  PriorityBadge,
} from "@/components/tasks/task-badges";
import type { Task } from "@/db/schema";
import { cn } from "@/lib/cn";
import { formatDateShort } from "@/lib/dates";
import { daysRemaining, isOverdue } from "@/lib/derive";
import type { Workspace } from "@/lib/task-queries";

/** Tarjeta compacta de tarea. La usan el Kanban y la matriz de
 *  Eisenhower, para que una tarea se vea igual en todos lados. */
export function TaskCard({
  task,
  workspace,
  today,
  childCount = 0,
  onOpen,
  dragging,
}: {
  task: Task;
  workspace: Workspace;
  today: string;
  childCount?: number;
  onOpen: () => void;
  dragging?: boolean;
}) {
  const statusById = new Map(workspace.statuses.map((s) => [s.id, s]));
  const project = workspace.projects.find((p) => p.id === task.projectId);
  const assignee = workspace.people.find((p) => p.id === task.assigneeId);
  const priority = workspace.priorities.find((p) => p.id === task.priorityId);
  const overdue = isOverdue(task, statusById, today);
  const remaining = daysRemaining(task, statusById, today);

  return (
    <article
      // Toda la tarjeta abre la tarea, no solo su título: es lo que uno
      // espera de una tarjeta, y en Kanban no hay campos que editar en
      // línea que puedan quedarse con el clic.
      onClick={onOpen}
      className={cn(
        "flex cursor-pointer flex-col gap-2 rounded-md border bg-surface p-2.5 text-sm shadow-sm transition-shadow hover:border-accent/50",
        overdue ? "border-danger/40" : "border-border",
        dragging && "opacity-50",
      )}
    >
      <div className="flex items-start gap-2">
        <span
          className="mt-1 size-2 shrink-0 rounded-full"
          style={{ background: project?.color ?? "#94a3b8" }}
          title={project?.name}
        />
        <button
          onClick={onOpen}
          className="min-w-0 flex-1 cursor-pointer text-left font-medium hover:underline"
        >
          {task.title}
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {priority ? <PriorityBadge priority={priority} /> : null}
        {childCount > 0 ? (
          <span
            className="inline-flex items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted"
            title={`${childCount} subtarea(s)`}
          >
            <GitBranch className="size-3" />
            {childCount}
          </span>
        ) : null}
        {task.dueDate ? (
          <span
            className={cn(
              "inline-flex items-center gap-1 text-[11px]",
              overdue ? "text-danger" : "text-muted",
            )}
          >
            <CalendarDays className="size-3" />
            {formatDateShort(task.dueDate)}
          </span>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-2">
        <PersonAvatar person={assignee} />
        <div className="flex items-center gap-2">
          <DaysRemainingBadge value={remaining} />
          <div className="h-1 w-12 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent/60"
              style={{ width: `${task.progress}%` }}
            />
          </div>
        </div>
      </div>
    </article>
  );
}
