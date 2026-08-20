import { ensureDb } from "@/db/bootstrap";
import {
  kanbanStages,
  people,
  priorities,
  projects,
  settings,
  statuses,
} from "@/db/schema";
import { toSettings, type WorkspaceSettings } from "@/lib/settings";
import { asc } from "drizzle-orm";

/** Lecturas de catálogos que casi toda pantalla necesita. Son tablas
 *  chicas: se traen enteras y se cachean por request de Next. */

export function getSettings(): WorkspaceSettings {
  const db = ensureDb();
  return toSettings(db.select().from(settings).all());
}

export function getPeople() {
  const db = ensureDb();
  return db.select().from(people).orderBy(asc(people.position), asc(people.id)).all();
}

export function getStatuses() {
  const db = ensureDb();
  return db
    .select()
    .from(statuses)
    .orderBy(asc(statuses.position), asc(statuses.id))
    .all();
}

export function getKanbanStages() {
  const db = ensureDb();
  return db
    .select()
    .from(kanbanStages)
    .orderBy(asc(kanbanStages.position), asc(kanbanStages.id))
    .all();
}

export function getPriorities() {
  const db = ensureDb();
  return db
    .select()
    .from(priorities)
    .orderBy(asc(priorities.position), asc(priorities.id))
    .all();
}

export function getProjects({ includeArchived = false } = {}) {
  const db = ensureDb();
  const rows = db
    .select()
    .from(projects)
    .orderBy(asc(projects.position), asc(projects.id))
    .all();
  return includeArchived ? rows : rows.filter((p) => !p.archived);
}
