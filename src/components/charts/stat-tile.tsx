import Link from "next/link";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";
import type { StatusTone } from "@/components/charts/palette";

const TONE_VAR: Record<StatusTone, string> = {
  good: "var(--viz-good)",
  warning: "var(--viz-warning)",
  serious: "var(--viz-serious)",
  critical: "var(--viz-critical)",
};

/**
 * Ficha de estadística: un número que no necesita gráfico.
 *
 * Un valor suelto no es un gráfico de una barra ni una torta de dos gajos.
 * El color de estado nunca viaja solo — siempre lleva su etiqueta al lado.
 */
export function StatTile({
  label,
  value,
  hint,
  tone,
  icon,
  href,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: StatusTone;
  icon?: ReactNode;
  href?: string;
  className?: string;
}) {
  const body = (
    <div
      className={cn(
        "flex h-full flex-col gap-1 rounded-lg border border-border bg-surface px-4 py-3 transition-colors",
        href && "hover:border-accent",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-xs text-muted">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <span
        className="text-2xl font-semibold"
        style={tone ? { color: TONE_VAR[tone] } : undefined}
      >
        {value}
      </span>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );

  return href ? (
    <Link href={href} className="min-w-0">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Número protagonista de una pantalla. Misma tipografía que el resto —
 *  nada de una fuente decorativa— y figuras proporcionales. */
export function HeroFigure({
  value,
  label,
  tone,
}: {
  value: string;
  label: string;
  tone?: StatusTone;
}) {
  return (
    <div className="flex flex-col">
      <span
        className="text-5xl font-semibold leading-none"
        style={tone ? { color: TONE_VAR[tone] } : undefined}
      >
        {value}
      </span>
      <span className="mt-1 text-sm text-muted">{label}</span>
    </div>
  );
}
