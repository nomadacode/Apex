"use client";

import Link from "next/link";
import { useState } from "react";

import { cn } from "@/lib/cn";

export type BarDatum = {
  label: string;
  value: number;
  /** Texto que se muestra en lugar del número crudo (p. ej. "2,5 d"). */
  display?: string;
  /** Color propio. Sin esto, una sola serie usa el slot 1. */
  color?: string;
  href?: string;
  /** Línea extra en el tooltip. */
  note?: string;
};

/**
 * Barras horizontales. La forma correcta cuando las categorías tienen
 * nombres largos (personas, etapas) — que es casi siempre en estos reportes.
 *
 * Se dibuja con HTML y porcentajes, no con un SVG estirado: un viewBox con
 * `preserveAspectRatio="none"` deforma la escala y desalinea las etiquetas
 * respecto de las barras.
 *
 * Una sola serie ⇒ un solo color: no se pinta cada barra de un tono
 * distinto según su tamaño, porque eso duplicaría en color lo que el largo
 * ya dice y quemaría el único canal libre que queda.
 */
export function BarChart({
  data,
  labelWidth = 132,
  emphasis,
  formatValue = (v) => String(v),
}: {
  data: BarDatum[];
  labelWidth?: number;
  /** Índice de la barra a destacar; el resto se atenúa. */
  emphasis?: number;
  formatValue?: (value: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) return null;

  const max = Math.max(...data.map((d) => Math.abs(d.value)), 1);

  return (
    <ul className="flex flex-col gap-2">
      {data.map((datum, index) => {
        // Se reserva un 22 % del canal para que el valor, que va después de
        // la punta, tenga siempre dónde caer sin salirse de la tarjeta.
        const width = (Math.abs(datum.value) / max) * 78;
        const dim = emphasis !== undefined && emphasis !== index;
        const text = datum.display ?? formatValue(datum.value);

        return (
          <li
            key={datum.label}
            className="flex items-center gap-2"
            onPointerEnter={() => setHover(index)}
            onPointerLeave={() => setHover(null)}
          >
            <span
              className="shrink-0 truncate text-xs text-foreground/80"
              style={{ width: labelWidth }}
              title={datum.label}
            >
              {datum.href ? (
                <Link href={datum.href} className="hover:underline">
                  {datum.label}
                </Link>
              ) : (
                datum.label
              )}
            </span>

            <div className="relative flex min-w-0 flex-1 items-center">
              <div
                className="h-3.5 rounded-r-[3px] transition-opacity"
                style={{
                  width: `${Math.max(width, 0.6)}%`,
                  // Con énfasis, el resto va en gris de fondo: un color
                  // diluido se sigue leyendo como "casi tan importante".
                  background: dim
                    ? "var(--viz-axis)"
                    : (datum.color ?? "var(--viz-1)"),
                  opacity: dim ? 0.55 : hover === index ? 1 : 0.9,
                }}
              />
              {/* El valor va después de la punta: nunca adentro, donde una
                  barra corta lo recortaría. */}
              <span
                className={cn(
                  "ml-1.5 whitespace-nowrap text-xs tabular-nums",
                  dim ? "text-muted/60" : "text-muted",
                )}
              >
                {text}
              </span>

              {hover === index && datum.note ? (
                <span className="ml-2 truncate text-[11px] text-muted/80">
                  {datum.note}
                </span>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
