"use client";

import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { FiltersBar } from "@/components/tasks/filters-bar";
import { DaysRemainingBadge, PersonAvatar } from "@/components/tasks/task-badges";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/field";
import type { Task } from "@/db/schema";
import { cn } from "@/lib/cn";
import {
  addDays,
  eachDay,
  endOfMonth,
  formatDate,
  MONTH_NAMES,
  startOfMonth,
  startOfWeek,
  weekdayIndex,
} from "@/lib/dates";
import { daysRemaining, isHoliday, isWorkday } from "@/lib/derive";
import { PARAM } from "@/lib/search-params";
import type { Workspace } from "@/lib/task-queries";
import { useFilters } from "@/lib/use-filters";
import { WEEKDAY_NAMES } from "@/lib/settings";

/** Vista mensual: cada tarea aparece en su fecha límite, que es la que
 *  importa para no llevarse una sorpresa. Los días no laborables y los
 *  festivos se marcan para que se lean de un vistazo. */
export function MonthCalendar({
  tasks,
  workspace,
  today,
  year,
  month,
}: {
  tasks: Task[];
  workspace: Workspace;
  today: string;
  year: number;
  month: number;
}) {
  const { set } = useFilters();
  const [dayOpen, setDayOpen] = useState<string | null>(null);

  const weekStart = workspace.settings.weekStart;
  const first = startOfMonth(year, month);
  const last = endOfMonth(year, month);
  const gridStart = startOfWeek(first, weekStart);
  // Seis semanas fijas: la grilla no salta de alto al cambiar de mes.
  const gridEnd = addDays(gridStart, 41);
  const days = eachDay(gridStart, gridEnd);

  const byDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const list = map.get(task.dueDate);
      if (list) list.push(task);
      else map.set(task.dueDate, [task]);
    }
    return map;
  }, [tasks]);

  const headers = weekStart === "monday"
    ? WEEKDAY_NAMES
    : [WEEKDAY_NAMES[6], ...WEEKDAY_NAMES.slice(0, 6)];

  function shiftMonth(delta: number) {
    const next = month + delta;
    const nextYear = year + Math.floor((next - 1) / 12);
    const nextMonth = ((((next - 1) % 12) + 12) % 12) + 1;
    set({ [PARAM.year]: nextYear, [PARAM.month]: nextMonth });
  }

  const noDueDate = tasks.filter((t) => !t.dueDate).length;

  if (workspace.projects.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<CalendarDays className="size-8" />}
          title="Todavía no hay proyectos"
          description="El calendario ubica las tareas en su fecha límite. Creá un proyecto y cargá tareas para verlas acá."
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
          <Button size="icon" onClick={() => shiftMonth(-1)} aria-label="Mes anterior">
            <ChevronLeft className="size-4" />
          </Button>
          <Select
            value={month}
            onChange={(e) => set({ [PARAM.month]: e.target.value })}
            className="w-auto"
            aria-label="Mes"
          >
            {MONTH_NAMES.map((name, index) => (
              <option key={name} value={index + 1}>
                {name}
              </option>
            ))}
          </Select>
          <Select
            value={year}
            onChange={(e) => set({ [PARAM.year]: e.target.value })}
            className="w-auto"
            aria-label="Año"
          >
            {yearRange(year).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </Select>
          <Button size="icon" onClick={() => shiftMonth(1)} aria-label="Mes siguiente">
            <ChevronRight className="size-4" />
          </Button>
          <Button
            size="sm"
            onClick={() =>
              set({
                [PARAM.year]: Number(today.slice(0, 4)),
                [PARAM.month]: Number(today.slice(5, 7)),
              })
            }
          >
            Hoy
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-surface">
        <div className="grid shrink-0 grid-cols-7 border-b border-border">
          {headers.map((name) => (
            <div
              key={name}
              className="px-2 py-1.5 text-center text-[11px] font-medium uppercase tracking-wide text-muted"
            >
              {name.slice(0, 3)}
            </div>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6">
          {days.map((day) => {
            const inMonth = day >= first && day <= last;
            const dayTasks = byDay.get(day) ?? [];
            const holiday = isHoliday(day, workspace.calendar);
            const working = isWorkday(day, workspace.calendar);
            const isToday = day === today;

            return (
              <button
                key={day}
                onClick={() => setDayOpen(day)}
                className={cn(
                  "flex min-h-0 flex-col gap-0.5 overflow-hidden border-b border-r border-border p-1 text-left transition-colors hover:bg-surface-2/60",
                  !inMonth && "opacity-40",
                  !working && "bg-surface-2/40",
                  holiday && "bg-warning/5",
                )}
              >
                <div className="flex shrink-0 items-center gap-1">
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full text-xs",
                      isToday && "bg-accent font-semibold text-accent-fg",
                    )}
                  >
                    {Number(day.slice(8))}
                  </span>
                  {holiday ? (
                    <span
                      className="truncate text-[10px] text-warning"
                      title={holidayName(day, workspace)}
                    >
                      {holidayName(day, workspace)}
                    </span>
                  ) : null}
                  {dayTasks.length > 2 ? (
                    <span className="ml-auto text-[10px] text-muted">
                      {dayTasks.length}
                    </span>
                  ) : null}
                </div>

                <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                  {dayTasks.slice(0, 3).map((task) => (
                    <DayChip
                      key={task.id}
                      task={task}
                      workspace={workspace}
                      today={today}
                    />
                  ))}
                  {dayTasks.length > 3 ? (
                    <span className="text-[10px] text-muted">
                      +{dayTasks.length - 3} más
                    </span>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <p className="shrink-0 text-xs text-muted">
        {tasks.length - noDueDate} tarea(s) ubicadas por fecha límite.
        {noDueDate > 0
          ? ` ${noDueDate} sin fecha límite no aparecen en el calendario.`
          : ""}
      </p>

      <Dialog
        open={dayOpen !== null}
        onClose={() => setDayOpen(null)}
        title={dayOpen ? formatDate(dayOpen) : ""}
        description={
          dayOpen
            ? [
                WEEKDAY_NAMES[weekdayIndex(dayOpen)],
                isWorkday(dayOpen, workspace.calendar)
                  ? "día laborable"
                  : "día no laborable",
                isHoliday(dayOpen, workspace.calendar)
                  ? holidayName(dayOpen, workspace)
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")
            : undefined
        }
      >
        {dayOpen && (byDay.get(dayOpen)?.length ?? 0) > 0 ? (
          <ul className="flex flex-col gap-1">
            {byDay.get(dayOpen)!.map((task) => {
              const assignee = workspace.people.find(
                (p) => p.id === task.assigneeId,
              );
              const project = workspace.projects.find(
                (p) => p.id === task.projectId,
              );
              return (
                <li key={task.id}>
                  <button
                    onClick={() => {
                      set({ [PARAM.task]: task.id });
                      setDayOpen(null);
                    }}
                    className="flex w-full items-center gap-2 rounded border border-border px-2 py-1.5 text-left text-sm hover:bg-surface-2"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: project?.color ?? "#94a3b8" }}
                    />
                    <span className="min-w-0 flex-1 truncate">{task.title}</span>
                    <PersonAvatar person={assignee} />
                    <DaysRemainingBadge
                      value={daysRemaining(
                        task,
                        new Map(workspace.statuses.map((s) => [s.id, s])),
                        today,
                      )}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="py-4 text-center text-sm text-muted">
            No vence nada este día.
          </p>
        )}
      </Dialog>
    </div>
  );
}

function DayChip({
  task,
  workspace,
  today,
}: {
  task: Task;
  workspace: Workspace;
  today: string;
}) {
  const statusById = new Map(workspace.statuses.map((s) => [s.id, s]));
  const remaining = daysRemaining(task, statusById, today);
  const overdue = typeof remaining === "number" && remaining < 0;
  const project = workspace.projects.find((p) => p.id === task.projectId);

  return (
    <span
      className={cn(
        "truncate rounded px-1 py-0.5 text-[11px]",
        overdue ? "bg-danger/15 text-danger" : "bg-surface-2",
      )}
      style={
        overdue
          ? undefined
          : { borderLeft: `2px solid ${project?.color ?? "#94a3b8"}` }
      }
      title={task.title}
    >
      {task.title}
    </span>
  );
}

function holidayName(date: string, workspace: Workspace): string {
  return (
    workspace.holidays.find((h) => h.date === date)?.description || "Festivo"
  );
}

function yearRange(current: number): number[] {
  const start = current - 3;
  return Array.from({ length: 9 }, (_, i) => start + i);
}
