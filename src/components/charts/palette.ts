/** Paleta de visualización.
 *
 *  Validada con el script de la guía de dataviz contra las superficies
 *  reales de la app (`#ffffff` en claro, `#14171d` en oscuro):
 *
 *    categórica  claro  → todos los checks PASS (peor par adyacente CVD ΔE 9,1;
 *                         visión normal 19,6; tres slots por debajo de 3:1 de
 *                         contraste, cubiertos por etiquetas visibles + vista
 *                         de tabla, que es la mitigación que pide la guía)
 *    categórica  oscuro → todos los checks PASS, contraste ≥ 3:1
 *    ordinal     ambos  → monotonía, saltos ≥ 0,06 y un solo tono
 *
 *  Los valores se exponen como variables CSS en `chart-frame.tsx`, así el
 *  cambio de tema los reemplaza en un solo lugar.
 */

/** Orden fijo. Nunca se cicla ni se genera un noveno tono: pasado el
 *  octavo, la cola va a "Otros" o el gráfico se parte en múltiplos. */
export const CATEGORICAL_LIGHT = [
  "#2a78d6", // azul
  "#eb6834", // naranja
  "#1baf7a", // aqua
  "#eda100", // amarillo
  "#e87ba4", // magenta
  "#008300", // verde
  "#4a3aa7", // violeta
  "#e34948", // rojo
] as const;

export const CATEGORICAL_DARK = [
  "#3987e5",
  "#d95926",
  "#199e70",
  "#c98500",
  "#d55181",
  "#008300",
  "#9085e9",
  "#e66767",
] as const;

/** Rampa ordinal de un solo tono, para escalas ordenadas (bandas de
 *  antigüedad, tramos de demora). Claro→oscuro en modo claro; el modo
 *  oscuro invierte el sentido para conservar "más = más presente". */
export const ORDINAL_LIGHT = [
  "#86b6ef",
  "#5598e7",
  "#2a78d6",
  "#1c5cab",
  "#104281",
] as const;

export const ORDINAL_DARK = [
  "#184f95",
  "#256abf",
  "#3987e5",
  "#6da7ec",
  "#b7d3f6",
] as const;

/** Estado: reservados, nunca se usan como "serie 5". Siempre acompañados
 *  de ícono o texto, jamás color solo. */
export const STATUS_COLORS = {
  good: "#0ca30c",
  warning: "#fab219",
  serious: "#ec835a",
  critical: "#d03b3b",
} as const;

export type StatusTone = keyof typeof STATUS_COLORS;

export const MAX_SERIES = CATEGORICAL_LIGHT.length;

/** Variable CSS del slot `index`. Se reparten en orden fijo y estable:
 *  filtrar una serie no repinta a las que quedan. */
export function seriesVar(index: number): string {
  return `var(--viz-${(index % MAX_SERIES) + 1})`;
}

export function ordinalVar(index: number, total: number): string {
  // Con menos pasos que la rampa, se toman los extremos y se reparte.
  const span = ORDINAL_LIGHT.length - 1;
  const step = total <= 1 ? span : Math.round((index / (total - 1)) * span);
  return `var(--viz-ord-${step + 1})`;
}
