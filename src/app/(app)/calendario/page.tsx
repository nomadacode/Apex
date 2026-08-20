import { Suspense } from "react";

import { MonthCalendar } from "@/components/calendar/month-calendar";
import { DetailSlot } from "@/components/tasks/detail-slot";
import { ViewTabs } from "@/components/nav/view-tabs";
import { PageShell } from "@/components/ui/page-shell";
import { addDays, endOfMonth, startOfMonth, today } from "@/lib/dates";
import { toFilters, type RawSearchParams } from "@/lib/search-params";
import { getTaskDetail, getTasks, getWorkspace } from "@/lib/task-queries";

function one(params: RawSearchParams, key: string): string {
  const value = params[key];
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const workspace = getWorkspace();
  const hoy = today();

  const year = Number(one(params, "anio")) || Number(hoy.slice(0, 4));
  const month = Number(one(params, "mes")) || Number(hoy.slice(5, 7));

  // Se consulta solo la ventana visible (6 semanas), no la tabla entera.
  const first = startOfMonth(year, month);
  const last = endOfMonth(year, month);
  const tasks = getTasks(
    {
      ...toFilters(params),
      from: addDays(first, -7),
      to: addDays(last, 14),
    },
    workspace,
  );
  const allTasks = getTasks({}, workspace);

  const openId = Number(one(params, "tarea"));
  const detail = Number.isFinite(openId) && openId > 0 ? getTaskDetail(openId) : null;

  return (
    <PageShell
      title="Trabajo"
      subtitle="El panorama de las fechas de entrega, mes a mes."
      tabs={<ViewTabs />}
      scroll={false}
    >
      <div className="flex h-full min-h-0">
        <div className="min-w-0 flex-1">
          <Suspense fallback={null}>
            <MonthCalendar
              tasks={tasks}
              workspace={workspace}
              today={hoy}
              year={year}
              month={month}
            />
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <DetailSlot
            detail={detail}
            workspace={workspace}
            today={hoy}
            allTasks={allTasks}
          />
        </Suspense>
      </div>
    </PageShell>
  );
}
