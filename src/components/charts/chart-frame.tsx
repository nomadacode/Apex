"use client";

import { useState, type ReactNode } from "react";
import { Table2, TrendingUp } from "lucide-react";

import { cn } from "@/lib/cn";

/** Marco común de todo gráfico: título, leyenda, el lienzo y la vista de
 *  tabla obligatoria.
 *
 *  La tabla no es un extra: la guía de dataviz exige que todo valor sea
 *  alcanzable sin hover y sin depender del color. El botón la alterna. */
export function ChartCard({
  title,
  subtitle,
  legend,
  actions,
  table,
  children,
  className,
}: {
  title: string;
  subtitle?: ReactNode;
  legend?: ReactNode;
  actions?: ReactNode;
  /** Equivalente accesible del gráfico. Obligatorio salvo en fichas sueltas. */
  table?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const [showTable, setShowTable] = useState(false);

  return (
    <section
      className={cn(
        // `min-w-0` no es decorativo: dentro de una grilla, una columna
        // `1fr` no se achica por debajo del ancho mínimo de su contenido.
        // Sin esto, un gráfico con muchas barras estira la tarjeta y la
        // saca de la pantalla en un celular.
        "viz-root flex min-w-0 flex-col rounded-lg border border-border bg-surface",
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-2 border-b border-border px-4 py-2.5">
        <div className="min-w-0">
          <h3 className="text-sm font-medium">{title}</h3>
          {subtitle ? (
            <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          {actions}
          {table ? (
            <button
              onClick={() => setShowTable((v) => !v)}
              aria-pressed={showTable}
              title={showTable ? "Ver el gráfico" : "Ver los datos en tabla"}
              className="flex size-7 cursor-pointer items-center justify-center rounded text-muted transition-colors hover:bg-surface-2 hover:text-foreground"
            >
              {showTable ? (
                <TrendingUp className="size-3.5" />
              ) : (
                <Table2 className="size-3.5" />
              )}
            </button>
          ) : null}
        </div>
      </header>

      {legend && !showTable ? (
        <div className="px-4 pt-3">{legend}</div>
      ) : null}

      <div className="min-w-0 flex-1 p-4">
        {showTable && table ? (
          <div className="overflow-x-auto">{table}</div>
        ) : (
          children
        )}
      </div>
    </section>
  );
}

/** Leyenda. Presente siempre que haya dos o más series: la identidad no
 *  puede depender solo del color. */
export function Legend({
  items,
  shape = "rect",
}: {
  items: { label: string; color: string }[];
  shape?: "rect" | "line";
}) {
  if (items.length < 2) return null;
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5 text-xs">
          <span
            aria-hidden
            className={cn("shrink-0", shape === "line" ? "h-0.5 w-4" : "size-2.5 rounded-sm")}
            style={{ background: item.color }}
          />
          <span className="text-muted">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

/** Tabla equivalente de un gráfico. */
export function DataTable({
  columns,
  rows,
}: {
  columns: string[];
  rows: (string | number)[][];
}) {
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted">
          {columns.map((column, index) => (
            <th
              key={column}
              className={cn("px-2 py-1.5 font-medium", index > 0 && "text-right")}
            >
              {column}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex} className="border-b border-border last:border-0">
            {row.map((cell, cellIndex) => (
              <td
                key={cellIndex}
                className={cn(
                  "px-2 py-1.5",
                  cellIndex > 0 && "text-right tabular-nums text-muted",
                )}
              >
                {cell}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** Estado vacío de un gráfico: dice por qué no hay nada, no se queda mudo. */
export function ChartEmpty({ message }: { message: string }) {
  return (
    <p className="flex min-h-32 items-center justify-center px-4 text-center text-sm text-muted">
      {message}
    </p>
  );
}
