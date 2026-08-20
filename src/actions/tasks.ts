"use server";

import { and, count, eq, inArray, sql } from "drizzle-orm";

import { ensureDb } from "@/db/bootstrap";
import {
  comments,
  kanbanStages,
  phases,
  statuses,
  taskDependencies,
  tasks,
  type Task,
} from "@/db/schema";
import { logChanges } from "@/actions/log";
import { fail, guard, ok, refreshUI, type ActionResult } from "@/actions/result";
import { isISODate } from "@/lib/dates";
import { clampProgress, findCycle } from "@/lib/derive";

function trimmed(value: FormDataEntryValue | null): string {
  return typeof value === "string" ? value.trim() : "";
}

function numberOrNull(value: FormDataEntryValue | null): number | null {
  const raw = trimmed(value);
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function dateOrNull(value: FormDataEntryValue | null): string | null {
  const raw = trimmed(value);
  return isISODate(raw) ? raw : null;
}

/** Campos editables de una tarea, con el nombre que se ve en el historial. */
const FIELD_LABELS: Partial<Record<keyof Task, string>> = {
  title: "título",
  description: "descripción",
  projectId: "proyecto",
  phaseId: "fase",
  statusId: "estado",
  priorityId: "prioridad",
  assigneeId: "responsable",
  kanbanStageId: "etapa",
  startDate: "fecha de inicio",
  dueDate: "fecha límite",
  progress: "progreso",
  important: "importante",
  urgent: "urgente",
  estimateHours: "estimación",
  notes: "notas",
};

/* ─────────────────────────────  Validación  ─────────────────────────── */

function validateDates(
  startDate: string | null,
  dueDate: string | null,
): string | null {
  if (startDate && dueDate && startDate > dueDate) {
    return "La fecha de inicio no puede ser posterior a la fecha límite.";
  }
  return null;
}

/** Estado terminal por defecto y primera etapa: se usan cuando la tarea
 *  se crea sin elegirlos, para que nunca quede en un limbo sin columna. */
function defaults() {
  const db = ensureDb();
  const firstStatus = db
    .select()
    .from(statuses)
    .orderBy(statuses.position)
    .limit(1)
    .get();
  const firstStage = db
    .select()
    .from(kanbanStages)
    .orderBy(kanbanStages.position)
    .limit(1)
    .get();
  return { statusId: firstStatus?.id ?? null, stageId: firstStage?.id ?? null };
}

/* ─────────────────────────────  Crear / editar  ─────────────────────── */

export async function createTask(
  formData: FormData,
): Promise<ActionResult<{ id: number }>> {
  return guard(() => {
    const db = ensureDb();
    const title = trimmed(formData.get("title"));
    if (!title) return fail("La tarea necesita un nombre.");

    const projectId = numberOrNull(formData.get("projectId"));
    if (projectId == null) {
      return fail(
        "La tarea tiene que pertenecer a un proyecto.",
        "Creá un proyecto en Configuración si todavía no tenés ninguno.",
      );
    }

    const startDate = dateOrNull(formData.get("startDate"));
    const dueDate = dateOrNull(formData.get("dueDate"));
    const dateError = validateDates(startDate, dueDate);
    if (dateError) return fail(dateError);

    const parentTaskId = numberOrNull(formData.get("parentTaskId"));
    if (parentTaskId != null) {
      const parent = db
        .select()
        .from(tasks)
        .where(eq(tasks.id, parentTaskId))
        .get();
      if (!parent) return fail("La tarea padre ya no existe.");
    }

    const fallback = defaults();
    const statusId = numberOrNull(formData.get("statusId")) ?? fallback.statusId;
    const status =
      statusId != null
        ? db.select().from(statuses).where(eq(statuses.id, statusId)).get()
        : undefined;

    const max = db
      .select({ v: sql<number>`coalesce(max(${tasks.position}), -1)` })
      .from(tasks)
      .where(eq(tasks.projectId, projectId))
      .get();

    const row = db
      .insert(tasks)
      .values({
        projectId,
        phaseId: numberOrNull(formData.get("phaseId")),
        parentTaskId,
        title,
        description: trimmed(formData.get("description")),
        important: formData.get("important") !== null,
        urgent: formData.get("urgent") !== null,
        statusId,
        priorityId: numberOrNull(formData.get("priorityId")),
        assigneeId: numberOrNull(formData.get("assigneeId")),
        kanbanStageId:
          numberOrNull(formData.get("kanbanStageId")) ?? fallback.stageId,
        startDate,
        dueDate,
        progress: clampProgress(numberOrNull(formData.get("progress")) ?? 0),
        estimateHours: numberOrNull(formData.get("estimateHours")),
        notes: trimmed(formData.get("notes")),
        position: (max?.v ?? -1) + 1,
        completedAt: status?.isDone ? new Date().toISOString() : null,
      })
      .returning({ id: tasks.id })
      .get();

    logChanges([{ taskId: row.id, field: "creación", newValue: title }]);
    refreshUI();
    return ok({ id: row.id });
  });
}

export type TaskPatch = Partial<{
  title: string;
  description: string;
  projectId: number;
  phaseId: number | null;
  statusId: number | null;
  priorityId: number | null;
  assigneeId: number | null;
  kanbanStageId: number | null;
  startDate: string | null;
  dueDate: string | null;
  progress: number;
  important: boolean;
  urgent: boolean;
  estimateHours: number | null;
  notes: string;
}>;

/** Actualización parcial: la usa la edición inline de la tabla, el panel
 *  de detalle, el arrastre del Kanban y el del Gantt. Un solo camino. */
export async function updateTask(
  id: number,
  patch: TaskPatch,
): Promise<ActionResult<{ cascadedChildren?: number }>> {
  return guard(() => {
    const db = ensureDb();
    const before = db.select().from(tasks).where(eq(tasks.id, id)).get();
    if (!before) return fail("Esa tarea ya no existe.");

    const startDate =
      patch.startDate !== undefined ? patch.startDate : before.startDate;
    const dueDate = patch.dueDate !== undefined ? patch.dueDate : before.dueDate;
    const dateError = validateDates(startDate, dueDate);
    if (dateError) return fail(dateError);

    if (patch.progress !== undefined) {
      patch.progress = clampProgress(patch.progress);
    }

    // Cambiar de proyecto invalida la fase: las fases son del proyecto.
    if (patch.projectId !== undefined && patch.projectId !== before.projectId) {
      const phase = patch.phaseId !== undefined ? patch.phaseId : before.phaseId;
      if (phase != null) {
        const belongs = db
          .select()
          .from(phases)
          .where(and(eq(phases.id, phase), eq(phases.projectId, patch.projectId)))
          .get();
        if (!belongs) patch.phaseId = null;
      }
    }

    const nextStatus =
      patch.statusId !== undefined
        ? patch.statusId != null
          ? db.select().from(statuses).where(eq(statuses.id, patch.statusId)).get()
          : undefined
        : undefined;

    const values: Record<string, unknown> = {
      ...patch,
      updatedAt: new Date().toISOString(),
    };

    // Completar sella la fecha; descompletar la limpia, para que la tarea
    // vuelva a contar como pendiente sin rastros del cierre anterior.
    if (patch.statusId !== undefined) {
      values.completedAt = nextStatus?.isDone
        ? (before.completedAt ?? new Date().toISOString())
        : null;
      if (nextStatus?.isDone) values.progress = 100;
    }

    db.update(tasks).set(values).where(eq(tasks.id, id)).run();

    logChanges(
      (Object.keys(patch) as (keyof TaskPatch)[])
        .filter((key) => before[key as keyof Task] !== patch[key])
        .map((key) => ({
          taskId: id,
          field: FIELD_LABELS[key as keyof Task] ?? String(key),
          oldValue: before[key as keyof Task],
          newValue: patch[key],
        })),
    );

    refreshUI();
    return ok({});
  });
}

/** Cuántas subtareas quedarían pendientes al completar el padre. La UI
 *  lo pregunta antes de completar, en vez de decidir por su cuenta. */
export async function getPendingChildren(
  id: number,
): Promise<ActionResult<{ pending: number }>> {
  return guard(() => {
    const db = ensureDb();
    const doneIds = db
      .select({ id: statuses.id })
      .from(statuses)
      .where(eq(statuses.isDone, true))
      .all()
      .map((s) => s.id);

    const children = db
      .select()
      .from(tasks)
      .where(eq(tasks.parentTaskId, id))
      .all();
    const pending = children.filter(
      (c) => c.statusId == null || !doneIds.includes(c.statusId),
    ).length;
    return ok({ pending });
  });
}

/** Completa una tarea y, si se pide, todo su subárbol. */
export async function completeTask(
  id: number,
  statusId: number,
  cascade: boolean,
): Promise<ActionResult<{ completed: number }>> {
  return guard(() => {
    const db = ensureDb();
    const ids = cascade ? [id, ...subtreeIds(id)] : [id];
    const now = new Date().toISOString();
    db.update(tasks)
      .set({ statusId, progress: 100, completedAt: now, updatedAt: now })
      .where(inArray(tasks.id, ids))
      .run();
    logChanges(
      ids.map((taskId) => ({
        taskId,
        field: "estado",
        newValue: "completado",
      })),
    );
    refreshUI();
    return ok({ completed: ids.length });
  });
}

function subtreeIds(rootId: number): number[] {
  const db = ensureDb();
  const out: number[] = [];
  const seen = new Set([rootId]);
  let frontier = [rootId];
  while (frontier.length > 0) {
    const children = db
      .select({ id: tasks.id })
      .from(tasks)
      .where(inArray(tasks.parentTaskId, frontier))
      .all()
      .map((r) => r.id)
      .filter((cid) => !seen.has(cid));
    children.forEach((cid) => seen.add(cid));
    out.push(...children);
    frontier = children;
  }
  return out;
}

/* ────────────────────────────  Acciones masivas  ────────────────────── */

export async function bulkUpdate(
  ids: number[],
  patch: TaskPatch,
): Promise<ActionResult<{ updated: number }>> {
  return guard(() => {
    if (ids.length === 0) return ok({ updated: 0 });
    const db = ensureDb();
    const values: Record<string, unknown> = {
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    if (patch.statusId !== undefined) {
      const status =
        patch.statusId != null
          ? db.select().from(statuses).where(eq(statuses.id, patch.statusId)).get()
          : undefined;
      values.completedAt = status?.isDone ? new Date().toISOString() : null;
      if (status?.isDone) values.progress = 100;
    }
    db.update(tasks).set(values).where(inArray(tasks.id, ids)).run();
    logChanges(
      ids.flatMap((id) =>
        (Object.keys(patch) as (keyof TaskPatch)[]).map((key) => ({
          taskId: id,
          field: FIELD_LABELS[key as keyof Task] ?? String(key),
          newValue: patch[key],
        })),
      ),
    );
    refreshUI();
    return ok({ updated: ids.length });
  });
}

export async function deleteTasks(
  ids: number[],
): Promise<ActionResult<{ deleted: number }>> {
  return guard(() => {
    if (ids.length === 0) return ok({ deleted: 0 });
    const db = ensureDb();
    // El subárbol cae por la FK en cascada; se cuentan acá para poder
    // decirle al usuario cuántas desaparecieron de verdad.
    const all = new Set(ids);
    ids.forEach((id) => subtreeIds(id).forEach((child) => all.add(child)));
    db.delete(tasks).where(inArray(tasks.id, ids)).run();
    refreshUI();
    return ok({ deleted: all.size });
  });
}

/** Cuántas tareas caen (incluidas subtareas) si se borran estos ids. */
export async function getDeletionImpact(
  ids: number[],
): Promise<ActionResult<{ total: number; subtasks: number }>> {
  return guard(() => {
    const all = new Set(ids);
    let subtasks = 0;
    for (const id of ids) {
      for (const child of subtreeIds(id)) {
        if (!all.has(child)) {
          all.add(child);
          subtasks += 1;
        }
      }
    }
    return ok({ total: all.size, subtasks });
  });
}

/* ──────────────────────────────  Orden  ─────────────────────────────── */

/** Reordena tarjetas dentro de una etapa del Kanban y, si cambió, mueve
 *  la tarea de columna en el mismo paso. */
export async function moveTask(
  id: number,
  stageId: number | null,
  orderedIdsInStage: number[],
): Promise<ActionResult> {
  return guard(() => {
    const db = ensureDb();
    const before = db.select().from(tasks).where(eq(tasks.id, id)).get();
    if (!before) return fail("Esa tarea ya no existe.");

    db.transaction((tx) => {
      if (stageId !== before.kanbanStageId) {
        tx.update(tasks)
          .set({ kanbanStageId: stageId, updatedAt: new Date().toISOString() })
          .where(eq(tasks.id, id))
          .run();
      }
      orderedIdsInStage.forEach((taskId, index) => {
        tx.update(tasks).set({ position: index }).where(eq(tasks.id, taskId)).run();
      });
    });

    if (stageId !== before.kanbanStageId) {
      logChanges([
        {
          taskId: id,
          field: "etapa",
          oldValue: before.kanbanStageId,
          newValue: stageId,
        },
      ]);
    }
    refreshUI();
    return ok();
  });
}

/* ───────────────────────────  Dependencias  ─────────────────────────── */

export async function addDependency(
  predecessorId: number,
  successorId: number,
  type = "FS",
): Promise<ActionResult> {
  return guard(() => {
    const db = ensureDb();
    if (predecessorId === successorId) {
      return fail("Una tarea no puede depender de sí misma.");
    }
    const edges = db
      .select({
        predecessorId: taskDependencies.predecessorId,
        successorId: taskDependencies.successorId,
      })
      .from(taskDependencies)
      .all();

    const cycle = findCycle(edges, predecessorId, successorId);
    if (cycle) {
      const titles = db
        .select({ id: tasks.id, title: tasks.title })
        .from(tasks)
        .where(inArray(tasks.id, cycle))
        .all();
      const nameOf = (id: number) =>
        titles.find((t) => t.id === id)?.title ?? `#${id}`;
      return fail(
        "Esa dependencia crearía un círculo.",
        `El camino sería: ${cycle.map(nameOf).join(" → ")}`,
      );
    }

    const exists = db
      .select()
      .from(taskDependencies)
      .where(
        and(
          eq(taskDependencies.predecessorId, predecessorId),
          eq(taskDependencies.successorId, successorId),
        ),
      )
      .get();
    if (exists) return fail("Esa dependencia ya existe.");

    db.insert(taskDependencies)
      .values({ predecessorId, successorId, type })
      .run();
    logChanges([
      { taskId: successorId, field: "depende de", newValue: predecessorId },
    ]);
    refreshUI();
    return ok();
  });
}

export async function removeDependency(id: number): Promise<ActionResult> {
  return guard(() => {
    ensureDb().delete(taskDependencies).where(eq(taskDependencies.id, id)).run();
    refreshUI();
    return ok();
  });
}

/* ────────────────────────────  Comentarios  ─────────────────────────── */

export async function addComment(
  formData: FormData,
): Promise<ActionResult<{ id: number }>> {
  return guard(() => {
    const db = ensureDb();
    const taskId = numberOrNull(formData.get("taskId"));
    const body = trimmed(formData.get("body"));
    if (taskId == null) return fail("Falta la tarea.");
    if (!body) return fail("El comentario está vacío.");
    const row = db
      .insert(comments)
      .values({
        taskId,
        authorId: numberOrNull(formData.get("authorId")),
        body,
      })
      .returning({ id: comments.id })
      .get();
    refreshUI();
    return ok({ id: row.id });
  });
}

export async function deleteComment(id: number): Promise<ActionResult> {
  return guard(() => {
    ensureDb().delete(comments).where(eq(comments.id, id)).run();
    refreshUI();
    return ok();
  });
}

/* ──────────────────────────────  Conteos  ───────────────────────────── */

export async function countTasksInProject(
  projectId: number,
): Promise<ActionResult<{ total: number }>> {
  return guard(() => {
    const row = ensureDb()
      .select({ n: count() })
      .from(tasks)
      .where(eq(tasks.projectId, projectId))
      .get();
    return ok({ total: row?.n ?? 0 });
  });
}
