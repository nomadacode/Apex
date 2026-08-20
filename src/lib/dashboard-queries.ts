import { and, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import type { SQLiteColumn } from "drizzle-orm/sqlite-core";

import { ensureDb } from "@/db/bootstrap";
import { tasks } from "@/db/schema";
import type { Workspace } from "@/lib/task-queries";

/** KPIs por agregado SQL, no trayendo todas las filas a memoria: el
 *  Dashboard tiene que seguir siendo instantáneo con decenas de miles
 *  de tareas. */

export type Kpis = {
  total: number;
  done: number;
  pending: number;
  overdue: number;
  dueToday: number;
  dueSoon: number;
  cancelled: number;
  completion: number;
};

type Scope = { projectId?: number | null; from?: string | null; to?: string | null };

function scopeClauses(scope: Scope, workspace: Workspace) {
  const visible = workspace.projects.map((p) => p.id);
  const clauses = [];
  if (visible.length === 0) return [eq(tasks.id, -1)];
  if (scope.projectId != null) clauses.push(eq(tasks.projectId, scope.projectId));
  else clauses.push(inArray(tasks.projectId, visible));
  if (scope.from) clauses.push(sql`${tasks.dueDate} >= ${scope.from}`);
  if (scope.to) clauses.push(sql`${tasks.dueDate} <= ${scope.to}`);
  return clauses;
}

export function getKpis(
  scope: Scope,
  workspace: Workspace,
  today: string,
): Kpis {
  const db = ensureDb();
  const base = scopeClauses(scope, workspace);

  const doneIds = workspace.statuses.filter((s) => s.isDone).map((s) => s.id);
  const cancelledIds = workspace.statuses
    .filter((s) => s.isCancelled)
    .map((s) => s.id);

  const notCancelled =
    cancelledIds.length > 0
      ? [
          sql`(${tasks.statusId} is null or ${tasks.statusId} not in (${sql.join(
            cancelledIds.map((id) => sql`${id}`),
            sql`, `,
          )}))`,
        ]
      : [];

  const isDone =
    doneIds.length > 0
      ? sql`${tasks.statusId} in (${sql.join(
          doneIds.map((id) => sql`${id}`),
          sql`, `,
        )})`
      : sql`0`;

  const row = db
    .select({
      total: sql<number>`count(*)`,
      done: sql<number>`sum(case when ${isDone} then 1 else 0 end)`,
      overdue: sql<number>`sum(case when ${tasks.dueDate} is not null and ${tasks.dueDate} < ${today} and not ${isDone} then 1 else 0 end)`,
      dueToday: sql<number>`sum(case when ${tasks.dueDate} = ${today} and not ${isDone} then 1 else 0 end)`,
      dueSoon: sql<number>`sum(case when ${tasks.dueDate} > ${today} and ${tasks.dueDate} <= date(${today}, '+7 day') and not ${isDone} then 1 else 0 end)`,
    })
    .from(tasks)
    .where(and(...base, ...notCancelled))
    .get();

  const cancelledRow =
    cancelledIds.length > 0
      ? db
          .select({ n: sql<number>`count(*)` })
          .from(tasks)
          .where(and(...base, inArray(tasks.statusId, cancelledIds)))
          .get()
      : { n: 0 };

  const total = row?.total ?? 0;
  const done = row?.done ?? 0;

  return {
    total,
    done,
    pending: total - done,
    overdue: row?.overdue ?? 0,
    dueToday: row?.dueToday ?? 0,
    dueSoon: row?.dueSoon ?? 0,
    cancelled: cancelledRow?.n ?? 0,
    completion: total === 0 ? 0 : done / total,
  };
}

export type Breakdown = { id: number | null; label: string; color: string; count: number };

/** Conteos por estado, prioridad, etapa y responsable: un `GROUP BY` para
 *  cada corte, resueltos en la base y no recorriendo las tareas en memoria. */
export function getBreakdowns(scope: Scope, workspace: Workspace) {
  const db = ensureDb();
  const base = scopeClauses(scope, workspace);

  function countBy(column: SQLiteColumn) {
    return db
      .select({ key: column, n: sql<number>`count(*)` })
      .from(tasks)
      .where(and(...base))
      .groupBy(column)
      .all();
  }

  const byStatus = countBy(tasks.statusId);
  const byPriority = countBy(tasks.priorityId);
  const byStage = countBy(tasks.kanbanStageId);
  const byAssignee = countBy(tasks.assigneeId);

  const map = <T extends { id: number; name: string; color: string; emoji?: string }>(
    rows: { key: number | null; n: number }[],
    catalog: T[],
    emptyLabel: string,
  ): Breakdown[] => {
    const out: Breakdown[] = catalog.map((item) => ({
      id: item.id,
      label: `${item.emoji ?? ""} ${item.name}`.trim(),
      color: item.color,
      count: rows.find((r) => r.key === item.id)?.n ?? 0,
    }));
    const orphan = rows.find((r) => r.key === null);
    if (orphan && orphan.n > 0) {
      out.push({ id: null, label: emptyLabel, color: "#94a3b8", count: orphan.n });
    }
    return out;
  };

  return {
    byStatus: map(byStatus, workspace.statuses, "Sin estado"),
    byPriority: map(byPriority, workspace.priorities, "Sin prioridad"),
    byStage: map(byStage, workspace.stages, "Sin etapa"),
    byAssignee: map(byAssignee, workspace.people, "Sin responsable"),
  };
}

/** Tareas que vencen hoy y atrasadas, para las listas del Dashboard. */
export function getAttentionLists(
  scope: Scope,
  workspace: Workspace,
  today: string,
  limit = 12,
) {
  const db = ensureDb();
  const base = scopeClauses(scope, workspace);
  const doneIds = workspace.statuses.filter((s) => s.isDone).map((s) => s.id);
  const cancelledIds = workspace.statuses
    .filter((s) => s.isCancelled)
    .map((s) => s.id);
  const excluded = [...doneIds, ...cancelledIds];

  const alive =
    excluded.length > 0
      ? [
          sql`(${tasks.statusId} is null or ${tasks.statusId} not in (${sql.join(
            excluded.map((id) => sql`${id}`),
            sql`, `,
          )}))`,
        ]
      : [];

  return {
    dueToday: db
      .select()
      .from(tasks)
      .where(and(...base, ...alive, eq(tasks.dueDate, today)))
      .limit(limit)
      .all(),
    overdue: db
      .select()
      .from(tasks)
      .where(and(...base, ...alive, isNotNull(tasks.dueDate), lt(tasks.dueDate, today)))
      .orderBy(tasks.dueDate)
      .limit(limit)
      .all(),
  };
}

/** Resumen por proyecto para la tabla del Dashboard. */
export function getProjectSummaries(workspace: Workspace, today: string) {
  const db = ensureDb();
  const doneIds = workspace.statuses.filter((s) => s.isDone).map((s) => s.id);
  const cancelledIds = workspace.statuses
    .filter((s) => s.isCancelled)
    .map((s) => s.id);

  const isDone =
    doneIds.length > 0
      ? sql`${tasks.statusId} in (${sql.join(
          doneIds.map((id) => sql`${id}`),
          sql`, `,
        )})`
      : sql`0`;

  const rows = db
    .select({
      projectId: tasks.projectId,
      total: sql<number>`count(*)`,
      done: sql<number>`sum(case when ${isDone} then 1 else 0 end)`,
      overdue: sql<number>`sum(case when ${tasks.dueDate} is not null and ${tasks.dueDate} < ${today} and not ${isDone} then 1 else 0 end)`,
    })
    .from(tasks)
    .where(
      cancelledIds.length > 0
        ? sql`(${tasks.statusId} is null or ${tasks.statusId} not in (${sql.join(
            cancelledIds.map((id) => sql`${id}`),
            sql`, `,
          )}))`
        : undefined,
    )
    .groupBy(tasks.projectId)
    .all();

  return workspace.projects.map((project) => {
    const row = rows.find((r) => r.projectId === project.id);
    const total = row?.total ?? 0;
    const done = row?.done ?? 0;
    return {
      project,
      total,
      done,
      overdue: row?.overdue ?? 0,
      completion: total === 0 ? 0 : done / total,
    };
  });
}

export type ProjectSummary = ReturnType<typeof getProjectSummaries>[number];
