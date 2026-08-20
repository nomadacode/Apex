import { db } from "./index";
import {
  kanbanStages,
  priorities,
  settings,
  statuses,
} from "./schema";
import { SETTING_DEFAULTS } from "../lib/settings";

/** Catálogos por defecto: lo mínimo para que la app sirva desde el primer
 *  arranque. Todos editables desde Configuración. */

const DEFAULT_STATUSES = [
  { name: "No iniciado", emoji: "💤", color: "#94a3b8", isDone: false, isCancelled: false },
  { name: "Pendiente", emoji: "📋", color: "#f59e0b", isDone: false, isCancelled: false },
  { name: "En progreso", emoji: "🚀", color: "#3b82f6", isDone: false, isCancelled: false },
  { name: "En espera", emoji: "⏸️", color: "#a855f7", isDone: false, isCancelled: false },
  { name: "Atrasado", emoji: "⚠️", color: "#ef4444", isDone: false, isCancelled: false },
  { name: "Completado", emoji: "✅", color: "#22c55e", isDone: true, isCancelled: false },
  { name: "Cancelado", emoji: "🚫", color: "#6b7280", isDone: false, isCancelled: true },
];

const DEFAULT_STAGES = [
  { name: "Ideas", emoji: "💡", color: "#a855f7" },
  { name: "Backlog", emoji: "📝", color: "#94a3b8" },
  { name: "Pendiente", emoji: "⏳", color: "#f59e0b" },
  { name: "En progreso", emoji: "🚀", color: "#3b82f6" },
  { name: "En espera", emoji: "⏸️", color: "#8b5cf6" },
  { name: "Completado", emoji: "✅", color: "#22c55e" },
  { name: "Cancelado", emoji: "❌", color: "#6b7280" },
];

const DEFAULT_PRIORITIES = [
  { name: "Muy Alta", emoji: "🔴", color: "#f2b8b5", weight: 5 },
  { name: "Alta", emoji: "🟠", color: "#f9d8c0", weight: 4 },
  { name: "Media", emoji: "🟡", color: "#f9e1ab", weight: 3 },
  { name: "Baja", emoji: "🟢", color: "#d6e5bd", weight: 2 },
  { name: "Muy Baja", emoji: "🔵", color: "#a3ceef", weight: 1 },
];

/** Idempotente: solo inserta lo que falta, nunca pisa lo que el usuario editó. */
export function seed() {
  const existingStatuses = db.select().from(statuses).all();
  if (existingStatuses.length === 0) {
    db.insert(statuses)
      .values(DEFAULT_STATUSES.map((s, i) => ({ ...s, position: i })))
      .run();
  }

  const existingStages = db.select().from(kanbanStages).all();
  if (existingStages.length === 0) {
    db.insert(kanbanStages)
      .values(
        DEFAULT_STAGES.map((s, i) => ({ ...s, position: i, wipLimit: null })),
      )
      .run();
  }

  const existingPriorities = db.select().from(priorities).all();
  if (existingPriorities.length === 0) {
    db.insert(priorities)
      .values(DEFAULT_PRIORITIES.map((p, i) => ({ ...p, position: i })))
      .run();
  }

  const existingSettings = new Set(
    db
      .select()
      .from(settings)
      .all()
      .map((s) => s.key),
  );
  const missing = Object.entries(SETTING_DEFAULTS)
    .filter(([key]) => !existingSettings.has(key))
    .map(([key, value]) => ({ key, value }));
  if (missing.length > 0) db.insert(settings).values(missing).run();
}

if (process.argv[1]?.endsWith("seed.ts")) {
  seed();
  console.log("Catálogos por defecto listos.");
}
