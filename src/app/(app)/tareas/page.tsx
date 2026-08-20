import { Suspense } from "react";

import { TasksScreen } from "@/components/tasks/tasks-screen";
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
      subtitle="Todo lo que hay que hacer. Tocá una tarea para ver su detalle."
      tabs={<ViewTabs />}
      scroll={false}
    >
      <Suspense fallback={null}>
        <TasksScreen
          tasks={tasks}
          allTasks={allTasks}
          detail={detail}
          workspace={workspace}
          today={today()}
        />
      </Suspense>
    </PageShell>
  );
}
