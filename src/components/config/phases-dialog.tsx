"use client";

import { useState } from "react";
import { GripVertical, Pencil, Plus, Trash2, X } from "lucide-react";

import { deletePhase, reorderPhases, savePhase } from "@/actions/config";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/field";
import { SortableList } from "@/components/ui/sortable-list";
import type { Phase, Project } from "@/db/schema";
import { useAction } from "@/lib/use-action";

/** Las fases agrupan las tareas dentro de un proyecto. Son entidades con
 *  orden propio y no texto libre repetido en cada tarea: renombrar una fase
 *  no obliga a corregir fila por fila. */
export function PhasesDialog({
  project,
  phases,
  onClose,
}: {
  project: Project | null;
  phases: Phase[];
  onClose: () => void;
}) {
  const { run, pending } = useAction();
  const [editing, setEditing] = useState<Phase | "new" | null>(null);

  const list = phases
    .filter((p) => p.projectId === project?.id)
    .sort((a, b) => a.position - b.position || a.id - b.id);

  const current = editing === "new" ? null : editing;

  return (
    <Dialog
      open={project !== null}
      onClose={onClose}
      title={`Fases de ${project?.name ?? ""}`}
      description="Agrupan las tareas dentro del proyecto y ordenan las filas del Gantt."
    >
      {list.length === 0 && editing === null ? (
        <p className="py-6 text-center text-sm text-muted">
          Este proyecto todavía no tiene fases. Las tareas pueden existir sin
          fase, pero agruparlas ayuda a leer el Gantt.
        </p>
      ) : null}

      {list.length > 0 ? (
        <div className="rounded-md border border-border">
          <SortableList
            items={list.map((p) => p.id)}
            onReorder={(ids) => run(() => reorderPhases(ids))}
            renderItem={(id, handleProps) => {
              const phase = list.find((p) => p.id === id)!;
              return (
                <div className="flex items-center gap-2 px-3 py-2">
                  <span
                    {...handleProps}
                    className="cursor-grab text-muted active:cursor-grabbing"
                    aria-label="Reordenar"
                  >
                    <GripVertical className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{phase.name}</p>
                    {phase.description ? (
                      <p className="truncate text-xs text-muted">
                        {phase.description}
                      </p>
                    ) : null}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Editar"
                    onClick={() => setEditing(phase)}
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Borrar"
                    onClick={() =>
                      run(() => deletePhase(phase.id), {
                        onSuccess: (data) =>
                          toastOrphans(data.orphanedTasks),
                      })
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              );
            }}
          />
        </div>
      ) : null}

      {editing !== null ? (
        <form
          action={(formData) =>
            run(() => savePhase(formData), {
              success: "Fase guardada.",
              onSuccess: () => setEditing(null),
            })
          }
          className="mt-3 flex flex-col gap-3 rounded-md border border-border p-3"
        >
          <input type="hidden" name="projectId" value={project?.id ?? ""} />
          {current ? <input type="hidden" name="id" value={current.id} /> : null}
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">
              {current ? "Editar fase" : "Nueva fase"}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Cancelar"
              onClick={() => setEditing(null)}
            >
              <X className="size-3.5" />
            </Button>
          </div>
          <Input
            name="name"
            placeholder="Nombre de la fase"
            defaultValue={current?.name ?? ""}
            required
            autoFocus
          />
          <Textarea
            name="description"
            placeholder="Descripción (opcional)"
            defaultValue={current?.description ?? ""}
            rows={2}
          />
          <div className="flex justify-end">
            <Button type="submit" variant="primary" size="sm" disabled={pending}>
              Guardar
            </Button>
          </div>
        </form>
      ) : (
        <div className="mt-3 flex justify-between">
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="size-3.5" /> Agregar fase
          </Button>
          <Button size="sm" onClick={onClose}>
            Listo
          </Button>
        </div>
      )}
    </Dialog>
  );
}

async function toastOrphans(orphaned: number) {
  const { toast } = await import("sonner");
  if (orphaned > 0) {
    toast.success("Fase borrada.", {
      description: `${orphaned} tarea(s) quedaron sin fase. Podés reasignarlas desde Tareas.`,
    });
  } else {
    toast.success("Fase borrada.");
  }
}
