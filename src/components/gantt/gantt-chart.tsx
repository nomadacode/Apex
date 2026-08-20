"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GanttChartSquare } from "lucide-react";
import { toast } from "sonner";

import { updateTask } from "@/actions/tasks";
import { FiltersBar } from "@/components/tasks/filters-bar";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Select } from "@/components/ui/field";
import type { Task, TaskDependency } from "@/db/schema";
import { cn } from "@/lib/cn";
import {
  addDays,
  daysBetween,
  eachDay,
  formatDate,
  formatDateShort,
  MONTH_NAMES,
  weekdayIndex,
} from "@/lib/dates";
import { isHoliday, isWorkday } from "@/lib/derive";
import { PARAM } from "@/lib/search-params";
import type { Workspace } from "@/lib/task-queries";
import { useAction } from "@/lib/use-action";
import { useDevice } from "@/lib/use-device";
import { useFilters } from "@/lib/use-filters";

type Scale = "day" | "week" | "month";

const COL_WIDTH: Record<Scale, number> = { day: 32, week: 12, month: 4 };
const ROW_HEIGHT = 28;
const HEADER_HEIGHT = 40;

type Row =
  | { kind: "project"; id: string; label: string; color: string }
  | { kind: "phase"; id: string; label: string }
  | { kind: "task"; id: string; task: Task; depth: number };

export function GanttChart({
  tasks,
  dependencies,
  workspace,
  today,
}: {
  tasks: Task[];
  dependencies: TaskDependency[];
  workspace: Workspace;
  today: string;
}) {
  const { run } = useAction();
  const { get, set } = useFilters();
  const scale = (get(PARAM.scale) || "day") as Scale;
  const colWidth = COL_WIDTH[scale];
  const svgRef = useRef<SVGSVGElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);

  // Ancho de la lista de tareas. En celular se recorta para dejarle lugar
  // a las barras, que son el punto del gráfico.
  const labelWidth = useDevice().phone ? 132 : 260;

  /** El lienzo manda: el encabezado lo sigue de costado y la lista, de
   *  arriba abajo. Se escribe directo en el DOM en vez de pasar por el
   *  estado de React porque ocurre en cada cuadro del desplazamiento. */
  function syncScroll(event: React.UIEvent<HTMLDivElement>) {
    const { scrollLeft, scrollTop } = event.currentTarget;
    if (headerRef.current) headerRef.current.scrollLeft = scrollLeft;
    if (labelsRef.current) labelsRef.current.scrollTop = scrollTop;
  }

  const [drag, setDrag] = useState<{
    taskId: number;
    mode: "move" | "start" | "end";
    originX: number;
    offsetDays: number;
  } | null>(null);

  const scheduled = useMemo(
    () => tasks.filter((t) => t.startDate || t.dueDate),
    [tasks],
  );

  const range = useMemo(() => {
    if (scheduled.length === 0) {
      return { from: addDays(today, -7), to: addDays(today, 30) };
    }
    let min = "9999-12-31";
    let max = "0000-01-01";
    for (const task of scheduled) {
      const from = task.startDate ?? task.dueDate!;
      const to = task.dueDate ?? task.startDate!;
      if (from < min) min = from;
      if (to > max) max = to;
    }
    if (today < min) min = today;
    if (today > max) max = today;
    return { from: addDays(min, -3), to: addDays(max, 5) };
  }, [scheduled, today]);

  const days = useMemo(() => eachDay(range.from, range.to), [range]);

  const rows = useMemo(
    () => buildRows(scheduled, workspace),
    [scheduled, workspace],
  );

  const taskRowIndex = useMemo(() => {
    const map = new Map<number, number>();
    rows.forEach((row, index) => {
      if (row.kind === "task") map.set(row.task.id, index);
    });
    return map;
  }, [rows]);

  const width = days.length * colWidth;
  const height = rows.length * ROW_HEIGHT;

  function xOf(date: string): number {
    return daysBetween(range.from, date) * colWidth;
  }

  const todayOffset = daysBetween(range.from, today) * colWidth;

  const scrollToToday = useCallback(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.scrollLeft = Math.max(0, todayOffset - el.clientWidth / 2);
    if (headerRef.current) headerRef.current.scrollLeft = el.scrollLeft;
  }, [todayOffset]);

  // Al abrir, el lienzo se posiciona en hoy. Sin esto arranca en el extremo
  // izquierdo del rango —que puede ser meses atrás— y en una pantalla
  // angosta no se ve una sola barra vigente.
  useEffect(scrollToToday, [scrollToToday]);

  /** Píxeles arrastrados → días enteros. */
  function daysFromDelta(deltaX: number): number {
    return Math.round(deltaX / colWidth);
  }

  function handlePointerDown(
    event: React.PointerEvent,
    task: Task,
    mode: "move" | "start" | "end",
  ) {
    event.preventDefault();
    (event.target as Element).setPointerCapture?.(event.pointerId);
    setDrag({ taskId: task.id, mode, originX: event.clientX, offsetDays: 0 });
  }

  function handlePointerMove(event: React.PointerEvent) {
    if (!drag) return;
    const offsetDays = daysFromDelta(event.clientX - drag.originX);
    if (offsetDays !== drag.offsetDays) setDrag({ ...drag, offsetDays });
  }

  function handlePointerUp() {
    if (!drag) return;
    const { taskId, mode, offsetDays } = drag;
    setDrag(null);
    if (offsetDays === 0) return;

    const task = scheduled.find((t) => t.id === taskId);
    if (!task) return;

    const start = task.startDate ?? task.dueDate!;
    const end = task.dueDate ?? task.startDate!;

    let patch: { startDate?: string | null; dueDate?: string | null };
    if (mode === "move") {
      patch = {
        startDate: task.startDate ? addDays(start, offsetDays) : null,
        dueDate: task.dueDate ? addDays(end, offsetDays) : null,
      };
    } else if (mode === "start") {
      const next = addDays(start, offsetDays);
      if (task.dueDate && next > task.dueDate) {
        toast.error("El inicio no puede pasar la fecha límite.");
        return;
      }
      patch = { startDate: next };
    } else {
      const next = addDays(end, offsetDays);
      if (task.startDate && next < task.startDate) {
        toast.error("La fecha límite no puede quedar antes del inicio.");
        return;
      }
      patch = { dueDate: next };
    }

    run(() => updateTask(taskId, patch), {
      onSuccess: () => warnAboutSuccessors(task, patch),
    });
  }

  /** Aviso (no bloqueo) cuando mover una barra deja a una sucesora
   *  empezando antes de que termine su predecesora. */
  function warnAboutSuccessors(task: Task, patch: { dueDate?: string | null }) {
    const newDue = patch.dueDate ?? task.dueDate;
    if (!newDue) return;
    const affected = dependencies
      .filter((d) => d.predecessorId === task.id)
      .map((d) => scheduled.find((t) => t.id === d.successorId))
      .filter(
        (t): t is Task => Boolean(t?.startDate) && t!.startDate! < newDue,
      );

    if (affected.length > 0) {
      toast.warning(
        `${affected.length} tarea(s) que dependen de esta ahora empiezan antes de que termine.`,
        { description: affected.map((t) => t.title).join(", ") },
      );
    }
  }

  if (scheduled.length === 0) {
    const sinProyectos = workspace.projects.length === 0;
    return (
      <div className="flex h-full flex-col gap-3 p-4 sm:p-6">
        {sinProyectos ? null : (
          <FiltersBar
            workspace={workspace}
            show={["project", "assignee", "status"]}
          />
        )}
        <EmptyState
          icon={<GanttChartSquare className="size-8" />}
          title={
            sinProyectos
              ? "Todavía no hay proyectos"
              : "Ninguna tarea tiene fechas"
          }
          description={
            sinProyectos
              ? "El Gantt ordena las tareas por proyecto y fase. Creá el primer proyecto para empezar."
              : "El Gantt dibuja barras a partir de la fecha de inicio y la fecha límite. Cargá esas fechas y las tareas aparecen acá."
          }
          action={
            sinProyectos
              ? {
                  label: "Ir a Configuración",
                  href: "/configuracion?tab=proyectos",
                }
              : { label: "Ir a Tareas", href: "/tareas" }
          }
        />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <FiltersBar
          workspace={workspace}
          show={["search", "project", "assignee", "status"]}
          extra={
            <Select
              value={scale}
              onChange={(e) => set({ [PARAM.scale]: e.target.value })}
              className="w-auto"
              aria-label="Escala"
            >
              <option value="day">Días</option>
              <option value="week">Semanas</option>
              <option value="month">Meses</option>
            </Select>
          }
        />
        <Button size="sm" onClick={scrollToToday}>
          Ir a hoy
        </Button>
      </div>

      {/* Cuatro zonas que se mueven juntas, como en Jira:
          esquina fija · encabezado de fechas (acompaña el scroll lateral)
          lista de tareas (acompaña el vertical) · lienzo (manda en ambos).

          El lienzo es el único con barras de scroll reales; los otros dos
          se sincronizan desde su evento, así una fila de la lista siempre
          queda enfrentada con su barra. */}
      <div className="flex min-h-0 flex-1 flex-col rounded-lg border border-border bg-surface">
        <div className="flex shrink-0 border-b border-border bg-surface-2">
          <div
            className="shrink-0 border-r border-border px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted"
            style={{ width: labelWidth, height: HEADER_HEIGHT }}
          >
            Proyecto / fase / tarea
          </div>
          <div ref={headerRef} className="min-w-0 flex-1 overflow-hidden">
            <svg width={width} height={HEADER_HEIGHT} className="block">
              <GanttHeader
                days={days}
                colWidth={colWidth}
                scale={scale}
                today={today}
                workspace={workspace}
              />
            </svg>
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <div
            ref={labelsRef}
            className="shrink-0 overflow-hidden border-r border-border"
            style={{ width: labelWidth }}
          >
            {rows.map((row) => (
              <div
                key={row.id}
                className={cn(
                  "flex items-center gap-1.5 truncate border-b border-border/50 px-3 text-sm",
                  row.kind === "project" && "bg-surface-2/60 font-medium",
                  row.kind === "phase" && "pl-6 text-xs text-muted",
                  row.kind === "task" && "pl-8",
                )}
                style={{ height: ROW_HEIGHT }}
                title={row.kind === "task" ? row.task.title : row.label}
              >
                {row.kind === "project" ? (
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ background: row.color }}
                  />
                ) : null}
                <span className="truncate">
                  {row.kind === "task" ? row.task.title : row.label}
                </span>
              </div>
            ))}
            {/* Colchón del alto de la barra de scroll horizontal del
                lienzo, para que la última fila no quede desfasada. */}
            <div className="h-4" />
          </div>

          {/* Lienzo del Gantt */}
          <div
            ref={canvasRef}
            onScroll={syncScroll}
            className="min-w-0 flex-1 overflow-auto"
          >
            <svg
              ref={svgRef}
              width={width}
              height={height}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerLeave={handlePointerUp}
              className="block select-none"
            >
              {/* Fondo: fines de semana, festivos y hoy */}
              <g>
                {days.map((day, index) => {
                  const working = isWorkday(day, workspace.calendar);
                  const holiday = isHoliday(day, workspace.calendar);
                  if (working && !holiday) return null;
                  return (
                    <rect
                      key={day}
                      x={index * colWidth}
                      y={0}
                      width={colWidth}
                      height={height}
                      fill={
                        holiday
                          ? "var(--color-warning)"
                          : "var(--color-surface-2)"
                      }
                      opacity={holiday ? 0.12 : 0.5}
                    />
                  );
                })}
              </g>

              {/* Líneas de fila */}
              <g>
                {rows.map((row, index) => (
                  <line
                    key={row.id}
                    x1={0}
                    x2={width}
                    y1={(index + 1) * ROW_HEIGHT}
                    y2={(index + 1) * ROW_HEIGHT}
                    stroke="var(--color-border)"
                    strokeWidth={0.5}
                    opacity={0.5}
                  />
                ))}
              </g>

              {/* Línea de hoy */}
              <line
                x1={xOf(today) + colWidth / 2}
                x2={xOf(today) + colWidth / 2}
                y1={0}
                y2={height}
                stroke="var(--color-accent)"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />

              {/* Fecha límite de cada proyecto */}
              {workspace.projects.map((project) =>
                project.endDate &&
                project.endDate >= range.from &&
                project.endDate <= range.to ? (
                  <line
                    key={`end-${project.id}`}
                    x1={xOf(project.endDate) + colWidth / 2}
                    x2={xOf(project.endDate) + colWidth / 2}
                    y1={0}
                    y2={height}
                    stroke={project.color}
                    strokeWidth={1}
                    opacity={0.4}
                  />
                ) : null,
              )}

              {/* Líneas de dependencia */}
              <DependencyLines
                dependencies={dependencies}
                tasks={scheduled}
                taskRowIndex={taskRowIndex}
                xOf={xOf}
                colWidth={colWidth}
              />

              {/* Barras */}
              {rows.map((row, index) =>
                row.kind === "task" ? (
                  <TaskBar
                    key={row.id}
                    task={row.task}
                    y={index * ROW_HEIGHT}
                    xOf={xOf}
                    colWidth={colWidth}
                    workspace={workspace}
                    today={today}
                    dragOffset={
                      drag?.taskId === row.task.id ? drag.offsetDays : 0
                    }
                    dragMode={drag?.taskId === row.task.id ? drag.mode : null}
                    onPointerDown={handlePointerDown}
                    onOpen={() => set({ [PARAM.task]: row.task.id })}
                  />
                ) : null,
              )}
            </svg>
          </div>
        </div>
      </div>

      <p className="shrink-0 text-xs text-muted">
        Arrastrá una barra para mover la tarea, o sus extremos para cambiar
        inicio y fin. Las flechas son dependencias; la línea punteada es hoy.
        {tasks.length - scheduled.length > 0
          ? ` ${tasks.length - scheduled.length} tarea(s) sin fechas no se dibujan.`
          : ""}
      </p>
    </div>
  );
}

function GanttHeader({
  days,
  colWidth,
  scale,
  today,
  workspace,
}: {
  days: string[];
  colWidth: number;
  scale: Scale;
  today: string;
  workspace: Workspace;
}) {
  // En escalas chicas no entra el número de cada día: se rotula por
  // semana o por mes según haga falta.
  const step = scale === "day" ? 1 : scale === "week" ? 7 : 30;

  return (
    <g>
      <rect
        x={0}
        y={0}
        width={days.length * colWidth}
        height={HEADER_HEIGHT}
        fill="var(--color-surface-2)"
      />
      {days.map((day, index) => {
        const isFirstOfMonth = day.endsWith("-01");
        const showMonth = isFirstOfMonth || index === 0;
        const showDay = index % step === 0;
        return (
          <g key={day}>
            {showMonth ? (
              <text
                x={index * colWidth + 2}
                y={13}
                fontSize={10}
                fill="var(--color-foreground)"
                fontWeight={600}
              >
                {MONTH_NAMES[Number(day.slice(5, 7)) - 1]} {day.slice(0, 4)}
              </text>
            ) : null}
            {showDay ? (
              <text
                x={index * colWidth + colWidth / 2}
                y={31}
                fontSize={9}
                textAnchor="middle"
                fill={
                  day === today ? "var(--color-accent)" : "var(--color-muted)"
                }
                fontWeight={day === today ? 700 : 400}
              >
                {scale === "day" ? Number(day.slice(8)) : formatDateShort(day)}
              </text>
            ) : null}
            {scale === "day" && !isWorkday(day, workspace.calendar) ? (
              <text
                x={index * colWidth + colWidth / 2}
                y={40}
                fontSize={7}
                textAnchor="middle"
                fill="var(--color-muted)"
              >
                {["L", "M", "M", "J", "V", "S", "D"][weekdayIndex(day)]}
              </text>
            ) : null}
          </g>
        );
      })}
      <line
        x1={0}
        x2={days.length * colWidth}
        y1={HEADER_HEIGHT}
        y2={HEADER_HEIGHT}
        stroke="var(--color-border)"
      />
    </g>
  );
}

function TaskBar({
  task,
  y,
  xOf,
  colWidth,
  workspace,
  today,
  dragOffset,
  dragMode,
  onPointerDown,
  onOpen,
}: {
  task: Task;
  y: number;
  xOf: (date: string) => number;
  colWidth: number;
  workspace: Workspace;
  today: string;
  dragOffset: number;
  dragMode: "move" | "start" | "end" | null;
  onPointerDown: (
    event: React.PointerEvent,
    task: Task,
    mode: "move" | "start" | "end",
  ) => void;
  onOpen: () => void;
}) {
  const status = workspace.statuses.find((s) => s.id === task.statusId);
  const project = workspace.projects.find((p) => p.id === task.projectId);

  let start = task.startDate ?? task.dueDate!;
  let end = task.dueDate ?? task.startDate!;

  // Previsualización mientras se arrastra.
  if (dragMode === "move") {
    start = addDays(start, dragOffset);
    end = addDays(end, dragOffset);
  } else if (dragMode === "start") {
    start = addDays(start, dragOffset);
  } else if (dragMode === "end") {
    end = addDays(end, dragOffset);
  }
  if (start > end) [start, end] = [end, start];

  const x = xOf(start);
  const width = Math.max(
    colWidth * 0.8,
    (daysBetween(start, end) + 1) * colWidth,
  );
  const barY = y + 5;
  const barHeight = ROW_HEIGHT - 12;

  const overdue =
    task.dueDate != null && task.dueDate < today && !status?.isDone;
  const color = status?.isDone
    ? "var(--color-success)"
    : overdue
      ? "var(--color-danger)"
      : (project?.color ?? "var(--color-accent)");

  return (
    <g>
      <title>
        {`${task.title}\n${formatDate(start)} → ${formatDate(end)}\n${task.progress}% completado`}
      </title>

      {/* El cuerpo es un tinte del fondo, no el color pleno, y el borde
          lleva el color entero. Así el título de adentro puede usar el color
          de texto normal del tema y leerse siempre: contra un tinte suave
          contrasta igual de bien en claro que en oscuro, y da lo mismo qué
          color se le haya puesto al proyecto —incluso uno casi negro—.
          Pintar la barra a pleno obligaba a adivinar el color del texto, que
          es un problema sin solución cuando el color lo elige quien usa la
          app y los tokens además cambian con el tema. */}
      <rect
        x={x}
        y={barY}
        width={width}
        height={barHeight}
        rx={3}
        fill={color}
        fillOpacity={status?.isCancelled ? 0.09 : 0.22}
        stroke={color}
        strokeOpacity={status?.isCancelled ? 0.3 : 0.85}
        strokeWidth={1}
        className="cursor-grab"
        onPointerDown={(e) => onPointerDown(e, task, "move")}
        onDoubleClick={onOpen}
      />

      {/* El progreso es un segundo tinte del mismo color, no el color pleno:
          la diferencia entre los dos alcanza para leer cuánto va hecho, y el
          título sigue contrastando esté sobre la parte hecha o sobre la
          pendiente.

          Ojo con el valor: este tinte se apila sobre el de la barra, así que
          el resultado es 1-(1-0,22)(1-0,26) ≈ 0,42, no 0,26. Subirlo hasta
          que "se note" tira el contraste del título abajo del mínimo.

          El recorte lo mantiene dentro de las esquinas redondeadas, así el
          borde entre hecho y pendiente queda recto. */}
      {task.progress > 0 ? (
        <>
          <clipPath id={`barra-${task.id}`}>
            <rect x={x} y={barY} width={width} height={barHeight} rx={3} />
          </clipPath>
          <rect
            x={x}
            y={barY}
            width={(width * task.progress) / 100}
            height={barHeight}
            fill={color}
            fillOpacity={status?.isCancelled ? 0.1 : 0.26}
            clipPath={`url(#barra-${task.id})`}
            pointerEvents="none"
          />
        </>
      ) : null}

      {/* Asas de redimensionado */}
      <rect
        x={x - 2}
        y={barY}
        width={5}
        height={barHeight}
        fill="transparent"
        className="cursor-ew-resize"
        onPointerDown={(e) => onPointerDown(e, task, "start")}
      />
      <rect
        x={x + width - 3}
        y={barY}
        width={5}
        height={barHeight}
        fill="transparent"
        className="cursor-ew-resize"
        onPointerDown={(e) => onPointerDown(e, task, "end")}
      />

      {width > 60 ? (
        <text
          x={x + 5}
          y={barY + barHeight / 2 + 3}
          fontSize={9}
          fill="var(--color-foreground)"
          pointerEvents="none"
        >
          {task.title.slice(0, Math.floor(width / 6))}
        </text>
      ) : null}
    </g>
  );
}

function DependencyLines({
  dependencies,
  tasks,
  taskRowIndex,
  xOf,
  colWidth,
}: {
  dependencies: TaskDependency[];
  tasks: Task[];
  taskRowIndex: Map<number, number>;
  xOf: (date: string) => number;
  colWidth: number;
}) {
  const byId = new Map(tasks.map((t) => [t.id, t]));

  return (
    <g>
      <defs>
        <marker
          id="gantt-arrow"
          viewBox="0 0 8 8"
          refX={7}
          refY={4}
          markerWidth={5}
          markerHeight={5}
          orient="auto"
        >
          <path d="M0,0 L8,4 L0,8 z" fill="var(--color-muted)" />
        </marker>
      </defs>

      {dependencies.map((dep) => {
        const from = byId.get(dep.predecessorId);
        const to = byId.get(dep.successorId);
        const fromRow = taskRowIndex.get(dep.predecessorId);
        const toRow = taskRowIndex.get(dep.successorId);
        if (!from || !to || fromRow == null || toRow == null) return null;

        const fromEnd = from.dueDate ?? from.startDate!;
        const toStart = to.startDate ?? to.dueDate!;

        const x1 = xOf(fromEnd) + colWidth;
        const y1 = fromRow * ROW_HEIGHT + ROW_HEIGHT / 2;
        const x2 = xOf(toStart);
        const y2 = toRow * ROW_HEIGHT + ROW_HEIGHT / 2;

        // Codo en L: sale a la derecha de la predecesora, baja, y entra
        // por la izquierda de la sucesora.
        const midX = x2 > x1 + 12 ? x1 + (x2 - x1) / 2 : x1 + 10;
        const path = `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;

        return (
          <path
            key={dep.id}
            d={path}
            fill="none"
            stroke="var(--color-muted)"
            strokeWidth={1}
            opacity={0.6}
            markerEnd="url(#gantt-arrow)"
          />
        );
      })}
    </g>
  );
}

/** Filas del Gantt: proyecto → fase → tarea, en el orden configurado. */
function buildRows(tasks: Task[], workspace: Workspace): Row[] {
  const out: Row[] = [];

  for (const project of workspace.projects) {
    const projectTasks = tasks.filter((t) => t.projectId === project.id);
    if (projectTasks.length === 0) continue;

    out.push({
      kind: "project",
      id: `p-${project.id}`,
      label: `${project.code} · ${project.name}`,
      color: project.color,
    });

    const projectPhases = workspace.phases.filter(
      (p) => p.projectId === project.id,
    );

    for (const phase of projectPhases) {
      const phaseTasks = projectTasks.filter((t) => t.phaseId === phase.id);
      if (phaseTasks.length === 0) continue;
      out.push({ kind: "phase", id: `f-${phase.id}`, label: phase.name });
      for (const task of sortByDate(phaseTasks)) {
        out.push({ kind: "task", id: `t-${task.id}`, task, depth: 2 });
      }
    }

    const orphans = projectTasks.filter(
      (t) =>
        t.phaseId == null || !projectPhases.some((p) => p.id === t.phaseId),
    );
    if (orphans.length > 0) {
      out.push({
        kind: "phase",
        id: `f-none-${project.id}`,
        label: "Sin fase",
      });
      for (const task of sortByDate(orphans)) {
        out.push({ kind: "task", id: `t-${task.id}`, task, depth: 2 });
      }
    }
  }

  return out;
}

function sortByDate(list: Task[]): Task[] {
  return [...list].sort((a, b) => {
    const aStart = a.startDate ?? a.dueDate ?? "9999-12-31";
    const bStart = b.startDate ?? b.dueDate ?? "9999-12-31";
    return aStart.localeCompare(bStart) || a.position - b.position;
  });
}
