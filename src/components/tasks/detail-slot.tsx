"use client";

import { useState } from "react";

import { NewTaskDialog } from "@/components/tasks/new-task-dialog";
import { TaskDetailPanel } from "@/components/tasks/task-detail-panel";
import type { Task } from "@/db/schema";
import { PARAM } from "@/lib/search-params";
import type { TaskDetail, Workspace } from "@/lib/task-queries";
import { useFilters } from "@/lib/use-filters";

/** El panel de detalle acompaña a todas las vistas, no solo a Tareas:
 *  desde Kanban, matriz, calendarios o Gantt se abre la misma tarjeta
 *  con `?tarea=<id>`, y se cierra siempre del mismo modo. */
export function DetailSlot({
  detail,
  workspace,
  today,
  allTasks,
}: {
  detail: TaskDetail | null;
  workspace: Workspace;
  today: string;
  allTasks: Task[];
}) {
  const { get, set } = useFilters();
  const [subtaskParent, setSubtaskParent] = useState<Task | null>(null);
  const openId = get(PARAM.task);

  return (
    <>
      <TaskDetailPanel
        detail={openId ? detail : null}
        workspace={workspace}
        today={today}
        allTasks={allTasks}
        onClose={() => set({ [PARAM.task]: null })}
        onOpen={(id) => set({ [PARAM.task]: id })}
        onCreateSubtask={(parent) => setSubtaskParent(parent)}
      />

      <NewTaskDialog
        open={subtaskParent !== null}
        workspace={workspace}
        parent={subtaskParent}
        onClose={() => setSubtaskParent(null)}
        onCreated={(id) => set({ [PARAM.task]: id })}
      />
    </>
  );
}
