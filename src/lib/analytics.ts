/** Analítica de proyecto.
 *
 *  Responde las preguntas que un PM hace de verdad: quién demora, qué etapa
 *  frena el flujo, cuánto tarda una tarea de punta a punta, si llegamos a
 *  las fechas. Todo se deriva de lo ya cargado — no hay campos nuevos que
 *  alguien tenga que completar a mano.
 *
 *  Funciones puras: reciben filas y devuelven números. Los tests viven en
 *  `analytics.test.ts` y no tocan la base.
 */

import { daysBetween, type ISODate } from "@/lib/dates";
import {
  isCancelled,
  isDone,
  type StatusLike,
  type TaskLike,
} from "@/lib/derive";

/* ─────────────────────────────  Entradas  ──────────────────────────── */

export type AnalyticsTask = TaskLike & {
  title: string;
  projectId: number;
  phaseId: number | null;
  assigneeId: number | null;
  priorityId: number | null;
  kanbanStageId: number | null;
  createdAt: string;
  completedAt: string | null;
};

/** Entrada del historial: solo interesan los cambios de etapa y de estado. */
export type AnalyticsEvent = {
  taskId: number | null;
  field: string;
  oldValue: string | null;
  newValue: string | null;
  at: string;
};

/** `2026-08-13 14:05:00` o ISO completo → día `2026-08-13`. */
export function dayOf(timestamp: string): ISODate {
  return timestamp.slice(0, 10);
}

function hoursBetween(from: string, to: string): number {
  const a = Date.parse(normalizeStamp(from));
  const b = Date.parse(normalizeStamp(to));
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, (b - a) / 3_600_000);
}

/** SQLite escribe `YYYY-MM-DD HH:MM:SS` (sin zona); `Date.parse` lo
 *  interpreta distinto según el navegador. Se normaliza a ISO con Z. */
function normalizeStamp(value: string): string {
  if (value.includes("T")) return value;
  return `${value.replace(" ", "T")}Z`;
}

/* ────────────────────────  Tiempos de una tarea  ───────────────────── */

/** Días desde que se creó hasta que se cerró. `null` si sigue abierta. */
export function leadTimeDays(task: AnalyticsTask): number | null {
  if (!task.completedAt) return null;
  return round1(hoursBetween(task.createdAt, task.completedAt) / 24);
}

/** Días desde que empezó a moverse hasta que se cerró.
 *
 *  El arranque real es el primer cambio de etapa registrado; si la tarea
 *  nunca se movió, se cae a la fecha de inicio planificada y, en último
 *  caso, a la creación. */
export function cycleTimeDays(
  task: AnalyticsTask,
  events: AnalyticsEvent[],
): number | null {
  if (!task.completedAt) return null;
  const firstMove = events
    .filter((e) => e.taskId === task.id && e.field === "etapa")
    .map((e) => e.at)
    .sort()[0];
  const start = firstMove ?? task.startDate ?? task.createdAt;
  return round1(hoursBetween(start, task.completedAt) / 24);
}

/** Días de atraso al cerrar: positivo = cerró tarde, negativo = antes.
 *  `null` si no tenía fecha límite o sigue abierta. */
export function closingDelayDays(task: AnalyticsTask): number | null {
  if (!task.completedAt || !task.dueDate) return null;
  return daysBetween(task.dueDate, dayOf(task.completedAt));
}

/** Días que una tarea abierta lleva sin cerrarse (aging del WIP). */
export function agingDays(
  task: AnalyticsTask,
  statuses: Map<number, StatusLike>,
  today: ISODate,
): number | null {
  if (isDone(task, statuses) || isCancelled(task, statuses)) return null;
  const start = task.startDate ?? dayOf(task.createdAt);
  return Math.max(0, daysBetween(start, today));
}

/* ──────────────────────────  Tiempo por etapa  ─────────────────────── */

export type StageTime = {
  stageId: number | null;
  /** Horas acumuladas en esa etapa, sumando todas las tareas. */
  totalHours: number;
  /** Cuántos tramos se midieron (una tarea puede pasar dos veces). */
  samples: number;
  /** Horas promedio por tramo. */
  avgHours: number;
  /** Tareas distintas que pasaron por la etapa. */
  tasks: number;
};

/**
 * Cuánto tiempo se queda el trabajo en cada etapa del Kanban.
 *
 * Se reconstruye a partir del historial: cada cambio de etapa cierra el
 * tramo anterior. El tramo abierto de una tarea viva se cierra en `now`,
 * porque una tarea que lleva dos semanas trabada *es* el problema que este
 * reporte tiene que mostrar — ignorarla lo escondería.
 */
export function stageTimes(
  tasks: AnalyticsTask[],
  events: AnalyticsEvent[],
  now: string,
  statuses: Map<number, StatusLike>,
): StageTime[] {
  const byTask = new Map<number, AnalyticsEvent[]>();
  for (const event of events) {
    if (event.field !== "etapa" || event.taskId == null) continue;
    const list = byTask.get(event.taskId);
    if (list) list.push(event);
    else byTask.set(event.taskId, [event]);
  }

  const acc = new Map<number | null, StageTime & { taskIds: Set<number> }>();

  function add(stageId: number | null, hours: number, taskId: number) {
    const current = acc.get(stageId) ?? {
      stageId,
      totalHours: 0,
      samples: 0,
      avgHours: 0,
      tasks: 0,
      taskIds: new Set<number>(),
    };
    current.totalHours += hours;
    current.samples += 1;
    current.taskIds.add(taskId);
    acc.set(stageId, current);
  }

  for (const task of tasks) {
    if (isCancelled(task, statuses)) continue;

    const moves = (byTask.get(task.id) ?? [])
      .slice()
      .sort((a, b) => a.at.localeCompare(b.at));

    // El tramo inicial va desde la creación hasta el primer movimiento,
    // en la etapa de la que salió ese movimiento.
    let cursor = task.createdAt;
    let stage: number | null =
      moves.length > 0 ? parseId(moves[0].oldValue) : task.kanbanStageId;

    for (const move of moves) {
      add(stage, hoursBetween(cursor, move.at), task.id);
      cursor = move.at;
      stage = parseId(move.newValue);
    }

    // Tramo abierto: hasta el cierre si terminó, hasta ahora si sigue viva.
    const end = task.completedAt ?? now;
    if (end > cursor) add(stage, hoursBetween(cursor, end), task.id);
  }

  return [...acc.values()]
    .map(({ taskIds, ...rest }) => ({
      ...rest,
      tasks: taskIds.size,
      avgHours: rest.samples === 0 ? 0 : round1(rest.totalHours / rest.samples),
      totalHours: round1(rest.totalHours),
    }))
    .sort((a, b) => b.avgHours - a.avgHours);
}

function parseId(value: string | null): number | null {
  if (value == null || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/* ────────────────────────  Ranking por responsable  ────────────────── */

export type PersonStats = {
  personId: number | null;
  total: number;
  done: number;
  open: number;
  overdue: number;
  /** Tareas cerradas con fecha límite, y cuántas llegaron a tiempo. */
  withDueDate: number;
  onTime: number;
  onTimeRate: number | null;
  avgLeadTime: number | null;
  avgCycleTime: number | null;
  /** Días promedio de atraso, contando solo las que cerraron tarde. */
  avgDelay: number | null;
  /** La tarea abierta más vieja: dónde está el problema hoy. */
  oldestOpenDays: number | null;
};

/** Ranking de responsables. El orden por defecto lo deja al frente quien
 *  más demora — que es exactamente lo que hay que mirar primero. */
export function personStats(
  tasks: AnalyticsTask[],
  events: AnalyticsEvent[],
  statuses: Map<number, StatusLike>,
  today: ISODate,
): PersonStats[] {
  const groups = new Map<number | null, AnalyticsTask[]>();
  for (const task of tasks) {
    if (isCancelled(task, statuses)) continue;
    const list = groups.get(task.assigneeId);
    if (list) list.push(task);
    else groups.set(task.assigneeId, [task]);
  }

  return [...groups.entries()]
    .map(([personId, list]) => {
      const done = list.filter((t) => isDone(t, statuses));
      const open = list.filter((t) => !isDone(t, statuses));

      const closedWithDue = done.filter((t) => t.dueDate);
      const delays = closedWithDue
        .map(closingDelayDays)
        .filter((d): d is number => d != null);
      const late = delays.filter((d) => d > 0);

      const leads = done
        .map(leadTimeDays)
        .filter((d): d is number => d != null);
      const cycles = done
        .map((t) => cycleTimeDays(t, events))
        .filter((d): d is number => d != null);

      const agings = open
        .map((t) => agingDays(t, statuses, today))
        .filter((d): d is number => d != null);

      return {
        personId,
        total: list.length,
        done: done.length,
        open: open.length,
        overdue: open.filter(
          (t) => t.dueDate != null && t.dueDate < today,
        ).length,
        withDueDate: closedWithDue.length,
        onTime: delays.length - late.length,
        onTimeRate:
          delays.length === 0
            ? null
            : (delays.length - late.length) / delays.length,
        avgLeadTime: average(leads),
        avgCycleTime: average(cycles),
        avgDelay: average(late),
        oldestOpenDays: agings.length === 0 ? null : Math.max(...agings),
      };
    })
    .sort((a, b) => (b.avgDelay ?? -1) - (a.avgDelay ?? -1));
}

/* ─────────────────────────────  Puntualidad  ───────────────────────── */

export type Punctuality = {
  /** Cerradas antes o el mismo día del vencimiento. */
  onTime: number;
  /** Cerradas después. */
  late: number;
  /** Abiertas y ya vencidas. */
  openOverdue: number;
  /** Cerradas sin fecha límite: no se pueden juzgar. */
  unmeasured: number;
  rate: number | null;
  avgDelay: number | null;
};

export function punctuality(
  tasks: AnalyticsTask[],
  statuses: Map<number, StatusLike>,
  today: ISODate,
): Punctuality {
  let onTime = 0;
  let late = 0;
  let openOverdue = 0;
  let unmeasured = 0;
  const delays: number[] = [];

  for (const task of tasks) {
    if (isCancelled(task, statuses)) continue;
    if (isDone(task, statuses)) {
      const delay = closingDelayDays(task);
      if (delay == null) {
        unmeasured += 1;
        continue;
      }
      if (delay > 0) {
        late += 1;
        delays.push(delay);
      } else {
        onTime += 1;
      }
    } else if (task.dueDate != null && task.dueDate < today) {
      openOverdue += 1;
    }
  }

  const judged = onTime + late;
  return {
    onTime,
    late,
    openOverdue,
    unmeasured,
    rate: judged === 0 ? null : onTime / judged,
    avgDelay: average(delays),
  };
}

/* ─────────────────────────  Throughput semanal  ────────────────────── */

export type WeekPoint = {
  /** Lunes de la semana, ISO. */
  weekStart: ISODate;
  completed: number;
  created: number;
  /** Lead time promedio de lo cerrado esa semana. */
  avgLeadTime: number | null;
};

/** Cuánto entra y cuánto sale por semana. Si `created` supera a
 *  `completed` de forma sostenida, la cola crece. */
export function weeklyFlow(
  tasks: AnalyticsTask[],
  statuses: Map<number, StatusLike>,
  weeks: ISODate[],
): WeekPoint[] {
  return weeks.map((weekStart) => {
    const weekEnd = addDaysISO(weekStart, 6);
    const inWeek = (date: string | null) =>
      date != null && dayOf(date) >= weekStart && dayOf(date) <= weekEnd;

    const completed = tasks.filter(
      (t) => !isCancelled(t, statuses) && inWeek(t.completedAt),
    );
    const leads = completed
      .map(leadTimeDays)
      .filter((d): d is number => d != null);

    return {
      weekStart,
      completed: completed.length,
      created: tasks.filter(
        (t) => !isCancelled(t, statuses) && inWeek(t.createdAt),
      ).length,
      avgLeadTime: average(leads),
    };
  });
}

function addDaysISO(date: ISODate, days: number): ISODate {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/* ────────────────────────────  Aging del WIP  ──────────────────────── */

export const AGING_BANDS = [
  { label: "0–3 días", min: 0, max: 3 },
  { label: "4–7 días", min: 4, max: 7 },
  { label: "8–14 días", min: 8, max: 14 },
  { label: "15–30 días", min: 15, max: 30 },
  { label: "más de 30", min: 31, max: Infinity },
] as const;

export type AgingBucket = {
  label: string;
  count: number;
  /** Las tareas más viejas de la banda, para poder ir a mirarlas. */
  sample: AnalyticsTask[];
};

/** Cuánto lleva esperando el trabajo abierto. Las bandas altas son deuda:
 *  tareas que nadie cerró y que probablemente ya no reflejan la realidad. */
export function agingBuckets(
  tasks: AnalyticsTask[],
  statuses: Map<number, StatusLike>,
  today: ISODate,
): AgingBucket[] {
  const withAge = tasks
    .map((task) => ({ task, age: agingDays(task, statuses, today) }))
    .filter((row): row is { task: AnalyticsTask; age: number } => row.age != null)
    .sort((a, b) => b.age - a.age);

  return AGING_BANDS.map((band) => {
    const inBand = withAge.filter(
      (row) => row.age >= band.min && row.age <= band.max,
    );
    return {
      label: band.label,
      count: inBand.length,
      sample: inBand.slice(0, 5).map((row) => row.task),
    };
  });
}

/* ──────────────────────────────  Utilidades  ───────────────────────── */

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return round1(values.reduce((a, b) => a + b, 0) / values.length);
}

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return round1(
    sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid],
  );
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Horas → texto corto legible: `6 h`, `2,5 d`. */
export function formatDuration(hours: number | null): string {
  if (hours == null) return "—";
  if (hours < 24) return `${Math.round(hours)} h`;
  const days = hours / 24;
  return `${days.toFixed(days < 10 ? 1 : 0).replace(".", ",")} d`;
}

export function formatDays(days: number | null): string {
  if (days == null) return "—";
  return `${days.toFixed(days < 10 ? 1 : 0).replace(".", ",")} d`;
}
