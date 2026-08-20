import { Suspense } from "react";

import { GanttChart } from "@/components/gantt/gantt-chart";
import { DetailSlot } from "@/components/tasks/detail-slot";
import { ViewTabs } from "@/components/nav/view-tabs";
import { PageShell } from "@/components/ui/page-shell";
import { today } from "@/lib/dates";
import { toFilters, type RawSearchParams } from "@/lib/search-params";
import {
  getAllDependencies,
  getTaskDetail,
  getTasks,
  getWorkspace,
} from "@/lib/task-queries";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const workspace = getWorkspace();
  const tasks = getTasks(toFilters(params), workspace);
  const allTasks = getTasks({}, workspace);
  const hoy = today();

  const openId = Number(
    Array.isArray(params.tarea) ? params.tarea[0] : params.tarea,
  );
  const detail = Number.isFinite(openId) && openId > 0 ? getTaskDetail(openId) : null;

  return (
    <PageShell
      title="Trabajo"
      subtitle="El mapa del tiempo: cuánto dura cada tarea y cómo se encadenan."
      tabs={<ViewTabs />}
      scroll={false}
    >
      <div className="flex h-full min-h-0">
        <div className="min-w-0 flex-1">
          <Suspense fallback={null}>
            <GanttChart
              tasks={tasks}
              dependencies={getAllDependencies()}
              workspace={workspace}
              today={hoy}
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
