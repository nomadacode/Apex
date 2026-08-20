/** Lógica derivada del planificador.
 *
 *  Funciones puras, sin acceso a datos ni a React.
 *  Este es el ÚNICO lugar donde vive esta lógica: Dashboard, Kanban,
 *  Gantt, calendarios y matriz la consumen, ninguno la reimplementa.
 */

import {
  addDays,
  daysBetween,
  eachDay,
  isISODate,
  weekdayIndex,
  type ISODate,
} from "@/lib/dates";

/* ───────────────────────────  Tipos mínimos  ───────────────────────────
 * Se piden estructuras chicas en lugar de la fila entera de la tabla:
 * así estas funciones se testean sin tocar la base. */

export type StatusLike = {
  id: number;
  isDone: boolean;
  isCancelled: boolean;
};

export type TaskLike = {
  id: number;
  statusId: number | null;
  startDate: string | null;
  dueDate: string | null;
  important: boolean;
  urgent: boolean;
  progress: number;
  parentTaskId?: number | null;
};

export type Calendar = {
  /** Índice 0 = lunes … 6 = domingo. */
  workdays: boolean[];
  /** Fechas ISO no laborables (festivos y días libres). */
  holidays: Set<ISODate> | ISODate[];
};

/* ───────────────────────────  Estado de tarea  ───────────────────────── */

export function isDone(
  task: TaskLike,
  statuses: Map<number, StatusLike>,
): boolean {
  return task.statusId != null
    ? (statuses.get(task.statusId)?.isDone ?? false)
    : false;
}

export function isCancelled(
  task: TaskLike,
  statuses: Map<number, StatusLike>,
): boolean {
  return task.statusId != null
    ? (statuses.get(task.statusId)?.isCancelled ?? false)
    : false;
}

/** Días restantes hasta la fecha límite. Tres resultados posibles, y la
 *  vista decide cómo mostrar cada uno:
 *  - `null` si la tarea no tiene fecha límite
 *  - `"done"` si ya está completada
 *  - un número (negativo si está atrasada) en cualquier otro caso */
export function daysRemaining(
  task: TaskLike,
  statuses: Map<number, StatusLike>,
  today: ISODate,
): number | null | "done" {
  if (!isISODate(task.dueDate)) return null;
  if (isDone(task, statuses)) return "done";
  return daysBetween(today, task.dueDate);
}

/** Atrasada = venció y no está completada. Las canceladas no cuentan:
 *  no tiene sentido perseguir algo que se decidió no hacer. */
export function isOverdue(
  task: TaskLike,
  statuses: Map<number, StatusLike>,
  today: ISODate,
): boolean {
  if (isCancelled(task, statuses)) return false;
  const remaining = daysRemaining(task, statuses, today);
  return typeof remaining === "number" && remaining < 0;
}

export function isDueToday(
  task: TaskLike,
  statuses: Map<number, StatusLike>,
  today: ISODate,
): boolean {
  if (isCancelled(task, statuses)) return false;
  return daysRemaining(task, statuses, today) === 0;
}

/** Vence dentro de los próximos `days` días (sin incluir hoy ni lo vencido). */
export function isDueSoon(
  task: TaskLike,
  statuses: Map<number, StatusLike>,
  today: ISODate,
  days = 7,
): boolean {
  if (isCancelled(task, statuses)) return false;
  const remaining = daysRemaining(task, statuses, today);
  return typeof remaining === "number" && remaining > 0 && remaining <= days;
}

/* ─────────────────────────  Matriz de Eisenhower  ───────────────────── */

export type Quadrant = "do" | "schedule" | "delegate" | "eliminate";

export const QUADRANTS: Record<
  Quadrant,
  { label: string; hint: string; important: boolean; urgent: boolean }
> = {
  do: {
    label: "Haz primero",
    hint: "Importante y urgente: resolvelo ya.",
    important: true,
    urgent: true,
  },
  schedule: {
    label: "Programar",
    hint: "Importante pero no urgente: buscale un lugar en el calendario.",
    important: true,
    urgent: false,
  },
  delegate: {
    label: "Delegar",
    hint: "Urgente pero no importante: que lo haga otra persona.",
    important: false,
    urgent: true,
  },
  eliminate: {
    label: "No hacer",
    hint: "Ni urgente ni importante: sacalo de la lista.",
    important: false,
    urgent: false,
  },
};

export function quadrantOf(task: TaskLike): Quadrant {
  if (task.important) return task.urgent ? "do" : "schedule";
  return task.urgent ? "delegate" : "eliminate";
}

/* ────────────────────────────  Calendario  ──────────────────────────── */

function holidaySet(calendar: Calendar): Set<ISODate> {
  return calendar.holidays instanceof Set
    ? calendar.holidays
    : new Set(calendar.holidays);
}

export function isWorkday(date: ISODate, calendar: Calendar): boolean {
  if (!calendar.workdays[weekdayIndex(date)]) return false;
  return !holidaySet(calendar).has(date);
}

export function isHoliday(date: ISODate, calendar: Calendar): boolean {
  return holidaySet(calendar).has(date);
}

/** Días laborables entre dos fechas, ambas inclusive: respeta los días de
 *  la semana marcados como laborables en el calendario del espacio de
 *  trabajo y descuenta los festivos cargados. */
export function workdaysBetween(
  from: ISODate | null | undefined,
  to: ISODate | null | undefined,
  calendar: Calendar,
): number | null {
  if (!isISODate(from) || !isISODate(to)) return null;
  if (daysBetween(from, to) < 0) return 0;
  const holidays = holidaySet(calendar);
  let count = 0;
  for (const day of eachDay(from, to)) {
    if (calendar.workdays[weekdayIndex(day)] && !holidays.has(day)) count += 1;
  }
  return count;
}

/** Duración en días calendario, ambas inclusive (el `GETDUR` del Excel). */
export function durationDays(
  from: ISODate | null | undefined,
  to: ISODate | null | undefined,
): number | null {
  if (!isISODate(from) || !isISODate(to)) return null;
  const diff = daysBetween(from, to);
  return diff < 0 ? 0 : diff + 1;
}

/** Desplaza una fecha `n` días laborables hacia adelante o atrás. Se usa
 *  al reprogramar cadenas de dependencias en el Gantt. */
export function shiftWorkdays(
  date: ISODate,
  amount: number,
  calendar: Calendar,
): ISODate {
  if (amount === 0) return date;
  const step = amount > 0 ? 1 : -1;
  let remaining = Math.abs(amount);
  let cursor = date;
  // Cota de seguridad: si el calendario no tiene ningún día laborable,
  // esto terminaría igual en vez de colgarse.
  let guard = 0;
  while (remaining > 0 && guard < 10_000) {
    cursor = addDays(cursor, step);
    if (isWorkday(cursor, calendar)) remaining -= 1;
    guard += 1;
  }
  return cursor;
}

/* ──────────────────────────────  Progreso  ─────────────────────────── */

export type ProgressSummary = {
  /** Tareas consideradas (excluye canceladas). */
  total: number;
  done: number;
  pending: number;
  overdue: number;
  dueToday: number;
  cancelled: number;
  /** Fracción 0-1 de tareas completadas. */
  completion: number;
  /** Fracción 0-1 ponderada por el campo `progress` de cada tarea. */
  weighted: number;
};

/** Resumen de un conjunto de tareas.
 *
 *  Las canceladas quedan fuera del numerador y del denominador. Contarlas
 *  hundiría el porcentaje de un proyecto que simplemente descartó trabajo,
 *  que es una decisión sana y no un incumplimiento. */
export function summarize(
  tasks: TaskLike[],
  statuses: Map<number, StatusLike>,
  today: ISODate,
): ProgressSummary {
  let done = 0;
  let overdue = 0;
  let dueToday = 0;
  let cancelled = 0;
  let progressSum = 0;
  let counted = 0;

  for (const task of tasks) {
    if (isCancelled(task, statuses)) {
      cancelled += 1;
      continue;
    }
    counted += 1;
    const finished = isDone(task, statuses);
    if (finished) done += 1;
    progressSum += finished ? 100 : clampProgress(task.progress);
    if (isOverdue(task, statuses, today)) overdue += 1;
    if (isDueToday(task, statuses, today)) dueToday += 1;
  }

  return {
    total: counted,
    done,
    pending: counted - done,
    overdue,
    dueToday,
    cancelled,
    completion: counted === 0 ? 0 : done / counted,
    weighted: counted === 0 ? 0 : progressSum / (counted * 100),
  };
}

export function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Progreso de una tarea con subtareas = promedio de las hijas directas
 *  no canceladas. Sin hijas, el valor propio (editable a mano). */
export function rollupProgress(
  task: TaskLike,
  children: TaskLike[],
  statuses: Map<number, StatusLike>,
): number {
  const relevant = children.filter((c) => !isCancelled(c, statuses));
  if (relevant.length === 0) return clampProgress(task.progress);
  const sum = relevant.reduce(
    (acc, child) =>
      acc + (isDone(child, statuses) ? 100 : clampProgress(child.progress)),
    0,
  );
  return Math.round(sum / relevant.length);
}

/* ─────────────────────────────  Agrupar  ───────────────────────────── */

/** Cuenta tareas por una clave (estado, prioridad, etapa, responsable).
 *  Un solo recuento genérico en vez de uno escrito a mano por cada vista. */
export function countBy<K>(
  tasks: TaskLike[],
  key: (task: TaskLike) => K,
): Map<K, number> {
  const out = new Map<K, number>();
  for (const task of tasks) {
    const k = key(task);
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}

/** Construye el índice hijo→padre para recorrer subtareas. */
export function childrenByParent<T extends TaskLike>(
  tasks: T[],
): Map<number, T[]> {
  const out = new Map<number, T[]>();
  for (const task of tasks) {
    if (task.parentTaskId == null) continue;
    const list = out.get(task.parentTaskId);
    if (list) list.push(task);
    else out.set(task.parentTaskId, [task]);
  }
  return out;
}

/** Ids de todo el subárbol de una tarea, sin incluirla. Tolera datos con
 *  ciclos (no deberían existir, pero no vale colgarse por eso). */
export function descendantIds(
  rootId: number,
  childrenIndex: Map<number, TaskLike[]>,
): number[] {
  const out: number[] = [];
  const seen = new Set<number>([rootId]);
  const stack = [rootId];
  while (stack.length > 0) {
    const current = stack.pop()!;
    for (const child of childrenIndex.get(current) ?? []) {
      if (seen.has(child.id)) continue;
      seen.add(child.id);
      out.push(child.id);
      stack.push(child.id);
    }
  }
  return out;
}

/* ───────────────────────────  Dependencias  ────────────────────────── */

export type DependencyEdge = { predecessorId: number; successorId: number };

/** Camino del ciclo que se formaría al agregar `predecessor → successor`,
 *  o `null` si no se forma ninguno. Se usa para rechazar la dependencia
 *  con un mensaje que muestra el ciclo concreto. */
export function findCycle(
  edges: DependencyEdge[],
  predecessorId: number,
  successorId: number,
): number[] | null {
  if (predecessorId === successorId) return [predecessorId, successorId];

  const next = new Map<number, number[]>();
  for (const edge of edges) {
    const list = next.get(edge.predecessorId);
    if (list) list.push(edge.successorId);
    else next.set(edge.predecessorId, [edge.successorId]);
  }

  // ¿Se llega de `successor` de vuelta a `predecessor`? Entonces el
  // arco nuevo cierra el círculo.
  const cameFrom = new Map<number, number>();
  const seen = new Set<number>([successorId]);
  const queue = [successorId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === predecessorId) {
      const path = [predecessorId];
      let node = predecessorId;
      while (node !== successorId) {
        node = cameFrom.get(node)!;
        path.push(node);
      }
      path.reverse();
      return [...path, successorId];
    }
    for (const nb of next.get(current) ?? []) {
      if (seen.has(nb)) continue;
      seen.add(nb);
      cameFrom.set(nb, current);
      queue.push(nb);
    }
  }
  return null;
}
