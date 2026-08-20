"use client";

import { useState } from "react";
import {
  Archive,
  ArchiveRestore,
  GripVertical,
  Layers,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";

import {
  deleteProject,
  getProjectDeletionImpact,
  reorder,
  saveProject,
  setProjectArchived,
} from "@/actions/config";
import { PhasesDialog } from "@/components/config/phases-dialog";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import { SortableList } from "@/components/ui/sortable-list";
import { formatDate } from "@/lib/dates";
import type { Person, Phase, Project } from "@/db/schema";
import { useAction } from "@/lib/use-action";

export function ProjectsSection({
  projects,
  people,
  phases,
}: {
  projects: Project[];
  people: Person[];
  phases: Phase[];
}) {
  const { run, pending } = useAction();
  const [editing, setEditing] = useState<Project | null | "new">(null);
  const [managingPhases, setManagingPhases] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState<{
    project: Project;
    tasks: number;
    phases: number;
  } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = projects.filter((p) => showArchived || !p.archived);
  const current = editing === "new" ? null : editing;
  const archivedCount = projects.filter((p) => p.archived).length;

  return (
    <section className="rounded-lg border border-border bg-surface">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-medium">Proyectos</h2>
          <p className="text-sm text-muted">
            Sin tope de cantidad. El código (P1, P2, …) se asigna solo.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {archivedCount > 0 ? (
            <Button size="sm" onClick={() => setShowArchived((v) => !v)}>
              {showArchived
                ? "Ocultar archivados"
                : `Ver archivados (${archivedCount})`}
            </Button>
          ) : null}
          <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-3.5" /> Nuevo proyecto
          </Button>
        </div>
      </header>

      {visible.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted">
          Todavía no hay proyectos. Creá el primero para poder cargar tareas.
        </p>
      ) : (
        <SortableList
          items={visible.map((p) => p.id)}
          onReorder={(ids) => run(() => reorder("projects", ids))}
          renderItem={(id, handleProps) => {
            const project = visible.find((p) => p.id === id)!;
            const leader = people.find((p) => p.id === project.leaderId);
            return (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2.5">
                <span
                  {...handleProps}
                  className="cursor-grab text-muted active:cursor-grabbing"
                  aria-label="Reordenar"
                >
                  <GripVertical className="size-4" />
                </span>
                <span
                  className="size-3 shrink-0 rounded-full"
                  style={{ background: project.color }}
                />
                <span className="shrink-0 font-mono text-xs text-muted">
                  {project.code}
                </span>
                <div className="min-w-0 flex-1 basis-40">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {project.name}
                    </span>
                    {project.archived ? (
                      <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">
                        archivado
                      </span>
                    ) : null}
                  </div>
                  <p className="truncate text-xs text-muted">
                    {[
                      project.client,
                      leader ? `líder: ${leader.name}` : null,
                      project.startDate && project.endDate
                        ? `${formatDate(project.startDate)} → ${formatDate(project.endDate)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Sin datos adicionales"}
                  </p>
                </div>
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    title="Gestionar las fases de este proyecto"
                    onClick={() => setManagingPhases(project)}
                  >
                    <Layers className="size-3.5" />
                    {phases.filter((p) => p.projectId === project.id).length ||
                      0}
                    <span className="hidden sm:inline">fases</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={project.archived ? "Desarchivar" : "Archivar"}
                    title={
                      project.archived
                        ? "Volver a mostrar en todas las vistas"
                        : "Sacar de las vistas sin perder los datos"
                    }
                    onClick={() =>
                      run(
                        () => setProjectArchived(project.id, !project.archived),
                        {
                          success: project.archived
                            ? "Desarchivado."
                            : "Archivado.",
                        },
                      )
                    }
                  >
                    {project.archived ? (
                      <ArchiveRestore className="size-3.5" />
                    ) : (
                      <Archive className="size-3.5" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Editar"
                    onClick={() => setEditing(project)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Borrar"
                    onClick={() =>
                      run(() => getProjectDeletionImpact(project.id), {
                        onSuccess: (impact) =>
                          setDeleting({ project, ...impact }),
                      })
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              </div>
            );
          }}
        />
      )}

      <Dialog
        open={editing !== null}
        onClose={() => {
          setEditing(null);
          setError(null);
        }}
        title={current ? `Editar ${current.name}` : "Nuevo proyecto"}
      >
        <form
          action={(formData) =>
            run(() => saveProject(formData), {
              success: "Proyecto guardado.",
              onSuccess: () => {
                setEditing(null);
                setError(null);
              },
              onError: (r) => setError(r.error),
            })
          }
          className="flex flex-col gap-4"
        >
          {current ? (
            <input type="hidden" name="id" value={current.id} />
          ) : null}
          <Field label="Nombre">
            <Input
              name="name"
              defaultValue={current?.name ?? ""}
              required
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Cliente">
              <Input name="client" defaultValue={current?.client ?? ""} />
            </Field>
            <Field label="Líder del proyecto">
              <Select name="leaderId" defaultValue={current?.leaderId ?? ""}>
                <option value="">Sin asignar</option>
                {people.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-[1fr_1fr_5rem] gap-3">
            <Field label="Fecha de inicio">
              <Input
                type="date"
                name="startDate"
                defaultValue={current?.startDate ?? ""}
              />
            </Field>
            <Field label="Fecha final">
              <Input
                type="date"
                name="endDate"
                defaultValue={current?.endDate ?? ""}
              />
            </Field>
            <Field label="Color">
              <Input
                type="color"
                name="color"
                defaultValue={current?.color ?? "#6366f1"}
                className="h-9 p-1"
              />
            </Field>
          </div>
          {error ? <p className="text-sm text-danger">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              Guardar
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title={`Borrar "${deleting?.project.name}"`}
        description={
          <>
            <p>
              Se borran también{" "}
              <strong>
                {deleting?.tasks ?? 0} tarea(s) y {deleting?.phases ?? 0}{" "}
                fase(s)
              </strong>
              . No se puede deshacer.
            </p>
            <p className="mt-2">
              Si solo querés sacarlo de las vistas, archivalo en lugar de
              borrarlo: conserva todos los datos.
            </p>
          </>
        }
        pending={pending}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          run(() => deleteProject(deleting!.project.id), {
            success: "Proyecto borrado.",
            onSuccess: () => setDeleting(null),
          })
        }
      />

      <PhasesDialog
        project={managingPhases}
        phases={phases}
        onClose={() => setManagingPhases(null)}
      />
    </section>
  );
}
