"use client";

import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { cn } from "@/lib/cn";
import { PARAM } from "@/lib/search-params";
import type { Workspace } from "@/lib/task-queries";
import { FILTER_KEYS, useFilters } from "@/lib/use-filters";

/** Barra de filtros común a Tareas, Kanban, Matriz, Gantt y Reportes.
 *
 *  En celular los controles se pliegan tras un botón: seis desplegables
 *  en fila se comen la pantalla antes de mostrar un solo dato. La
 *  búsqueda queda siempre a la vista porque es lo que más se usa. */
export function FiltersBar({
  workspace,
  show = ["search", "project", "phase", "assignee", "status", "priority"],
  extra,
}: {
  workspace: Workspace;
  show?: (
    | "search"
    | "project"
    | "phase"
    | "assignee"
    | "status"
    | "priority"
    | "stage"
    | "dates"
  )[];
  extra?: React.ReactNode;
}) {
  const { get, getNumber, set, clear, activeCount } = useFilters();
  const [openOnMobile, setOpenOnMobile] = useState(false);
  const projectId = getNumber(PARAM.project);

  const phases = workspace.phases.filter(
    (p) => projectId == null || p.projectId === projectId,
  );

  const hasControls =
    show.some((s) => s !== "search") || Boolean(extra);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {show.includes("search") ? (
          <div className="relative min-w-0 flex-1 sm:max-w-44 sm:flex-none">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted" />
            <Input
              defaultValue={get(PARAM.search)}
              onChange={(e) => set({ [PARAM.search]: e.target.value })}
              placeholder="Buscar…"
              className="pl-7"
              aria-label="Buscar tareas"
            />
          </div>
        ) : null}

        {hasControls ? (
          <Button
            size="md"
            onClick={() => setOpenOnMobile((v) => !v)}
            aria-expanded={openOnMobile}
            className="shrink-0 sm:hidden"
          >
            <SlidersHorizontal className="size-3.5" />
            Filtros
            {activeCount > 0 ? (
              <span className="ml-0.5 rounded bg-accent px-1 text-[10px] text-accent-fg">
                {activeCount}
              </span>
            ) : null}
          </Button>
        ) : null}
      </div>

      <div
        className={cn(
          "flex-wrap items-center gap-2",
          // Plegado en celular, siempre visible de tablet para arriba.
          openOnMobile ? "flex" : "hidden sm:flex",
        )}
      >
        {show.includes("project") ? (
          <Select
            value={get(PARAM.project)}
            onChange={(e) =>
              // Cambiar de proyecto invalida la fase elegida.
              set({ [PARAM.project]: e.target.value, [PARAM.phase]: null })
            }
            className="w-full sm:w-auto"
            aria-label="Filtrar por proyecto"
          >
            <option value="">Todos los proyectos</option>
            {workspace.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} · {p.name}
              </option>
            ))}
          </Select>
        ) : null}

        {show.includes("phase") && phases.length > 0 ? (
          <Select
            value={get(PARAM.phase)}
            onChange={(e) => set({ [PARAM.phase]: e.target.value })}
            className="w-full sm:w-auto"
            aria-label="Filtrar por fase"
          >
            <option value="">Todas las fases</option>
            {phases.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        ) : null}

        {show.includes("assignee") ? (
          <Select
            value={get(PARAM.assignee)}
            onChange={(e) => set({ [PARAM.assignee]: e.target.value })}
            className="w-full sm:w-auto"
            aria-label="Filtrar por responsable"
          >
            <option value="">Todos los responsables</option>
            <option value="ninguno">Sin responsable</option>
            {workspace.people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        ) : null}

        {show.includes("status") ? (
          <Select
            value={get(PARAM.status)}
            onChange={(e) => set({ [PARAM.status]: e.target.value })}
            className="w-full sm:w-auto"
            aria-label="Filtrar por estado"
          >
            <option value="">Todos los estados</option>
            {workspace.statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.emoji} {s.name}
              </option>
            ))}
          </Select>
        ) : null}

        {show.includes("priority") ? (
          <Select
            value={get(PARAM.priority)}
            onChange={(e) => set({ [PARAM.priority]: e.target.value })}
            className="w-full sm:w-auto"
            aria-label="Filtrar por prioridad"
          >
            <option value="">Todas las prioridades</option>
            {workspace.priorities.map((p) => (
              <option key={p.id} value={p.id}>
                {p.emoji} {p.name}
              </option>
            ))}
          </Select>
        ) : null}

        {show.includes("stage") ? (
          <Select
            value={get(PARAM.stage)}
            onChange={(e) => set({ [PARAM.stage]: e.target.value })}
            className="w-full sm:w-auto"
            aria-label="Filtrar por etapa"
          >
            <option value="">Todas las etapas</option>
            {workspace.stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.emoji} {s.name}
              </option>
            ))}
          </Select>
        ) : null}

        {show.includes("dates") ? (
          <div className="flex w-full flex-wrap items-center gap-1 text-xs text-muted sm:w-auto">
            <span className="shrink-0">Vence entre</span>
            <Input
              type="date"
              value={get(PARAM.from)}
              onChange={(e) => set({ [PARAM.from]: e.target.value })}
              className="min-w-0 flex-1 sm:w-auto sm:flex-none"
              aria-label="Desde"
            />
            <span className="shrink-0">y</span>
            <Input
              type="date"
              value={get(PARAM.to)}
              onChange={(e) => set({ [PARAM.to]: e.target.value })}
              className="min-w-0 flex-1 sm:w-auto sm:flex-none"
              aria-label="Hasta"
            />
          </div>
        ) : null}

        {extra}

        {activeCount > 0 ? (
          <Button size="sm" variant="ghost" onClick={() => clear(FILTER_KEYS)}>
            <X className="size-3.5" /> Limpiar filtros ({activeCount})
          </Button>
        ) : null}
      </div>
    </div>
  );
}
