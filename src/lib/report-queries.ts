import { and, desc, eq, inArray, isNotNull } from "drizzle-orm";

import { ensureDb } from "@/db/bootstrap";
import { activityLog, tasks } from "@/db/schema";
import {
  agingBuckets,
  personStats,
  punctuality,
  stageTimes,
  weeklyFlow,
  type AnalyticsEvent,
  type AnalyticsTask,
} from "@/lib/analytics";
import { addDays, startOfWeek, type ISODate } from "@/lib/dates";
import type { StatusLike } from "@/lib/derive";
import type { Workspace } from "@/lib/task-queries";

/** Arma el paquete completo de analítica para la pantalla de Reportes.
 *
 *  Las tareas se traen una sola vez y todos los cálculos se hacen en
 *  memoria sobre ese conjunto: son funciones puras y ya están testeadas.
 *  El historial se acota a los cambios de etapa y estado, que es lo único
 *  que las métricas de tiempo consultan. */
export function getReportData({
  workspace,
  today,
  projectId,
  weeks = 12,
}: {
  workspace: Workspace;
  today: ISODate;
  projectId?: number | null;
  weeks?: number;
}) {
  const db = ensureDb();

  const visibleProjects = workspace.projects.map((p) => p.id);
  const scoped =
    projectId != null && visibleProjects.includes(projectId)
      ? [projectId]
      : visibleProjects;

  const rows: AnalyticsTask[] =
    scoped.length === 0
      ? []
      : db
          .select()
          .from(tasks)
          .where(inArray(tasks.projectId, scoped))
          .all();

  const taskIds = new Set(rows.map((r) => r.id));
  const events: AnalyticsEvent[] =
    taskIds.size === 0
      ? []
      : db
          .select({
            taskId: activityLog.taskId,
            field: activityLog.field,
            oldValue: activityLog.oldValue,
            newValue: activityLog.newValue,
            at: activityLog.at,
          })
          .from(activityLog)
          .where(
            and(
              isNotNull(activityLog.taskId),
              inArray(activityLog.field, ["etapa", "estado"]),
            ),
          )
          .orderBy(activityLog.at)
          .all()
          .filter((e) => e.taskId != null && taskIds.has(e.taskId));

  const statusMap = new Map<number, StatusLike>(
    workspace.statuses.map((s) => [s.id, s]),
  );

  const now = new Date().toISOString();
  const weekStarts = lastWeeks(today, weeks, workspace.settings.weekStart);

  return {
    tasks: rows,
    events,
    punctuality: punctuality(rows, statusMap, today),
    people: personStats(rows, events, statusMap, today),
    stages: stageTimes(rows, events, now, statusMap),
    aging: agingBuckets(rows, statusMap, today),
    flow: weeklyFlow(rows, statusMap, weekStarts),
    weekStarts,
  };
}

export type ReportData = ReturnType<typeof getReportData>;

function lastWeeks(
  today: ISODate,
  count: number,
  weekStart: "monday" | "sunday",
): ISODate[] {
  const current = startOfWeek(today, weekStart);
  return Array.from({ length: count }, (_, i) =>
    addDays(current, -(count - 1 - i) * 7),
  );
}

/** Últimos cambios registrados, para el panel de actividad reciente. */
export function getRecentActivity(limit = 25) {
  const db = ensureDb();
  return db
    .select({
      id: activityLog.id,
      taskId: activityLog.taskId,
      field: activityLog.field,
      oldValue: activityLog.oldValue,
      newValue: activityLog.newValue,
      at: activityLog.at,
      title: tasks.title,
      projectId: tasks.projectId,
    })
    .from(activityLog)
    .innerJoin(tasks, eq(tasks.id, activityLog.taskId))
    .orderBy(desc(activityLog.at), desc(activityLog.id))
    .limit(limit)
    .all();
}
