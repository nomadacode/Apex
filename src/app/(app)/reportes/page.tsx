import { Suspense } from "react";

import { ReportsScreen } from "@/components/reports/reports-screen";
import { PageShell } from "@/components/ui/page-shell";
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

  const query = new URLSearchParams();
  if (filters.projectId) query.set("proyecto", String(filters.projectId));

  return (
    <PageShell
      title="Reportes"
      subtitle="Quién demora, qué etapa frena el flujo y si estamos llegando a las fechas."
    >
      <Suspense fallback={null}>
        <ReportsScreen
          data={getReportData({
            workspace,
            today: hoy,
            projectId: filters.projectId,
          })}
          workspace={workspace}
          today={hoy}
          scopeQuery={query.toString()}
        />
      </Suspense>
    </PageShell>
  );
}
