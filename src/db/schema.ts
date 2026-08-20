import { sql } from "drizzle-orm";
import {
  type AnySQLiteColumn,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

/* ─────────────────────────────  Catálogos  ─────────────────────────────
 * Estados, etapas, prioridades y personas no están escritos en el código:
 * son tablas propias, editables desde Configuración sin tocar el esquema.
 * -------------------------------------------------------------------- */

export const people = sqliteTable("people", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  role: text("role").notNull().default(""),
  color: text("color").notNull().default("#94a3b8"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  position: integer("position").notNull().default(0),
});

/** `isDone` reemplaza al hardcodeo de "Completado" que tenía el Excel:
 *  el estado terminal es un flag, no un nombre literal. */
export const statuses = sqliteTable("statuses", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default(""),
  color: text("color").notNull().default("#94a3b8"),
  isDone: integer("is_done", { mode: "boolean" }).notNull().default(false),
  isCancelled: integer("is_cancelled", { mode: "boolean" })
    .notNull()
    .default(false),
  position: integer("position").notNull().default(0),
});

export const kanbanStages = sqliteTable("kanban_stages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default(""),
  color: text("color").notNull().default("#94a3b8"),
  wipLimit: integer("wip_limit"),
  position: integer("position").notNull().default(0),
});

export const priorities = sqliteTable("priorities", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  emoji: text("emoji").notNull().default(""),
  color: text("color").notNull().default("#94a3b8"),
  /** 5 = Muy Alta … 1 = Muy Baja */
  weight: integer("weight").notNull().default(3),
  position: integer("position").notNull().default(0),
});

/** Fechas en formato ISO `YYYY-MM-DD` (sin hora, sin zona horaria: el
 *  planificador razona en días de calendario, no en instantes). */
export const holidays = sqliteTable(
  "holidays",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    date: text("date").notNull(),
    description: text("description").notNull().default(""),
  },
  (t) => [unique("holidays_date_unq").on(t.date)],
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/* ─────────────────────────────  Núcleo  ───────────────────────────── */

export const projects = sqliteTable(
  "projects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    /** P1, P2, … sin tope: lo calcula `nextProjectCode` mirando el máximo. */
    code: text("code").notNull(),
    name: text("name").notNull(),
    client: text("client").notNull().default(""),
    leaderId: integer("leader_id").references(() => people.id, {
      onDelete: "set null",
    }),
    startDate: text("start_date"),
    endDate: text("end_date"),
    color: text("color").notNull().default("#6366f1"),
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    position: integer("position").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [unique("projects_code_unq").on(t.code)],
);

/** En el Excel la fase era texto libre repetido en cada fila; acá es una
 *  entidad con orden propio y descripción única. */
export const phases = sqliteTable(
  "phases",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    position: integer("position").notNull().default(0),
  },
  (t) => [index("phases_project_idx").on(t.projectId)],
);

export const tasks = sqliteTable(
  "tasks",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    phaseId: integer("phase_id").references(() => phases.id, {
      onDelete: "set null",
    }),
    /** Subtareas de N niveles. Borrar el padre borra el subárbol. */
    parentTaskId: integer("parent_task_id").references(
      (): AnySQLiteColumn => tasks.id,
      { onDelete: "cascade" },
    ),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    important: integer("important", { mode: "boolean" })
      .notNull()
      .default(false),
    urgent: integer("urgent", { mode: "boolean" }).notNull().default(false),
    statusId: integer("status_id").references(() => statuses.id, {
      onDelete: "set null",
    }),
    priorityId: integer("priority_id").references(() => priorities.id, {
      onDelete: "set null",
    }),
    assigneeId: integer("assignee_id").references(() => people.id, {
      onDelete: "set null",
    }),
    kanbanStageId: integer("kanban_stage_id").references(
      () => kanbanStages.id,
      { onDelete: "set null" },
    ),
    startDate: text("start_date"),
    dueDate: text("due_date"),
    /** 0-100. Solo lectura cuando la tarea tiene subtareas (rollup). */
    progress: integer("progress").notNull().default(0),
    estimateHours: integer("estimate_hours"),
    notes: text("notes").notNull().default(""),
    position: integer("position").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    completedAt: text("completed_at"),
  },
  (t) => [
    index("tasks_project_idx").on(t.projectId),
    index("tasks_phase_idx").on(t.phaseId),
    index("tasks_parent_idx").on(t.parentTaskId),
    index("tasks_assignee_idx").on(t.assigneeId),
    index("tasks_status_idx").on(t.statusId),
    index("tasks_stage_idx").on(t.kanbanStageId),
    index("tasks_due_idx").on(t.dueDate),
    index("tasks_start_idx").on(t.startDate),
  ],
);

/** FS = fin→inicio, SS = inicio→inicio, FF = fin→fin, SF = inicio→fin. */
export const taskDependencies = sqliteTable(
  "task_dependencies",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    predecessorId: integer("predecessor_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    successorId: integer("successor_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("FS"),
  },
  (t) => [
    unique("task_dep_unq").on(t.predecessorId, t.successorId),
    index("task_dep_pred_idx").on(t.predecessorId),
    index("task_dep_succ_idx").on(t.successorId),
  ],
);

export const comments = sqliteTable(
  "comments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    authorId: integer("author_id").references(() => people.id, {
      onDelete: "set null",
    }),
    body: text("body").notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("comments_task_idx").on(t.taskId)],
);

export const attachments = sqliteTable(
  "attachments",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** Ruta relativa dentro de `data/uploads/`. */
    path: text("path").notNull(),
    mime: text("mime").notNull().default(""),
    size: integer("size").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("attachments_task_idx").on(t.taskId)],
);

export const activityLog = sqliteTable(
  "activity_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    taskId: integer("task_id").references(() => tasks.id, {
      onDelete: "cascade",
    }),
    entity: text("entity").notNull().default("task"),
    entityId: integer("entity_id"),
    field: text("field").notNull(),
    oldValue: text("old_value"),
    newValue: text("new_value"),
    at: text("at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (t) => [index("activity_task_idx").on(t.taskId)],
);

export const tags = sqliteTable(
  "tags",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    color: text("color").notNull().default("#94a3b8"),
  },
  (t) => [unique("tags_name_unq").on(t.name)],
);

export const taskTags = sqliteTable(
  "task_tags",
  {
    taskId: integer("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.taskId, t.tagId] }),
    index("task_tags_tag_idx").on(t.tagId),
  ],
);

export type Person = typeof people.$inferSelect;
export type Status = typeof statuses.$inferSelect;
export type KanbanStage = typeof kanbanStages.$inferSelect;
export type Priority = typeof priorities.$inferSelect;
export type Holiday = typeof holidays.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Phase = typeof phases.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type TaskDependency = typeof taskDependencies.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Attachment = typeof attachments.$inferSelect;
export type ActivityEntry = typeof activityLog.$inferSelect;
export type Tag = typeof tags.$inferSelect;
