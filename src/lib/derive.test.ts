import { describe, expect, it } from "vitest";

import {
  addDays,
  daysBetween,
  eachDay,
  formatDate,
  startOfWeek,
  weekdayIndex,
} from "@/lib/dates";
import {
  childrenByParent,
  countBy,
  daysRemaining,
  descendantIds,
  durationDays,
  findCycle,
  isDueSoon,
  isDueToday,
  isOverdue,
  isWorkday,
  quadrantOf,
  rollupProgress,
  shiftWorkdays,
  summarize,
  workdaysBetween,
  type Calendar,
  type StatusLike,
  type TaskLike,
} from "@/lib/derive";

const NOT_STARTED: StatusLike = { id: 1, isDone: false, isCancelled: false };
const DONE: StatusLike = { id: 2, isDone: true, isCancelled: false };
const CANCELLED: StatusLike = { id: 3, isDone: false, isCancelled: true };

const STATUSES = new Map<number, StatusLike>([
  [1, NOT_STARTED],
  [2, DONE],
  [3, CANCELLED],
]);

const TODAY = "2026-08-13";

function task(overrides: Partial<TaskLike> = {}): TaskLike {
  return {
    id: 1,
    statusId: 1,
    startDate: null,
    dueDate: null,
    important: false,
    urgent: false,
    progress: 0,
    parentTaskId: null,
    ...overrides,
  };
}

/** L-V laborables, con dos festivos cargados. */
const CALENDAR: Calendar = {
  workdays: [true, true, true, true, true, false, false],
  holidays: new Set(["2026-08-17", "2026-12-25"]),
};

describe("fechas", () => {
  it("cuenta días entre fechas sin corrimiento por horario de verano", () => {
    // En el hemisferio norte el cambio de hora cae a fin de octubre;
    // con Date locales esto daría 30 o 32 días en vez de 31.
    expect(daysBetween("2026-10-01", "2026-11-01")).toBe(31);
    expect(daysBetween("2026-03-01", "2026-04-01")).toBe(31);
    expect(daysBetween("2026-08-13", "2026-08-13")).toBe(0);
    expect(daysBetween("2026-08-13", "2026-08-10")).toBe(-3);
  });

  it("suma días cruzando fin de mes y de año", () => {
    expect(addDays("2026-08-30", 3)).toBe("2026-09-02");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("indexa la semana con lunes = 0", () => {
    expect(weekdayIndex("2026-08-10")).toBe(0); // lunes
    expect(weekdayIndex("2026-08-15")).toBe(5); // sábado
    expect(weekdayIndex("2026-08-16")).toBe(6); // domingo
  });

  it("resuelve el inicio de semana según la preferencia", () => {
    expect(startOfWeek("2026-08-13", "monday")).toBe("2026-08-10");
    expect(startOfWeek("2026-08-13", "sunday")).toBe("2026-08-09");
    // Un domingo, con semana que empieza en domingo, es su propio inicio.
    expect(startOfWeek("2026-08-16", "sunday")).toBe("2026-08-16");
  });

  it("enumera rangos inclusive y devuelve vacío si están invertidos", () => {
    expect(eachDay("2026-08-13", "2026-08-15")).toEqual([
      "2026-08-13",
      "2026-08-14",
      "2026-08-15",
    ]);
    expect(eachDay("2026-08-15", "2026-08-13")).toEqual([]);
  });

  it("formatea en castellano", () => {
    expect(formatDate("2026-08-13")).toBe("13 ago 2026");
    expect(formatDate(null)).toBe("");
  });
});

describe("días restantes", () => {
  it("es null cuando no hay fecha límite", () => {
    expect(daysRemaining(task(), STATUSES, TODAY)).toBeNull();
  });

  it('es "done" cuando la tarea está completada, aunque haya vencido', () => {
    const t = task({ statusId: 2, dueDate: "2026-08-01" });
    expect(daysRemaining(t, STATUSES, TODAY)).toBe("done");
    expect(isOverdue(t, STATUSES, TODAY)).toBe(false);
  });

  it("cuenta positivo a futuro y negativo si venció", () => {
    expect(daysRemaining(task({ dueDate: "2026-08-20" }), STATUSES, TODAY)).toBe(7);
    expect(daysRemaining(task({ dueDate: "2026-08-10" }), STATUSES, TODAY)).toBe(-3);
    expect(daysRemaining(task({ dueDate: TODAY }), STATUSES, TODAY)).toBe(0);
  });

  it("marca atrasada, vence hoy y próxima a vencer", () => {
    expect(isOverdue(task({ dueDate: "2026-08-10" }), STATUSES, TODAY)).toBe(true);
    expect(isDueToday(task({ dueDate: TODAY }), STATUSES, TODAY)).toBe(true);
    expect(isDueSoon(task({ dueDate: "2026-08-18" }), STATUSES, TODAY)).toBe(true);
    expect(isDueSoon(task({ dueDate: "2026-09-30" }), STATUSES, TODAY)).toBe(false);
    // "Vence hoy" no es "próxima a vencer": son cortes distintos.
    expect(isDueSoon(task({ dueDate: TODAY }), STATUSES, TODAY)).toBe(false);
  });

  it("no persigue tareas canceladas", () => {
    const t = task({ statusId: 3, dueDate: "2026-08-01" });
    expect(isOverdue(t, STATUSES, TODAY)).toBe(false);
    expect(isDueToday(task({ statusId: 3, dueDate: TODAY }), STATUSES, TODAY)).toBe(
      false,
    );
  });
});

describe("matriz de Eisenhower", () => {
  it("reparte por importancia y urgencia", () => {
    expect(quadrantOf(task({ important: true, urgent: true }))).toBe("do");
    expect(quadrantOf(task({ important: true, urgent: false }))).toBe("schedule");
    expect(quadrantOf(task({ important: false, urgent: true }))).toBe("delegate");
    expect(quadrantOf(task({ important: false, urgent: false }))).toBe("eliminate");
  });
});

describe("calendario laboral", () => {
  it("descarta fines de semana y festivos", () => {
    expect(isWorkday("2026-08-13", CALENDAR)).toBe(true); // jueves
    expect(isWorkday("2026-08-15", CALENDAR)).toBe(false); // sábado
    expect(isWorkday("2026-08-17", CALENDAR)).toBe(false); // lunes feriado
  });

  it("cuenta días laborables inclusive", () => {
    // Lun 10 a vie 14: 5 laborables.
    expect(workdaysBetween("2026-08-10", "2026-08-14", CALENDAR)).toBe(5);
    // Lun 10 a lun 17: 5 + lunes 17 feriado = 5.
    expect(workdaysBetween("2026-08-10", "2026-08-17", CALENDAR)).toBe(5);
    // Un solo día, y que sea sábado.
    expect(workdaysBetween("2026-08-15", "2026-08-15", CALENDAR)).toBe(0);
    expect(workdaysBetween("2026-08-13", "2026-08-13", CALENDAR)).toBe(1);
  });

  it("devuelve null sin fechas y 0 si el rango está invertido", () => {
    expect(workdaysBetween(null, "2026-08-14", CALENDAR)).toBeNull();
    expect(workdaysBetween("2026-08-14", null, CALENDAR)).toBeNull();
    expect(workdaysBetween("2026-08-20", "2026-08-14", CALENDAR)).toBe(0);
  });

  it("cambia el resultado si cambian los días laborables", () => {
    const seisDias: Calendar = {
      workdays: [true, true, true, true, true, true, false],
      holidays: [],
    };
    expect(workdaysBetween("2026-08-10", "2026-08-16", seisDias)).toBe(6);
  });

  it("calcula duración en días calendario, inclusive", () => {
    expect(durationDays("2026-08-10", "2026-08-14")).toBe(5);
    expect(durationDays("2026-08-10", "2026-08-10")).toBe(1);
    expect(durationDays("2026-08-14", "2026-08-10")).toBe(0);
    expect(durationDays(null, "2026-08-10")).toBeNull();
  });

  it("desplaza días laborables salteando finde y feriado", () => {
    // Viernes 14 + 1 laborable → salta sáb, dom y el feriado del lunes 17.
    expect(shiftWorkdays("2026-08-14", 1, CALENDAR)).toBe("2026-08-18");
    expect(shiftWorkdays("2026-08-18", -1, CALENDAR)).toBe("2026-08-14");
    expect(shiftWorkdays("2026-08-13", 0, CALENDAR)).toBe("2026-08-13");
  });

  it("no se cuelga si no hay ningún día laborable", () => {
    const sinDias: Calendar = { workdays: Array(7).fill(false), holidays: [] };
    expect(shiftWorkdays("2026-08-13", 3, sinDias)).toBeTruthy();
  });
});

describe("resumen de progreso", () => {
  const tasks = [
    task({ id: 1, statusId: 2, dueDate: "2026-08-01" }), // completada
    task({ id: 2, statusId: 1, dueDate: "2026-08-01" }), // atrasada
    task({ id: 3, statusId: 1, dueDate: TODAY }), // vence hoy
    task({ id: 4, statusId: 1, progress: 50 }), // en curso, sin fecha
    task({ id: 5, statusId: 3, dueDate: "2026-08-01" }), // cancelada
  ];

  it("excluye canceladas del numerador y del denominador", () => {
    const s = summarize(tasks, STATUSES, TODAY);
    expect(s.total).toBe(4);
    expect(s.cancelled).toBe(1);
    expect(s.done).toBe(1);
    expect(s.pending).toBe(3);
    expect(s.completion).toBeCloseTo(0.25);
  });

  it("cuenta atrasadas y las que vencen hoy", () => {
    const s = summarize(tasks, STATUSES, TODAY);
    expect(s.overdue).toBe(1);
    expect(s.dueToday).toBe(1);
  });

  it("pondera por el progreso declarado", () => {
    // (100 + 0 + 0 + 50) / 400
    expect(summarize(tasks, STATUSES, TODAY).weighted).toBeCloseTo(0.375);
  });

  it("no divide por cero con una lista vacía", () => {
    const s = summarize([], STATUSES, TODAY);
    expect(s.total).toBe(0);
    expect(s.completion).toBe(0);
    expect(s.weighted).toBe(0);
  });
});

describe("subtareas", () => {
  it("promedia el progreso de las hijas, ignorando canceladas", () => {
    const parent = task({ id: 10, progress: 0 });
    const children = [
      task({ id: 11, parentTaskId: 10, statusId: 2 }), // completada = 100
      task({ id: 12, parentTaskId: 10, progress: 40 }),
      task({ id: 13, parentTaskId: 10, statusId: 3, progress: 0 }), // cancelada
    ];
    expect(rollupProgress(parent, children, STATUSES)).toBe(70);
  });

  it("sin hijas usa el progreso propio", () => {
    expect(rollupProgress(task({ progress: 33 }), [], STATUSES)).toBe(33);
  });

  it("recorre el subárbol completo", () => {
    const all = [
      task({ id: 1 }),
      task({ id: 2, parentTaskId: 1 }),
      task({ id: 3, parentTaskId: 2 }),
      task({ id: 4, parentTaskId: 1 }),
      task({ id: 5 }),
    ];
    const index = childrenByParent(all);
    expect(descendantIds(1, index).sort()).toEqual([2, 3, 4]);
    expect(descendantIds(5, index)).toEqual([]);
  });

  it("no se cuelga si los datos tuvieran un ciclo", () => {
    const index = childrenByParent([
      task({ id: 1, parentTaskId: 2 }),
      task({ id: 2, parentTaskId: 1 }),
    ]);
    expect(descendantIds(1, index)).toEqual([2]);
  });
});

describe("dependencias", () => {
  it("rechaza la autodependencia", () => {
    expect(findCycle([], 5, 5)).toEqual([5, 5]);
  });

  it("detecta el ciclo y devuelve el camino", () => {
    // 1 → 2 → 3; agregar 3 → 1 cierra el círculo.
    const edges = [
      { predecessorId: 1, successorId: 2 },
      { predecessorId: 2, successorId: 3 },
    ];
    expect(findCycle(edges, 3, 1)).toEqual([1, 2, 3, 1]);
  });

  it("acepta lo que no cierra círculo", () => {
    const edges = [{ predecessorId: 1, successorId: 2 }];
    expect(findCycle(edges, 2, 3)).toBeNull();
    expect(findCycle(edges, 3, 1)).toBeNull();
  });
});

describe("agrupaciones", () => {
  it("cuenta por clave", () => {
    const counts = countBy(
      [task({ statusId: 1 }), task({ statusId: 1 }), task({ statusId: 2 })],
      (t) => t.statusId,
    );
    expect(counts.get(1)).toBe(2);
    expect(counts.get(2)).toBe(1);
  });
});
