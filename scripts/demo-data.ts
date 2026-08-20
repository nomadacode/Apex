/** Datos de prueba para verificar las vistas end-to-end.
 *
 *  No forma parte del producto: se corre a mano con `npm run demo:seed`
 *  y se limpia con `npm run demo:clear`. */

import { ensureDb } from "../src/db/bootstrap";
import {
  activityLog,
  holidays,
  kanbanStages,
  people,
  phases,
  priorities,
  projects,
  statuses,
  taskDependencies,
  tasks,
} from "../src/db/schema";
import { addDays, today } from "../src/lib/dates";

const db = ensureDb();
const hoy = today();

function clear() {
  db.delete(activityLog).run();
  db.delete(taskDependencies).run();
  db.delete(tasks).run();
  db.delete(phases).run();
  db.delete(projects).run();
  db.delete(people).run();
  db.delete(holidays).run();
}

/** Marca de tiempo a `dias` de hoy, a la hora indicada. Los reportes de
 *  tiempo por etapa necesitan horas, no solo fechas. */
function stamp(days: number, hour = 10): string {
  return `${addDays(hoy, days)} ${String(hour).padStart(2, "0")}:00:00`;
}

function seedDemo() {
  clear();

  const team = db
    .insert(people)
    .values([
      { name: "Alexia Díaz", role: "Dirección", color: "#6366f1", position: 0 },
      { name: "Martín Rossi", role: "Desarrollo", color: "#0ea5e9", position: 1 },
      { name: "Lucía Ferrer", role: "Diseño", color: "#ec4899", position: 2 },
      { name: "Pablo Núñez", role: "QA", color: "#f59e0b", position: 3 },
    ])
    .returning({ id: people.id })
    .all();

  db.insert(holidays)
    .values([
      { date: addDays(hoy, 4), description: "Feriado de prueba" },
      { date: addDays(hoy, 25), description: "Día no laborable" },
    ])
    .run();

  const proj = db
    .insert(projects)
    .values([
      {
        code: "P1",
        name: "Lanzamiento del sitio",
        client: "Interno",
        leaderId: team[0].id,
        startDate: addDays(hoy, -20),
        endDate: addDays(hoy, 40),
        color: "#6366f1",
        position: 0,
      },
      {
        code: "P2",
        name: "Migración de datos",
        client: "Cliente Norte",
        leaderId: team[1].id,
        startDate: addDays(hoy, -5),
        endDate: addDays(hoy, 60),
        color: "#0ea5e9",
        position: 1,
      },
    ])
    .returning({ id: projects.id })
    .all();

  const ph = db
    .insert(phases)
    .values([
      { projectId: proj[0].id, name: "Descubrimiento", description: "Relevamiento", position: 0 },
      { projectId: proj[0].id, name: "Diseño", description: "UI y contenidos", position: 1 },
      { projectId: proj[0].id, name: "Construcción", description: "", position: 2 },
      { projectId: proj[1].id, name: "Análisis", description: "", position: 0 },
      { projectId: proj[1].id, name: "Ejecución", description: "", position: 1 },
    ])
    .returning({ id: phases.id })
    .all();

  const st = db.select().from(statuses).orderBy(statuses.position).all();
  const stg = db.select().from(kanbanStages).orderBy(kanbanStages.position).all();
  const pr = db.select().from(priorities).orderBy(priorities.position).all();

  const byName = (name: string) => st.find((s) => s.name === name)!.id;
  const stageByName = (name: string) => stg.find((s) => s.name === name)!.id;

  /** Una tarea con su historia: cuándo se creó, por qué etapas pasó y
   *  cuándo se cerró. Los reportes de demora se calculan de esto. */
  type Row = {
    title: string;
    project: 0 | 1;
    phase: number | null;
    status: string;
    stage: string;
    priority: number | null;
    person: number | null;
    /** Días respecto de hoy. */
    start: number | null;
    due: number | null;
    progress: number;
    important?: boolean;
    urgent?: boolean;
    /** Día en que se creó (negativo = en el pasado). */
    born: number;
    /** Día en que se cerró; null si sigue abierta. */
    closed?: number;
    /** Recorrido por etapas: [etapa, día en que entró]. */
    trail?: [string, number][];
  };

  const rows: Row[] = [
    // ── Atrasadas ────────────────────────────────────────────────────
    {
      title: "Relevar competencia",
      project: 0, phase: 0, status: "En progreso", stage: "En progreso",
      priority: 4, person: 1, start: -14, due: -2, progress: 60,
      important: true, urgent: true, born: -16,
      trail: [["Backlog", -16], ["Pendiente", -15], ["En progreso", -13]],
    },
    {
      title: "Definir alcance",
      project: 0, phase: 0, status: "Pendiente", stage: "Pendiente",
      priority: 3, person: 0, start: -18, due: -5, progress: 20,
      important: true, born: -20,
      trail: [["Backlog", -20], ["Pendiente", -18]],
    },
    // ── Vence hoy ────────────────────────────────────────────────────
    {
      title: "Entregar wireframes",
      project: 0, phase: 1, status: "En progreso", stage: "En progreso",
      priority: 4, person: 2, start: -7, due: 0, progress: 80,
      important: true, urgent: true, born: -9,
      trail: [["Backlog", -9], ["Pendiente", -8], ["En progreso", -6]],
    },
    // ── Completadas, con distinta puntualidad ────────────────────────
    {
      title: "Kickoff con el equipo",
      project: 0, phase: 0, status: "Completado", stage: "Completado",
      priority: 2, person: 0, start: -20, due: -18, progress: 100,
      urgent: true, born: -22, closed: -18,
      trail: [["Pendiente", -22], ["En progreso", -20], ["Completado", -18]],
    },
    {
      title: "Elegir paleta de color",
      project: 0, phase: 1, status: "Completado", stage: "Completado",
      priority: 1, person: 2, start: -12, due: -9, progress: 100,
      born: -14, closed: -10,
      trail: [["Backlog", -14], ["En progreso", -12], ["Completado", -10]],
    },
    {
      title: "Definir tono de la marca",
      project: 0, phase: 1, status: "Completado", stage: "Completado",
      priority: 2, person: 2, start: -26, due: -22, progress: 100,
      born: -28, closed: -21,
      trail: [["Backlog", -28], ["Pendiente", -26], ["En progreso", -24], ["Completado", -21]],
    },
    {
      title: "Armar el brief inicial",
      project: 0, phase: 0, status: "Completado", stage: "Completado",
      priority: 3, person: 1, start: -34, due: -30, progress: 100,
      born: -36, closed: -24,
      trail: [["Backlog", -36], ["Pendiente", -34], ["En espera", -32], ["En progreso", -27], ["Completado", -24]],
    },
    {
      title: "Auditar accesibilidad",
      project: 0, phase: 1, status: "Completado", stage: "Completado",
      priority: 2, person: 3, start: -18, due: -14, progress: 100,
      born: -19, closed: -15,
      trail: [["Backlog", -19], ["En progreso", -17], ["Completado", -15]],
    },
    // ── A futuro ─────────────────────────────────────────────────────
    {
      title: "Maquetar home",
      project: 0, phase: 2, status: "No iniciado", stage: "Backlog",
      priority: 3, person: 1, start: 2, due: 12, progress: 0,
      important: true, born: -6,
    },
    {
      title: "Integrar formulario",
      project: 0, phase: 2, status: "No iniciado", stage: "Backlog",
      priority: 2, person: 1, start: 8, due: 20, progress: 0, born: -5,
    },
    {
      title: "Pruebas de carga",
      project: 0, phase: 2, status: "No iniciado", stage: "Ideas",
      priority: 1, person: 3, start: 20, due: 35, progress: 0, born: -4,
    },
    // ── Cancelada ────────────────────────────────────────────────────
    {
      title: "Rediseñar el logo",
      project: 0, phase: 1, status: "Cancelado", stage: "Cancelado",
      priority: 0, person: 2, start: -6, due: 3, progress: 0, born: -8,
      trail: [["Backlog", -8], ["Cancelado", -5]],
    },
    // ── Sin fecha límite ─────────────────────────────────────────────
    {
      title: "Escribir documentación",
      project: 0, phase: null, status: "Pendiente", stage: "Backlog",
      priority: 1, person: 1, start: null, due: null, progress: 0, born: -11,
    },
    // ── Trabada hace mucho: alimenta el aging y el cuello de botella ─
    {
      title: "Definir política de datos",
      project: 0, phase: 0, status: "En espera", stage: "En espera",
      priority: 3, person: 0, start: -40, due: -12, progress: 15,
      important: true, born: -42,
      trail: [["Backlog", -42], ["Pendiente", -40], ["En espera", -37]],
    },
    // ── Proyecto 2 ───────────────────────────────────────────────────
    {
      title: "Mapear tablas legadas",
      project: 1, phase: 3, status: "En progreso", stage: "En progreso",
      priority: 4, person: 1, start: -3, due: 6, progress: 45,
      important: true, urgent: true, born: -5,
      trail: [["Backlog", -5], ["En progreso", -3]],
    },
    {
      title: "Definir reglas de limpieza",
      project: 1, phase: 3, status: "Pendiente", stage: "Pendiente",
      priority: 3, person: 0, start: 1, due: 10, progress: 0,
      important: true, born: -3,
      trail: [["Backlog", -3], ["Pendiente", -1]],
    },
    {
      title: "Migrar clientes",
      project: 1, phase: 4, status: "No iniciado", stage: "Backlog",
      priority: 3, person: 1, start: 12, due: 30, progress: 0,
      important: true, born: -2,
    },
    {
      title: "Validar con QA",
      project: 1, phase: 4, status: "No iniciado", stage: "Backlog",
      priority: 2, person: 3, start: 30, due: 45, progress: 0, born: -2,
    },
    {
      title: "Plan de rollback",
      project: 1, phase: 4, status: "En espera", stage: "En espera",
      priority: 2, person: null, start: 5, due: 25, progress: 10,
      important: true, born: -7,
      trail: [["Backlog", -7], ["En espera", -6]],
    },
    {
      title: "Inventario de integraciones",
      project: 1, phase: 3, status: "Completado", stage: "Completado",
      priority: 2, person: 3, start: -16, due: -11, progress: 100,
      born: -17, closed: -12,
      trail: [["Backlog", -17], ["En progreso", -15], ["Completado", -12]],
    },
    {
      title: "Relevar volúmenes",
      project: 1, phase: 3, status: "Completado", stage: "Completado",
      priority: 3, person: 0, start: -9, due: -6, progress: 100,
      born: -10, closed: -2,
      trail: [["Backlog", -10], ["Pendiente", -9], ["En progreso", -6], ["Completado", -2]],
    },
  ];

  const created = db
    .insert(tasks)
    .values(
      rows.map((r, i) => ({
        projectId: proj[r.project].id,
        phaseId: r.phase == null ? null : ph[r.phase].id,
        title: r.title,
        description: "",
        statusId: byName(r.status),
        kanbanStageId: stageByName(r.stage),
        priorityId: r.priority == null ? null : (pr[r.priority]?.id ?? null),
        assigneeId: r.person == null ? null : team[r.person].id,
        startDate: r.start == null ? null : addDays(hoy, r.start),
        dueDate: r.due == null ? null : addDays(hoy, r.due),
        progress: r.progress,
        important: r.important ?? false,
        urgent: r.urgent ?? false,
        position: i,
        createdAt: stamp(r.born, 9),
        updatedAt: stamp(r.closed ?? r.born, 9),
        completedAt: r.closed == null ? null : stamp(r.closed, 17),
      })),
    )
    .returning({ id: tasks.id })
    .all();

  // Historial de movimientos entre etapas. Es lo que hace posible medir
  // dónde se traba el trabajo: sin esto, el reporte de etapas no tiene
  // de dónde sacar los tiempos.
  const trail = rows.flatMap((row, index) => {
    if (!row.trail || row.trail.length < 2) return [];
    return row.trail.slice(1).map(([stage, day], step) => ({
      taskId: created[index].id,
      entity: "task",
      field: "etapa",
      oldValue: String(stageByName(row.trail![step][0])),
      newValue: String(stageByName(stage)),
      at: stamp(day, 11),
    }));
  });
  if (trail.length > 0) db.insert(activityLog).values(trail).run();

  // Subtareas de "Maquetar home".
  const parent = created[8].id;
  db.insert(tasks)
    .values([
      {
        projectId: proj[0].id,
        phaseId: ph[2].id,
        parentTaskId: parent,
        title: "Header y navegación",
        statusId: byName("Completado"),
        kanbanStageId: stageByName("Completado"),
        priorityId: pr[2].id,
        assigneeId: team[1].id,
        startDate: addDays(hoy, 2),
        dueDate: addDays(hoy, 5),
        progress: 100,
        position: 0,
        createdAt: stamp(-6, 9),
        completedAt: stamp(-1, 15),
      },
      {
        projectId: proj[0].id,
        phaseId: ph[2].id,
        parentTaskId: parent,
        title: "Sección de precios",
        statusId: byName("En progreso"),
        kanbanStageId: stageByName("En progreso"),
        priorityId: pr[2].id,
        assigneeId: team[1].id,
        startDate: addDays(hoy, 5),
        dueDate: addDays(hoy, 9),
        progress: 40,
        position: 1,
        createdAt: stamp(-6, 9),
      },
      {
        projectId: proj[0].id,
        phaseId: ph[2].id,
        parentTaskId: parent,
        title: "Pie de página",
        statusId: byName("No iniciado"),
        kanbanStageId: stageByName("Backlog"),
        assigneeId: team[2].id,
        startDate: addDays(hoy, 9),
        dueDate: addDays(hoy, 12),
        progress: 0,
        position: 2,
        createdAt: stamp(-6, 9),
      },
    ])
    .run();

  // Dependencias: descubrimiento → diseño → construcción.
  db.insert(taskDependencies)
    .values([
      { predecessorId: created[1].id, successorId: created[2].id, type: "FS" },
      { predecessorId: created[2].id, successorId: created[8].id, type: "FS" },
      { predecessorId: created[8].id, successorId: created[9].id, type: "FS" },
      { predecessorId: created[14].id, successorId: created[15].id, type: "FS" },
      { predecessorId: created[15].id, successorId: created[16].id, type: "FS" },
    ])
    .run();

  const total = db.select().from(tasks).all().length;
  const moves = db.select().from(activityLog).all().length;
  console.log(
    `Demo cargada: 2 proyectos, 5 fases, ${total} tareas, 4 personas, ${moves} movimientos de etapa.`,
  );
}

const mode = process.argv[2];
if (mode === "clear") {
  clear();
  console.log("Datos de demo borrados.");
} else {
  seedDemo();
}
