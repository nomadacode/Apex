"use client";

import { useState } from "react";

import { cn } from "@/lib/cn";

/** Celdas de edición inline. Todas comparten la misma promesa: el valor
 *  se guarda al salir del control (blur o cambio), sin botón "guardar",
 *  y si el guardado falla la fila vuelve a lo que decía la base. */

const CELL =
  "w-full rounded border border-transparent bg-transparent px-1.5 py-1 text-sm outline-none transition-colors hover:border-border focus:border-accent focus:bg-surface";

export function TextCell({
  value,
  onCommit,
  placeholder,
  className,
}: {
  value: string;
  onCommit: (next: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);

  // Mientras no se esté editando, el valor de la base manda: así una
  // actualización desde otra vista se refleja sin pisar lo que se tipea.
  const shown = editing ? draft : value;

  return (
    <input
      value={shown}
      placeholder={placeholder}
      onFocus={() => {
        setDraft(value);
        setEditing(true);
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        setEditing(false);
        if (draft !== value) onCommit(draft);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
        if (e.key === "Escape") {
          setDraft(value);
          setEditing(false);
          e.currentTarget.blur();
        }
      }}
      className={cn(CELL, className)}
    />
  );
}

export function SelectCell({
  value,
  options,
  onCommit,
  emptyLabel = "—",
  className,
}: {
  value: number | null;
  options: { id: number; label: string; color?: string }[];
  onCommit: (next: number | null) => void;
  emptyLabel?: string;
  className?: string;
}) {
  return (
    <select
      value={value ?? ""}
      onChange={(e) =>
        onCommit(e.target.value === "" ? null : Number(e.target.value))
      }
      className={cn(CELL, "cursor-pointer", className)}
    >
      <option value="">{emptyLabel}</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function DateCell({
  value,
  onCommit,
  className,
  title,
}: {
  value: string | null;
  onCommit: (next: string | null) => void;
  className?: string;
  title?: string;
}) {
  return (
    <input
      type="date"
      value={value ?? ""}
      title={title}
      onChange={(e) => onCommit(e.target.value || null)}
      className={cn(CELL, "cursor-pointer", className)}
    />
  );
}

export function CheckCell({
  checked,
  onCommit,
  label,
}: {
  checked: boolean;
  onCommit: (next: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-center py-1">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onCommit(e.target.checked)}
        aria-label={label}
        className="cursor-pointer"
      />
    </label>
  );
}

/** Barra de progreso editable. Con subtareas se vuelve solo lectura:
 *  el valor lo dicta el promedio de las hijas. */
export function ProgressCell({
  value,
  readOnly,
  onCommit,
}: {
  value: number;
  readOnly?: boolean;
  onCommit: (next: number) => void;
}) {
  const [draft, setDraft] = useState<number | null>(null);
  const shown = draft ?? value;

  if (readOnly) {
    return (
      <div
        className="flex items-center gap-2 px-1.5"
        title="Calculado a partir de las subtareas"
      >
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
          <div
            className="h-full rounded-full bg-accent/60"
            style={{ width: `${shown}%` }}
          />
        </div>
        <span className="w-8 shrink-0 text-right text-xs text-muted">
          {shown}%
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 px-1.5">
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={shown}
        onChange={(e) => setDraft(Number(e.target.value))}
        onPointerUp={() => {
          if (draft !== null && draft !== value) onCommit(draft);
          setDraft(null);
        }}
        onKeyUp={() => {
          if (draft !== null && draft !== value) onCommit(draft);
          setDraft(null);
        }}
        aria-label="Progreso"
        className="h-1.5 flex-1 cursor-pointer accent-[var(--accent)]"
      />
      <span className="w-8 shrink-0 text-right text-xs text-muted">
        {shown}%
      </span>
    </div>
  );
}
