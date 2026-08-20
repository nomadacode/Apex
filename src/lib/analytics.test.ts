import { describe, expect, it } from "vitest";

import {
  agingBuckets,
  agingDays,
  average,
  closingDelayDays,
  cycleTimeDays,
  formatDays,
  formatDuration,
  leadTimeDays,
  median,
  personStats,
  punctuality,
  stageTimes,
  weeklyFlow,
  type AnalyticsEvent,
  type AnalyticsTask,
} from "@/lib/analytics";
import type { StatusLike } from "@/lib/derive";

const NOT_STARTED: StatusLike = { id: 1, isDone: false, isCancelled: false };
const DONE: StatusLike = { id: 2, isDone: true, isCancelled: false };
const CANCELLED: StatusLike = { id: 3, isDone: false, isCancelled: true };

const STATUSES = new Map<number, StatusLike>([
  [1, NOT_STARTED],
  [2, DONE],
  [3, CANCELLED],
]);

const TODAY = "2026-08-13";

function task(overrides: Partial<AnalyticsTask> = {}): AnalyticsTask {
  return {
    id: 1,
    title: "Tarea",
    projectId: 1,
    phaseId: null,
    assigneeId: 1,
    priorityId: null,
    kanbanStageId: 10,
    statusId: 1,
    startDate: null,
    dueDate: null,
    important: false,
    urgent: false,
    progress: 0,
    parentTaskId: null,
    createdAt: "2026-08-01 09:00:00",
    completedAt: null,
    ...overrides,
  };
}

function move(
  taskId: number,
  from: number | null,
  to: number | null,
  at: string,
): AnalyticsEvent {
  return {
    taskId,
    field: "etapa",
    oldValue: from == null ? null : String(from),
    newValue: to == null ? null : String(to),
    at,
  };
}

describe("tiempos de una tarea", () => {
  it("mide el lead time de punta a punta", () => {
    const t = task({
      createdAt: "2026-08-01 09:00:00",
      completedAt: "2026-08-06 09:00:00",
      statusId: 2,
    });
    expect(leadTimeDays(t)).toBe(5);
  });

  it("no mide lead time si sigue abierta", () => {
    expect(leadTimeDays(task())).toBeNull();
  });

  it("mide el cycle time desde el primer movimiento real", () => {
    const t = task({
      createdAt: "2026-08-01 09:00:00",
      completedAt: "2026-08-10 09:00:00",
      statusId: 2,
    });
    // Se creó el 1, pero recién empezó a moverse el 8: el ciclo son 2 días.
    const events = [move(1, 10, 11, "2026-08-08 09:00:00")];
    expect(cycleTimeDays(t, events)).toBe(2);
    // Sin movimientos, cae a la fecha de inicio planificada. Esa fecha es
    // medianoche y el cierre fue a las 9, de ahí el 5,4 y no 5 redondo.
    expect(cycleTimeDays({ ...t, startDate: "2026-08-05" }, [])).toBe(5.4);
  });

  it("mide el atraso al cerrar, con signo", () => {
    expect(
      closingDelayDays(
        task({ dueDate: "2026-08-10", completedAt: "2026-08-13 12:00:00" }),
      ),
    ).toBe(3);
    // Cerró antes: el número es negativo, no cero.
    expect(
      closingDelayDays(
        task({ dueDate: "2026-08-10", completedAt: "2026-08-08 12:00:00" }),
      ),
    ).toBe(-2);
    expect(closingDelayDays(task({ completedAt: "2026-08-08" }))).toBeNull();
  });

  it("envejece solo las tareas vivas", () => {
    expect(agingDays(task({ startDate: "2026-08-03" }), STATUSES, TODAY)).toBe(10);
    expect(
      agingDays(task({ statusId: 2, startDate: "2026-08-03" }), STATUSES, TODAY),
    ).toBeNull();
    expect(
      agingDays(task({ statusId: 3, startDate: "2026-08-03" }), STATUSES, TODAY),
    ).toBeNull();
    // Sin fecha de inicio, cuenta desde que se creó.
    expect(agingDays(task({ createdAt: "2026-08-11 00:00:00" }), STATUSES, TODAY)).toBe(2);
  });
});

describe("tiempo por etapa", () => {
  it("reparte las horas entre las etapas por las que pasó", () => {
    const t = task({
      id: 1,
      createdAt: "2026-08-01 00:00:00",
      completedAt: "2026-08-05 00:00:00",
      statusId: 2,
    });
    const events = [
      move(1, 10, 11, "2026-08-02 00:00:00"), // 1 día en la 10
      move(1, 11, 12, "2026-08-04 00:00:00"), // 2 días en la 11
    ]; // y 1 día en la 12 hasta cerrar

    const times = stageTimes([t], events, "2026-08-05 00:00:00", STATUSES);
    const byStage = new Map(times.map((s) => [s.stageId, s]));
    expect(byStage.get(10)!.totalHours).toBe(24);
    expect(byStage.get(11)!.totalHours).toBe(48);
    expect(byStage.get(12)!.totalHours).toBe(24);
  });

  it("cierra en ahora el tramo de una tarea que sigue trabada", () => {
    const t = task({ id: 1, createdAt: "2026-08-01 00:00:00" });
    const times = stageTimes([t], [], "2026-08-11 00:00:00", STATUSES);
    // 10 días parada en su etapa actual: justo lo que hay que ver.
    expect(times[0].stageId).toBe(10);
    expect(times[0].totalHours).toBe(240);
  });

  it("suma varias tareas y promedia por tramo", () => {
    const a = task({ id: 1, createdAt: "2026-08-01 00:00:00" });
    const b = task({ id: 2, createdAt: "2026-08-01 00:00:00" });
    const times = stageTimes([a, b], [], "2026-08-03 00:00:00", STATUSES);
    expect(times[0].samples).toBe(2);
    expect(times[0].tasks).toBe(2);
    expect(times[0].avgHours).toBe(48);
  });

  it("ignora las canceladas", () => {
    const t = task({ id: 1, statusId: 3, createdAt: "2026-08-01 00:00:00" });
    expect(stageTimes([t], [], "2026-08-11 00:00:00", STATUSES)).toEqual([]);
  });

  it("ordena de la etapa más lenta a la más rápida", () => {
    const a = task({ id: 1, kanbanStageId: 10, createdAt: "2026-08-01 00:00:00" });
    const b = task({ id: 2, kanbanStageId: 11, createdAt: "2026-08-09 00:00:00" });
    const times = stageTimes([a, b], [], "2026-08-11 00:00:00", STATUSES);
    expect(times[0].stageId).toBe(10);
    expect(times[1].stageId).toBe(11);
  });
});

describe("ranking de responsables", () => {
  const tasks = [
    // Ana: cierra tarde de forma consistente.
    task({
      id: 1,
      assigneeId: 1,
      statusId: 2,
      dueDate: "2026-08-01",
      completedAt: "2026-08-06 00:00:00",
      createdAt: "2026-07-27 00:00:00",
    }),
    task({
      id: 2,
      assigneeId: 1,
      statusId: 2,
      dueDate: "2026-08-05",
      completedAt: "2026-08-08 00:00:00",
      createdAt: "2026-08-01 00:00:00",
    }),
    // Beto: cierra a tiempo.
    task({
      id: 3,
      assigneeId: 2,
      statusId: 2,
      dueDate: "2026-08-10",
      completedAt: "2026-08-09 00:00:00",
      createdAt: "2026-08-06 00:00:00",
    }),
    // Beto tiene además una abierta y vencida.
    task({ id: 4, assigneeId: 2, dueDate: "2026-08-01", startDate: "2026-07-25" }),
    // Cancelada: no debe contar para nadie.
    task({ id: 5, assigneeId: 1, statusId: 3 }),
  ];

  it("pone primero a quien más demora", () => {
    const stats = personStats(tasks, [], STATUSES, TODAY);
    expect(stats[0].personId).toBe(1);
    expect(stats[0].avgDelay).toBe(4); // (5 + 3) / 2
  });

  it("mide la puntualidad de cada uno", () => {
    const stats = personStats(tasks, [], STATUSES, TODAY);
    const ana = stats.find((s) => s.personId === 1)!;
    const beto = stats.find((s) => s.personId === 2)!;
    expect(ana.onTimeRate).toBe(0);
    expect(beto.onTimeRate).toBe(1);
    expect(beto.overdue).toBe(1);
    expect(beto.oldestOpenDays).toBe(19);
  });

  it("excluye las canceladas del total", () => {
    const ana = personStats(tasks, [], STATUSES, TODAY).find(
      (s) => s.personId === 1,
    )!;
    expect(ana.total).toBe(2);
  });

  it("promedia el lead time de lo cerrado", () => {
    const ana = personStats(tasks, [], STATUSES, TODAY).find(
      (s) => s.personId === 1,
    )!;
    expect(ana.avgLeadTime).toBe(8.5); // (10 + 7) / 2
  });
});

describe("puntualidad global", () => {
  it("separa a tiempo, tarde, vencidas abiertas y no medibles", () => {
    const result = punctuality(
      [
        task({ id: 1, statusId: 2, dueDate: "2026-08-10", completedAt: "2026-08-09" }),
        task({ id: 2, statusId: 2, dueDate: "2026-08-10", completedAt: "2026-08-12" }),
        task({ id: 3, dueDate: "2026-08-01" }),
        task({ id: 4, statusId: 2, completedAt: "2026-08-09" }),
        task({ id: 5, statusId: 3, dueDate: "2026-07-01" }),
      ],
      STATUSES,
      TODAY,
    );
    expect(result.onTime).toBe(1);
    expect(result.late).toBe(1);
    expect(result.openOverdue).toBe(1);
    expect(result.unmeasured).toBe(1);
    expect(result.rate).toBe(0.5);
    expect(result.avgDelay).toBe(2);
  });

  it("no inventa un porcentaje cuando no hay nada que juzgar", () => {
    expect(punctuality([], STATUSES, TODAY).rate).toBeNull();
  });
});

describe("flujo semanal", () => {
  it("cuenta lo creado y lo cerrado en cada semana", () => {
    const tasks = [
      task({
        id: 1,
        createdAt: "2026-08-03 10:00:00",
        completedAt: "2026-08-05 10:00:00",
        statusId: 2,
      }),
      task({ id: 2, createdAt: "2026-08-04 10:00:00" }),
      task({
        id: 3,
        createdAt: "2026-08-10 10:00:00",
        completedAt: "2026-08-12 10:00:00",
        statusId: 2,
      }),
    ];
    const flow = weeklyFlow(tasks, STATUSES, ["2026-08-03", "2026-08-10"]);
    expect(flow[0]).toMatchObject({ created: 2, completed: 1, avgLeadTime: 2 });
    expect(flow[1]).toMatchObject({ created: 1, completed: 1, avgLeadTime: 2 });
  });
});

describe("aging del WIP", () => {
  it("reparte las tareas abiertas en bandas", () => {
    const tasks = [
      task({ id: 1, startDate: "2026-08-12" }), // 1 día
      task({ id: 2, startDate: "2026-08-08" }), // 5 días
      task({ id: 3, startDate: "2026-07-01" }), // 43 días
      task({ id: 4, statusId: 2, startDate: "2026-07-01" }), // cerrada
    ];
    const buckets = agingBuckets(tasks, STATUSES, TODAY);
    expect(buckets.map((b) => b.count)).toEqual([1, 1, 0, 0, 1]);
    expect(buckets[4].sample[0].id).toBe(3);
  });
});

describe("utilidades", () => {
  it("promedia y mediana sin romperse con listas vacías", () => {
    expect(average([])).toBeNull();
    expect(average([1, 2, 4])).toBe(2.3);
    expect(median([])).toBeNull();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });

  it("formatea duraciones en horas y días", () => {
    expect(formatDuration(null)).toBe("—");
    expect(formatDuration(6)).toBe("6 h");
    expect(formatDuration(36)).toBe("1,5 d");
    expect(formatDuration(24 * 40)).toBe("40 d");
    expect(formatDays(2.5)).toBe("2,5 d");
  });
});
