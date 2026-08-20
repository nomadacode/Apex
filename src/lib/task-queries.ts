import {
  and,
  asc,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  notInArray,
  or,
  type SQL,
} from "drizzle-orm";

import { ensureDb } from "@/db/bootstrap";
import {
  activityLog,
  attachments,
  comments,
  holidays,
  phases,
  taskDependencies,
  tasks,
  type Task,
} from "@/db/schema";
import type { Calendar } from "@/lib/derive";
import {
  getKanbanStages,
  getPeople,
  getPriorities,
  getProjects,
  getSettings,
  getStatuses,
} from "@/lib/queries";

export type TaskFilters = {
  projectId?: number | null;
  phaseId?: number | null;
  assigneeId?: number | "none" | null;
  statusId?: number | null;
  priorityId?: number | null;
  stageId?: number | null;
  /** Ventana de fechas: la tarea entra si su tramo la toca. */
  from?: string | null;
  to?: string | null;
  search?: string | null;
  /** Excluye las que están en un estado marcado como cancelado. */
  hideCancelled?: boolean;
};

/** Catálogos + calendario laboral: el paquete que necesita cada vista
 *  para resolver ids a nombres y calcular días laborables. */
export function getWorkspace() {
  const db = ensureDb();
  const settings = getSettings();
  const holidayRows = db.select().from(holidays).all();
  const calendar: Calendar = {
    workdays: settings.workdays,
    holidays: new Set(holidayRows.map((h) => h.date)),
  };
  return {
    settings,
    calendar,
    holidays: holidayRows,
    projects: getProjects(),
    allProjects: getProjects({ includeArchived: true }),
    phases: db.select().from(phases).orderBy(asc(phases.position)).all(),
    people: getPeople(),
    statuses: getStatuses(),
    stages: getKanbanStages(),
    priorities: getPriorities(),
  };
}

export type Workspace = ReturnType<typeof getWorkspace>;

function buildWhere(filters: TaskFilters, workspace: Workspace): SQL | undefined {
  const clauses: SQL[] = [];

  // Los proyectos archivados no aparecen en ninguna vista de trabajo.
  const visibleProjectIds = workspace.projects.map((p) => p.id);
  if (visibleProjectIds.length === 0) return eq(tasks.id, -1);

  if (filters.projectId != null) {
    if (!visibleProjectIds.includes(filters.projectId)) return eq(tasks.id, -1);
    clauses.push(eq(tasks.projectId, filters.projectId));
  } else {
    clauses.push(inArray(tasks.projectId, visibleProjectIds));
  }

  if (filters.phaseId != null) clauses.push(eq(tasks.phaseId, filters.phaseId));
  if (filters.statusId != null) clauses.push(eq(tasks.statusId, filters.statusId));
  if (filters.priorityId != null)
    clauses.push(eq(tasks.priorityId, filters.priorityId));
  if (filters.stageId != null)
    clauses.push(eq(tasks.kanbanStageId, filters.stageId));

  if (filters.assigneeId === "none") clauses.push(isNull(tasks.assigneeId));
  else if (filters.assigneeId != null)
    clauses.push(eq(tasks.assigneeId, filters.assigneeId));

  if (filters.from) {
    const clause = or(
      gte(tasks.dueDate, filters.from),
      gte(tasks.startDate, filters.from),
    );
    if (clause) clauses.push(clause);
  }
  if (filters.to) {
    const clause = or(
      lte(tasks.startDate, filters.to),
      lte(tasks.dueDate, filters.to),
    );
    if (clause) clauses.push(clause);
  }

  if (filters.hideCancelled) {
    const cancelledIds = workspace.statuses
      .filter((s) => s.isCancelled)
      .map((s) => s.id);
    if (cancelledIds.length > 0) {
      const clause = or(
        isNull(tasks.statusId),
        notInArray(tasks.statusId, cancelledIds),
      );
      if (clause) clauses.push(clause);
    }
  }

  return clauses.length > 0 ? and(...clauses) : undefined;
}

/** Compara sin distinguir mayúsculas ni acentos: buscar "diseno" tiene
 *  que encontrar "diseño". */
export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Tareas que cumplen los filtros. El texto se filtra en memoria porque
 *  SQLite no compara acentos por defecto. */
export function getTasks(
  filters: TaskFilters,
  workspace: Workspace = getWorkspace(),
): Task[] {
  const db = ensureDb();
  const rows = db
    .select()
    .from(tasks)
    .where(buildWhere(filters, workspace))
    .orderBy(asc(tasks.position), asc(tasks.id))
    .all();

  const search = normalize(filters.search ?? "").trim();
  if (!search) return rows;
  return rows.filter(
    (t) =>
      normalize(t.title).includes(search) ||
      normalize(t.description).includes(search) ||
      normalize(t.notes).includes(search),
  );
}

/** Detalle completo de una tarea, para el panel lateral. */
export function getTaskDetail(id: number) {
  const db = ensureDb();
  const task = db.select().from(tasks).where(eq(tasks.id, id)).get();
  if (!task) return null;

  const children = db
    .select()
    .from(tasks)
    .where(eq(tasks.parentTaskId, id))
    .orderBy(asc(tasks.position), asc(tasks.id))
    .all();

  const predecessors = db
    .select({
      id: taskDependencies.id,
      type: taskDependencies.type,
      taskId: taskDependencies.predecessorId,
    })
    .from(taskDependencies)
    .where(eq(taskDependencies.successorId, id))
    .all();

  const successors = db
    .select({
      id: taskDependencies.id,
      type: taskDependencies.type,
      taskId: taskDependencies.successorId,
    })
    .from(taskDependencies)
    .where(eq(taskDependencies.predecessorId, id))
    .all();

  const relatedIds = [
    ...predecessors.map((d) => d.taskId),
    ...successors.map((d) => d.taskId),
  ];
  const related =
    relatedIds.length > 0
      ? db.select().from(tasks).where(inArray(tasks.id, relatedIds)).all()
      : [];

  const parent =
    task.parentTaskId != null
      ? (db.select().from(tasks).where(eq(tasks.id, task.parentTaskId)).get() ??
        null)
      : null;

  return {
    task,
    parent,
    children,
    predecessors,
    successors,
    related,
    comments: db
      .select()
      .from(comments)
      .where(eq(comments.taskId, id))
      .orderBy(asc(comments.createdAt))
      .all(),
    attachments: db
      .select()
      .from(attachments)
      .where(eq(attachments.taskId, id))
      .all(),
    activity: db
      .select()
      .from(activityLog)
      .where(eq(activityLog.taskId, id))
      .orderBy(desc(activityLog.at), desc(activityLog.id))
      .limit(60)
      .all(),
  };
}

export type TaskDetail = NonNullable<ReturnType<typeof getTaskDetail>>;

/** Todas las dependencias del tablero, para dibujar las líneas del Gantt. */
export function getAllDependencies() {
  return ensureDb().select().from(taskDependencies).all();
}
