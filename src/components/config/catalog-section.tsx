"use client";

import { useState } from "react";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";

import type { ActionResult } from "@/actions/result";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Label, Select } from "@/components/ui/field";
import { SortableList } from "@/components/ui/sortable-list";
import { useAction } from "@/lib/use-action";

export type CatalogItem = {
  id: number;
  name: string;
  emoji: string;
  color: string;
  /** Texto suelto a la derecha del nombre (p. ej. "terminal", "WIP 3"). */
  badge?: string;
};

/** Extras de formulario propios de cada catálogo (isDone, wipLimit, peso). */
export type CatalogExtra = {
  name: string;
  label: string;
  type: "checkbox" | "number";
  hint?: string;
  value: (item: CatalogItem | null) => string | boolean;
};

/** Lista editable y reordenable, común a estados, etapas y prioridades.
 *  Un solo componente en vez de tres pantallas casi idénticas. */
export function CatalogSection({
  title,
  description,
  items,
  extras = [],
  onSave,
  onDelete,
  onReorder,
  migration,
}: {
  title: string;
  description: string;
  items: CatalogItem[];
  extras?: CatalogExtra[];
  onSave: (formData: FormData) => Promise<ActionResult<{ id: number }>>;
  onDelete: (id: number) => Promise<ActionResult>;
  onReorder: (orderedIds: number[]) => Promise<ActionResult>;
  /** Cuando el borrado se bloquea por uso, se ofrece mover los datos. */
  migration?: {
    label: string;
    onMigrate: (fromId: number, toId: number) => Promise<ActionResult<{ moved: number }>>;
  };
}) {
  const { run, pending } = useAction();
  const [editing, setEditing] = useState<CatalogItem | null | "new">(null);
  const [deleting, setDeleting] = useState<CatalogItem | null>(null);
  const [blocked, setBlocked] = useState<{
    item: CatalogItem;
    error: string;
    hint?: string;
  } | null>(null);
  const [migrateTo, setMigrateTo] = useState<string>("");

  const current = editing === "new" ? null : editing;

  return (
    <section className="rounded-lg border border-border bg-surface">
      <header className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-medium">{title}</h2>
          <p className="text-sm text-muted">{description}</p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
          <Plus className="size-3.5" /> Agregar
        </Button>
      </header>

      <SortableList
        items={items.map((i) => i.id)}
        onReorder={(ids) => run(() => onReorder(ids))}
        renderItem={(id, handleProps) => {
          const item = items.find((i) => i.id === id)!;
          return (
            <div className="flex items-center gap-3 px-4 py-2">
              <span
                {...handleProps}
                className="cursor-grab text-muted active:cursor-grabbing"
                aria-label="Reordenar"
              >
                <GripVertical className="size-4" />
              </span>
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ background: item.color }}
              />
              <span className="min-w-0 flex-1 truncate text-sm">
                {item.emoji ? `${item.emoji} ` : ""}
                {item.name}
              </span>
              {item.badge ? (
                <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">
                  {item.badge}
                </span>
              ) : null}
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Editar ${item.name}`}
                onClick={() => setEditing(item)}
              >
                <Pencil className="size-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Borrar ${item.name}`}
                onClick={() => setDeleting(item)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          );
        }}
      />

      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted">
          Todavía no hay nada en esta lista.
        </p>
      ) : null}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={current ? `Editar ${current.name}` : `Nuevo en ${title.toLowerCase()}`}
      >
        <form
          action={(formData) =>
            run(() => onSave(formData), {
              success: "Guardado.",
              onSuccess: () => setEditing(null),
            })
          }
          className="flex flex-col gap-4"
        >
          {current ? <input type="hidden" name="id" value={current.id} /> : null}
          <div className="grid grid-cols-[1fr_5rem_5rem] gap-3">
            <Field label="Nombre">
              <Input name="name" defaultValue={current?.name ?? ""} required autoFocus />
            </Field>
            <Field label="Emoji">
              <Input name="emoji" defaultValue={current?.emoji ?? ""} maxLength={4} />
            </Field>
            <Field label="Color">
              <Input
                type="color"
                name="color"
                defaultValue={current?.color ?? "#94a3b8"}
                className="h-9 p-1"
              />
            </Field>
          </div>
          {extras.map((extra) =>
            extra.type === "checkbox" ? (
              <label key={extra.name} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name={extra.name}
                  defaultChecked={Boolean(extra.value(current))}
                  className="mt-0.5"
                />
                <span>
                  {extra.label}
                  {extra.hint ? (
                    <span className="block text-xs text-muted">{extra.hint}</span>
                  ) : null}
                </span>
              </label>
            ) : (
              <Field key={extra.name} label={extra.label} hint={extra.hint}>
                <Input
                  type="number"
                  name={extra.name}
                  defaultValue={String(extra.value(current) ?? "")}
                  min={1}
                />
              </Field>
            ),
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              Guardar
            </Button>
          </div>
        </form>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        title={`Borrar "${deleting?.name}"`}
        description="Esta acción no se puede deshacer."
        pending={pending}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          const item = deleting!;
          run(() => onDelete(item.id), {
            success: "Borrado.",
            onSuccess: () => setDeleting(null),
            onError: (result) => {
              setDeleting(null);
              setBlocked({ item, ...result });
              setMigrateTo("");
            },
          });
        }}
      />

      {/* Borrado bloqueado: se muestra el motivo y, si hay salida
          posible, se ofrece migrar los datos en el mismo paso. */}
      <Dialog
        open={blocked !== null}
        onClose={() => setBlocked(null)}
        title="No se puede borrar"
        width="sm"
      >
        <p className="text-sm">{blocked?.error}</p>
        {blocked?.hint ? (
          <p className="mt-1 text-sm text-muted">{blocked.hint}</p>
        ) : null}

        {migration && items.length > 1 ? (
          <div className="mt-4 flex flex-col gap-2">
            <Label>{migration.label}</Label>
            <Select
              value={migrateTo}
              onChange={(e) => setMigrateTo(e.target.value)}
            >
              <option value="">Elegí una opción…</option>
              {items
                .filter((i) => i.id !== blocked?.item.id)
                .map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.emoji ? `${i.emoji} ` : ""}
                    {i.name}
                  </option>
                ))}
            </Select>
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <Button onClick={() => setBlocked(null)}>Cerrar</Button>
          {migration && migrateTo ? (
            <Button
              variant="primary"
              disabled={pending}
              onClick={() => {
                const from = blocked!.item.id;
                const to = Number(migrateTo);
                run(() => migration.onMigrate(from, to), {
                  onSuccess: (data) => {
                    run(() => onDelete(from), {
                      success: `Movidas ${data.moved} tarea(s) y borrado.`,
                      onSuccess: () => setBlocked(null),
                    });
                  },
                });
              }}
            >
              Mover y borrar
            </Button>
          ) : null}
        </div>
      </Dialog>
    </section>
  );
}
