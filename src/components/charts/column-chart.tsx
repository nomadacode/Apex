"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";

export type ColumnSeries = { label: string; color: string; values: number[] };

/**
 * Columnas agrupadas sobre un eje temporal. Se usa para el flujo semanal
 * —cuánto entra contra cuánto sale—, donde las dos series comparten
 * unidad y por lo tanto comparten un solo eje.
 */
export function ColumnChart({
  labels,
  series,
  height = 180,
  formatValue = (v) => String(v),
}: {
  labels: string[];
  series: ColumnSeries[];
  height?: number;
  formatValue?: (value: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  // Con muchas columnas en poco ancho las fechas se pisan, así que se
  // rotula una de cada dos o tres. Se cuenta desde el final para que la
  // semana más reciente —la que se mira— siempre quede rotulada, y para
  // que nunca queden dos rótulos pegados.
  const labelStep = Math.ceil(labels.length / 8);
  const rotulada = (index: number) =>
    (labels.length - 1 - index) % labelStep === 0;

  const rawMax = Math.max(...series.flatMap((s) => s.values), 1);
  const ticks = niceTicks(rawMax);
  const max = ticks[ticks.length - 1];
  const plotH = height - 24;

  return (
    <div className="relative">
      {/* El respiro de arriba es para que la marca más alta del eje no se
          coma el borde de la tarjeta. */}
      <div className="flex pt-2" style={{ height: height + 8 }}>
        {/* Eje de valores: carga los números que no se etiquetan encima
            de cada columna. */}
        <div
          className="relative w-7 shrink-0"
          style={{ height: plotH }}
          aria-hidden
        >
          {ticks.map((tick) => (
            <span
              key={tick}
              className="absolute right-1 -translate-y-1/2 text-[9px] tabular-nums text-muted"
              style={{ bottom: `${(tick / max) * 100}%` }}
            >
              {tick}
            </span>
          ))}
        </div>

        <div className="relative min-w-0 flex-1">
          {/* Grilla: hairline sólida, un paso por encima de la superficie. */}
          <div className="absolute inset-x-0 top-0" style={{ height: plotH }}>
            {ticks.map((tick) => (
              <span
                key={tick}
                className="absolute inset-x-0 h-px"
                style={{
                  bottom: `${(tick / max) * 100}%`,
                  background: "var(--viz-grid)",
                }}
              />
            ))}
          </div>

          <div className="relative flex h-full items-end gap-1">
            {labels.map((label, index) => (
              <div
                key={label}
                className="flex min-w-0 flex-1 flex-col items-center gap-1"
                onPointerEnter={() => setHover(index)}
                onPointerLeave={() => setHover(null)}
              >
                <div
                  className="flex w-full items-end justify-center gap-0.5"
                  style={{ height: plotH }}
                >
                  {series.map((s) => (
                    <div
                      key={s.label}
                      className={cn(
                        "w-full max-w-5 rounded-t-[3px] transition-opacity",
                        hover !== null && hover !== index && "opacity-45",
                      )}
                      style={{
                        height: `${s.values[index] > 0 ? Math.max((s.values[index] / max) * 100, 1.5) : 0}%`,
                        background: s.color,
                      }}
                      title={`${label} · ${s.label}: ${formatValue(s.values[index])}`}
                    />
                  ))}
                </div>
                {/* La fecha se centra en su columna y puede invadir el
                    espacio de las vecinas sin rótulo: cortarla a "25…" no
                    sirve de nada. */}
                <span className="whitespace-nowrap text-[10px] text-muted">
                  {rotulada(index) ? label : "\u00a0"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {hover !== null ? (
        <div
          className="pointer-events-none absolute top-0 z-10 min-w-24 rounded border border-border bg-surface px-2 py-1.5 text-xs shadow-md"
          style={{
            left: `min(calc(1.75rem + ${(hover / Math.max(labels.length, 1)) * 100}%), calc(100% - 7rem))`,
          }}
        >
          <p className="mb-1 text-muted">{labels[hover]}</p>
          {series.map((s) => (
            <p key={s.label} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="size-2 shrink-0 rounded-sm"
                style={{ background: s.color }}
              />
              <span className="font-medium tabular-nums">
                {formatValue(s.values[hover])}
              </span>
              <span className="text-muted">{s.label}</span>
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Marcas del eje en números redondos. */
function niceTicks(max: number): number[] {
  const target = 4;
  const raw = max / target;
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  const step = Math.max(1, Math.ceil(raw / magnitude) * magnitude);
  const out: number[] = [];
  for (let value = 0; value <= max + step * 0.001; value += step) out.push(value);
  if (out[out.length - 1] < max) out.push(out[out.length - 1] + step);
  return out;
}
