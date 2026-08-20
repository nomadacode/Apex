"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { Grid2X2 } from "lucide-react";
import { toast } from "sonner";

import { updateTask } from "@/actions/tasks";
import { FiltersBar } from "@/components/tasks/filters-bar";
import { TaskCard } from "@/components/tasks/task-card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { Task } from "@/db/schema";
import { cn } from "@/lib/cn";
import { QUADRANTS, quadrantOf, type Quadrant } from "@/lib/derive";
import { PARAM } from "@/lib/search-params";
import type { Workspace } from "@/lib/task-queries";
import { useAction } from "@/lib/use-action";
import { FILTER_KEYS, useFilters } from "@/lib/use-filters";

/** Orden visual: importante arriba, urgente a la izquierda. */
const LAYOUT: Quadrant[] = ["do", "schedule", "delegate", "eliminate"];

const TONE: Record<Quadrant, string> = {
  do: "border-danger/40 bg-danger/5",
  schedule: "border-accent/40 bg-accent/5",
  delegate: "border-warning/40 bg-warning/5",
  eliminate: "border-border bg-surface-2/40",
};

export function EisenhowerMatrix({
  tasks,
  workspace,
  today,
}: {
  tasks: Task[];
  workspace: Workspace;
  today: string;
}) {
  const { run } = useAction();
  const { set, clear, activeCount } = useFilters();
  const [dragging, setDragging] = useState<Task | null>(null);
  const [optimistic, setOptimistic] = useState<Task[] | null>(null);

  const board = optimistic ?? tasks;

  const grouped = useMemo(() => {
    const map = new Map<Quadrant, Task[]>(
      LAYOUT.map((q) => [q, [] as Task[]]),
    );
    for (const task of board) map.get(quadrantOf(task))!.push(task);
    return map;
  }, [board]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    setDragging(null);
    if (!over) return;

    const taskId = Number(active.id);
    const task = board.find((t) => t.id === taskId);
    const target = String(over.id) as Quadrant;
    if (!task || !QUADRANTS[target]) return;

    const { important, urgent } = QUADRANTS[target];
    if (task.important === important && task.urgent === urgent) return;

    const snapshot = board;
    setOptimistic(
      board.map((t) => (t.id === taskId ? { ...t, important, urgent } : t)),
    );

    run(() => updateTask(taskId, { important, urgent }), {
      onSuccess: () => setOptimistic(null),
      onError: (result) => {
        setOptimistic(snapshot);
        setTimeout(() => setOptimistic(null), 0);
        toast.error(result.error, { description: result.hint });
      },
    });
  }

  if (workspace.projects.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<Grid2X2 className="size-8" />}
          title="Todavía no hay proyectos"
          description="La matriz reparte tareas por importancia y urgencia. Creá un proyecto y cargá tareas para verlas repartidas acá."
          action={{
            label: "Ir a Configuración",
            href: "/configuracion?tab=proyectos",
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4 sm:p-6">
      <FiltersBar
        workspace={workspace}
        show={["search", "project", "assignee", "status"]}
      />

      {board.length === 0 ? (
        <EmptyState
          icon={<Grid2X2 className="size-8" />}
          title={
            activeCount > 0
              ? "Ninguna tarea pasa los filtros"
              : "Todavía no hay tareas que ubicar"
          }
          description="La matriz reparte las tareas por importancia y urgencia. Arrastrá una tarjeta de cuadrante para cambiar esos dos valores."
          action={
            activeCount > 0 ? (
              <Button onClick={() => clear(FILTER_KEYS)}>Limpiar filtros</Button>
            ) : (
              { label: "Ir a Tareas", href: "/tareas" }
            )
          }
        />
      ) : (
        <DndContext
          id="matriz"
          sensors={sensors}
          collisionDetection={pointerWithin}
          onDragStart={(event: DragStartEvent) =>
            setDragging(board.find((t) => t.id === Number(event.active.id)) ?? null)
          }
          onDragEnd={handleDragEnd}
        >
          {/* En celular los cuadrantes se apilan y la página scrollea:
              cuatro cajas de 190 px de ancho no muestran ni un título. */}
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-y-auto sm:grid-cols-2 sm:grid-rows-2 sm:overflow-visible">
            {LAYOUT.map((quadrant) => (
              <QuadrantBox
                key={quadrant}
                quadrant={quadrant}
                tasks={grouped.get(quadrant) ?? []}
                workspace={workspace}
                today={today}
                onOpen={(id) => set({ [PARAM.task]: id })}
              />
            ))}
          </div>

          <DragOverlay>
            {dragging ? (
              <div className="w-64 rotate-2">
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
    </div>
  );
}

function QuadrantBox({
  quadrant,
  tasks,
  workspace,
  today,
  onOpen,
}: {
  quadrant: Quadrant;
  tasks: Task[];
  workspace: Workspace;
  today: string;
  onOpen: (id: number) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: quadrant });
  const meta = QUADRANTS[quadrant];

  return (
    <section
      ref={setNodeRef}
      className={cn(
        "flex min-h-52 flex-col rounded-lg border transition-colors sm:min-h-0",
        TONE[quadrant],
        isOver && "border-accent ring-1 ring-accent",
      )}
    >
      <header className="shrink-0 border-b border-border/60 px-3 py-2">
        <div className="flex items-baseline gap-2">
          <h2 className="text-sm font-medium">{meta.label}</h2>
          <span className="text-xs text-muted">{tasks.length}</span>
        </div>
        <p className="text-xs text-muted">{meta.hint}</p>
      </header>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-2">
        {tasks.length === 0 ? (
          <p className="py-6 text-center text-xs text-muted">
            Sin tareas en este cuadrante
          </p>
        ) : (
          tasks.map((task) => (
            <DraggableCard
              key={task.id}
              task={task}
              workspace={workspace}
              today={today}
              onOpen={() => onOpen(task.id)}
            />
          ))
        )}
      </div>
    </section>
  );
}

function DraggableCard({
  task,
  workspace,
  today,
  onOpen,
}: {
  task: Task;
  workspace: Workspace;
  today: string;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      className="cursor-grab active:cursor-grabbing"
    >
      <TaskCard
        task={task}
        workspace={workspace}
        today={today}
        onOpen={onOpen}
        dragging={isDragging}
      />
    </div>
  );
}
