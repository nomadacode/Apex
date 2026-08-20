import type { TaskFilters } from "@/lib/task-queries";
import { isISODate } from "@/lib/dates";

export type RawSearchParams = Record<string, string | string[] | undefined>;

function one(params: RawSearchParams, key: string): string {
  const value = params[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function num(params: RawSearchParams, key: string): number | null {
  const raw = one(params, key);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Traduce los parámetros de la URL (en castellano, legibles) a los
 *  filtros que entienden las consultas. Un solo lugar para el mapeo. */
export function toFilters(params: RawSearchParams): TaskFilters {
  const responsable = one(params, "responsable");
  const desde = one(params, "desde");
  const hasta = one(params, "hasta");

  return {
    projectId: num(params, "proyecto"),
    phaseId: num(params, "fase"),
    assigneeId:
      responsable === "ninguno" ? "none" : num(params, "responsable"),
    statusId: num(params, "estado"),
    priorityId: num(params, "prioridad"),
    stageId: num(params, "etapa"),
    from: isISODate(desde) ? desde : null,
    to: isISODate(hasta) ? hasta : null,
    search: one(params, "q") || null,
  };
}

export const PARAM = {
  project: "proyecto",
  phase: "fase",
  assignee: "responsable",
  status: "estado",
  priority: "prioridad",
  stage: "etapa",
  from: "desde",
  to: "hasta",
  search: "q",
  group: "agrupar",
  sort: "orden",
  task: "tarea",
  view: "vista",
  month: "mes",
  year: "anio",
  scale: "escala",
} as const;
