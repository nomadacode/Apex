"use client";

import {
  deletePriority,
  deleteStage,
  deleteStatus,
  migrateStage,
  migrateStatus,
  reorder,
  savePriority,
  saveStage,
  saveStatus,
} from "@/actions/config";
import { CalendarSection } from "@/components/config/calendar-section";
import { CatalogSection, type CatalogItem } from "@/components/config/catalog-section";
import { ExportSection } from "@/components/config/export-section";
import { PeopleSection } from "@/components/config/people-section";
import { ProjectsSection } from "@/components/config/projects-section";
import { Tabs } from "@/components/ui/tabs";
import type {
  Holiday,
  KanbanStage,
  Person,
  Phase,
  Priority,
  Project,
  Status,
} from "@/db/schema";
import type { WorkspaceSettings } from "@/lib/settings";

export function ConfigScreen({
  projects,
  people,
  phases,
  statuses,
  stages,
  priorities,
  holidays,
  settings,
  counts,
}: {
  projects: Project[];
  people: Person[];
  phases: Phase[];
  statuses: Status[];
  stages: KanbanStage[];
  priorities: Priority[];
  holidays: Holiday[];
  settings: WorkspaceSettings;
  counts: { projects: number; tasks: number };
}) {
  const statusItems: CatalogItem[] = statuses.map((s) => ({
    id: s.id,
    name: s.name,
    emoji: s.emoji,
    color: s.color,
    badge: s.isDone ? "completa" : s.isCancelled ? "cancela" : undefined,
  }));

  const stageItems: CatalogItem[] = stages.map((s) => ({
    id: s.id,
    name: s.name,
    emoji: s.emoji,
    color: s.color,
    badge: s.wipLimit ? `máx ${s.wipLimit}` : undefined,
  }));

  const priorityItems: CatalogItem[] = priorities.map((p) => ({
    id: p.id,
    name: p.name,
    emoji: p.emoji,
    color: p.color,
    badge: `peso ${p.weight}`,
  }));

  return (
    <Tabs
      tabs={[
        { id: "proyectos", label: "Proyectos" },
        { id: "personas", label: "Responsables" },
        { id: "estados", label: "Estados y etapas" },
        { id: "prioridades", label: "Prioridades" },
        { id: "calendario", label: "Calendario laboral" },
        { id: "datos", label: "Datos" },
      ]}
    >
      {(active) => (
        <>
          {active === "proyectos" ? (
            <ProjectsSection projects={projects} people={people} phases={phases} />
          ) : null}

          {active === "personas" ? <PeopleSection people={people} /> : null}

          {active === "estados" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <CatalogSection
                title="Estados"
                description="Cómo se sigue el avance de una tarea. Al menos uno tiene que marcar la tarea como completada."
                items={statusItems}
                extras={[
                  {
                    name: "isDone",
                    label: "Marca la tarea como completada",
                    type: "checkbox",
                    hint: "Las tareas en este estado cuentan en el % completado y dejan de figurar como atrasadas.",
                    value: (item) =>
                      statuses.find((s) => s.id === item?.id)?.isDone ?? false,
                  },
                  {
                    name: "isCancelled",
                    label: "Marca la tarea como cancelada",
                    type: "checkbox",
                    hint: "Las canceladas quedan fuera de los porcentajes: no se hicieron ni se van a hacer.",
                    value: (item) =>
                      statuses.find((s) => s.id === item?.id)?.isCancelled ?? false,
                  },
                ]}
                onSave={saveStatus}
                onDelete={deleteStatus}
                onReorder={(ids) => reorder("statuses", ids)}
                migration={{
                  label: "Mover esas tareas al estado",
                  onMigrate: migrateStatus,
                }}
              />

              <CatalogSection
                title="Etapas del Kanban"
                description="Las columnas del tablero, de izquierda a derecha."
                items={stageItems}
                extras={[
                  {
                    name: "wipLimit",
                    label: "Límite de tarjetas",
                    type: "number",
                    hint: "Opcional. La columna avisa cuando se pasa de este número.",
                    value: (item) =>
                      String(
                        stages.find((s) => s.id === item?.id)?.wipLimit ?? "",
                      ),
                  },
                ]}
                onSave={saveStage}
                onDelete={deleteStage}
                onReorder={(ids) => reorder("kanbanStages", ids)}
                migration={{
                  label: "Mover esas tareas a la etapa",
                  onMigrate: migrateStage,
                }}
              />
            </div>
          ) : null}

          {active === "prioridades" ? (
            <div className="max-w-2xl">
              <CatalogSection
                title="Prioridades"
                description="El peso ordena las tareas de más a menos importante en todas las vistas."
                items={priorityItems}
                extras={[
                  {
                    name: "weight",
                    label: "Peso (1 a 5)",
                    type: "number",
                    hint: "5 es la prioridad más alta.",
                    value: (item) =>
                      String(
                        priorities.find((p) => p.id === item?.id)?.weight ?? 3,
                      ),
                  },
                ]}
                onSave={savePriority}
                onDelete={deletePriority}
                onReorder={(ids) => reorder("priorities", ids)}
              />
            </div>
          ) : null}

          {active === "calendario" ? (
            <CalendarSection settings={settings} holidays={holidays} />
          ) : null}

          {active === "datos" ? (
            <div className="max-w-2xl">
              <ExportSection counts={counts} />
            </div>
          ) : null}
        </>
      )}
    </Tabs>
  );
}
