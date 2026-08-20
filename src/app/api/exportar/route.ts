import ExcelJS from "exceljs";
import { asc } from "drizzle-orm";

import { ensureDb } from "@/db/bootstrap";
import {
  comments,
  holidays,
  kanbanStages,
  people,
  phases,
  priorities,
  projects,
  statuses,
  taskDependencies,
  tasks,
} from "@/db/schema";
import { today } from "@/lib/dates";
import { daysRemaining, workdaysBetween } from "@/lib/derive";
import { getWorkspace } from "@/lib/task-queries";

/** Exporta todo el planificador en XLSX o JSON. Que los datos puedan
 *  salir enteros es parte del producto, no una concesión. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = url.searchParams.get("formato") === "json" ? "json" : "xlsx";
  const db = ensureDb();
  const workspace = getWorkspace();
  const hoy = today();

  const data = {
    proyectos: db.select().from(projects).orderBy(asc(projects.position)).all(),
    fases: db.select().from(phases).orderBy(asc(phases.position)).all(),
    tareas: db.select().from(tasks).orderBy(asc(tasks.id)).all(),
    dependencias: db.select().from(taskDependencies).all(),
    personas: db.select().from(people).orderBy(asc(people.position)).all(),
    estados: db.select().from(statuses).orderBy(asc(statuses.position)).all(),
    etapas: db.select().from(kanbanStages).orderBy(asc(kanbanStages.position)).all(),
    prioridades: db.select().from(priorities).orderBy(asc(priorities.position)).all(),
    festivos: db.select().from(holidays).orderBy(asc(holidays.date)).all(),
    comentarios: db.select().from(comments).all(),
  };

  if (format === "json") {
    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="apex-${hoy}.json"`,
      },
    });
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = "Apex";
  wb.created = new Date();

  const statusById = new Map(workspace.statuses.map((s) => [s.id, s]));
  const nameOf = <T extends { id: number; name: string }>(
    list: T[],
    id: number | null,
  ) => (id == null ? "" : (list.find((x) => x.id === id)?.name ?? ""));

  // Hoja de tareas, con los derivados ya resueltos: quien la abra ve los
  // mismos números que la app, sin fórmulas que se puedan romper.
  const tareas = wb.addWorksheet("Tareas");
  tareas.columns = [
    { header: "ID", key: "id", width: 6 },
    { header: "Proyecto", key: "proyecto", width: 24 },
    { header: "Fase", key: "fase", width: 18 },
    { header: "Tarea", key: "titulo", width: 40 },
    { header: "Descripción", key: "descripcion", width: 34 },
    { header: "Subtarea de", key: "padre", width: 24 },
    { header: "Importante", key: "importante", width: 11 },
    { header: "Urgente", key: "urgente", width: 9 },
    { header: "Estado", key: "estado", width: 14 },
    { header: "Prioridad", key: "prioridad", width: 12 },
    { header: "Responsable", key: "responsable", width: 18 },
    { header: "Rol / área", key: "rol", width: 16 },
    { header: "Fecha de inicio", key: "inicio", width: 14 },
    { header: "Fecha límite", key: "limite", width: 14 },
    { header: "Días restantes", key: "restantes", width: 14 },
    { header: "Días laborables", key: "laborables", width: 15 },
    { header: "Etapa Kanban", key: "etapa", width: 16 },
    { header: "Progreso %", key: "progreso", width: 11 },
    { header: "Notas", key: "notas", width: 30 },
  ];

  const taskById = new Map(data.tareas.map((t) => [t.id, t]));

  for (const task of data.tareas) {
    const person = workspace.people.find((p) => p.id === task.assigneeId);
    const remaining = daysRemaining(task, statusById, hoy);
    tareas.addRow({
      id: task.id,
      proyecto: nameOf(workspace.allProjects, task.projectId),
      fase: nameOf(workspace.phases, task.phaseId),
      titulo: task.title,
      descripcion: task.description,
      padre: task.parentTaskId ? (taskById.get(task.parentTaskId)?.title ?? "") : "",
      importante: task.important ? "Sí" : "No",
      urgente: task.urgent ? "Sí" : "No",
      estado: nameOf(workspace.statuses, task.statusId),
      prioridad: nameOf(workspace.priorities, task.priorityId),
      responsable: person?.name ?? "",
      rol: person?.role ?? "",
      inicio: task.startDate ?? "",
      limite: task.dueDate ?? "",
      restantes: remaining === "done" ? "-" : (remaining ?? ""),
      laborables:
        workdaysBetween(task.startDate, task.dueDate, workspace.calendar) ?? "",
      etapa: nameOf(workspace.stages, task.kanbanStageId),
      progreso: task.progress,
      notas: task.notes,
    });
  }

  const proyectos = wb.addWorksheet("Proyectos");
  proyectos.columns = [
    { header: "Código", key: "code", width: 8 },
    { header: "Nombre", key: "name", width: 30 },
    { header: "Cliente", key: "client", width: 22 },
    { header: "Líder", key: "leader", width: 20 },
    { header: "Inicio", key: "start", width: 12 },
    { header: "Fin", key: "end", width: 12 },
    { header: "Archivado", key: "archived", width: 11 },
  ];
  for (const project of data.proyectos) {
    proyectos.addRow({
      code: project.code,
      name: project.name,
      client: project.client,
      leader: nameOf(workspace.people, project.leaderId),
      start: project.startDate ?? "",
      end: project.endDate ?? "",
      archived: project.archived ? "Sí" : "No",
    });
  }

  addSimpleSheet(wb, "Fases", data.fases, [
    ["Proyecto", (r) => nameOf(workspace.allProjects, r.projectId), 24],
    ["Fase", (r) => r.name, 24],
    ["Descripción", (r) => r.description, 34],
  ]);

  addSimpleSheet(wb, "Responsables", data.personas, [
    ["Nombre", (r) => r.name, 22],
    ["Rol / área", (r) => r.role, 20],
    ["Activo", (r) => (r.active ? "Sí" : "No"), 8],
  ]);

  addSimpleSheet(wb, "Estados", data.estados, [
    ["Estado", (r) => `${r.emoji} ${r.name}`.trim(), 20],
    ["Completa", (r) => (r.isDone ? "Sí" : "No"), 10],
    ["Cancela", (r) => (r.isCancelled ? "Sí" : "No"), 10],
  ]);

  addSimpleSheet(wb, "Etapas Kanban", data.etapas, [
    ["Etapa", (r) => `${r.emoji} ${r.name}`.trim(), 20],
    ["Límite", (r) => r.wipLimit ?? "", 10],
  ]);

  addSimpleSheet(wb, "Prioridades", data.prioridades, [
    ["Prioridad", (r) => `${r.emoji} ${r.name}`.trim(), 20],
    ["Peso", (r) => r.weight, 8],
  ]);

  addSimpleSheet(wb, "Festivos", data.festivos, [
    ["Fecha", (r) => r.date, 14],
    ["Descripción", (r) => r.description, 30],
  ]);

  addSimpleSheet(wb, "Dependencias", data.dependencias, [
    ["Antes", (r) => taskById.get(r.predecessorId)?.title ?? "", 34],
    ["Después", (r) => taskById.get(r.successorId)?.title ?? "", 34],
    ["Tipo", (r) => r.type, 8],
  ]);

  for (const sheet of wb.worksheets) {
    sheet.getRow(1).font = { bold: true };
    sheet.views = [{ state: "frozen", ySplit: 1 }];
  }

  const buffer = await wb.xlsx.writeBuffer();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="apex-${hoy}.xlsx"`,
    },
  });
}

function addSimpleSheet<T>(
  wb: ExcelJS.Workbook,
  name: string,
  rows: T[],
  columns: [string, (row: T) => string | number, number][],
) {
  const sheet = wb.addWorksheet(name);
  sheet.columns = columns.map(([header, , width]) => ({ header, width }));
  for (const row of rows) {
    sheet.addRow(columns.map(([, get]) => get(row)));
  }
}
