/** Fechas de calendario, sin hora ni zona horaria.
 *
 *  El planificador razona en días ("faltan 3 días", "vence hoy"), no en
 *  instantes. Toda fecha se maneja como string ISO `YYYY-MM-DD` y las
 *  cuentas se hacen en UTC para que no aparezcan corrimientos de un día
 *  por horario de verano: sumar 24 horas a una fecha local puede devolver
 *  el mismo día o saltear uno cuando el reloj cambia.
 */

export type ISODate = string;

const MS_PER_DAY = 86_400_000;

export function isISODate(value: unknown): value is ISODate {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/** Fecha de hoy en la zona horaria local, como `YYYY-MM-DD`. */
export function today(now: Date = new Date()): ISODate {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Milisegundos UTC de medianoche de esa fecha. */
export function toUTC(date: ISODate): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function fromUTC(ms: number): ISODate {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Días calendario entre dos fechas (b - a). Puede ser negativo. */
export function daysBetween(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / MS_PER_DAY);
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromUTC(toUTC(date) + days * MS_PER_DAY);
}

/** 0 = lunes … 6 = domingo (el Excel arrancaba la semana en lunes). */
export function weekdayIndex(date: ISODate): number {
  return (new Date(toUTC(date)).getUTCDay() + 6) % 7;
}

/** Fechas inclusive entre `from` y `to`. Vacío si `to` < `from`. */
export function eachDay(from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let ms = toUTC(from); ms <= toUTC(to); ms += MS_PER_DAY) {
    out.push(fromUTC(ms));
  }
  return out;
}

export function startOfMonth(year: number, month: number): ISODate {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

export function endOfMonth(year: number, month: number): ISODate {
  return fromUTC(Date.UTC(year, month, 0));
}

/** Primer día de la semana que contiene a `date`. */
export function startOfWeek(
  date: ISODate,
  weekStart: "monday" | "sunday",
): ISODate {
  const idx = weekdayIndex(date);
  const offset = weekStart === "monday" ? idx : (idx + 1) % 7;
  return addDays(date, -offset);
}

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? "";
}

export { MONTH_NAMES };

/** `2026-08-13` → `13 ago 2026`. */
export function formatDate(date: ISODate | null | undefined): string {
  if (!isISODate(date)) return "";
  const [y, m, d] = date.split("-");
  const short = MONTH_NAMES[Number(m) - 1]?.slice(0, 3).toLowerCase() ?? "";
  return `${Number(d)} ${short} ${y}`;
}

/** `2026-08-13` → `13/08`. Para ejes densos (Gantt, calendarios). */
export function formatDateShort(date: ISODate | null | undefined): string {
  if (!isISODate(date)) return "";
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}
