import { Suspense } from "react";

import { KanbanBoard } from "@/components/kanban/kanban-board";
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
  const tasks = getTasks(toFilters(params), workspace);
  const allTasks = getTasks({}, workspace);

  const openId = Number(
    Array.isArray(params.tarea) ? params.tarea[0] : params.tarea,
  );
  const detail = Number.isFinite(openId) && openId > 0 ? getTaskDetail(openId) : null;

  return (
    <PageShell
      title="Trabajo"
      subtitle="Arrastrá las tarjetas entre columnas: el cambio de etapa se guarda solo."
      tabs={<ViewTabs />}
      scroll={false}
    >
      <div className="flex h-full min-h-0">
        <div className="min-w-0 flex-1">
          <Suspense fallback={null}>
            <KanbanBoard tasks={tasks} workspace={workspace} today={today()} />
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
