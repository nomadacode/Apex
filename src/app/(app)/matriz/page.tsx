import { Suspense } from "react";

import { EisenhowerMatrix } from "@/components/matrix/eisenhower-matrix";
import { DetailSlot } from "@/components/tasks/detail-slot";
import { ViewTabs } from "@/components/nav/view-tabs";
import { PageShell } from "@/components/ui/page-shell";
import { today } from "@/lib/dates";
import { toFilters, type RawSearchParams } from "@/lib/search-params";
import { getTaskDetail, getTasks, getWorkspace } from "@/lib/task-queries";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<RawSearchParams>;
}) {
  const params = await searchParams;
  const workspace = getWorkspace();
  // Las canceladas no entran: la matriz decide sobre trabajo vivo.
  const tasks = getTasks({ ...toFilters(params), hideCancelled: true }, workspace);
  const allTasks = getTasks({}, workspace);

  const openId = Number(
    Array.isArray(params.tarea) ? params.tarea[0] : params.tarea,
  );
  const detail = Number.isFinite(openId) && openId > 0 ? getTaskDetail(openId) : null;

  return (
    <PageShell
      title="Trabajo"
      subtitle="Las tareas repartidas por importancia y urgencia."
      tabs={<ViewTabs />}
      scroll={false}
    >
      <div className="flex h-full min-h-0">
        <div className="min-w-0 flex-1">
          <Suspense fallback={null}>
            <EisenhowerMatrix
              tasks={tasks}
              workspace={workspace}
              today={today()}
            />
          </Suspense>
        </div>
        <Suspense fallback={null}>
          <DetailSlot
            detail={detail}
            workspace={workspace}
            today={today()}
            allTasks={allTasks}
          />
        </Suspense>
      </div>
    </PageShell>
  );
}
