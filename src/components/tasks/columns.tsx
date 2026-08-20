"use client";

import { useCallback, useRef, useState } from "react";

import { cn } from "@/lib/cn";
import { useLocalRecord } from "@/lib/use-local-record";

/** Columnas de la tabla de tareas, en orden. */
export const COLUMN_KEYS = [
  "select",
  "title",
  "project",
  "status",
  "assignee",
  "important",
  "urgent",
  "start",
  "due",
  "remaining",
  "progress",
] as const;

export type ColumnKey = (typeof COLUMN_KEYS)[number];

export const COLUMN_LABELS: Record<ColumnKey, string> = {
  select: "",
  title: "Tarea",
  project: "Proyecto / fase",
  status: "Estado",
  assignee: "Responsable",
  important: "Imp",
  urgent: "Urg",
  start: "Inicio",
  due: "Límite",
  remaining: "Faltan",
  progress: "Progreso",
};

/** Anchos iniciales en píxeles.
 *
 *  Suman 1254, elegidos para que la tabla entre entera en una pantalla
 *  común sin desplazamiento, y para que los campos de fecha muestren el
 *  año completo en lugar de cortarlo. */
export const DEFAULT_WIDTHS: Record<ColumnKey, number> = {
  select: 34,
  title: 240,
  project: 140,
  status: 132,
  assignee: 132,
  important: 44,
  urgent: 44,
  start: 132,
  due: 132,
  remaining: 84,
  progress: 140,
};

/** Mínimos por columna: por debajo de esto el contenido deja de leerse. */
const MIN_WIDTHS: Record<ColumnKey, number> = {
  select: 34,
  title: 140,
  project: 90,
  status: 92,
  assignee: 92,
  important: 40,
  urgent: 40,
  start: 100,
  due: 100,
  remaining: 64,
  progress: 96,
};

/** La casilla de selección no se redimensiona: su ancho es el del control. */
const FIXED: ColumnKey[] = ["select"];

const STORAGE_KEY = "apex:task-columns";

/**
 * Anchos de columna, ajustables y recordados entre sesiones.
 *
 * Durante el arrastre el ancho vive en un estado transitorio, y recién al
 * soltar se guarda: escribir en `localStorage` en cada píxel del puntero
 * sería un derroche y haría que la tabla se sienta pesada.
 */
export function useColumnWidths() {
  const [stored, setStored] = useLocalRecord(STORAGE_KEY, DEFAULT_WIDTHS);
  const [draft, setDraft] = useState<Partial<Record<ColumnKey, number>>>({});

  const widths = { ...stored, ...draft };
  const template = COLUMN_KEYS.map((key) => `${widths[key]}px`).join(" ");
  const totalWidth = COLUMN_KEYS.reduce((sum, key) => sum + widths[key], 0);

  const preview = useCallback((key: ColumnKey, width: number) => {
    setDraft((prev) => ({ ...prev, [key]: clamp(key, width) }));
  }, []);

  const commit = useCallback(
    (key: ColumnKey, width: number) => {
      setStored({ ...stored, [key]: clamp(key, width) });
      setDraft((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    },
    [stored, setStored],
  );

  const reset = useCallback(
    (key: ColumnKey) => commit(key, DEFAULT_WIDTHS[key]),
    [commit],
  );

  const resetAll = useCallback(() => {
    setStored(DEFAULT_WIDTHS);
    setDraft({});
  }, [setStored]);

  return { widths, template, totalWidth, preview, commit, reset, resetAll };
}

function clamp(key: ColumnKey, width: number): number {
  return Math.max(MIN_WIDTHS[key], Math.round(width));
}

/** Encabezado con manija de arrastre para reordenar y redimensionar. */
export function ColumnHeader({
  column,
  width,
  align = "left",
  onPreview,
  onCommit,
  onReset,
}: {
  column: ColumnKey;
  width: number;
  align?: "left" | "center" | "right";
  onPreview: (width: number) => void;
  onCommit: (width: number) => void;
  onReset: () => void;
}) {
  const [dragging, setDragging] = useState(false);
  const origin = useRef({ x: 0, width: 0 });
  const latest = useRef(width);

  if (FIXED.includes(column)) {
    return <div className="px-1.5" />;
  }

  function widthAt(clientX: number) {
    return origin.current.width + (clientX - origin.current.x);
  }

  return (
    <div
      className={cn(
        "relative select-none px-1.5",
        align === "center" && "text-center",
        align === "right" && "text-right",
      )}
      title={COLUMN_LABELS[column] || undefined}
    >
      <span className="block truncate">{COLUMN_LABELS[column]}</span>

      <span
        onPointerDown={(event) => {
          event.preventDefault();
          (event.target as Element).setPointerCapture(event.pointerId);
          origin.current = { x: event.clientX, width };
          latest.current = width;
          setDragging(true);
        }}
        onPointerMove={(event) => {
          if (!dragging) return;
          latest.current = widthAt(event.clientX);
          onPreview(latest.current);
        }}
        onPointerUp={(event) => {
          if (!dragging) return;
          (event.target as Element).releasePointerCapture?.(event.pointerId);
          setDragging(false);
          onCommit(latest.current);
        }}
        onPointerCancel={() => {
          if (!dragging) return;
          setDragging(false);
          onCommit(latest.current);
        }}
        onDoubleClick={onReset}
        role="separator"
        aria-orientation="vertical"
        aria-label={`Ajustar el ancho de ${COLUMN_LABELS[column]}`}
        title="Arrastrá para ajustar · doble clic para restablecer"
        className={cn(
          // La zona de agarre es más ancha que la línea visible: una línea
          // de 1 px es imposible de acertar con el puntero.
          "absolute -right-1 top-0 z-20 h-full w-2 cursor-col-resize touch-none",
          "after:absolute after:left-1/2 after:top-0 after:h-full after:w-px after:-translate-x-1/2 hover:after:bg-accent",
          dragging ? "after:bg-accent" : "after:bg-transparent",
        )}
      />
    </div>
  );
}
