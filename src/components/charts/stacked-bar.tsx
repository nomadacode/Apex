"use client";

import { useState } from "react";

export type StackSegment = {
  label: string;
  value: number;
  color: string;
  href?: string;
};

/**
 * Barra apilada horizontal de una sola fila: parte-de-un-todo con nombres
 * largos, que es donde la torta falla.
 *
 * Los segmentos se separan con 2 px de superficie, nunca con un borde
 * dibujado alrededor. La etiqueta va adentro solo si entra; si no, queda
 * en la leyenda y el tooltip, y siempre en la vista de tabla.
 */
export function StackedBar({
  segments,
  height = 26,
  formatValue = (v) => String(v),
}: {
  segments: StackSegment[];
  height?: number;
  formatValue?: (value: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  if (total === 0) return null;

  return (
    <div className="relative">
      <div
        className="flex w-full overflow-hidden rounded"
        style={{ height, gap: 2 }}
        role="img"
        aria-label={segments
          .map((s) => `${s.label}: ${formatValue(s.value)}`)
          .join(", ")}
      >
        {segments
          .filter((s) => s.value > 0)
          .map((segment, index) => {
            const percent = (segment.value / total) * 100;
            // Se etiqueta adentro solo con espacio holgado; si no, el valor
            // vive en el tooltip y en la tabla. Nunca se recorta el texto.
            const showLabel = percent > 14;
            return (
              <div
                key={segment.label}
                className="relative flex items-center justify-center transition-opacity"
                style={{
                  width: `${percent}%`,
                  background: segment.color,
                  opacity: hover === null || hover === index ? 1 : 0.45,
                }}
                onPointerEnter={() => setHover(index)}
                onPointerLeave={() => setHover(null)}
                title={`${segment.label}: ${formatValue(segment.value)}`}
              >
                {showLabel ? (
                  <span className="px-1 text-[11px] font-medium tabular-nums text-white mix-blend-luminosity">
                    {formatValue(segment.value)}
                  </span>
                ) : null}
              </div>
            );
          })}
      </div>

      {hover !== null && segments[hover] ? (
        <div className="pointer-events-none absolute -top-8 left-0 z-10 rounded border border-border bg-surface px-2 py-1 text-xs shadow-md">
          <span className="font-medium tabular-nums">
            {formatValue(segments[hover].value)}
          </span>
          <span className="ml-1.5 text-muted">{segments[hover].label}</span>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Barras apiladas por fila: comparación de composición entre categorías
 * (por ejemplo, en qué estado está el trabajo de cada persona).
 */
export function StackedRows({
  rows,
  keys,
  labelWidth = 132,
  formatValue = (v) => String(v),
}: {
  rows: { label: string; href?: string; values: number[] }[];
  keys: { label: string; color: string }[];
  labelWidth?: number;
  formatValue?: (value: number) => string;
}) {
  const max = Math.max(
    ...rows.map((row) => row.values.reduce((a, b) => a + b, 0)),
    1,
  );

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => {
        const total = row.values.reduce((a, b) => a + b, 0);
        return (
          <div key={row.label} className="flex items-center gap-2">
            <span
              className="shrink-0 truncate text-xs text-foreground/80"
              style={{ width: labelWidth }}
              title={row.label}
            >
              {row.href ? (
                <a href={row.href} className="hover:underline">
                  {row.label}
                </a>
              ) : (
                row.label
              )}
            </span>
            {/* El canal ocupa el espacio disponible y la barra se dibuja
                adentro proporcional al total: si no, todas las filas
                quedarían del mismo largo y el gráfico diría que todos
                tienen la misma carga. */}
            <div className="min-w-0 flex-1">
              <div style={{ width: `${(total / max) * 100}%` }}>
                <StackedBar
                  height={18}
                  formatValue={formatValue}
                  segments={row.values.map((value, index) => ({
                    label: keys[index]?.label ?? "",
                    color: keys[index]?.color ?? "var(--viz-1)",
                    value,
                  }))}
                />
              </div>
            </div>
            <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted">
              {total}
            </span>
          </div>
        );
      })}
    </div>
  );
}
