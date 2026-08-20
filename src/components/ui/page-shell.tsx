import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Marco común de toda pantalla: título, bajada, acciones y cuerpo.
 *
 *  Mantiene la altura fija para que las vistas con scroll propio
 *  (tabla, Kanban, Gantt) scrolleen adentro y no la página entera.
 *
 *  En celular la bajada se esconde: es contexto útil en una pantalla
 *  grande, pero ahí se come el alto que necesita el contenido. */
export function PageShell({
  title,
  subtitle,
  actions,
  tabs,
  children,
  scroll = true,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Pestañas de vista, debajo del título (las de Trabajo). */
  tabs?: ReactNode;
  children: ReactNode;
  scroll?: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <header
        className={cn(
          "flex shrink-0 flex-wrap items-end justify-between gap-3 bg-surface px-4 py-3 sm:px-6 sm:py-4",
          // Con pestañas, el borde lo dibuja la fila de pestañas: dos
          // líneas seguidas se ven como un error de maquetado.
          tabs ? "pb-2 sm:pb-2" : "border-b border-border",
        )}
      >
        <div className="min-w-0">
          <h1 className="text-lg font-semibold tracking-tight sm:text-xl">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-0.5 hidden text-sm text-muted sm:block">
              {subtitle}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </header>
      {tabs ? <div className="shrink-0 bg-surface">{tabs}</div> : null}
      <div
        className={
          scroll
            ? "min-h-0 flex-1 overflow-auto p-4 sm:p-6"
            : "flex min-h-0 flex-1 flex-col overflow-hidden"
        }
      >
        {children}
      </div>
    </div>
  );
}
