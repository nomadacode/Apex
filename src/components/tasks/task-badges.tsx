import { cn } from "@/lib/cn";
import type { Person, Priority, Status } from "@/db/schema";

/** Fichitas de estado, prioridad y responsable, con el color que se
 *  configuró en Configuración. Se reusan en tabla, Kanban, matriz,
 *  calendarios y panel de detalle. */

export function StatusBadge({ status }: { status: Status | undefined }) {
  if (!status) return <span className="text-xs text-muted">Sin estado</span>;
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
      style={{ background: `${status.color}22`, color: status.color }}
    >
      {status.emoji ? <span aria-hidden>{status.emoji}</span> : null}
      {status.name}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: Priority | undefined }) {
  if (!priority) return null;
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs"
      style={{ background: `${priority.color}33` }}
      title={`Prioridad ${priority.name}`}
    >
      {priority.emoji ? <span aria-hidden>{priority.emoji}</span> : null}
      {priority.name}
    </span>
  );
}

export function PersonAvatar({
  person,
  size = "sm",
}: {
  person: Person | undefined;
  size?: "sm" | "md";
}) {
  if (!person) {
    return (
      <span
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full border border-dashed border-border text-[10px] text-muted",
          size === "sm" ? "size-6" : "size-8",
        )}
        title="Sin responsable"
      >
        ?
      </span>
    );
  }
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full font-semibold text-white",
        size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs",
      )}
      style={{ background: person.color }}
      title={person.role ? `${person.name} · ${person.role}` : person.name}
    >
      {person.name
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("")}
    </span>
  );
}

/** Días restantes con el color que corresponde: rojo si venció, ámbar si
 *  vence hoy o pronto, gris si está lejos o ya terminó. */
export function DaysRemainingBadge({
  value,
}: {
  value: number | null | "done";
}) {
  if (value === null) return <span className="text-xs text-muted">—</span>;
  if (value === "done")
    return (
      <span className="text-xs text-muted" title="Tarea completada">
        ✓
      </span>
    );

  const tone =
    value < 0
      ? "text-danger"
      : value === 0
        ? "text-warning"
        : value <= 3
          ? "text-warning/80"
          : "text-muted";

  const label =
    value < 0
      ? `${Math.abs(value)} d de atraso`
      : value === 0
        ? "vence hoy"
        : `${value} d`;

  return <span className={cn("text-xs whitespace-nowrap", tone)}>{label}</span>;
}
