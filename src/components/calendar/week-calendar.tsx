"use client";

import { useMemo } from "react";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";

import { FiltersBar } from "@/components/tasks/filters-bar";
import { PersonAvatar } from "@/components/tasks/task-badges";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { Task } from "@/db/schema";
import { cn } from "@/lib/cn";
import {
  addDays,
  daysBetween,
  eachDay,
  formatDate,
  weekdayIndex,
} from "@/lib/dates";
import { isHoliday, isWorkday } from "@/lib/derive";
import { PARAM } from "@/lib/search-params";
import { WEEKDAY_NAMES } from "@/lib/settings";
import type { Workspace } from "@/lib/task-queries";
import { useFilters } from "@/lib/use-filters";

/** Vista semanal: 7 columnas con la carga real de cada día. A diferencia
 *  del mensual, una tarea con inicio y fin ocupa todos los días de su
 *  tramo, así se ve dónde se apila el trabajo. */
export function WeekCalendar({
  tasks,
  workspace,
  today,
  weekStartDate,
}: {
  tasks: Task[];
  workspace: Workspace;
  today: string;
  weekStartDate: string;
}) {
  const { set } = useFilters();
  const days = eachDay(weekStartDate, addDays(weekStartDate, 6));

  const byDay = useMemo(() => {
    const map = new Map<string, { task: Task; role: "span" | "due" }[]>();
    for (const day of days) map.set(day, []);

    for (const task of tasks) {
      // Sin fecha límite no hay nada que ubicar en el tiempo.
      if (!task.dueDate && !task.startDate) continue;
      const from = task.startDate ?? task.dueDate!;
      const to = task.dueDate ?? task.startDate!;
      for (const day of days) {
        if (day < from || day > to) continue;
        map.get(day)!.push({ task, role: day === task.dueDate ? "due" : "span" });
      }
    }
    return map;
  }, [tasks, days]);

  const maxLoad = Math.max(1, ...days.map((d) => byDay.get(d)?.length ?? 0));

  if (workspace.projects.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<CalendarRange className="size-8" />}
          title="Todavía no hay proyectos"
          description="La vista semanal muestra la carga de trabajo día por día. Creá un proyecto y cargá tareas con fechas."
          action={{
            label: "Ir a Configuración",
            href: "/configuracion?tab=proyectos",
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FiltersBar
          workspace={workspace}
          show={["search", "project", "assignee", "status"]}
        />
        <div className="flex items-center gap-1">
          <Button
            size="icon"
            aria-label="Semana anterior"
            onClick={() => set({ semana: addDays(weekStartDate, -7) })}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <span className="px-2 text-sm text-muted">
            {formatDate(weekStartDate)} – {formatDate(addDays(weekStartDate, 6))}
          </span>
          <Button
            size="icon"
            aria-label="Semana siguiente"
            onClick={() => set({ semana: addDays(weekStartDate, 7) })}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button size="sm" onClick={() => set({ semana: null })}>
            Esta semana
          </Button>
        </div>
      </div>

      <div
        className={cn(
          "grid min-h-0 flex-1 gap-2 overflow-x-auto",
          // El mínimo va acá, en la pista de la grilla, y no en la columna:
          // `grid-cols-7` es `repeat(7, minmax(0, 1fr))` y deja que la pista
          // se achique hasta cero, así que un `min-w` en el hijo no la
          // ensancha — simplemente lo desborda encima de la columna vecina.
          // Con el mínimo en la pista, la grilla se pasa de ancho y aparece
          // el desplazamiento de costado, que es lo que queremos.
          "grid-cols-[repeat(7,minmax(8rem,1fr))]",
          "sm:grid-cols-[repeat(7,minmax(10rem,1fr))]",
        )}
      >
        {days.map((day) => {
          const items = byDay.get(day) ?? [];
          const working = isWorkday(day, workspace.calendar);
          const holiday = isHoliday(day, workspace.calendar);
          const isToday = day === today;

          return (
            <section
              key={day}
              className={cn(
                "flex min-h-0 flex-col rounded-lg border bg-surface",
                isToday ? "border-accent" : "border-border",
                !working && "bg-surface-2/40",
              )}
            >
              <header className="shrink-0 border-b border-border px-2 py-1.5">
                <div className="flex items-baseline justify-between gap-1">
                  <span
                    className={cn(
                      "text-sm font-medium",
                      isToday && "text-accent",
                    )}
                  >
                    {WEEKDAY_NAMES[weekdayIndex(day)].slice(0, 3)}{" "}
                    {Number(day.slice(8))}
                  </span>
                  <span className="text-xs text-muted">{items.length}</span>
                </div>
                {/* Barra de carga: proporción respecto del día más cargado. */}
                <div className="mt-1 h-1 overflow-hidden rounded-full bg-surface-2">
                  <div
                    className={cn(
                      "h-full rounded-full",
                      items.length >= maxLoad && maxLoad > 1
                        ? "bg-warning"
                        : "bg-accent/60",
                    )}
                    style={{ width: `${(items.length / maxLoad) * 100}%` }}
                  />
                </div>
                {/* Se dibuja siempre, con texto o con un espacio duro: si la
                    línea apareciera solo los días no laborables, esos
                    encabezados serían más altos y las tarjetas de cada columna
                    arrancarían a distinta altura. */}
                <p
                  className={cn(
                    "mt-0.5 truncate text-[10px]",
                    holiday ? "text-warning" : "text-muted",
                  )}
                >
                  {holiday
                    ? workspace.holidays.find((h) => h.date === day)
                        ?.description || "Festivo"
                    : !working
                      ? "No laborable"
                      : "\u00A0"}
                </p>
              </header>

              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-1.5">
                {items.length === 0 ? (
                  <p className="py-4 text-center text-[11px] text-muted">
                    Sin trabajo
                  </p>
                ) : (
                  items.map(({ task, role }) => {
                    const project = workspace.projects.find(
                      (p) => p.id === task.projectId,
                    );
                    const assignee = workspace.people.find(
                      (p) => p.id === task.assigneeId,
                    );
                    const span =
                      task.startDate && task.dueDate
                        ? daysBetween(task.startDate, task.dueDate) + 1
                        : 1;
                    return (
                      <button
                        key={task.id}
                        onClick={() => set({ [PARAM.task]: task.id })}
                        className={cn(
                          "flex w-full items-center gap-1.5 rounded border px-1.5 py-1 text-left text-[11px] hover:bg-surface-2",
                          role === "due"
                            ? "border-border font-medium"
                            : "border-dashed border-border/60 text-muted",
                        )}
                        title={
                          role === "due"
                            ? `Vence hoy · ${task.title}`
                            : `En curso (${span} días) · ${task.title}`
                        }
                      >
                        <span
                          className="size-1.5 shrink-0 rounded-full"
                          style={{ background: project?.color ?? "#94a3b8" }}
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {task.title}
                        </span>
                        {assignee ? <PersonAvatar person={assignee} /> : null}
                      </button>
                    );
                  })
                )}
              </div>
            </section>
          );
        })}
      </div>

      <p className="shrink-0 text-xs text-muted">
        Línea llena: la tarea vence ese día. Línea punteada: está en curso.
        La barra de cada columna compara la carga con el día más cargado de la
        semana.
      </p>
    </div>
  );
}
