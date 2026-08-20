"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { AlertTriangle, Plus, SquareKanban } from "lucide-react";
import { toast } from "sonner";

import { moveTask } from "@/actions/tasks";
import { FiltersBar } from "@/components/tasks/filters-bar";
import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import { TaskCard } from "@/components/tasks/task-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/field";
import type { Task } from "@/db/schema";
import { cn } from "@/lib/cn";
import { PARAM } from "@/lib/search-params";
import type { Workspace } from "@/lib/task-queries";
import { useAction } from "@/lib/use-action";
import { FILTER_KEYS, useFilters } from "@/lib/use-filters";

type SortMode = "manual" | "priority" | "due" | "assignee";

export function KanbanBoard({
  tasks,
  workspace,
  today,
}: {
  tasks: Task[];
  workspace: Workspace;
  today: string;
}) {
  const { run } = useAction();
  const { get, set, clear, activeCount } = useFilters();
  const [creating, setCreating] = useState(false);
  const [dragging, setDragging] = useState<Task | null>(null);
  /** Copia local para que la tarjeta se mueva al instante y recién
   *  después se confirme contra la base. Si falla, se descarta. */
  const [optimistic, setOptimistic] = useState<Task[] | null>(null);

  const sortMode = (get(PARAM.sort) || "manual") as SortMode;
  const board = optimistic ?? tasks;

  const childCount = useMemo(() => {
    const map = new Map<number, number>();
    for (const task of tasks) {
      if (task.parentTaskId == null) continue;
      map.set(task.parentTaskId, (map.get(task.parentTaskId) ?? 0) + 1);
    }
    return map;
  }, [tasks]);

  const columns = useMemo(() => {
    const byStage = new Map<number | "none", Task[]>();
    for (const task of board) {
      const key = task.kanbanStageId ?? "none";
      const list = byStage.get(key);
      if (list) list.push(task);
      else byStage.set(key, [task]);
    }
    for (const [, list] of byStage) sortTasks(list, sortMode, workspace);
    return byStage;
  }, [board, sortMode, workspace]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function handleDragStart(event: DragStartEvent) {
    const task = board.find((t) => t.id === Number(event.active.id));
    setDragging(task ?? null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setDragging(null);
    if (!over) return;

    const taskId = Number(active.id);
    const task = board.find((t) => t.id === taskId);
    if (!task) return;

    // El destino puede ser otra tarjeta o la columna vacía.
    const overId = String(over.id);
    const targetStage = overId.startsWith("stage-")
      ? overId === "stage-none"
        ? null
        : Number(overId.slice(6))
      : (board.find((t) => t.id === Number(overId))?.kanbanStageId ?? null);

    const currentStage = task.kanbanStageId ?? null;
    const destination = board
      .filter((t) => (t.kanbanStageId ?? null) === targetStage && t.id !== taskId)
      .sort((a, b) => a.position - b.position);

    const overTask = board.find((t) => t.id === Number(overId));
    const insertAt = overTask
      ? destination.findIndex((t) => t.id === overTask.id)
      : destination.length;

    const ordered = [...destination];
    ordered.splice(insertAt === -1 ? ordered.length : insertAt, 0, task);

    if (currentStage === targetStage && sortMode !== "manual") {
      toast.info("El orden manual solo se aplica con la vista sin ordenar.", {
        description: "Cambiá el orden a «Manual» para reordenar las tarjetas.",
      });
      return;
    }

    const snapshot = board;
    setOptimistic(
      board.map((t) =>
        t.id === taskId ? { ...t, kanbanStageId: targetStage } : t,
      ),
    );

    run(() => moveTask(taskId, targetStage, ordered.map((t) => t.id)), {
      onSuccess: () => setOptimistic(null),
      onError: (result) => {
        // La tarjeta vuelve a su lugar: nada de estados fantasma.
        setOptimistic(snapshot);
        setTimeout(() => setOptimistic(null), 0);
        toast.error(result.error, { description: result.hint });
      },
    });
  }

  if (workspace.stages.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<SquareKanban className="size-8" />}
          title="No hay etapas configuradas"
          description="El tablero necesita al menos una columna para poder mostrar tarjetas."
          action={{ label: "Configurar etapas", href: "/configuracion?tab=estados" }}
        />
      </div>
    );
  }

  // Sin proyectos no hay nada que llenar el tablero: se guía al primer paso
  // en lugar de mostrar columnas vacías sin explicación.
  if (workspace.projects.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<SquareKanban className="size-8" />}
          title="Todavía no hay proyectos"
          description="Las tarjetas del tablero son tareas, y toda tarea vive dentro de un proyecto. Creá el primero para empezar."
          action={{
            label: "Ir a Configuración",
            href: "/configuracion?tab=proyectos",
          }}
        />
      </div>
    );
  }

  const unassignedStage = board.filter((t) => t.kanbanStageId == null);

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FiltersBar
          workspace={workspace}
          show={["search", "project", "assignee", "priority"]}
          extra={
            <Select
              value={sortMode}
              onChange={(e) => set({ [PARAM.sort]: e.target.value })}
              className="w-auto"
              aria-label="Ordenar tarjetas"
            >
              <option value="manual">Orden manual</option>
              <option value="priority">Por prioridad</option>
              <option value="due">Por fecha límite</option>
              <option value="assignee">Por responsable</option>
            </Select>
          }
        />
        <Button
          variant="primary"
          onClick={() => setCreating(true)}
          disabled={workspace.projects.length === 0}
        >
          <Plus className="size-4" /> Nueva tarea
        </Button>
      </div>

      {board.length === 0 ? (
        <EmptyState
          icon={<SquareKanban className="size-8" />}
          title={
            activeCount > 0
              ? "Ninguna tarjeta pasa los filtros"
              : "El tablero está vacío"
          }
          description={
            activeCount > 0
              ? "Probá quitando algún filtro para volver a ver tarjetas."
              : "Cargá tareas y aparecen acá, en la columna de su etapa."
          }
          action={
            activeCount > 0 ? (
              <Button onClick={() => clear(FILTER_KEYS)}>Limpiar filtros</Button>
            ) : (
              <Button variant="primary" onClick={() => setCreating(true)}>
                <Plus className="size-4" /> Nueva tarea
              </Button>
            )
          }
        />
      ) : (
        <DndContext
          id="kanban"
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex min-h-0 flex-1 gap-3 overflow-x-auto pb-2">
            {workspace.stages.map((stage) => (
              <Column
                key={stage.id}
                id={`stage-${stage.id}`}
                title={`${stage.emoji} ${stage.name}`.trim()}
                color={stage.color}
                wipLimit={stage.wipLimit}
                tasks={columns.get(stage.id) ?? []}
                workspace={workspace}
                today={today}
                childCount={childCount}
                onOpen={(id) => set({ [PARAM.task]: id })}
              />
            ))}
            {unassignedStage.length > 0 ? (
              <Column
                id="stage-none"
                title="Sin etapa"
                color="#94a3b8"
                wipLimit={null}
                tasks={unassignedStage}
                workspace={workspace}
                today={today}
                childCount={childCount}
                onOpen={(id) => set({ [PARAM.task]: id })}
              />
            ) : null}
          </div>

          <DragOverlay>
            {dragging ? (
              <div className="w-72 rotate-2">
                <TaskCard
                  task={dragging}
                  workspace={workspace}
                  today={today}
                  onOpen={() => {}}
                />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <NewTaskDialog
        open={creating}
        workspace={workspace}
        defaultProjectId={Number(get(PARAM.project)) || null}
        onClose={() => setCreating(false)}
        onCreated={(id) => set({ [PARAM.task]: id })}
      />
    </div>
  );
}

function Column({
  id,
  title,
  color,
  wipLimit,
  tasks,
  workspace,
  today,
  childCount,
  onOpen,
}: {
  id: string;
  title: string;
  color: string;
  wipLimit: number | null;
  tasks: Task[];
  workspace: Workspace;
  today: string;
  childCount: Map<number, number>;
  onOpen: (id: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const overLimit = wipLimit != null && tasks.length > wipLimit;

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-lg border bg-surface-2/40",
        isOver ? "border-accent" : "border-border",
      )}
    >
      <header className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ background: color }}
        />
        <h2 className="min-w-0 flex-1 truncate text-sm font-medium">{title}</h2>
        <span
          className={cn(
            "rounded px-1.5 py-0.5 text-xs",
            overLimit ? "bg-warning/20 text-warning" : "text-muted",
          )}
          title={
            wipLimit != null
              ? `Límite de trabajo en curso: ${wipLimit}`
              : undefined
          }
        >
          {tasks.length}
          {wipLimit != null ? `/${wipLimit}` : ""}
        </span>
        {overLimit ? (
          <AlertTriangle
            className="size-3.5 text-warning"
            aria-label="Se pasó del límite de trabajo en curso"
          />
        ) : null}
      </header>

      <SortableContext
        items={tasks.map((t) => t.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto p-2">
          {tasks.length === 0 ? (
            <p className="py-6 text-center text-xs text-muted">
              Soltá una tarjeta acá
            </p>
          ) : (
            tasks.map((task) => (
              <SortableCard
                key={task.id}
                task={task}
                workspace={workspace}
                today={today}
                childCount={childCount.get(task.id) ?? 0}
                onOpen={() => onOpen(task.id)}
              />
            ))
          )}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableCard({
  task,
  workspace,
  today,
  childCount,
  onOpen,
}: {
  task: Task;
  workspace: Workspace;
  today: string;
  childCount: number;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing"
    >
      <TaskCard
        task={task}
        workspace={workspace}
        today={today}
        childCount={childCount}
        onOpen={onOpen}
        dragging={isDragging}
      />
    </div>
  );
}

function sortTasks(list: Task[], mode: SortMode, workspace: Workspace) {
  const weightOf = (id: number | null) =>
    workspace.priorities.find((p) => p.id === id)?.weight ?? 0;
  const nameOf = (id: number | null) =>
    workspace.people.find((p) => p.id === id)?.name ?? "￿";

  switch (mode) {
    case "priority":
      list.sort(
        (a, b) =>
          weightOf(b.priorityId) - weightOf(a.priorityId) ||
          a.position - b.position,
      );
      break;
    case "due":
      // Las que no tienen fecha van al final: no compiten por urgencia.
      list.sort(
        (a, b) =>
          (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31") ||
          a.position - b.position,
      );
      break;
    case "assignee":
      list.sort(
        (a, b) =>
          nameOf(a.assigneeId).localeCompare(nameOf(b.assigneeId)) ||
          a.position - b.position,
      );
      break;
    default:
      list.sort((a, b) => a.position - b.position || a.id - b.id);
  }
}
