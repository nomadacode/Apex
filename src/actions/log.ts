import { ensureDb } from "@/db/bootstrap";
import { activityLog } from "@/db/schema";

type LogEntry = {
  taskId?: number | null;
  entity?: string;
  entityId?: number | null;
  field: string;
  oldValue?: unknown;
  newValue?: unknown;
};

function serialize(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "boolean") return value ? "sí" : "no";
  return String(value);
}

/** Único punto de escritura del historial. Toda mutación pasa por acá,
 *  así el panel de actividad de una tarea nunca queda con huecos. */
export function logChanges(entries: LogEntry[]) {
  const relevant = entries.filter(
    (e) => serialize(e.oldValue) !== serialize(e.newValue),
  );
  if (relevant.length === 0) return;
  const db = ensureDb();
  db.insert(activityLog)
    .values(
      relevant.map((e) => ({
        taskId: e.taskId ?? null,
        entity: e.entity ?? "task",
        entityId: e.entityId ?? null,
        field: e.field,
        oldValue: serialize(e.oldValue),
        newValue: serialize(e.newValue),
      })),
    )
    .run();
}

/** Diff de dos versiones de un registro, para no escribir el log a mano
 *  campo por campo en cada acción. */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>,
  labels: Partial<Record<keyof T, string>> = {},
): { field: string; oldValue: unknown; newValue: unknown }[] {
  const out: { field: string; oldValue: unknown; newValue: unknown }[] = [];
  for (const key of Object.keys(after) as (keyof T)[]) {
    if (after[key] === undefined) continue;
    if (before[key] === after[key]) continue;
    out.push({
      field: (labels[key] as string) ?? String(key),
      oldValue: before[key],
      newValue: after[key],
    });
  }
  return out;
}
