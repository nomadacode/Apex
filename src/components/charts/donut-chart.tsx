"use client";

import { useId, useState } from "react";

export type Slice = { label: string; value: number; color: string };

/**
 * Dona. Se reserva para parte-de-un-todo de un vistazo, con pocos
 * segmentos: es su única lectura honesta.
 *
 * Para comparar valores cercanos no sirve — eso es una barra. Si hay más
 * de seis segmentos, la cola se pliega en "Otros" antes de llegar acá.
 */
export function DonutChart({
  data,
  size = 148,
  thickness = 18,
  centerValue,
  centerLabel,
}: {
  data: Slice[];
  size?: number;
  thickness?: number;
  centerValue?: string;
  centerLabel?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const id = useId();

  const total = data.reduce((sum, slice) => sum + slice.value, 0);
  if (total === 0) return null;

  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  // 2px de superficie entre segmentos: el separador es aire, no un borde.
  const gap = data.length > 1 ? 2 : 0;

  // Desplazamiento de cada gajo: lo que ocupan todos los anteriores.
  const offsets = data.map(
    (_, index) =>
      (data.slice(0, index).reduce((sum, s) => sum + s.value, 0) / total) *
      circumference,
  );

  return (
    <div className="relative flex items-center justify-center">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-labelledby={`${id}-desc`}
      >
        <desc id={`${id}-desc`}>
          {data
            .map(
              (s) =>
                `${s.label}: ${s.value} (${Math.round((s.value / total) * 100)}%)`,
            )
            .join(". ")}
        </desc>

        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          {data.map((slice, index) => {
            const fraction = slice.value / total;
            const length = Math.max(fraction * circumference - gap, 0.5);
            const dash = `${length} ${circumference - length}`;

            return (
              <circle
                key={slice.label}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={slice.color}
                strokeWidth={thickness}
                strokeDasharray={dash}
                strokeDashoffset={-offsets[index]}
                opacity={hover === null || hover === index ? 1 : 0.4}
                onPointerEnter={() => setHover(index)}
                onPointerLeave={() => setHover(null)}
                style={{ transition: "opacity 120ms", cursor: "default" }}
              />
            );
          })}
        </g>
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
        {hover !== null ? (
          <>
            <span className="text-lg font-semibold">
              {Math.round((data[hover].value / total) * 100)}%
            </span>
            <span className="max-w-24 truncate px-1 text-[11px] text-muted">
              {data[hover].label}
            </span>
          </>
        ) : (
          <>
            {centerValue ? (
              <span className="text-xl font-semibold">{centerValue}</span>
            ) : null}
            {centerLabel ? (
              <span className="text-[11px] text-muted">{centerLabel}</span>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

/** Medidor: una sola razón contra un límite. Reemplaza a la torta de dos
 *  gajos, que es la forma equivocada para un porcentaje. */
export function Gauge({
  value,
  label,
  tone = "var(--viz-1)",
  size = 116,
}: {
  /** Fracción 0–1. */
  value: number;
  label?: string;
  tone?: string;
  size?: number;
}) {
  const thickness = 12;
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = Math.max(0, Math.min(1, value)) * circumference;

  return (
    <div className="relative flex items-center justify-center">
      <svg width={size} height={size} role="img" aria-label={label}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--viz-grid)"
            strokeWidth={thickness}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={tone}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`${filled} ${circumference - filled}`}
          />
        </g>
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-semibold">
          {Math.round(value * 100)}%
        </span>
        {label ? (
          <span className="text-[11px] text-muted">{label}</span>
        ) : null}
      </div>
    </div>
  );
}
