import { Suspense } from "react";
import { asc, count } from "drizzle-orm";

import { ConfigScreen } from "@/components/config/config-screen";
import { ThemeToggle } from "@/components/nav/theme-toggle";
import { PageShell } from "@/components/ui/page-shell";
import { ensureDb } from "@/db/bootstrap";
import { holidays, phases, projects, tasks } from "@/db/schema";
import {
  getKanbanStages,
  getPeople,
  getPriorities,
  getProjects,
  getSettings,
  getStatuses,
} from "@/lib/queries";

export default function Page() {
  const db = ensureDb();

  return (
    <PageShell
      title="Configuración"
      subtitle="Lo primero que conviene completar: sin esto, el resto de las vistas no tiene con qué trabajar."
      actions={<ThemeToggle />}
    >
      <Suspense fallback={null}>
        <ConfigScreen
          projects={getProjects({ includeArchived: true })}
          people={getPeople()}
          phases={db.select().from(phases).orderBy(asc(phases.position)).all()}
          statuses={getStatuses()}
          stages={getKanbanStages()}
          priorities={getPriorities()}
          holidays={db.select().from(holidays).orderBy(asc(holidays.date)).all()}
          settings={getSettings()}
          counts={{
            projects: db.select({ n: count() }).from(projects).get()?.n ?? 0,
            tasks: db.select({ n: count() }).from(tasks).get()?.n ?? 0,
          }}
        />
      </Suspense>
    </PageShell>
  );
}
