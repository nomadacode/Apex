"use client";

import { useState } from "react";

import { createTask } from "@/actions/tasks";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import type { Task } from "@/db/schema";
import { today } from "@/lib/dates";
import type { Workspace } from "@/lib/task-queries";
import { useAction } from "@/lib/use-action";

export function NewTaskDialog({
  open,
  workspace,
  parent,
  defaultProjectId,
  onClose,
  onCreated,
}: {
  open: boolean;
  workspace: Workspace;
  /** Si viene, la tarea nueva es subtarea de esta. */
  parent?: Task | null;
  defaultProjectId?: number | null;
  onClose: () => void;
  onCreated: (id: number) => void;
}) {
  const { run, pending } = useAction();
  const [error, setError] = useState<string | null>(null);
  const [projectId, setProjectId] = useState<number | "">(
    parent?.projectId ?? defaultProjectId ?? workspace.projects[0]?.id ?? "",
  );

  const phases = workspace.phases.filter((p) => p.projectId === projectId);

  if (workspace.projects.length === 0) {
    return (
      <Dialog
        open={open}
        onClose={onClose}
        title="Primero hace falta un proyecto"
        width="sm"
      >
        <p className="text-sm text-muted">
          Toda tarea pertenece a un proyecto. Creá uno en Configuración y volvé
          acá.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={onClose}>Cerrar</Button>
          <a href="/configuracion?tab=proyectos">
            <Button variant="primary">Ir a Configuración</Button>
          </a>
        </div>
      </Dialog>
    );
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={parent ? `Nueva subtarea de "${parent.title}"` : "Nueva tarea"}
      width="lg"
    >
      <form
        action={(formData) =>
          run(() => createTask(formData), {
            success: "Tarea creada.",
            onSuccess: (data) => {
              setError(null);
              onCreated(data.id);
              onClose();
            },
            onError: (r) => setError(r.error),
          })
        }
        className="flex flex-col gap-4"
      >
        {parent ? (
          <input type="hidden" name="parentTaskId" value={parent.id} />
        ) : null}

        <Field label="Nombre de la tarea">
          <Input name="title" required autoFocus placeholder="Qué hay que hacer" />
        </Field>

        <Field label="Descripción">
          <Textarea name="description" rows={2} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Proyecto">
            <Select
              name="projectId"
              value={projectId}
              onChange={(e) => setProjectId(Number(e.target.value))}
              disabled={Boolean(parent)}
              required
            >
              {workspace.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} · {p.name}
                </option>
              ))}
            </Select>
            {parent ? (
              <input type="hidden" name="projectId" value={parent.projectId} />
            ) : null}
          </Field>
          <Field label="Fase">
            <Select name="phaseId" defaultValue={parent?.phaseId ?? ""}>
              <option value="">Sin fase</option>
              {phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Estado">
            <Select name="statusId" defaultValue={workspace.statuses[0]?.id ?? ""}>
              {workspace.statuses.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.emoji} {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Prioridad">
            <Select name="priorityId" defaultValue="">
              <option value="">Sin prioridad</option>
              {workspace.priorities.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.emoji} {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Etapa Kanban">
            <Select name="kanbanStageId" defaultValue={workspace.stages[0]?.id ?? ""}>
              {workspace.stages.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.emoji} {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="Responsable">
            <Select name="assigneeId" defaultValue="">
              <option value="">Sin asignar</option>
              {workspace.people
                .filter((p) => p.active)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </Select>
          </Field>
          <Field label="Fecha de inicio">
            <Input type="date" name="startDate" defaultValue={today()} />
          </Field>
          <Field label="Fecha límite">
            <Input type="date" name="dueDate" />
          </Field>
        </div>

        <div className="flex gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" name="important" defaultChecked={parent?.important} />
            Importante
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" name="urgent" defaultChecked={parent?.urgent} />
            Urgente
          </label>
          <span className="text-xs text-muted">
            Definen en qué cuadrante de la matriz cae.
          </span>
        </div>

        {error ? <p className="text-sm text-danger">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={pending}>
            Crear tarea
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
