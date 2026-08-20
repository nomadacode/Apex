"use client";

import { useState } from "react";
import { ListTodo, Plus } from "lucide-react";

import {
  bulkUpdate,
  completeTask,
  deleteTasks,
  getDeletionImpact,
  getPendingChildren,
  updateTask,
  type TaskPatch,
} from "@/actions/tasks";
import { FiltersBar } from "@/components/tasks/filters-bar";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import { TaskListMobile } from "@/components/tasks/task-list-mobile";
import { TaskTable, type GroupBy } from "@/components/tasks/task-table";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Dialog } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/field";
import type { Task } from "@/db/schema";
import { PARAM } from "@/lib/search-params";
import type { TaskDetail, Workspace } from "@/lib/task-queries";
import { useAction } from "@/lib/use-action";
import { FILTER_KEYS, useFilters } from "@/lib/use-filters";

export function TasksScreen({
  tasks,
  allTasks,
  detail,
  workspace,
  today,
}: {
  tasks: Task[];
  /** Todas las tareas visibles, sin filtrar: el selector de dependencias
   *  tiene que poder apuntar a una tarea que el filtro esconde. */
  allTasks: Task[];
  detail: TaskDetail | null;
  workspace: Workspace;
  today: string;
}) {
  const { run, pending } = useAction();
  const { get, set, clear, activeCount } = useFilters();
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [creating, setCreating] = useState<{ parent: Task | null } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{
    ids: number[];
    total: number;
    subtasks: number;
  } | null>(null);
  const [confirmComplete, setConfirmComplete] = useState<{
    task: Task;
    statusId: number;
    pendingChildren: number;
  } | null>(null);

  const groupBy = (get(PARAM.group) || "project") as GroupBy;
  const openId = get(PARAM.task);

  function patch(id: number, next: TaskPatch) {
    run(() => updateTask(id, next));
  }

  function toggleSelect(id: number, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  const hasProjects = workspace.projects.length > 0;
  const selectedIds = [...selected];

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col gap-3 p-4 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <FiltersBar
            workspace={workspace}
            show={["search", "project", "phase", "assignee", "status", "priority"]}
            extra={
              <Select
                value={groupBy}
                onChange={(e) => set({ [PARAM.group]: e.target.value })}
                className="w-auto"
                aria-label="Agrupar por"
              >
                <option value="project">Agrupar por proyecto</option>
                <option value="phase">Agrupar por fase</option>
                <option value="assignee">Agrupar por responsable</option>
                <option value="status">Agrupar por estado</option>
                <option value="none">Sin agrupar</option>
              </Select>
            }
          />
          <Button
            variant="primary"
            onClick={() => setCreating({ parent: null })}
            disabled={!hasProjects}
            title={hasProjects ? undefined : "Primero creá un proyecto"}
          >
            <Plus className="size-4" /> Nueva tarea
          </Button>
        </div>

        {selectedIds.length > 0 ? (
          <BulkBar
            count={selectedIds.length}
            workspace={workspace}
            pending={pending}
            onClear={() => setSelected(new Set())}
            onApply={(patchValues) =>
              run(() => bulkUpdate(selectedIds, patchValues), {
                success: `${selectedIds.length} tarea(s) actualizadas.`,
                onSuccess: () => setSelected(new Set()),
              })
            }
            onDelete={() =>
              run(() => getDeletionImpact(selectedIds), {
                onSuccess: (impact) =>
                  setConfirmDelete({ ids: selectedIds, ...impact }),
              })
            }
          />
        ) : null}

        {!hasProjects ? (
          <EmptyState
            icon={<ListTodo className="size-8" />}
            title="Todavía no hay proyectos"
            description="Toda tarea vive dentro de un proyecto. Creá el primero y volvé acá para empezar a cargar trabajo."
            action={{ label: "Ir a Configuración", href: "/configuracion?tab=proyectos" }}
          />
        ) : tasks.length === 0 ? (
          <EmptyState
            icon={<ListTodo className="size-8" />}
            title={
              activeCount > 0
                ? "Ningún resultado con estos filtros"
                : "Todavía no hay tareas"
            }
            description={
              activeCount > 0
                ? "Los filtros activos no dejan pasar ninguna tarea. Probá quitando alguno."
                : "Cargá la primera tarea: el resto de las vistas se arma sola a partir de acá."
            }
            action={
              activeCount > 0 ? (
                <Button onClick={() => clear(FILTER_KEYS)}>Limpiar filtros</Button>
              ) : (
                <Button variant="primary" onClick={() => setCreating({ parent: null })}>
                  <Plus className="size-4" /> Nueva tarea
                </Button>
              )
            }
          />
        ) : (
          <>
            {/* En celular, tarjetas; de tablet para arriba, la tabla densa
                con edición en línea. */}
            <div className="min-h-0 flex-1 overflow-y-auto lg:hidden">
              <TaskListMobile
                tasks={tasks}
                workspace={workspace}
                today={today}
                selected={selected}
                onToggleSelect={toggleSelect}
                onOpen={(id) => set({ [PARAM.task]: id })}
              />
            </div>

            <div className="hidden min-h-0 min-w-0 flex-1 lg:flex">
              <TaskTable
                tasks={tasks}
                workspace={workspace}
                today={today}
                groupBy={groupBy}
                selected={selected}
                activeTaskId={openId ? Number(openId) : null}
                onToggleSelect={toggleSelect}
                onToggleSelectAll={(checked) =>
                  setSelected(
                    checked ? new Set(tasks.map((t) => t.id)) : new Set(),
                  )
                }
                onPatch={patch}
                onOpen={(id) => set({ [PARAM.task]: id })}
                onRequestComplete={(task, statusId) =>
                  run(() => getPendingChildren(task.id), {
                    onSuccess: ({ pending: pendingChildren }) => {
                      if (pendingChildren === 0) {
                        patch(task.id, { statusId });
                        return;
                      }
                      setConfirmComplete({ task, statusId, pendingChildren });
                    },
                  })
                }
              />
            </div>
          </>
        )}

        <p className="shrink-0 text-xs text-muted">
          {tasks.length} tarea(s) visibles
          {activeCount > 0 ? " con los filtros actuales" : ""}.
        </p>
      </div>

      <TaskDetailPanel
        detail={openId ? detail : null}
        workspace={workspace}
        today={today}
        allTasks={allTasks}
        onClose={() => set({ [PARAM.task]: null })}
        onOpen={(id) => set({ [PARAM.task]: id })}
        onCreateSubtask={(parent) => setCreating({ parent })}
      />

      <NewTaskDialog
        open={creating !== null}
        workspace={workspace}
        parent={creating?.parent}
        defaultProjectId={Number(get(PARAM.project)) || null}
        onClose={() => setCreating(null)}
        onCreated={(id) => set({ [PARAM.task]: id })}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        title={`Borrar ${confirmDelete?.total ?? 0} tarea(s)`}
        description={
          confirmDelete?.subtasks
            ? `Se borran ${confirmDelete.ids.length} tarea(s) seleccionadas y ${confirmDelete.subtasks} subtarea(s) que cuelgan de ellas. No se puede deshacer.`
            : "Esta acción no se puede deshacer."
        }
        pending={pending}
        onClose={() => setConfirmDelete(null)}
        onConfirm={() =>
          run(() => deleteTasks(confirmDelete!.ids), {
            success: "Tareas borradas.",
            onSuccess: () => {
              setConfirmDelete(null);
              setSelected(new Set());
              set({ [PARAM.task]: null });
            },
          })
        }
      />

      {/* Tres salidas posibles, así que no alcanza el confirm genérico:
          completar en cascada, completar solo el padre, o no hacer nada. */}
      <Dialog
        open={confirmComplete !== null}
        onClose={() => setConfirmComplete(null)}
        title="Tiene subtareas pendientes"
        width="sm"
      >
        <p className="text-sm">
          &quot;{confirmComplete?.task.title}&quot; tiene{" "}
          <strong>{confirmComplete?.pendingChildren} subtarea(s)</strong> sin
          completar.
        </p>
        <p className="mt-2 text-sm text-muted">
          Podés completarla junto con todas sus subtareas, o completar solo esta
          y dejar las subtareas como están.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button onClick={() => setConfirmComplete(null)}>Cancelar</Button>
          <Button
            disabled={pending}
            onClick={() => {
              patch(confirmComplete!.task.id, {
                statusId: confirmComplete!.statusId,
              });
              setConfirmComplete(null);
            }}
          >
            Solo esta tarea
          </Button>
          <Button
            variant="primary"
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  completeTask(
                    confirmComplete!.task.id,
                    confirmComplete!.statusId,
                    true,
                  ),
                {
                  success: "Completadas.",
                  onSuccess: () => setConfirmComplete(null),
                },
              )
            }
          >
            Completar todo
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

function BulkBar({
  count,
  workspace,
  pending,
  onClear,
  onApply,
  onDelete,
}: {
  count: number;
  workspace: Workspace;
  pending: boolean;
  onClear: () => void;
  onApply: (patch: TaskPatch) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-accent/40 bg-accent/5 px-3 py-2">
      <span className="text-sm font-medium">{count} seleccionada(s)</span>

      <Select
        value=""
        className="w-auto"
        aria-label="Cambiar estado"
        onChange={(e) =>
          e.target.value && onApply({ statusId: Number(e.target.value) })
        }
      >
        <option value="">Cambiar estado…</option>
        {workspace.statuses.map((s) => (
          <option key={s.id} value={s.id}>
            {s.emoji} {s.name}
          </option>
        ))}
      </Select>

      <Select
        value=""
        className="w-auto"
        aria-label="Reasignar"
        onChange={(e) =>
          e.target.value &&
          onApply({
            assigneeId: e.target.value === "none" ? null : Number(e.target.value),
          })
        }
      >
        <option value="">Reasignar a…</option>
        <option value="none">Sin responsable</option>
        {workspace.people
          .filter((p) => p.active)
          .map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
      </Select>

      <Select
        value=""
        className="w-auto"
        aria-label="Mover de etapa"
        onChange={(e) =>
          e.target.value && onApply({ kanbanStageId: Number(e.target.value) })
        }
      >
        <option value="">Mover a etapa…</option>
        {workspace.stages.map((s) => (
          <option key={s.id} value={s.id}>
            {s.emoji} {s.name}
          </option>
        ))}
      </Select>

      <Select
        value=""
        className="w-auto"
        aria-label="Cambiar prioridad"
        onChange={(e) =>
          e.target.value && onApply({ priorityId: Number(e.target.value) })
        }
      >
        <option value="">Cambiar prioridad…</option>
        {workspace.priorities.map((p) => (
          <option key={p.id} value={p.id}>
            {p.emoji} {p.name}
          </option>
        ))}
      </Select>

      <Button variant="danger" size="sm" onClick={onDelete} disabled={pending}>
        Borrar
      </Button>
      <Button variant="ghost" size="sm" onClick={onClear}>
        Quitar selección
      </Button>
    </div>
  );
}
