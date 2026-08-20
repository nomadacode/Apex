"use client";

import Link from "next/link";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  LayoutDashboard,
  ListTodo,
  Timer,
} from "lucide-react";

import { ChartCard, DataTable, Legend } from "@/components/charts/chart-frame";
import { ColumnChart } from "@/components/charts/column-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { seriesVar } from "@/components/charts/palette";
import { Button } from "@/components/ui/button";
import { formatDateShort } from "@/lib/dates";
import type { WeekPoint } from "@/lib/analytics";

import { FiltersBar } from "@/components/tasks/filters-bar";
import { DaysRemainingBadge, PersonAvatar } from "@/components/tasks/task-badges";
import { EmptyState } from "@/components/ui/empty-state";
import type { Task } from "@/db/schema";
import { cn } from "@/lib/cn";
import type { Breakdown, Kpis, ProjectSummary } from "@/lib/dashboard-queries";
import { formatDate } from "@/lib/dates";
import { daysRemaining, durationDays, workdaysBetween } from "@/lib/derive";
import type { Workspace } from "@/lib/task-queries";

export function DashboardScreen({
  kpis,
  breakdowns,
  attention,
  projectSummaries,
  flow,
  workspace,
  today,
  filterQuery,
}: {
  kpis: Kpis;
  breakdowns: {
    byStatus: Breakdown[];
    byPriority: Breakdown[];
    byStage: Breakdown[];
    byAssignee: Breakdown[];
  };
  attention: { dueToday: Task[]; overdue: Task[] };
  projectSummaries: ProjectSummary[];
  /** Últimas semanas de creadas contra completadas. */
  flow: WeekPoint[];
  workspace: Workspace;
  today: string;
  /** Filtros vigentes, para que los KPIs lleven a Tareas con el mismo recorte. */
  filterQuery: string;
}) {
  if (workspace.projects.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<LayoutDashboard className="size-8" />}
          title="Todavía no hay nada que mostrar"
          description="El tablero se arma solo a partir de tus proyectos y tareas. Empezá creando un proyecto."
          action={{
            label: "Ir a Configuración",
            href: "/configuracion?tab=proyectos",
          }}
        />
      </div>
    );
  }

  const link = (extra: string) =>
    `/tareas${filterQuery ? `?${filterQuery}${extra ? `&${extra}` : ""}` : extra ? `?${extra}` : ""}`;

  // Cada corte del tablero tiene su reporte detrás: acá se abre el que
  // corresponde, conservando el proyecto y el rango que estén filtrados.
  const reportLink = (tab: string) =>
    `/reportes?${[filterQuery, `r=${tab}`].filter(Boolean).join("&")}`;

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6">
      <FiltersBar workspace={workspace} show={["project", "dates"]} />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi
          label="Total de tareas"
          value={kpis.total}
          icon={<ListTodo className="size-4" />}
          href={link("")}
        />
        <Kpi
          label="Completadas"
          value={kpis.done}
          icon={<CheckCircle2 className="size-4" />}
          tone="success"
          href={link(doneParam(workspace))}
        />
        <Kpi
          label="Completado"
          value={`${Math.round(kpis.completion * 100)}%`}
          icon={<CircleDashed className="size-4" />}
          progress={kpis.completion}
        />
        <Kpi
          label="Pendientes"
          value={kpis.pending}
          icon={<Timer className="size-4" />}
          href={link("")}
        />
        <Kpi
          label="Atrasadas"
          value={kpis.overdue}
          icon={<AlertTriangle className="size-4" />}
          tone={kpis.overdue > 0 ? "danger" : undefined}
          href={link(`hasta=${previousDay(today)}`)}
        />
        <Kpi
          label="Vencen hoy"
          value={kpis.dueToday}
          icon={<CalendarClock className="size-4" />}
          tone={kpis.dueToday > 0 ? "warning" : undefined}
          href={link(`desde=${today}&hasta=${today}`)}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
        <ChartCard
          title="Estado del trabajo"
          subtitle="Todo lo cargado, incluidas las canceladas"
          legend={<Legend items={statusSlices(breakdowns.byStatus)} />}
          table={
            <DataTable
              columns={["Estado", "Tareas"]}
              rows={statusSlices(breakdowns.byStatus).map((s) => [
                s.label,
                s.value,
              ])}
            />
          }
        >
          <DonutChart
            data={statusSlices(breakdowns.byStatus)}
            centerValue={`${Math.round(kpis.completion * 100)}%`}
            centerLabel="completado"
          />
        </ChartCard>

        <ChartCard
          title="Ritmo de las últimas semanas"
          subtitle={
            flowVerdict(flow)
          }
          legend={
            <Legend
              items={[
                { label: "Creadas", color: seriesVar(0) },
                { label: "Completadas", color: seriesVar(2) },
              ]}
            />
          }
          actions={
            <Link href={`/reportes?${[filterQuery, "r=flujo"].filter(Boolean).join("&")}`}>
              <Button size="sm" variant="ghost">
                <BarChart3 className="size-3.5" /> Ver flujo
              </Button>
            </Link>
          }
          table={
            <DataTable
              columns={["Semana", "Creadas", "Completadas"]}
              rows={flow.map((p) => [
                formatDateShort(p.weekStart),
                p.created,
                p.completed,
              ])}
            />
          }
        >
          <ColumnChart
            labels={flow.map((p) => formatDateShort(p.weekStart))}
            series={[
              {
                label: "Creadas",
                color: seriesVar(0),
                values: flow.map((p) => p.created),
              },
              {
                label: "Completadas",
                color: seriesVar(2),
                values: flow.map((p) => p.completed),
              },
            ]}
          />
        </ChartCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Atrasadas" count={attention.overdue.length}>
          {attention.overdue.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              Nada atrasado. 🎉
            </p>
          ) : (
            <TaskList
              tasks={attention.overdue}
              workspace={workspace}
              today={today}
            />
          )}
        </Panel>

        <Panel title="Vencen hoy" count={attention.dueToday.length}>
          {attention.dueToday.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">
              No vence nada hoy.
            </p>
          ) : (
            <TaskList
              tasks={attention.dueToday}
              workspace={workspace}
              today={today}
            />
          )}
        </Panel>
      </div>

      <Panel title="Proyectos" count={projectSummaries.length}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-3 py-2 font-medium">Proyecto</th>
                <th className="px-3 py-2 font-medium">Cliente</th>
                <th className="px-3 py-2 font-medium">Líder</th>
                <th className="px-3 py-2 font-medium">Fechas</th>
                <th className="px-3 py-2 text-right font-medium">Duración</th>
                <th className="px-3 py-2 text-right font-medium">Laborables</th>
                <th className="px-3 py-2 text-right font-medium">Atrasadas</th>
                <th className="px-3 py-2 font-medium">Avance</th>
              </tr>
            </thead>
            <tbody>
              {projectSummaries.map((summary) => {
                const leader = workspace.people.find(
                  (p) => p.id === summary.project.leaderId,
                );
                const duration = durationDays(
                  summary.project.startDate,
                  summary.project.endDate,
                );
                const workdays = workdaysBetween(
                  summary.project.startDate,
                  summary.project.endDate,
                  workspace.calendar,
                );
                return (
                  <tr
                    key={summary.project.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-3 py-2">
                      <Link
                        href={`/tareas?proyecto=${summary.project.id}`}
                        className="flex items-center gap-2 hover:underline"
                      >
                        <span
                          className="size-2.5 shrink-0 rounded-full"
                          style={{ background: summary.project.color }}
                        />
                        <span className="font-mono text-xs text-muted">
                          {summary.project.code}
                        </span>
                        {summary.project.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-muted">
                      {summary.project.client || "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <PersonAvatar person={leader} />
                        <span className="text-muted">{leader?.name ?? "—"}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted">
                      {summary.project.startDate && summary.project.endDate
                        ? `${formatDate(summary.project.startDate)} → ${formatDate(summary.project.endDate)}`
                        : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-muted">
                      {duration != null ? `${duration} d` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-muted">
                      {workdays != null ? `${workdays} d` : "—"}
                    </td>
                    <td
                      className={cn(
                        "px-3 py-2 text-right",
                        summary.overdue > 0 ? "text-danger" : "text-muted",
                      )}
                    >
                      {summary.overdue}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-2">
                          <div
                            className="h-full rounded-full bg-accent"
                            style={{ width: `${summary.completion * 100}%` }}
                          />
                        </div>
                        <span className="w-20 text-xs text-muted">
                          {summary.done}/{summary.total} ·{" "}
                          {Math.round(summary.completion * 100)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <BreakdownPanel
          title="Por estado"
          rows={breakdowns.byStatus}
          total={kpis.total + kpis.cancelled}
          hrefFor={(id) => link(id == null ? "" : `estado=${id}`)}
          reportHref={reportLink("distribucion")}
          reportLabel="Ver distribución completa"
        />
        <BreakdownPanel
          title="Por prioridad"
          rows={breakdowns.byPriority}
          total={kpis.total + kpis.cancelled}
          hrefFor={(id) => link(id == null ? "" : `prioridad=${id}`)}
          reportHref={reportLink("distribucion")}
          reportLabel="Ver distribución completa"
        />
        <BreakdownPanel
          title="Por etapa"
          rows={breakdowns.byStage}
          total={kpis.total + kpis.cancelled}
          hrefFor={(id) => link(id == null ? "" : `etapa=${id}`)}
          reportHref={reportLink("flujo")}
          reportLabel="Ver dónde se traba el flujo"
        />
        <BreakdownPanel
          title="Por responsable"
          rows={breakdowns.byAssignee}
          total={kpis.total + kpis.cancelled}
          hrefFor={(id) => link(`responsable=${id ?? "ninguno"}`)}
          reportHref={reportLink("equipo")}
          reportLabel="Ver carga y demoras del equipo"
        />
      </div>
    </div>
  );
}

function Kpi({
  label,
  value,
  icon,
  tone,
  href,
  progress,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone?: "success" | "danger" | "warning";
  href?: string;
  progress?: number;
}) {
  const body = (
    <div
      className={cn(
        "flex h-full flex-col gap-1 rounded-lg border border-border bg-surface px-4 py-3 transition-colors",
        href && "hover:border-accent",
      )}
    >
      <div className="flex items-center gap-2 text-xs text-muted">
        {icon}
        {label}
      </div>
      <span
        className={cn(
          "text-2xl font-semibold tabular-nums",
          tone === "danger" && "text-danger",
          tone === "warning" && "text-warning",
          tone === "success" && "text-success",
        )}
      >
        {value}
      </span>
      {progress !== undefined ? (
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-accent"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      ) : null}
    </div>
  );

  return href ? <Link href={href}>{body}</Link> : body;
}

function Panel({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border bg-surface">
      <header className="flex items-baseline gap-2 border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-medium">{title}</h2>
        {count !== undefined ? (
          <span className="text-xs text-muted">{count}</span>
        ) : null}
      </header>
      <div className="p-2">{children}</div>
    </section>
  );
}

function TaskList({
  tasks,
  workspace,
  today,
}: {
  tasks: Task[];
  workspace: Workspace;
  today: string;
}) {
  const statusById = new Map(workspace.statuses.map((s) => [s.id, s]));
  return (
    <ul className="divide-y divide-border">
      {tasks.map((task) => {
        const project = workspace.projects.find((p) => p.id === task.projectId);
        const assignee = workspace.people.find((p) => p.id === task.assigneeId);
        return (
          <li key={task.id}>
            <Link
              href={`/tareas?tarea=${task.id}`}
              className="flex items-center gap-2 px-2 py-2 text-sm hover:bg-surface-2"
            >
              <span
                className="size-2 shrink-0 rounded-full"
                style={{ background: project?.color ?? "#94a3b8" }}
              />
              <span className="min-w-0 flex-1 truncate">{task.title}</span>
              <PersonAvatar person={assignee} />
              <DaysRemainingBadge
                value={daysRemaining(task, statusById, today)}
              />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function BreakdownPanel({
  title,
  rows,
  total,
  hrefFor,
  reportHref,
  reportLabel,
}: {
  title: string;
  rows: Breakdown[];
  total: number;
  hrefFor: (id: number | null) => string;
  /** Reporte detallado que corresponde a este corte. */
  reportHref: string;
  reportLabel: string;
}) {
  const visible = rows.filter((r) => r.count > 0);
  return (
    <section className="flex flex-col rounded-lg border border-border bg-surface">
      <header className="flex items-baseline justify-between gap-2 border-b border-border px-4 py-2.5">
        <h2 className="text-sm font-medium">{title}</h2>
      </header>

      <div className="flex-1 p-2">
        {visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Sin datos.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 p-1">
            {visible.map((row) => (
              <li key={`${row.id}`}>
                <Link
                  href={hrefFor(row.id)}
                  className="flex items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-surface-2"
                >
                  <span className="min-w-0 flex-1 truncate">{row.label}</span>
                  <div className="h-1.5 w-16 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${total === 0 ? 0 : (row.count / total) * 100}%`,
                        background: row.color,
                      }}
                    />
                  </div>
                  <span className="w-6 text-right text-xs tabular-nums text-muted">
                    {row.count}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* El corte es el resumen; el reporte es el análisis detrás. */}
      <Link
        href={reportHref}
        className="flex items-center justify-between gap-2 border-t border-border px-4 py-2 text-xs text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
      >
        {reportLabel}
        <ChevronRight className="size-3.5 shrink-0" />
      </Link>
    </section>
  );
}

/** Gajos con valor: un cero no aporta y ensucia la leyenda. */
function statusSlices(rows: Breakdown[]) {
  return rows
    .filter((row) => row.count > 0)
    .map((row) => ({ label: row.label, value: row.count, color: row.color }));
}

/** Lectura del ritmo en una frase, que es lo que un PM quiere del gráfico. */
function flowVerdict(flow: WeekPoint[]): string {
  const created = flow.reduce((sum, p) => sum + p.created, 0);
  const completed = flow.reduce((sum, p) => sum + p.completed, 0);
  if (created === 0 && completed === 0) {
    return "Todavía no hay movimiento en el período";
  }
  if (completed > created) {
    return `Se cerraron ${completed} y entraron ${created}: la cola se está achicando`;
  }
  if (completed === created) {
    return `Entraron y salieron ${created}: el equipo va al día`;
  }
  return `Entraron ${created} y se cerraron ${completed}: la cola está creciendo`;
}

function doneParam(workspace: Workspace): string {
  const done = workspace.statuses.find((s) => s.isDone);
  return done ? `estado=${done.id}` : "";
}

function previousDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const prev = new Date(Date.UTC(y, m - 1, d - 1));
  return prev.toISOString().slice(0, 10);
}
