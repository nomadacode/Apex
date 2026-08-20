"use client";

import { useId, useRef, useState } from "react";

export type LineSeries = {
  label: string;
  color: string;
  values: (number | null)[];
};

const PAD = { top: 10, right: 12, bottom: 22, left: 34 };

/**
 * Líneas sobre un eje temporal, con cruceta.
 *
 * Un solo eje Y, siempre: dos medidas de escalas distintas van en dos
 * gráficos, nunca en dos escalas superpuestas — es la forma más común de
 * inventar una correlación que los datos no tienen.
 */
export function LineChart({
  labels,
  series,
  height = 180,
  formatValue = (v) => String(v),
  area = false,
}: {
  labels: string[];
  series: LineSeries[];
  height?: number;
  formatValue?: (value: number) => string;
  /** Relleno al 10 % bajo la línea. Solo con una serie. */
  area?: boolean;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const ref = useRef<SVGSVGElement>(null);
  const id = useId();

  const width = 520; // viewBox; el ancho real lo da el contenedor
  const plotW = width - PAD.left - PAD.right;
  const plotH = height - PAD.top - PAD.bottom;

  const all = series.flatMap((s) => s.values).filter((v): v is number => v != null);
  const max = Math.max(...all, 1);
  const ticks = niceTicks(max);
  const scaleMax = ticks[ticks.length - 1];

  const x = (index: number) =>
    labels.length <= 1
      ? PAD.left + plotW / 2
      : PAD.left + (index / (labels.length - 1)) * plotW;
  const y = (value: number) => PAD.top + plotH - (value / scaleMax) * plotH;

  function handleMove(event: React.PointerEvent<SVGSVGElement>) {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const ratio = (event.clientX - rect.left) / rect.width;
    const index = Math.round(ratio * (labels.length - 1));
    setHover(Math.max(0, Math.min(labels.length - 1, index)));
  }

  return (
    <div className="relative">
      <svg
        ref={ref}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        onPointerMove={handleMove}
        onPointerLeave={() => setHover(null)}
        role="img"
        aria-labelledby={`${id}-desc`}
        className="block"
      >
        <desc id={`${id}-desc`}>
          {series
            .map(
              (s) =>
                `${s.label}: ${s.values.map((v, i) => `${labels[i]} ${v ?? "sin dato"}`).join(", ")}`,
            )
            .join(". ")}
        </desc>

        {/* Grilla: hairline sólida, un paso por encima de la superficie. */}
        {ticks.map((tick) => (
          <g key={tick}>
            <line
              x1={PAD.left}
              x2={width - PAD.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="var(--viz-grid)"
              strokeWidth={1}
            />
            <text
              x={PAD.left - 6}
              y={y(tick) + 3}
              textAnchor="end"
              fontSize={9}
              fill="var(--color-muted)"
              className="tabular-nums"
            >
              {tick}
            </text>
          </g>
        ))}

        {hover !== null ? (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={PAD.top}
            y2={PAD.top + plotH}
            stroke="var(--viz-axis)"
            strokeWidth={1}
          />
        ) : null}

        {area && series.length === 1
          ? (() => {
              const values = series[0].values;
              const filled = values
                .map((v, i) => ({ v, i }))
                .filter((p): p is { v: number; i: number } => p.v != null);
              if (filled.length === 0) return null;
              // El relleno arranca en el primer dato real y termina en el
              // último: extenderlo hasta los bordes dibujaría una rampa
              // desde cero en semanas donde no hubo ninguna medición.
              const firstX = x(filled[0].i);
              const lastX = x(filled[filled.length - 1].i);
              const points = filled.map((p) => `${x(p.i)},${y(p.v)}`);
              return (
                <polygon
                  points={`${firstX},${PAD.top + plotH} ${points.join(" ")} ${lastX},${PAD.top + plotH}`}
                  fill={series[0].color}
                  opacity={0.1}
                />
              );
            })()
          : null}

        {series.map((line) => {
          const points = line.values
            .map((v, i) => (v == null ? null : `${x(i)},${y(v)}`))
            .filter(Boolean) as string[];
          if (points.length === 0) return null;
          return (
            <polyline
              key={line.label}
              points={points.join(" ")}
              fill="none"
              stroke={line.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          );
        })}

        {/* Marcadores solo en el punto activo y en el final: un punto en
            cada dato satura y no se lee. */}
        {series.map((line) => {
          const lastIndex = line.values.reduce(
            (acc, v, i) => (v != null ? i : acc),
            -1,
          );
          const marks = [hover, lastIndex].filter(
            (i): i is number => i != null && i >= 0 && line.values[i] != null,
          );
          return marks.map((i) => (
            <circle
              key={`${line.label}-${i}`}
              cx={x(i)}
              cy={y(line.values[i]!)}
              r={4}
              fill={line.color}
              stroke="var(--color-surface)"
              strokeWidth={2}
            />
          ));
        })}

        {labels.map((label, index) =>
          index % Math.ceil(labels.length / 8) === 0 ||
          index === labels.length - 1 ? (
            <text
              key={label}
              x={x(index)}
              y={height - 6}
              textAnchor="middle"
              fontSize={9}
              fill="var(--color-muted)"
            >
              {label}
            </text>
          ) : null,
        )}
      </svg>

      {hover !== null ? (
        <div
          className="pointer-events-none absolute z-10 min-w-28 rounded border border-border bg-surface px-2 py-1.5 text-xs shadow-md"
          style={{
            left: `min(calc(${(x(hover) / width) * 100}% + 8px), calc(100% - 8rem))`,
            top: 4,
          }}
        >
          <p className="mb-1 text-muted">{labels[hover]}</p>
          {series.map((line) => (
            <p key={line.label} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="h-0.5 w-3 shrink-0"
                style={{ background: line.color }}
              />
              <span className="font-medium tabular-nums">
                {line.values[hover] == null
                  ? "—"
                  : formatValue(line.values[hover]!)}
              </span>
              <span className="truncate text-muted">{line.label}</span>
            </p>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Marcas del eje en números redondos. */
function niceTicks(max: number): number[] {
  const raw = max / 4;
  const magnitude = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))));
  const step = Math.ceil(raw / magnitude) * magnitude;
  const out: number[] = [];
  for (let value = 0; value <= max + step * 0.001; value += step) {
    out.push(Math.round(value * 100) / 100);
  }
  if (out.length < 2) out.push(step);
  return out;
}
