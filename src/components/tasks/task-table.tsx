"use client";

import { useMemo, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { ChevronDown, ChevronRight } from "lucide-react";

import type { TaskPatch } from "@/actions/tasks";
import {
  CheckCell,
  DateCell,
  ProgressCell,
  SelectCell,
  TextCell,
} from "@/components/tasks/cells";
import { DaysRemainingBadge } from "@/components/tasks/task-badges";
import type { Task } from "@/db/schema";
import {
  ColumnHeader,
  COLUMN_KEYS,
  useColumnWidths,
} from "@/components/tasks/columns";
import { cn } from "@/lib/cn";
import { daysRemaining, isOverdue, rollupProgress } from "@/lib/derive";
import type { Workspace } from "@/lib/task-queries";

export type GroupBy = "none" | "project" | "phase" | "assignee" | "status";

type Row =
  | { kind: "group"; key: string; label: string; count: number; done: number }
  | { kind: "task"; task: Task; depth: number; hasChildren: boolean };


export function TaskTable({
  tasks,
  workspace,
  today,
  groupBy,
  selected,
  activeTaskId,
  onToggleSelect,
  onToggleSelectAll,
  onPatch,
  onOpen,
  onRequestComplete,
}: {
  tasks: Task[];
  workspace: Workspace;
  today: string;
  groupBy: GroupBy;
  selected: Set<number>;
  /** Tarea abierta en el panel, para marcarla y permitir renombrarla. */
  activeTaskId: number | null;
  onToggleSelect: (id: number, checked: boolean) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onPatch: (id: number, patch: TaskPatch) => void;
  onOpen: (id: number) => void;
  /** Completar un padre con hijas pendientes se pregunta antes. */
  onRequestComplete: (task: Task, statusId: number) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [collapsedTasks, setCollapsedTasks] = useState<Set<number>>(new Set());
  // El contenedor de scroll se guarda en estado, no en un ref: el
  // virtualizador necesita enterarse de que pasó de "no existe" a "existe"
  // para medir, y un ref no dispara ese re-render. Con un ref, la tabla
  // quedaba sin filas hasta el primer scroll.
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const columns = useColumnWidths();

  const statusById = useMemo(
    () => new Map(workspace.statuses.map((s) => [s.id, s])),
    [workspace.statuses],
  );
  const doneStatus = workspace.statuses.find((s) => s.isDone);

  const childrenOf = useMemo(() => {
    const map = new Map<number, Task[]>();
    for (const task of tasks) {
      if (task.parentTaskId == null) continue;
      const list = map.get(task.parentTaskId);
      if (list) list.push(task);
      else map.set(task.parentTaskId, [task]);
    }
    return map;
  }, [tasks]);

  const rows = useMemo(
    () =>
      buildRows({
        tasks,
        workspace,
        groupBy,
        collapsed,
        collapsedTasks,
        childrenOf,
        statusById,
      }),
    [
      tasks,
      workspace,
      groupBy,
      collapsed,
      collapsedTasks,
      childrenOf,
      statusById,
    ],
  );

  const allSelected =
    tasks.length > 0 && tasks.every((t) => selected.has(t.id));

  return (
    // `min-w-0` es lo que permite que esta caja se encoja: sin él, el ancho
    // mínimo de la grilla gana y la tabla se derrama por encima de lo que
    // tenga al lado (el panel de detalle, por ejemplo).
    <div className="flex min-h-0 min-w-0 flex-1 flex-col rounded-lg border border-border bg-surface">
      {/* Dos scrolls anidados a propósito: el horizontal es de afuera, así
          arrastra encabezado y filas juntos; el vertical es del bloque de
          filas, que es lo único que debe desplazarse hacia abajo. Meter el
          encabezado dentro del scroll vertical rompería el virtualizador,
          que espera que su contenedor empiece al tope. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-x-auto">
        <div
          className="flex min-h-0 flex-1 flex-col"
          style={{ minWidth: columns.totalWidth }}
        >
          <div
            className="grid shrink-0 items-center border-b border-border bg-surface-2 py-2 text-[11px] font-medium uppercase tracking-wide text-muted"
            style={{ gridTemplateColumns: columns.template }}
          >
            <div className="flex justify-center">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={(e) => onToggleSelectAll(e.target.checked)}
                aria-label="Seleccionar todas"
                className="cursor-pointer"
              />
            </div>
            {COLUMN_KEYS.filter((key) => key !== "select").map((key) => (
              <ColumnHeader
                key={key}
                column={key}
                width={columns.widths[key]}
                align={
                  key === "important" || key === "urgent"
                    ? "center"
                    : key === "remaining"
                      ? "right"
                      : "left"
                }
                onPreview={(w) => columns.preview(key, w)}
                onCommit={(w) => columns.commit(key, w)}
                onReset={() => columns.reset(key)}
              />
            ))}
          </div>

          <div ref={setScroller} className="min-h-0 flex-1 overflow-y-auto">
            <VirtualRows scroller={scroller} count={rows.length}>
              {(index) => {
                const row = rows[index];
                return (
                  <>
                    {row.kind === "group" ? (
                      <GroupRow
                        row={row}
                        collapsed={collapsed.has(row.key)}
                        onToggle={() =>
                          setCollapsed((prev) => {
                            const next = new Set(prev);
                            if (next.has(row.key)) next.delete(row.key);
                            else next.add(row.key);
                            return next;
                          })
                        }
                      />
                    ) : (
                      <TaskRow
                        task={row.task}
                        depth={row.depth}
                        hasChildren={row.hasChildren}
                        collapsed={collapsedTasks.has(row.task.id)}
                        onToggleCollapse={() =>
                          setCollapsedTasks((prev) => {
                            const next = new Set(prev);
                            if (next.has(row.task.id)) next.delete(row.task.id);
                            else next.add(row.task.id);
                            return next;
                          })
                        }
                        workspace={workspace}
                        today={today}
                        selected={selected.has(row.task.id)}
                        active={row.task.id === activeTaskId}
                        childCount={childrenOf.get(row.task.id)?.length ?? 0}
                        rolledProgress={
                          childrenOf.has(row.task.id)
                            ? rollupProgress(
                                row.task,
                                childrenOf.get(row.task.id)!,
                                statusById,
                              )
                            : null
                        }
                        doneStatusId={doneStatus?.id ?? null}
                        onToggleSelect={onToggleSelect}
                        onPatch={onPatch}
                        onOpen={onOpen}
                        onRequestComplete={onRequestComplete}
                        template={columns.template}
                      />
                    )}
                  </>
                );
              }}
            </VirtualRows>
          </div>
        </div>
      </div>
    </div>
  );
}

/** El virtualizador vive aislado en su propio componente: React Compiler
 *  no puede memoizar la API de TanStack Virtual, y así el resto de la
 *  tabla no pierde optimización por su culpa. */
function VirtualRows({
  scroller,
  count,
  children,
}: {
  scroller: HTMLDivElement | null;
  count: number;
  children: (index: number) => React.ReactNode;
}) {
  // eslint-disable-next-line react-hooks/incompatible-library -- el aislamiento de arriba es justamente la mitigación
  const virtualizer = useVirtualizer({
    count,
    getScrollElement: () => scroller,
    estimateSize: () => 38,
    overscan: 12,
  });

  return (
    <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
      {virtualizer.getVirtualItems().map((virtualRow) => (
        <div
          key={virtualRow.key}
          data-index={virtualRow.index}
          ref={virtualizer.measureElement}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            transform: `translateY(${virtualRow.start}px)`,
          }}
        >
          {children(virtualRow.index)}
        </div>
      ))}
    </div>
  );
}

function GroupRow({
  row,
  collapsed,
  onToggle,
}: {
  row: Extract<Row, { kind: "group" }>;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center gap-2 border-b border-border bg-surface-2/60 px-3 py-2 text-left text-sm font-medium hover:bg-surface-2"
    >
      {collapsed ? (
        <ChevronRight className="size-3.5 text-muted" />
      ) : (
        <ChevronDown className="size-3.5 text-muted" />
      )}
      <span className="truncate">{row.label}</span>
      <span className="text-xs font-normal text-muted">
        {row.done}/{row.count} completadas
      </span>
    </button>
  );
}

function TaskRow({
  task,
  depth,
  hasChildren,
  collapsed,
  onToggleCollapse,
  workspace,
  today,
  selected,
  active,
  childCount,
  rolledProgress,
  doneStatusId,
  onToggleSelect,
  onPatch,
  onOpen,
  onRequestComplete,
  template,
}: {
  task: Task;
  depth: number;
  hasChildren: boolean;
  collapsed: boolean;
  onToggleCollapse: () => void;
  workspace: Workspace;
  today: string;
  selected: boolean;
  /** Es la tarea que está abierta en el panel de detalle. */
  active: boolean;
  childCount: number;
  rolledProgress: number | null;
  doneStatusId: number | null;
  onToggleSelect: (id: number, checked: boolean) => void;
  onPatch: (id: number, patch: TaskPatch) => void;
  onOpen: (id: number) => void;
  onRequestComplete: (task: Task, statusId: number) => void;
  /** Misma plantilla de columnas que el encabezado. */
  template: string;
}) {
  const statusById = new Map(workspace.statuses.map((s) => [s.id, s]));
  const remaining = daysRemaining(task, statusById, today);
  const overdue = isOverdue(task, statusById, today);
  const project = workspace.projects.find((p) => p.id === task.projectId);
  const phase = workspace.phases.find((p) => p.id === task.phaseId);

  const projectPhases = workspace.phases.filter(
    (p) => p.projectId === task.projectId,
  );

  /**
   * Clic en la fila abre el detalle, como en Asana o Jira.
   *
   * Se ignoran los clics que caen sobre un control —un desplegable, una
   * casilla, una fecha, el progreso—: esos siguen editando en línea, que
   * es la otra mitad del trato en una tabla así. Solo el espacio "muerto"
   * de la fila abre la tarea.
   */
  function handleRowClick(event: React.MouseEvent) {
    const target = event.target as HTMLElement;
    if (target.closest("input, select, textarea, button, a, label")) return;
    onOpen(task.id);
  }

  return (
    <div
      onClick={handleRowClick}
      style={{ gridTemplateColumns: template }}
      className={cn(
        "grid cursor-pointer items-center border-b border-border py-1 transition-colors hover:bg-surface-2/50",
        selected && "bg-accent/5",
        // La fila abierta queda marcada, para no perder de vista cuál se
        // está mirando en el panel.
        active && "bg-accent/10 shadow-[inset_2px_0_0_0_var(--color-accent)]",
      )}
    >
      <div className="flex justify-center">
        <input
          type="checkbox"
          checked={selected}
          onChange={(e) => onToggleSelect(task.id, e.target.checked)}
          aria-label={`Seleccionar ${task.title}`}
          className="cursor-pointer"
        />
      </div>

      <div
        className="flex min-w-0 items-center gap-1"
        style={{ paddingLeft: depth * 16 }}
      >
        {hasChildren ? (
          <button
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Mostrar subtareas" : "Ocultar subtareas"}
            className="shrink-0 cursor-pointer text-muted hover:text-foreground"
          >
            {collapsed ? (
              <ChevronRight className="size-3.5" />
            ) : (
              <ChevronDown className="size-3.5" />
            )}
          </button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        {/* El nombre abre la tarea de un clic. Cuando ya está abierta pasa
            a ser editable: es el mismo gesto de "clic para abrir, clic de
            nuevo para renombrar" de los gestores de archivos, y evita que
            un solo clic tenga dos significados a la vez. */}
        {active ? (
          <TextCell
            value={task.title}
            onCommit={(title) => onPatch(task.id, { title })}
            className={cn("font-medium", overdue && "text-danger")}
          />
        ) : (
          <button
            onClick={() => onOpen(task.id)}
            title={`Abrir ${task.title}`}
            className={cn(
              "min-w-0 flex-1 cursor-pointer truncate rounded px-1.5 py-1 text-left text-sm font-medium hover:underline",
              overdue && "text-danger",
            )}
          >
            {task.title}
          </button>
        )}
        {childCount > 0 ? (
          <span className="shrink-0 rounded bg-surface-2 px-1 text-[10px] text-muted">
            {childCount}
          </span>
        ) : null}
      </div>

      <div className="min-w-0">
        <p className="truncate px-1.5 text-xs text-muted" title={project?.name}>
          {project?.code ?? "—"}
        </p>
        <SelectCell
          value={task.phaseId}
          options={projectPhases.map((p) => ({ id: p.id, label: p.name }))}
          onCommit={(phaseId) => onPatch(task.id, { phaseId })}
          emptyLabel="Sin fase"
          className="text-xs"
        />
        <span className="sr-only">{phase?.name}</span>
      </div>

      <SelectCell
        value={task.statusId}
        options={workspace.statuses.map((s) => ({
          id: s.id,
          label: `${s.emoji} ${s.name}`.trim(),
        }))}
        onCommit={(statusId) => {
          // Completar un padre con hijas pendientes se consulta antes.
          if (statusId != null && statusId === doneStatusId && childCount > 0) {
            onRequestComplete(task, statusId);
            return;
          }
          onPatch(task.id, { statusId });
        }}
        emptyLabel="Sin estado"
      />

      <SelectCell
        value={task.assigneeId}
        options={workspace.people
          .filter((p) => p.active || p.id === task.assigneeId)
          .map((p) => ({ id: p.id, label: p.name }))}
        onCommit={(assigneeId) => onPatch(task.id, { assigneeId })}
        emptyLabel="Sin asignar"
      />

      <CheckCell
        checked={task.important}
        onCommit={(important) => onPatch(task.id, { important })}
        label="Importante"
      />
      <CheckCell
        checked={task.urgent}
        onCommit={(urgent) => onPatch(task.id, { urgent })}
        label="Urgente"
      />

      <DateCell
        value={task.startDate}
        onCommit={(startDate) => onPatch(task.id, { startDate })}
        title="Fecha de inicio"
        className="text-xs"
      />
      <DateCell
        value={task.dueDate}
        onCommit={(dueDate) => onPatch(task.id, { dueDate })}
        title="Fecha límite"
        className={cn("text-xs", overdue && "text-danger")}
      />

      <div className="pr-1 text-right">
        <DaysRemainingBadge value={remaining} />
      </div>

      <ProgressCell
        value={rolledProgress ?? task.progress}
        readOnly={rolledProgress !== null}
        onCommit={(progress) => onPatch(task.id, { progress })}
      />
    </div>
  );
}

/** Aplana el árbol de tareas en filas, respetando agrupación y colapsos.
 *  Las subtareas siempre cuelgan de su padre; si el padre no entra en el
 *  filtro, la hija se muestra igual pero en el primer nivel. */
function buildRows({
  tasks,
  workspace,
  groupBy,
  collapsed,
  collapsedTasks,
  childrenOf,
  statusById,
}: {
  tasks: Task[];
  workspace: Workspace;
  groupBy: GroupBy;
  collapsed: Set<string>;
  collapsedTasks: Set<number>;
  childrenOf: Map<number, Task[]>;
  statusById: Map<number, { isDone: boolean }>;
}): Row[] {
  const present = new Set(tasks.map((t) => t.id));
  const roots = tasks.filter(
    (t) => t.parentTaskId == null || !present.has(t.parentTaskId),
  );

  function pushSubtree(task: Task, depth: number, out: Row[]) {
    const children = childrenOf.get(task.id) ?? [];
    out.push({ kind: "task", task, depth, hasChildren: children.length > 0 });
    if (collapsedTasks.has(task.id)) return;
    for (const child of children) pushSubtree(child, depth + 1, out);
  }

  if (groupBy === "none") {
    const out: Row[] = [];
    for (const task of roots) pushSubtree(task, 0, out);
    return out;
  }

  const groups = new Map<string, { label: string; tasks: Task[] }>();
  for (const task of roots) {
    const { key, label } = groupKey(task, groupBy, workspace);
    const group = groups.get(key);
    if (group) group.tasks.push(task);
    else groups.set(key, { label, tasks: [task] });
  }

  const out: Row[] = [];
  for (const [key, group] of groups) {
    const done = group.tasks.filter(
      (t) => t.statusId != null && statusById.get(t.statusId)?.isDone,
    ).length;
    out.push({
      kind: "group",
      key,
      label: group.label,
      count: group.tasks.length,
      done,
    });
    if (collapsed.has(key)) continue;
    for (const task of group.tasks) pushSubtree(task, 0, out);
  }
  return out;
}

function groupKey(
  task: Task,
  groupBy: GroupBy,
  workspace: Workspace,
): { key: string; label: string } {
  switch (groupBy) {
    case "project": {
      const project = workspace.projects.find((p) => p.id === task.projectId);
      return {
        key: `p-${task.projectId}`,
        label: project ? `${project.code} · ${project.name}` : "Sin proyecto",
      };
    }
    case "phase": {
      const phase = workspace.phases.find((p) => p.id === task.phaseId);
      return {
        key: `f-${task.phaseId ?? "none"}`,
        label: phase?.name ?? "Sin fase",
      };
    }
    case "assignee": {
      const person = workspace.people.find((p) => p.id === task.assigneeId);
      return {
        key: `r-${task.assigneeId ?? "none"}`,
        label: person?.name ?? "Sin responsable",
      };
    }
    case "status": {
      const status = workspace.statuses.find((s) => s.id === task.statusId);
      return {
        key: `e-${task.statusId ?? "none"}`,
        label: status ? `${status.emoji} ${status.name}`.trim() : "Sin estado",
      };
    }
    default:
      return { key: "all", label: "Todas" };
  }
}
