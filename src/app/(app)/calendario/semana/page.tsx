import { Suspense } from "react";

import { WeekCalendar } from "@/components/calendar/week-calendar";
import { DetailSlot } from "@/components/tasks/detail-slot";
import { ViewTabs } from "@/components/nav/view-tabs";
import { PageShell } from "@/components/ui/page-shell";
import { addDays, isISODate, startOfWeek, today } from "@/lib/dates";
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

  const requested = one(params, "semana");
  const anchor = isISODate(requested) ? requested : hoy;
  const weekStartDate = startOfWeek(anchor, workspace.settings.weekStart);

  const tasks = getTasks(
    {
      ...toFilters(params),
      from: weekStartDate,
      to: addDays(weekStartDate, 6),
    },
    workspace,
  );
  const allTasks = getTasks({}, workspace);

  const openId = Number(one(params, "tarea"));
  const detail = Number.isFinite(openId) && openId > 0 ? getTaskDetail(openId) : null;

  return (
    <PageShell
      title="Trabajo"
      subtitle="Cuánto trabajo hay cada día de la semana."
      tabs={<ViewTabs />}
      scroll={false}
    >
      <div className="flex h-full min-h-0">
        <div className="min-w-0 flex-1">
          <Suspense fallback={null}>
            <WeekCalendar
              tasks={tasks}
              workspace={workspace}
              today={hoy}
              weekStartDate={weekStartDate}
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
