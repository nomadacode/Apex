/** Verificación end-to-end de las server actions contra la base real.
 *
 *  Corre las mutaciones de verdad y contrasta el resultado con SQL directo.
 *  Cubre lo que los tests unitarios de `derive.ts` no pueden: validaciones,
 *  guardas de borrado, cascadas y registro en el historial.
 *
 *  Uso: `npm run demo:seed && npm run verify:e2e`
 *  ⚠️  Escribe en `data/apex.db`. Corré `demo:seed` antes, no sobre
 *  datos reales. */

// La ruta sale de dónde está este archivo y no escrita a mano: así el script
// sigue funcionando si la carpeta del proyecto cambia de nombre o de lugar.
import path from "node:path";

process.chdir(path.resolve(import.meta.dirname, ".."));

import Database from "better-sqlite3";

import {
  addDependency,
  bulkUpdate,
  completeTask,
  createTask,
  deleteTasks,
  getDeletionImpact,
  getPendingChildren,
  updateTask,
} from "@/actions/tasks";
import {
  deletePerson,
  deleteStatus,
  migrateStatus,
  saveSettings,
  saveStatus,
} from "@/actions/config";

const raw = new Database("data/apex.db");
const q = (sql: string) => raw.prepare(sql).get() as Record<string, unknown>;

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ok   ${label}`);
  } else {
    failed += 1;
    console.log(`  FAIL ${label} ${detail}`);
  }
}

async function main() {
  console.log("\n— Crear tarea —");
  const form = new FormData();
  form.set("title", "Tarea de verificación");
  form.set("projectId", String(q("select id from projects limit 1").id));
  form.set("dueDate", "2026-09-01");
  form.set("startDate", "2026-09-10"); // inicio > límite: debe rechazarse
  const bad = await createTask(form);
  check("rechaza inicio posterior a la fecha límite", !bad.ok);

  form.set("startDate", "2026-08-20");
  const created = await createTask(form);
  check("crea la tarea", created.ok);
  if (!created.ok) return;
  const taskId = created.data.id;

  const row = q(`select * from tasks where id=${taskId}`);
  check("persiste el título", row.title === "Tarea de verificación");
  check("persiste las fechas", row.due_date === "2026-09-01");
  check("asigna estado por defecto", row.status_id != null);
  check("asigna etapa por defecto", row.kanban_stage_id != null);

  const log = q(
    `select count(*) n from activity_log where task_id=${taskId} and field='creación'`,
  );
  check("registra la creación en el historial", log.n === 1);

  console.log("\n— Completar y descompletar —");
  const doneId = Number(q("select id from statuses where is_done=1 limit 1").id);
  await updateTask(taskId, { statusId: doneId });
  const done = q(`select * from tasks where id=${taskId}`);
  check("sella completed_at", done.completed_at != null);
  check("pone el progreso en 100", done.progress === 100);

  const pendingId = Number(
    q("select id from statuses where is_done=0 and is_cancelled=0 limit 1").id,
  );
  await updateTask(taskId, { statusId: pendingId });
  check(
    "descompletar limpia completed_at",
    q(`select * from tasks where id=${taskId}`).completed_at === null,
  );

  console.log("\n— Subtareas en cascada —");
  const sub = new FormData();
  sub.set("title", "Subtarea de verificación");
  sub.set("projectId", String(row.project_id));
  sub.set("parentTaskId", String(taskId));
  const subCreated = await createTask(sub);
  check("crea la subtarea", subCreated.ok);

  const pend = await getPendingChildren(taskId);
  check(
    "detecta 1 subtarea pendiente",
    pend.ok && pend.data.pending === 1,
    pend.ok ? String(pend.data.pending) : "",
  );

  await completeTask(taskId, doneId, true);
  const cascaded = q(
    `select count(*) n from tasks where (id=${taskId} or parent_task_id=${taskId}) and status_id=${doneId}`,
  );
  check("completa el padre y la hija en cascada", cascaded.n === 2);

  console.log("\n— Dependencias —");
  const [a, b, c] = raw
    .prepare("select id from tasks where parent_task_id is null limit 3")
    .all() as { id: number }[];
  await addDependency(a.id, b.id);
  await addDependency(b.id, c.id);
  const cycle = await addDependency(c.id, a.id);
  check("rechaza el ciclo", !cycle.ok);
  check(
    "el mensaje muestra el camino",
    !cycle.ok && Boolean(cycle.hint?.includes("→")),
    !cycle.ok ? String(cycle.hint) : "",
  );
  const self = await addDependency(a.id, a.id);
  check("rechaza la autodependencia", !self.ok);
  const dup = await addDependency(a.id, b.id);
  check("rechaza la duplicada", !dup.ok);

  console.log("\n— Guardas de catálogos —");
  const doneCount = q("select count(*) n from statuses where is_done=1").n;
  const delDone = await deleteStatus(doneId);
  check("bloquea borrar el estado terminal en uso", !delDone.ok);
  check(
    "no borró nada",
    q("select count(*) n from statuses where is_done=1").n === doneCount,
  );

  const usedPerson = q(
    "select assignee_id id from tasks where assignee_id is not null limit 1",
  );
  const delPerson = await deletePerson(Number(usedPerson.id));
  check("bloquea borrar persona con tareas", !delPerson.ok);
  check(
    "ofrece salida en el mensaje",
    !delPerson.ok && Boolean(delPerson.hint),
  );

  console.log("\n— Migración de estado —");
  const tmp = new FormData();
  tmp.set("name", "Estado temporal");
  const tmpStatus = await saveStatus(tmp);
  check("crea un estado nuevo", tmpStatus.ok);
  if (tmpStatus.ok) {
    await updateTask(taskId, { statusId: tmpStatus.data.id });
    const blocked = await deleteStatus(tmpStatus.data.id);
    check("bloquea borrar el estado en uso", !blocked.ok);

    const moved = await migrateStatus(tmpStatus.data.id, pendingId);
    check("migra las tareas", moved.ok && moved.data.moved === 1);
    const cleared = await deleteStatus(tmpStatus.data.id);
    check("ahora sí lo borra", cleared.ok);
  }

  console.log("\n— Acciones masivas y borrado —");
  const ids = (
    raw.prepare("select id from tasks limit 3").all() as { id: number }[]
  ).map((r) => r.id);
  await bulkUpdate(ids, { priorityId: null });
  check(
    "aplica el cambio masivo",
    q(
      `select count(*) n from tasks where id in (${ids.join(",")}) and priority_id is null`,
    ).n === 3,
  );

  const impact = await getDeletionImpact([taskId]);
  check(
    "cuenta el subárbol al borrar",
    impact.ok && impact.data.total === 2 && impact.data.subtasks === 1,
    impact.ok ? JSON.stringify(impact.data) : "",
  );

  const before = q("select count(*) n from tasks").n as number;
  await deleteTasks([taskId]);
  check(
    "borra padre e hija",
    q("select count(*) n from tasks").n === before - 2,
  );

  console.log("\n— Días laborables reactivos —");
  const settings = new FormData();
  for (let i = 0; i < 6; i += 1) settings.set(`workday-${i}`, "on");
  settings.set("weekStart", "monday");
  settings.set("workspaceName", "Apex");
  await saveSettings(settings);
  check(
    "guarda sábado como laborable",
    q("select value from settings where key='workdays'").value === "1111110",
  );
  // Se restaura la configuración original.
  const restore = new FormData();
  for (let i = 0; i < 5; i += 1) restore.set(`workday-${i}`, "on");
  restore.set("weekStart", "monday");
  restore.set("workspaceName", "Apex");
  await saveSettings(restore);

  console.log(`\n${passed} ok, ${failed} fallidos\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
