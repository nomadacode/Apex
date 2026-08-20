"use client";

import Link from "next/link";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Hourglass,
  TrendingUp,
} from "lucide-react";

import { BarChart } from "@/components/charts/bar-chart";
import {
  ChartCard,
  ChartEmpty,
  DataTable,
  Legend,
} from "@/components/charts/chart-frame";
import { ColumnChart } from "@/components/charts/column-chart";
import { DonutChart, Gauge } from "@/components/charts/donut-chart";
import { LineChart } from "@/components/charts/line-chart";
import { ordinalVar, seriesVar } from "@/components/charts/palette";
import { StackedBar, StackedRows } from "@/components/charts/stacked-bar";
import { StatTile } from "@/components/charts/stat-tile";
import { FiltersBar } from "@/components/tasks/filters-bar";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs } from "@/components/ui/tabs";
import {
  formatDays,
  formatDuration,
  type PersonStats,
} from "@/lib/analytics";
import { formatDateShort } from "@/lib/dates";
import type { ReportData } from "@/lib/report-queries";
import type { Workspace } from "@/lib/task-queries";

export function ReportsScreen({
  data,
  workspace,
  today,
  scopeQuery,
}: {
  data: ReportData;
  workspace: Workspace;
  today: string;
  /** Filtros vigentes, para que cada enlace a Tareas conserve el recorte. */
  scopeQuery: string;
}) {
  if (workspace.projects.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={<TrendingUp className="size-8" />}
          title="Todavía no hay proyectos"
          description="Los reportes se calculan sobre tus tareas. Creá un proyecto y cargá trabajo para ver cómo avanza."
          action={{
            label: "Ir a Configuración",
            href: "/configuracion?tab=proyectos",
          }}
        />
      </div>
    );
  }

  const link = (extra: string) =>
    `/tareas${scopeQuery || extra ? "?" : ""}${[scopeQuery, extra].filter(Boolean).join("&")}`;

  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <FiltersBar workspace={workspace} show={["project"]} />

      <Tabs
        param="r"
        tabs={[
          { id: "entrega", label: "Entrega y demoras" },
          { id: "equipo", label: "Equipo" },
          { id: "flujo", label: "Flujo y etapas" },
          { id: "distribucion", label: "Distribución" },
        ]}
      >
        {(active) => (
          <>
            {active === "entrega" ? (
              <DeliveryTab data={data} workspace={workspace} link={link} />
            ) : null}
            {active === "equipo" ? (
              <TeamTab data={data} workspace={workspace} link={link} />
            ) : null}
            {active === "flujo" ? (
              <FlowTab data={data} workspace={workspace} link={link} />
            ) : null}
            {active === "distribucion" ? (
              <DistributionTab
                data={data}
                workspace={workspace}
                today={today}
                link={link}
              />
            ) : null}
          </>
        )}
      </Tabs>
    </div>
  );
}

/* ─────────────────────────  Entrega y demoras  ─────────────────────── */

function DeliveryTab({
  data,
  workspace,
  link,
}: {
  data: ReportData;
  workspace: Workspace;
  link: (extra: string) => string;
}) {
  const p = data.punctuality;
  const judged = p.onTime + p.late;

  // Quién cierra más tarde: el ranking que pediste, ordenado por atraso.
  const delayRanking = data.people
    .filter((row) => row.avgDelay != null)
    .slice(0, 8)
    .map((row) => ({
      label: personName(row.personId, workspace),
      value: row.avgDelay!,
      display: formatDays(row.avgDelay),
      note: `en ${row.withDueDate} tarea(s) con fecha`,
      color: "var(--viz-critical)",
      href: link(personParam(row.personId)),
    }));

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Entregas a tiempo"
          value={p.rate == null ? "—" : `${Math.round(p.rate * 100)}%`}
          hint={
            judged === 0
              ? "Todavía no cerró nada con fecha límite"
              : `${p.onTime} de ${judged} cerradas con fecha`
          }
          tone={p.rate == null ? undefined : p.rate >= 0.8 ? "good" : p.rate >= 0.5 ? "warning" : "critical"}
          icon={<CheckCircle2 className="size-3.5" />}
        />
        <StatTile
          label="Atraso promedio"
          value={p.avgDelay == null ? "—" : formatDays(p.avgDelay)}
          hint="De las que cerraron tarde"
          tone={p.avgDelay == null ? undefined : p.avgDelay > 5 ? "critical" : "warning"}
          icon={<Clock className="size-3.5" />}
        />
        <StatTile
          label="Vencidas sin cerrar"
          value={p.openOverdue}
          hint="Pasaron su fecha y siguen abiertas"
          tone={p.openOverdue > 0 ? "critical" : "good"}
          icon={<AlertTriangle className="size-3.5" />}
          href={link("")}
        />
        <StatTile
          label="Sin fecha límite"
          value={p.unmeasured}
          hint="Cerradas que no se pueden juzgar"
          icon={<Hourglass className="size-3.5" />}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <ChartCard
          title="Cumplimiento de fechas"
          subtitle="Cómo cerró el trabajo que tenía fecha comprometida"
          table={
            <DataTable
              columns={["Resultado", "Tareas"]}
              rows={[
                ["A tiempo", p.onTime],
                ["Tarde", p.late],
                ["Vencidas sin cerrar", p.openOverdue],
                ["Sin fecha límite", p.unmeasured],
              ]}
            />
          }
        >
          {judged + p.openOverdue === 0 ? (
            <ChartEmpty message="Todavía no hay tareas cerradas ni vencidas con fecha límite." />
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Gauge
                value={p.rate ?? 0}
                label="a tiempo"
                tone={
                  (p.rate ?? 0) >= 0.8
                    ? "var(--viz-good)"
                    : (p.rate ?? 0) >= 0.5
                      ? "var(--viz-warning)"
                      : "var(--viz-critical)"
                }
              />
              <div className="w-full">
                <StackedBar
                  segments={[
                    { label: "A tiempo", value: p.onTime, color: "var(--viz-good)" },
                    { label: "Tarde", value: p.late, color: "var(--viz-warning)" },
                    {
                      label: "Vencidas sin cerrar",
                      value: p.openOverdue,
                      color: "var(--viz-critical)",
                    },
                  ]}
                />
                <div className="mt-2">
                  <Legend
                    items={[
                      { label: "A tiempo", color: "var(--viz-good)" },
                      { label: "Tarde", color: "var(--viz-warning)" },
                      { label: "Vencidas sin cerrar", color: "var(--viz-critical)" },
                    ]}
                  />
                </div>
              </div>
            </div>
          )}
        </ChartCard>

        <ChartCard
          title="Quiénes cierran más tarde"
          subtitle="Días de atraso promedio al cerrar, contando solo las que cerraron después de la fecha"
          table={
            <DataTable
              columns={["Responsable", "Atraso medio", "Con fecha", "A tiempo"]}
              rows={data.people.map((row) => [
                personName(row.personId, workspace),
                formatDays(row.avgDelay),
                row.withDueDate,
                row.onTimeRate == null
                  ? "—"
                  : `${Math.round(row.onTimeRate * 100)}%`,
              ])}
            />
          }
        >
          {delayRanking.length === 0 ? (
            <ChartEmpty message="Nadie cerró tareas fuera de fecha todavía. Buena señal." />
          ) : (
            <BarChart data={delayRanking} emphasis={0} />
          )}
        </ChartCard>
      </div>

      <ChartCard
        title="Antigüedad del trabajo abierto"
        subtitle="Hace cuánto que espera cada tarea sin cerrarse. Las bandas altas son deuda: probablemente ya no reflejan la realidad"
        table={
          <DataTable
            columns={["Antigüedad", "Tareas"]}
            rows={data.aging.map((b) => [b.label, b.count])}
          />
        }
      >
        {data.aging.every((b) => b.count === 0) ? (
          <ChartEmpty message="No hay tareas abiertas." />
        ) : (
          <div className="flex flex-col gap-3">
            <BarChart
              labelWidth={92}
              data={data.aging.map((bucket, index) => ({
                label: bucket.label,
                value: bucket.count,
                display: String(bucket.count),
                // Rampa ordinal: la antigüedad SÍ tiene orden natural.
                color: ordinalVar(index, data.aging.length),
                note:
                  bucket.sample.length > 0
                    ? `la más vieja: ${bucket.sample[0].title}`
                    : undefined,
              }))}
            />
            {data.aging[4].count > 0 ? (
              <p className="rounded-md bg-warning/10 px-3 py-2 text-xs text-foreground/80">
                <AlertTriangle className="mr-1 inline size-3.5 text-warning" />
                {data.aging[4].count} tarea(s) llevan más de 30 días abiertas.
                Conviene cerrarlas, repartirlas o darlas de baja.
              </p>
            ) : null}
          </div>
        )}
      </ChartCard>
    </div>
  );
}

/* ────────────────────────────────  Equipo  ─────────────────────────── */

function TeamTab({
  data,
  workspace,
  link,
}: {
  data: ReportData;
  workspace: Workspace;
  link: (extra: string) => string;
}) {
  const people = data.people;

  if (people.length === 0) {
    return (
      <EmptyState
        title="Todavía no hay tareas asignadas"
        description="Asigná responsables a las tareas y acá vas a ver cómo se reparte y avanza el trabajo de cada uno."
        action={{ label: "Ir a Tareas", href: "/tareas" }}
      />
    );
  }

  const workload = people.map((row) => ({
    label: personName(row.personId, workspace),
    href: link(personParam(row.personId)),
    values: [row.open - row.overdue, row.overdue, row.done],
  }));

  const leadRanking = [...people]
    .filter((row) => row.avgLeadTime != null)
    .sort((a, b) => b.avgLeadTime! - a.avgLeadTime!)
    .map((row) => ({
      label: personName(row.personId, workspace),
      value: row.avgLeadTime!,
      display: formatDays(row.avgLeadTime),
      note: `${row.done} cerradas`,
      href: link(personParam(row.personId)),
    }));

  return (
    <div className="flex flex-col gap-4">
      <ChartCard
        title="Carga por responsable"
        subtitle="Cómo se reparte el trabajo hoy. La franja roja es lo que ya venció"
        legend={
          <Legend
            items={[
              { label: "Abiertas en fecha", color: seriesVar(0) },
              { label: "Vencidas", color: "var(--viz-critical)" },
              { label: "Completadas", color: "var(--viz-good)" },
            ]}
          />
        }
        table={
          <DataTable
            columns={["Responsable", "Abiertas", "Vencidas", "Completadas"]}
            rows={people.map((row) => [
              personName(row.personId, workspace),
              row.open - row.overdue,
              row.overdue,
              row.done,
            ])}
          />
        }
      >
        <StackedRows
          rows={workload}
          keys={[
            { label: "Abiertas en fecha", color: seriesVar(0) },
            { label: "Vencidas", color: "var(--viz-critical)" },
            { label: "Completadas", color: "var(--viz-good)" },
          ]}
        />
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Tiempo de punta a punta"
          subtitle="Días promedio entre que se crea una tarea y se cierra"
          table={
            <DataTable
              columns={["Responsable", "Lead time", "Cycle time", "Cerradas"]}
              rows={people.map((row) => [
                personName(row.personId, workspace),
                formatDays(row.avgLeadTime),
                formatDays(row.avgCycleTime),
                row.done,
              ])}
            />
          }
        >
          {leadRanking.length === 0 ? (
            <ChartEmpty message="Todavía nadie cerró tareas: no hay tiempos que medir." />
          ) : (
            <BarChart data={leadRanking} emphasis={0} />
          )}
        </ChartCard>

        <ChartCard
          title="Puntualidad por persona"
          subtitle="Porcentaje de tareas cerradas dentro de la fecha comprometida"
          table={
            <DataTable
              columns={["Responsable", "A tiempo", "Tarde", "% a tiempo"]}
              rows={people.map((row) => [
                personName(row.personId, workspace),
                row.onTime,
                row.withDueDate - row.onTime,
                row.onTimeRate == null
                  ? "—"
                  : `${Math.round(row.onTimeRate * 100)}%`,
              ])}
            />
          }
        >
          {people.every((row) => row.onTimeRate == null) ? (
            <ChartEmpty message="Nadie cerró todavía tareas con fecha límite." />
          ) : (
            <BarChart
              data={people
                .filter((row) => row.onTimeRate != null)
                .sort((a, b) => a.onTimeRate! - b.onTimeRate!)
                .map((row) => ({
                  label: personName(row.personId, workspace),
                  value: row.onTimeRate! * 100,
                  display: `${Math.round(row.onTimeRate! * 100)}%`,
                  note: `${row.withDueDate} con fecha`,
                  color:
                    row.onTimeRate! >= 0.8
                      ? "var(--viz-good)"
                      : row.onTimeRate! >= 0.5
                        ? "var(--viz-warning)"
                        : "var(--viz-critical)",
                  href: link(personParam(row.personId)),
                }))}
            />
          )}
        </ChartCard>
      </div>

      <ChartCard
        title="Detalle por responsable"
        subtitle="Todo junto, ordenado por atraso promedio"
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[46rem] text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-2 py-1.5 font-medium">Responsable</th>
                <th className="px-2 py-1.5 text-right font-medium">Abiertas</th>
                <th className="px-2 py-1.5 text-right font-medium">Vencidas</th>
                <th className="px-2 py-1.5 text-right font-medium">Cerradas</th>
                <th className="px-2 py-1.5 text-right font-medium">% a tiempo</th>
                <th className="px-2 py-1.5 text-right font-medium">Atraso medio</th>
                <th className="px-2 py-1.5 text-right font-medium">Lead time</th>
                <th className="px-2 py-1.5 text-right font-medium">La más vieja</th>
              </tr>
            </thead>
            <tbody>
              {people.map((row) => (
                <tr
                  key={String(row.personId)}
                  className="border-b border-border last:border-0"
                >
                  <td className="px-2 py-1.5">
                    <Link
                      href={link(personParam(row.personId))}
                      className="hover:underline"
                    >
                      {personName(row.personId, workspace)}
                    </Link>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted">
                    {row.open}
                  </td>
                  <td
                    className={`px-2 py-1.5 text-right tabular-nums ${row.overdue > 0 ? "text-danger" : "text-muted"}`}
                  >
                    {row.overdue}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted">
                    {row.done}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted">
                    {row.onTimeRate == null
                      ? "—"
                      : `${Math.round(row.onTimeRate * 100)}%`}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted">
                    {formatDays(row.avgDelay)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted">
                    {formatDays(row.avgLeadTime)}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted">
                    {row.oldestOpenDays == null ? "—" : `${row.oldestOpenDays} d`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ChartCard>
    </div>
  );
}

/* ──────────────────────────  Flujo y etapas  ───────────────────────── */

function FlowTab({
  data,
  workspace,
  link,
}: {
  data: ReportData;
  workspace: Workspace;
  link: (extra: string) => string;
}) {
  const stageName = (id: number | null) =>
    id == null
      ? "Sin etapa"
      : (() => {
          const stage = workspace.stages.find((s) => s.id === id);
          return stage ? `${stage.emoji} ${stage.name}`.trim() : `#${id}`;
        })();

  const stageBars = data.stages.slice(0, 10).map((row) => ({
    label: stageName(row.stageId),
    value: row.avgHours,
    display: formatDuration(row.avgHours),
    note: `${row.tasks} tarea(s)`,
    color: workspace.stages.find((s) => s.id === row.stageId)?.color,
    href: row.stageId == null ? undefined : link(`etapa=${row.stageId}`),
  }));

  const labels = data.flow.map((point) => formatDateShort(point.weekStart));
  const totalCreated = data.flow.reduce((sum, p) => sum + p.created, 0);
  const totalCompleted = data.flow.reduce((sum, p) => sum + p.completed, 0);

  return (
    <div className="flex flex-col gap-4">
      <ChartCard
        title="Dónde se queda trabado el trabajo"
        subtitle="Tiempo promedio que pasa una tarea en cada etapa antes de moverse. Se reconstruye del historial de cambios"
        table={
          <DataTable
            columns={["Etapa", "Promedio", "Total", "Tareas"]}
            rows={data.stages.map((row) => [
              stageName(row.stageId),
              formatDuration(row.avgHours),
              formatDuration(row.totalHours),
              row.tasks,
            ])}
          />
        }
      >
        {stageBars.length === 0 ? (
          <ChartEmpty message="Todavía no hay historial de movimientos entre etapas." />
        ) : (
          <div className="flex flex-col gap-3">
            <BarChart data={stageBars} labelWidth={148} emphasis={0} />
            {data.stages[0] ? (
              <p className="rounded-md bg-surface-2 px-3 py-2 text-xs text-foreground/80">
                El cuello de botella está en{" "}
                <strong>{stageName(data.stages[0].stageId)}</strong>: cada tarea
                pasa ahí {formatDuration(data.stages[0].avgHours)} en promedio.
              </p>
            ) : null}
          </div>
        )}
      </ChartCard>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Entra contra sale"
          subtitle={
            totalCreated > totalCompleted
              ? `Se crearon ${totalCreated} y se cerraron ${totalCompleted}: la cola está creciendo`
              : `Se crearon ${totalCreated} y se cerraron ${totalCompleted}: el equipo va al día`
          }
          legend={
            <Legend
              items={[
                { label: "Creadas", color: seriesVar(0) },
                { label: "Completadas", color: seriesVar(2) },
              ]}
            />
          }
          table={
            <DataTable
              columns={["Semana", "Creadas", "Completadas"]}
              rows={data.flow.map((p) => [
                formatDateShort(p.weekStart),
                p.created,
                p.completed,
              ])}
            />
          }
        >
          <ColumnChart
            labels={labels}
            series={[
              {
                label: "Creadas",
                color: seriesVar(0),
                values: data.flow.map((p) => p.created),
              },
              {
                label: "Completadas",
                color: seriesVar(2),
                values: data.flow.map((p) => p.completed),
              },
            ]}
          />
        </ChartCard>

        <ChartCard
          title="Tiempo de entrega por semana"
          subtitle="Días promedio entre creación y cierre de lo que se completó esa semana"
          table={
            <DataTable
              columns={["Semana", "Lead time (días)"]}
              rows={data.flow.map((p) => [
                formatDateShort(p.weekStart),
                p.avgLeadTime ?? "—",
              ])}
            />
          }
        >
          {data.flow.every((p) => p.avgLeadTime == null) ? (
            <ChartEmpty message="Todavía no se cerraron tareas en el período." />
          ) : (
            <LineChart
              labels={labels}
              area
              formatValue={(v) => `${v} d`}
              series={[
                {
                  label: "Lead time",
                  color: seriesVar(0),
                  values: data.flow.map((p) => p.avgLeadTime),
                },
              ]}
            />
          )}
        </ChartCard>
      </div>
    </div>
  );
}

/* ────────────────────────────  Distribución  ───────────────────────── */

function DistributionTab({
  data,
  workspace,
  today,
  link,
}: {
  data: ReportData;
  workspace: Workspace;
  today: string;
  link: (extra: string) => string;
}) {
  const statusMap = new Map(workspace.statuses.map((s) => [s.id, s]));
  const alive = data.tasks.filter(
    (t) => t.statusId == null || !statusMap.get(t.statusId)?.isCancelled,
  );

  const byStatus = workspace.statuses
    .map((status) => ({
      label: `${status.emoji} ${status.name}`.trim(),
      value: data.tasks.filter((t) => t.statusId === status.id).length,
      color: status.color,
      href: link(`estado=${status.id}`),
    }))
    .filter((row) => row.value > 0);

  const byPriority = workspace.priorities
    .map((priority) => ({
      label: `${priority.emoji} ${priority.name}`.trim(),
      value: alive.filter((t) => t.priorityId === priority.id).length,
      color: priority.color,
      href: link(`prioridad=${priority.id}`),
    }))
    .filter((row) => row.value > 0);

  const byStage = workspace.stages
    .map((stage) => ({
      label: `${stage.emoji} ${stage.name}`.trim(),
      value: alive.filter((t) => t.kanbanStageId === stage.id).length,
      color: stage.color,
      href: link(`etapa=${stage.id}`),
    }))
    .filter((row) => row.value > 0);

  const byPerson = data.people.map((row) => ({
    label: personName(row.personId, workspace),
    value: row.total,
    display: String(row.total),
    note: `${row.overdue} vencida(s)`,
    href: link(personParam(row.personId)),
  }));

  // El Gantt del Excel repartía por proyecto; acá se mantiene esa lectura.
  const byProject = workspace.projects
    .map((project, index) => ({
      label: `${project.code} · ${project.name}`,
      value: alive.filter((t) => t.projectId === project.id).length,
      color: project.color || seriesVar(index),
      href: `/tareas?proyecto=${project.id}`,
    }))
    .filter((row) => row.value > 0);

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ChartCard
        title="Por estado"
        subtitle="Incluye las canceladas, para ver el total real de lo cargado"
        legend={<Legend items={byStatus} />}
        table={
          <DataTable
            columns={["Estado", "Tareas"]}
            rows={byStatus.map((r) => [r.label, r.value])}
          />
        }
      >
        {byStatus.length === 0 ? (
          <ChartEmpty message="Sin tareas cargadas." />
        ) : (
          <DonutChart
            data={byStatus}
            centerValue={String(data.tasks.length)}
            centerLabel="tareas"
          />
        )}
      </ChartCard>

      <ChartCard
        title="Por prioridad"
        subtitle="Solo trabajo vivo: las canceladas quedan afuera"
        table={
          <DataTable
            columns={["Prioridad", "Tareas"]}
            rows={byPriority.map((r) => [r.label, r.value])}
          />
        }
      >
        {byPriority.length === 0 ? (
          <ChartEmpty message="Ninguna tarea tiene prioridad asignada." />
        ) : (
          <BarChart data={byPriority} labelWidth={110} />
        )}
      </ChartCard>

      <ChartCard
        title="Por etapa del tablero"
        subtitle="Dónde está parado el trabajo ahora mismo"
        table={
          <DataTable
            columns={["Etapa", "Tareas"]}
            rows={byStage.map((r) => [r.label, r.value])}
          />
        }
      >
        {byStage.length === 0 ? (
          <ChartEmpty message="Ninguna tarea tiene etapa asignada." />
        ) : (
          <BarChart data={byStage} labelWidth={132} />
        )}
      </ChartCard>

      <ChartCard
        title="Por responsable"
        subtitle="Cuántas tareas tiene cada uno, sin contar canceladas"
        table={
          <DataTable
            columns={["Responsable", "Tareas", "Vencidas"]}
            rows={data.people.map((r) => [
              personName(r.personId, workspace),
              r.total,
              r.overdue,
            ])}
          />
        }
      >
        {byPerson.length === 0 ? (
          <ChartEmpty message="Ninguna tarea tiene responsable." />
        ) : (
          <BarChart data={byPerson} />
        )}
      </ChartCard>

      {byProject.length > 1 ? (
        <ChartCard
          className="md:col-span-2"
          title="Por proyecto"
          subtitle="El reparto del trabajo vivo entre proyectos"
          legend={<Legend items={byProject} />}
          table={
            <DataTable
              columns={["Proyecto", "Tareas"]}
              rows={byProject.map((r) => [r.label, r.value])}
            />
          }
        >
          <StackedBar
            height={30}
            segments={byProject.map((row) => ({
              label: row.label,
              value: row.value,
              color: row.color,
            }))}
          />
        </ChartCard>
      ) : null}

      <p className="text-xs text-muted md:col-span-2">
        Al {today.split("-").reverse().join("/")}. Cada barra y cada gajo lleva
        a Tareas con ese filtro aplicado; el botón de tabla de cada tarjeta
        muestra los mismos datos en números.
      </p>
    </div>
  );
}

/* ─────────────────────────────  Utilidades  ────────────────────────── */

function personName(id: number | null, workspace: Workspace): string {
  if (id == null) return "Sin responsable";
  return workspace.people.find((p) => p.id === id)?.name ?? `#${id}`;
}

function personParam(id: number | null): string {
  return `responsable=${id ?? "ninguno"}`;
}

export type { PersonStats };
