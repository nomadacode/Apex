"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  CalendarRange,
  GanttChartSquare,
  Grid2X2,
  List,
  SquareKanban,
} from "lucide-react";

import { cn } from "@/lib/cn";

/**
 * Las seis maneras de mirar el mismo trabajo.
 *
 * Son vistas de una sola pantalla, no secciones distintas: el filtro que
 * pusiste en la lista sigue puesto al pasar al tablero, y la tarea que
 * tenías abierta sigue abierta. Por eso los enlaces arrastran los
 * parámetros actuales en lugar de empezar de cero.
 */
const VIEWS = [
  { href: "/tareas", label: "Lista", icon: List },
  { href: "/kanban", label: "Tablero", icon: SquareKanban },
  { href: "/gantt", label: "Cronograma", icon: GanttChartSquare },
  { href: "/calendario", label: "Calendario", icon: CalendarDays },
  { href: "/calendario/semana", label: "Semana", icon: CalendarRange },
  { href: "/matriz", label: "Prioridades", icon: Grid2X2 },
];

/** Parámetros que solo tienen sentido en la vista donde se eligieron. */
const VIEW_ONLY = ["agrupar", "orden", "escala", "mes", "anio", "semana", "r"];

export function ViewTabs() {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const shared = new URLSearchParams(searchParams.toString());
  VIEW_ONLY.forEach((key) => shared.delete(key));
  const query = shared.toString();

  return (
    <nav aria-label="Vistas del trabajo" className="border-b border-border">
      <div className="tab-strip -mb-px flex gap-1 px-4 sm:px-6">
        {VIEWS.map((view) => {
          const active =
            view.href === "/calendario"
              ? pathname === "/calendario"
              : pathname === view.href;
          const Icon = view.icon;
          return (
            <Link
              key={view.href}
              href={query ? `${view.href}?${query}` : view.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition-colors",
                active
                  ? "border-accent font-medium text-foreground"
                  : "border-transparent text-muted hover:text-foreground",
              )}
            >
              <Icon className="size-3.5" />
              {view.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
