"use client";

import { ChevronDown, ChevronRight } from "lucide-react";

import {
  DaysRemainingBadge,
  PersonAvatar,
  PriorityBadge,
  StatusBadge,
} from "@/components/tasks/task-badges";
import type { Task } from "@/db/schema";
import { cn } from "@/lib/cn";
import { daysRemaining, isOverdue } from "@/lib/derive";
import type { Workspace } from "@/lib/task-queries";

/**
 * Tareas en celular: una tarjeta por fila en lugar de la tabla densa.
 *
 * Doce columnas no entran en 390 px, y forzar scroll horizontal sobre una
 * tabla editable es peor que no tenerla. Acá cada tarjeta muestra lo que
 * se mira de un vistazo —qué es, de quién es, cuándo vence— y el detalle
 * completo se abre al tocarla.
 */
export function TaskListMobile({
  tasks,
  workspace,
  today,
  selected,
  onToggleSelect,
  onOpen,
}: {
  tasks: Task[];
  workspace: Workspace;
  today: string;
  selected: Set<number>;
  onToggleSelect: (id: number, checked: boolean) => void;
  onOpen: (id: number) => void;
}) {
  const statusById = new Map(workspace.statuses.map((s) => [s.id, s]));

  const childrenOf = new Map<number, number>();
  for (const task of tasks) {
    if (task.parentTaskId == null) continue;
    childrenOf.set(task.parentTaskId, (childrenOf.get(task.parentTaskId) ?? 0) + 1);
  }
  const present = new Set(tasks.map((t) => t.id));

  return (
    <ul className="flex flex-col gap-2">
      {tasks.map((task) => {
        const status = workspace.statuses.find((s) => s.id === task.statusId);
        const priority = workspace.priorities.find(
          (p) => p.id === task.priorityId,
        );
        const assignee = workspace.people.find((p) => p.id === task.assigneeId);
        const project = workspace.projects.find((p) => p.id === task.projectId);
        const overdue = isOverdue(task, statusById, today);
        const isSubtask =
          task.parentTaskId != null && present.has(task.parentTaskId);
        const childCount = childrenOf.get(task.id) ?? 0;

        return (
          <li key={task.id}>
            <div
              className={cn(
                "flex gap-2 rounded-lg border bg-surface p-3",
                overdue ? "border-danger/40" : "border-border",
                selected.has(task.id) && "ring-1 ring-accent",
                isSubtask && "ml-4",
              )}
            >
              <label className="flex shrink-0 items-start pt-0.5">
                <input
                  type="checkbox"
                  checked={selected.has(task.id)}
                  onChange={(e) => onToggleSelect(task.id, e.target.checked)}
                  aria-label={`Seleccionar ${task.title}`}
                  className="size-4 cursor-pointer"
                />
              </label>

              <button
                onClick={() => onOpen(task.id)}
                className="flex min-w-0 flex-1 flex-col gap-1.5 text-left"
              >
                <div className="flex items-start gap-1.5">
                  {isSubtask ? (
                    <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-muted" />
                  ) : null}
                  <span
                    className={cn(
                      "min-w-0 flex-1 font-medium",
                      overdue && "text-danger",
                    )}
                  >
                    {task.title}
                  </span>
                  {childCount > 0 ? (
                    <span className="flex shrink-0 items-center gap-0.5 rounded bg-surface-2 px-1 text-[10px] text-muted">
                      <ChevronDown className="size-2.5" />
                      {childCount}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={status} />
                  {priority ? <PriorityBadge priority={priority} /> : null}
                </div>

                <div className="flex items-center gap-2 text-xs text-muted">
                  <PersonAvatar person={assignee} />
                  <span className="min-w-0 flex-1 truncate">
                    {assignee?.name ?? "Sin asignar"}
                    {project ? ` · ${project.code}` : ""}
                  </span>
                  <DaysRemainingBadge
                    value={daysRemaining(task, statusById, today)}
                  />
                </div>

                {task.progress > 0 ? (
                  <div className="h-1 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-accent/60"
                      style={{ width: `${task.progress}%` }}
                    />
                  </div>
                ) : null}
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
