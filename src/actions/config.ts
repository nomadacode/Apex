"use server";

import { and, count, eq, ne, sql } from "drizzle-orm";

import { ensureDb } from "@/db/bootstrap";
import {
  holidays,
  kanbanStages,
  people,
  phases,
  priorities,
  projects,
  settings,
  statuses,
  tasks,
} from "@/db/schema";
import { logChanges } from "@/actions/log";
import { fail, guard, ok, refreshUI, type ActionResult } from "@/actions/result";
import { isISODate } from "@/lib/dates";
import { SETTING_KEYS } from "@/lib/settings";

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

/* ─────────────────────────────  Personas  ───────────────────────────── */

export async function savePerson(
  formData: FormData,
): Promise<ActionResult<{ id: number }>> {
  return guard(() => {
    const db = ensureDb();
    const id = numberOrNull(formData.get("id"));
    const name = trimmed(formData.get("name"));
    if (!name) return fail("La persona necesita un nombre.");

    const values = {
      name,
      role: trimmed(formData.get("role")),
      color: trimmed(formData.get("color")) || "#94a3b8",
      active: formData.get("active") !== null,
    };

    if (id == null) {
      const max = db
        .select({ v: sql<number>`coalesce(max(${people.position}), -1)` })
        .from(people)
        .get();
      const row = db
        .insert(people)
        .values({ ...values, position: (max?.v ?? -1) + 1 })
        .returning({ id: people.id })
        .get();
      logChanges([
        {
          entity: "person",
          entityId: row.id,
          field: "creación",
          newValue: name,
        },
      ]);
      refreshUI();
      return ok({ id: row.id });
    }

    const before = db.select().from(people).where(eq(people.id, id)).get();
    if (!before) return fail("Esa persona ya no existe.");
    db.update(people).set(values).where(eq(people.id, id)).run();
    logChanges(
      (["name", "role", "active"] as const)
        .filter((k) => before[k] !== values[k])
        .map((k) => ({
          entity: "person",
          entityId: id,
          field: k === "name" ? "nombre" : k === "role" ? "rol" : "activo",
          oldValue: before[k],
          newValue: values[k],
        })),
    );
    refreshUI();
    return ok({ id });
  });
}

export async function deletePerson(id: number): Promise<ActionResult> {
  return guard(() => {
    const db = ensureDb();
    const assigned = db
      .select({ n: count() })
      .from(tasks)
      .where(eq(tasks.assigneeId, id))
      .get();
    if ((assigned?.n ?? 0) > 0) {
      return fail(
        `No se puede borrar: tiene ${assigned!.n} tarea(s) asignada(s).`,
        "Reasignalas primero, o desactivá la persona para sacarla de las listas sin perder el historial.",
      );
    }
    const leading = db
      .select({ n: count() })
      .from(projects)
      .where(eq(projects.leaderId, id))
      .get();
    if ((leading?.n ?? 0) > 0) {
      return fail(
        `No se puede borrar: lidera ${leading!.n} proyecto(s).`,
        "Cambiá el líder de esos proyectos primero.",
      );
    }
    db.delete(people).where(eq(people.id, id)).run();
    refreshUI();
    return ok();
  });
}

/** Reasigna todas las tareas de una persona a otra (o a nadie). */
export async function reassignTasks(
  fromId: number,
  toId: number | null,
): Promise<ActionResult<{ moved: number }>> {
  return guard(() => {
    const db = ensureDb();
    const affected = db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.assigneeId, fromId))
      .all();
    db.update(tasks)
      .set({ assigneeId: toId })
      .where(eq(tasks.assigneeId, fromId))
      .run();
    logChanges(
      affected.map((t) => ({
        taskId: t.id,
        field: "responsable",
        oldValue: fromId,
        newValue: toId,
      })),
    );
    refreshUI();
    return ok({ moved: affected.length });
  });
}

/* ─────────────────────────────  Proyectos  ──────────────────────────── */

export async function saveProject(
  formData: FormData,
): Promise<ActionResult<{ id: number }>> {
  return guard(() => {
    const db = ensureDb();
    const id = numberOrNull(formData.get("id"));
    const name = trimmed(formData.get("name"));
    if (!name) return fail("El proyecto necesita un nombre.");

    const startDate = dateOrNull(formData.get("startDate"));
    const endDate = dateOrNull(formData.get("endDate"));
    if (startDate && endDate && startDate > endDate) {
      return fail("La fecha final no puede ser anterior a la de inicio.");
    }

    const values = {
      name,
      client: trimmed(formData.get("client")),
      leaderId: numberOrNull(formData.get("leaderId")),
      startDate,
      endDate,
      color: trimmed(formData.get("color")) || "#6366f1",
    };

    if (id == null) {
      // El código se autoincrementa sin tope: P1, P2, … P1000, …
      const max = db
        .select({ v: sql<number>`coalesce(max(${projects.position}), -1)` })
        .from(projects)
        .get();
      const position = (max?.v ?? -1) + 1;
      const code = nextProjectCode(db);
      const row = db
        .insert(projects)
        .values({ ...values, code, position, archived: false })
        .returning({ id: projects.id })
        .get();
      logChanges([
        {
          entity: "project",
          entityId: row.id,
          field: "creación",
          newValue: name,
        },
      ]);
      refreshUI();
      return ok({ id: row.id });
    }

    const before = db.select().from(projects).where(eq(projects.id, id)).get();
    if (!before) return fail("Ese proyecto ya no existe.");
    db.update(projects).set(values).where(eq(projects.id, id)).run();
    logChanges(
      (["name", "client", "startDate", "endDate"] as const)
        .filter((k) => before[k] !== values[k])
        .map((k) => ({
          entity: "project",
          entityId: id,
          field: k,
          oldValue: before[k],
          newValue: values[k],
        })),
    );
    refreshUI();
    return ok({ id });
  });
}

function nextProjectCode(db: ReturnType<typeof ensureDb>): string {
  const codes = db.select({ code: projects.code }).from(projects).all();
  let max = 0;
  for (const { code } of codes) {
    const m = /^P(\d+)$/.exec(code);
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `P${max + 1}`;
}

export async function setProjectArchived(
  id: number,
  archived: boolean,
): Promise<ActionResult> {
  return guard(() => {
    const db = ensureDb();
    db.update(projects).set({ archived }).where(eq(projects.id, id)).run();
    logChanges([
      {
        entity: "project",
        entityId: id,
        field: "archivado",
        oldValue: !archived,
        newValue: archived,
      },
    ]);
    refreshUI();
    return ok();
  });
}

/** Cuenta lo que se perdería al borrar, para que la confirmación diga
 *  el número real en vez de un "¿estás seguro?" a ciegas. */
export async function getProjectDeletionImpact(
  id: number,
): Promise<ActionResult<{ tasks: number; phases: number }>> {
  return guard(() => {
    const db = ensureDb();
    const t = db
      .select({ n: count() })
      .from(tasks)
      .where(eq(tasks.projectId, id))
      .get();
    const p = db
      .select({ n: count() })
      .from(phases)
      .where(eq(phases.projectId, id))
      .get();
    return ok({ tasks: t?.n ?? 0, phases: p?.n ?? 0 });
  });
}

export async function deleteProject(id: number): Promise<ActionResult> {
  return guard(() => {
    const db = ensureDb();
    db.delete(projects).where(eq(projects.id, id)).run();
    refreshUI();
    return ok();
  });
}

/* ──────────────────────────────  Estados  ───────────────────────────── */

export async function saveStatus(
  formData: FormData,
): Promise<ActionResult<{ id: number }>> {
  return guard(() => {
    const db = ensureDb();
    const id = numberOrNull(formData.get("id"));
    const name = trimmed(formData.get("name"));
    if (!name) return fail("El estado necesita un nombre.");

    const isDone = formData.get("isDone") !== null;
    const isCancelled = formData.get("isCancelled") !== null;
    if (isDone && isCancelled) {
      return fail("Un estado no puede ser terminal y cancelado a la vez.");
    }

    const values = {
      name,
      emoji: trimmed(formData.get("emoji")),
      color: trimmed(formData.get("color")) || "#94a3b8",
      isDone,
      isCancelled,
    };

    if (id != null) {
      const before = db.select().from(statuses).where(eq(statuses.id, id)).get();
      if (!before) return fail("Ese estado ya no existe.");
      // Siempre tiene que quedar al menos un estado terminal: sin él,
      // nada podría contarse como completado y todos los KPIs mienten.
      if (before.isDone && !isDone) {
        const others = db
          .select({ n: count() })
          .from(statuses)
          .where(and(eq(statuses.isDone, true), ne(statuses.id, id)))
          .get();
        if ((others?.n ?? 0) === 0) {
          return fail(
            "Tiene que haber al menos un estado que marque tareas como completadas.",
            "Marcá otro estado como terminal antes de quitarle esta marca a este.",
          );
        }
      }
      db.update(statuses).set(values).where(eq(statuses.id, id)).run();
      refreshUI();
      return ok({ id });
    }

    const max = db
      .select({ v: sql<number>`coalesce(max(${statuses.position}), -1)` })
      .from(statuses)
      .get();
    const row = db
      .insert(statuses)
      .values({ ...values, position: (max?.v ?? -1) + 1 })
      .returning({ id: statuses.id })
      .get();
    refreshUI();
    return ok({ id: row.id });
  });
}

export async function deleteStatus(id: number): Promise<ActionResult> {
  return guard(() => {
    const db = ensureDb();
    const status = db.select().from(statuses).where(eq(statuses.id, id)).get();
    if (!status) return ok();

    const inUse = db
      .select({ n: count() })
      .from(tasks)
      .where(eq(tasks.statusId, id))
      .get();
    if ((inUse?.n ?? 0) > 0) {
      return fail(
        `No se puede borrar: ${inUse!.n} tarea(s) usan este estado.`,
        "Migrá esas tareas a otro estado primero.",
      );
    }
    if (status.isDone) {
      const others = db
        .select({ n: count() })
        .from(statuses)
        .where(and(eq(statuses.isDone, true), ne(statuses.id, id)))
        .get();
      if ((others?.n ?? 0) === 0) {
        return fail(
          "Es el único estado que marca tareas como completadas.",
          "Creá o marcá otro estado terminal antes de borrar este.",
        );
      }
    }
    db.delete(statuses).where(eq(statuses.id, id)).run();
    refreshUI();
    return ok();
  });
}

/** Mueve todas las tareas de un estado a otro. La salida que ofrece el
 *  bloqueo de borrado. */
export async function migrateStatus(
  fromId: number,
  toId: number,
): Promise<ActionResult<{ moved: number }>> {
  return guard(() => {
    const db = ensureDb();
    const affected = db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.statusId, fromId))
      .all();
    const target = db.select().from(statuses).where(eq(statuses.id, toId)).get();
    if (!target) return fail("El estado de destino ya no existe.");

    db.update(tasks)
      .set({
        statusId: toId,
        completedAt: target.isDone ? sql`datetime('now')` : null,
      })
      .where(eq(tasks.statusId, fromId))
      .run();
    logChanges(
      affected.map((t) => ({
        taskId: t.id,
        field: "estado",
        oldValue: fromId,
        newValue: toId,
      })),
    );
    refreshUI();
    return ok({ moved: affected.length });
  });
}

/* ───────────────────────────  Etapas Kanban  ────────────────────────── */

export async function saveStage(
  formData: FormData,
): Promise<ActionResult<{ id: number }>> {
  return guard(() => {
    const db = ensureDb();
    const id = numberOrNull(formData.get("id"));
    const name = trimmed(formData.get("name"));
    if (!name) return fail("La etapa necesita un nombre.");

    const wipLimit = numberOrNull(formData.get("wipLimit"));
    if (wipLimit != null && wipLimit < 1) {
      return fail("El límite de trabajo en curso tiene que ser 1 o más.");
    }

    const values = {
      name,
      emoji: trimmed(formData.get("emoji")),
      color: trimmed(formData.get("color")) || "#94a3b8",
      wipLimit,
    };

    if (id != null) {
      db.update(kanbanStages).set(values).where(eq(kanbanStages.id, id)).run();
      refreshUI();
      return ok({ id });
    }
    const max = db
      .select({ v: sql<number>`coalesce(max(${kanbanStages.position}), -1)` })
      .from(kanbanStages)
      .get();
    const row = db
      .insert(kanbanStages)
      .values({ ...values, position: (max?.v ?? -1) + 1 })
      .returning({ id: kanbanStages.id })
      .get();
    refreshUI();
    return ok({ id: row.id });
  });
}

export async function deleteStage(id: number): Promise<ActionResult> {
  return guard(() => {
    const db = ensureDb();
    const total = db.select({ n: count() }).from(kanbanStages).get();
    if ((total?.n ?? 0) <= 1) {
      return fail(
        "Tiene que quedar al menos una etapa: el tablero necesita una columna.",
      );
    }
    const inUse = db
      .select({ n: count() })
      .from(tasks)
      .where(eq(tasks.kanbanStageId, id))
      .get();
    if ((inUse?.n ?? 0) > 0) {
      return fail(
        `No se puede borrar: ${inUse!.n} tarea(s) están en esta etapa.`,
        "Movelas a otra etapa primero.",
      );
    }
    db.delete(kanbanStages).where(eq(kanbanStages.id, id)).run();
    refreshUI();
    return ok();
  });
}

export async function migrateStage(
  fromId: number,
  toId: number,
): Promise<ActionResult<{ moved: number }>> {
  return guard(() => {
    const db = ensureDb();
    const affected = db
      .select({ id: tasks.id })
      .from(tasks)
      .where(eq(tasks.kanbanStageId, fromId))
      .all();
    db.update(tasks)
      .set({ kanbanStageId: toId })
      .where(eq(tasks.kanbanStageId, fromId))
      .run();
    logChanges(
      affected.map((t) => ({
        taskId: t.id,
        field: "etapa",
        oldValue: fromId,
        newValue: toId,
      })),
    );
    refreshUI();
    return ok({ moved: affected.length });
  });
}

/* ────────────────────────────  Prioridades  ─────────────────────────── */

export async function savePriority(
  formData: FormData,
): Promise<ActionResult<{ id: number }>> {
  return guard(() => {
    const db = ensureDb();
    const id = numberOrNull(formData.get("id"));
    const name = trimmed(formData.get("name"));
    if (!name) return fail("La prioridad necesita un nombre.");

    const weight = numberOrNull(formData.get("weight")) ?? 3;
    const values = {
      name,
      emoji: trimmed(formData.get("emoji")),
      color: trimmed(formData.get("color")) || "#94a3b8",
      weight: Math.min(5, Math.max(1, Math.round(weight))),
    };

    if (id != null) {
      db.update(priorities).set(values).where(eq(priorities.id, id)).run();
      refreshUI();
      return ok({ id });
    }
    const max = db
      .select({ v: sql<number>`coalesce(max(${priorities.position}), -1)` })
      .from(priorities)
      .get();
    const row = db
      .insert(priorities)
      .values({ ...values, position: (max?.v ?? -1) + 1 })
      .returning({ id: priorities.id })
      .get();
    refreshUI();
    return ok({ id: row.id });
  });
}

export async function deletePriority(id: number): Promise<ActionResult> {
  return guard(() => {
    const db = ensureDb();
    const inUse = db
      .select({ n: count() })
      .from(tasks)
      .where(eq(tasks.priorityId, id))
      .get();
    if ((inUse?.n ?? 0) > 0) {
      return fail(
        `No se puede borrar: ${inUse!.n} tarea(s) usan esta prioridad.`,
        "Cambiá la prioridad de esas tareas primero.",
      );
    }
    db.delete(priorities).where(eq(priorities.id, id)).run();
    refreshUI();
    return ok();
  });
}

/* ─────────────────────  Reordenar catálogos (drag)  ─────────────────── */

const REORDERABLE = {
  people,
  statuses,
  kanbanStages,
  priorities,
  projects,
} as const;

export async function reorder(
  table: keyof typeof REORDERABLE,
  orderedIds: number[],
): Promise<ActionResult> {
  return guard(() => {
    const db = ensureDb();
    const target = REORDERABLE[table];
    if (!target) return fail("Lista desconocida.");
    db.transaction((tx) => {
      orderedIds.forEach((id, index) => {
        tx.update(target)
          .set({ position: index })
          .where(eq(target.id, id))
          .run();
      });
    });
    refreshUI();
    return ok();
  });
}

/* ─────────────────────────  Festivos y ajustes  ─────────────────────── */

export async function saveHoliday(
  formData: FormData,
): Promise<ActionResult<{ id: number }>> {
  return guard(() => {
    const db = ensureDb();
    const date = dateOrNull(formData.get("date"));
    if (!date) return fail("Poné una fecha válida.");
    const description = trimmed(formData.get("description"));

    const existing = db
      .select()
      .from(holidays)
      .where(eq(holidays.date, date))
      .get();
    if (existing) {
      db.update(holidays)
        .set({ description })
        .where(eq(holidays.id, existing.id))
        .run();
      refreshUI();
      return ok({ id: existing.id });
    }
    const row = db
      .insert(holidays)
      .values({ date, description })
      .returning({ id: holidays.id })
      .get();
    refreshUI();
    return ok({ id: row.id });
  });
}

export async function deleteHoliday(id: number): Promise<ActionResult> {
  return guard(() => {
    ensureDb().delete(holidays).where(eq(holidays.id, id)).run();
    refreshUI();
    return ok();
  });
}

export async function saveSettings(
  formData: FormData,
): Promise<ActionResult> {
  return guard(() => {
    const db = ensureDb();
    const workdays = Array.from({ length: 7 }, (_, i) =>
      formData.get(`workday-${i}`) !== null ? "1" : "0",
    ).join("");
    const weekStart =
      trimmed(formData.get("weekStart")) === "sunday" ? "sunday" : "monday";
    const workspaceName = trimmed(formData.get("workspaceName")) || "Apex";

    const entries: [string, string][] = [
      [SETTING_KEYS.workdays, workdays],
      [SETTING_KEYS.weekStart, weekStart],
      [SETTING_KEYS.workspaceName, workspaceName],
    ];
    db.transaction((tx) => {
      for (const [key, value] of entries) {
        tx.insert(settings)
          .values({ key, value })
          .onConflictDoUpdate({ target: settings.key, set: { value } })
          .run();
      }
    });
    refreshUI();
    return ok();
  });
}

/* ──────────────────────────────  Fases  ─────────────────────────────── */

export async function savePhase(
  formData: FormData,
): Promise<ActionResult<{ id: number }>> {
  return guard(() => {
    const db = ensureDb();
    const id = numberOrNull(formData.get("id"));
    const projectId = numberOrNull(formData.get("projectId"));
    const name = trimmed(formData.get("name"));
    if (!name) return fail("La fase necesita un nombre.");
    if (id == null && projectId == null) {
      return fail("La fase tiene que pertenecer a un proyecto.");
    }
    const description = trimmed(formData.get("description"));

    if (id != null) {
      db.update(phases).set({ name, description }).where(eq(phases.id, id)).run();
      refreshUI();
      return ok({ id });
    }
    const max = db
      .select({ v: sql<number>`coalesce(max(${phases.position}), -1)` })
      .from(phases)
      .where(eq(phases.projectId, projectId!))
      .get();
    const row = db
      .insert(phases)
      .values({
        projectId: projectId!,
        name,
        description,
        position: (max?.v ?? -1) + 1,
      })
      .returning({ id: phases.id })
      .get();
    refreshUI();
    return ok({ id: row.id });
  });
}

/** Borrar una fase no borra sus tareas: quedan sin fase (el schema hace
 *  `set null`). Se devuelve cuántas quedaron sueltas para poder avisarlo. */
export async function deletePhase(
  id: number,
): Promise<ActionResult<{ orphanedTasks: number }>> {
  return guard(() => {
    const db = ensureDb();
    const inUse = db
      .select({ n: count() })
      .from(tasks)
      .where(eq(tasks.phaseId, id))
      .get();
    db.delete(phases).where(eq(phases.id, id)).run();
    refreshUI();
    return ok({ orphanedTasks: inUse?.n ?? 0 });
  });
}

export async function reorderPhases(
  orderedIds: number[],
): Promise<ActionResult> {
  return guard(() => {
    const db = ensureDb();
    db.transaction((tx) => {
      orderedIds.forEach((id, index) => {
        tx.update(phases).set({ position: index }).where(eq(phases.id, id)).run();
      });
    });
    refreshUI();
    return ok();
  });
}
