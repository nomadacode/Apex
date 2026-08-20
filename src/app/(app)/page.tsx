import { Suspense } from "react";

import { DashboardScreen } from "@/components/dashboard/dashboard-screen";
import { PageShell } from "@/components/ui/page-shell";
import {
  getAttentionLists,
  getBreakdowns,
  getKpis,
  getProjectSummaries,
} from "@/lib/dashboard-queries";
import { today } from "@/lib/dates";
import { getReportData } from "@/lib/report-queries";
import { toFilters, type RawSearchParams } from "@/lib/search-params";
import { getWorkspace } from "@/lib/task-queries";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const workspace = getWorkspace();
  const filters = toFilters(params);
  const hoy = today();

  const scope = {
    projectId: filters.projectId,
    from: filters.from,
    to: filters.to,
  };

  // Se preservan los filtros al saltar a Tareas desde un KPI.
  const query = new URLSearchParams();
  if (filters.projectId) query.set("proyecto", String(filters.projectId));
  if (filters.from) query.set("desde", filters.from);
  if (filters.to) query.set("hasta", filters.to);

  return (
    <PageShell
      title="Dashboard"
      subtitle="Cómo va todo, sin mover un dedo: se actualiza solo con lo que cargás en Tareas."
    >
      <Suspense fallback={null}>
        <DashboardScreen
          kpis={getKpis(scope, workspace, hoy)}
          breakdowns={getBreakdowns(scope, workspace)}
          attention={getAttentionLists(scope, workspace, hoy)}
          projectSummaries={getProjectSummaries(workspace, hoy)}
          flow={
            getReportData({
              workspace,
              today: hoy,
              projectId: filters.projectId,
              weeks: 8,
            }).flow
          }
          workspace={workspace}
          today={hoy}
          filterQuery={query.toString()}
        />
      </Suspense>
    </PageShell>
  );
}
