/** Claves de la tabla `settings`, con sus valores por defecto. */
export const SETTING_KEYS = {
  /** 7 caracteres "0"/"1", de lunes a domingo. Default: L-V laborables. */
  workdays: "workdays",
  /** "monday" | "sunday" — primer día del calendario semanal. */
  weekStart: "weekStart",
  /** Nombre visible del espacio de trabajo. */
  workspaceName: "workspaceName",
} as const;

export const SETTING_DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.workdays]: "1111100",
  [SETTING_KEYS.weekStart]: "monday",
  [SETTING_KEYS.workspaceName]: "Apex",
};

export type WeekStart = "monday" | "sunday";

export type WorkspaceSettings = {
  /** Índice 0 = lunes … 6 = domingo. */
  workdays: boolean[];
  weekStart: WeekStart;
  workspaceName: string;
};

export function parseWorkdays(raw: string | undefined): boolean[] {
  const value = raw && /^[01]{7}$/.test(raw) ? raw : SETTING_DEFAULTS.workdays;
  return value.split("").map((c) => c === "1");
}

export function serializeWorkdays(workdays: boolean[]): string {
  return workdays.map((d) => (d ? "1" : "0")).join("");
}

export function toSettings(rows: { key: string; value: string }[]): WorkspaceSettings {
  const map = new Map(rows.map((r) => [r.key, r.value]));
  const weekStart = map.get(SETTING_KEYS.weekStart);
  return {
    workdays: parseWorkdays(map.get(SETTING_KEYS.workdays)),
    weekStart: weekStart === "sunday" ? "sunday" : "monday",
    workspaceName:
      map.get(SETTING_KEYS.workspaceName) ||
      SETTING_DEFAULTS[SETTING_KEYS.workspaceName],
  };
}

export const WEEKDAY_NAMES = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
];
