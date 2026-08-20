"use client";

import { useState } from "react";
import { GripVertical, Pencil, Plus, Trash2 } from "lucide-react";

import { deletePerson, reassignTasks, reorder, savePerson } from "@/actions/config";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Label, Select } from "@/components/ui/field";
import { SortableList } from "@/components/ui/sortable-list";
import type { Person } from "@/db/schema";
import { useAction } from "@/lib/use-action";

export function PeopleSection({ people }: { people: Person[] }) {
  const { run, pending } = useAction();
  const [editing, setEditing] = useState<Person | null | "new">(null);
  const [deleting, setDeleting] = useState<Person | null>(null);
  const [blocked, setBlocked] = useState<{
    person: Person;
    error: string;
    hint?: string;
  } | null>(null);
  const [reassignTo, setReassignTo] = useState<string>("");

  const current = editing === "new" ? null : editing;

  return (
    <section className="rounded-lg border border-border bg-surface">
      <header className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-medium">Responsables</h2>
          <p className="text-sm text-muted">
            Quién trabaja y de qué se encarga. Aparecen en todas las listas de
            asignación.
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setEditing("new")}>
          <Plus className="size-3.5" /> Agregar
        </Button>
      </header>

      {people.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-muted">
          Todavía no hay nadie cargado. Podés asignar tareas igual, pero sin
          responsable.
        </p>
      ) : (
        <SortableList
          items={people.map((p) => p.id)}
          onReorder={(ids) => run(() => reorder("people", ids))}
          renderItem={(id, handleProps) => {
            const person = people.find((p) => p.id === id)!;
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
                  className="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white"
                  style={{ background: person.color }}
                >
                  {initials(person.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="text-sm">{person.name}</span>
                  {person.role ? (
                    <span className="ml-2 text-xs text-muted">{person.role}</span>
                  ) : null}
                </div>
                {!person.active ? (
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 text-[11px] text-muted">
                    inactivo
                  </span>
                ) : null}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Editar"
                  onClick={() => setEditing(person)}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Borrar"
                  onClick={() => setDeleting(person)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>
            );
          }}
        />
      )}

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={current ? `Editar ${current.name}` : "Nueva persona"}
      >
        <form
          action={(formData) =>
            run(() => savePerson(formData), {
              success: "Guardado.",
              onSuccess: () => setEditing(null),
            })
          }
          className="flex flex-col gap-4"
        >
          {current ? <input type="hidden" name="id" value={current.id} /> : null}
          <div className="grid grid-cols-[1fr_5rem] gap-3">
            <Field label="Nombre">
              <Input name="name" defaultValue={current?.name ?? ""} required autoFocus />
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
          <Field label="Rol / área" hint="Se muestra junto a la tarea asignada.">
            <Input name="role" defaultValue={current?.role ?? ""} />
          </Field>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="active"
              defaultChecked={current?.active ?? true}
              className="mt-0.5"
            />
            <span>
              Activo
              <span className="block text-xs text-muted">
                Las personas inactivas no aparecen para asignar tareas nuevas,
                pero conservan las que ya tenían.
              </span>
            </span>
          </label>
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
        title={`Borrar a ${deleting?.name}`}
        description="Esta acción no se puede deshacer."
        pending={pending}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          const person = deleting!;
          run(() => deletePerson(person.id), {
            success: "Borrado.",
            onSuccess: () => setDeleting(null),
            onError: (result) => {
              setDeleting(null);
              setBlocked({ person, ...result });
              setReassignTo("");
            },
          });
        }}
      />

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

        <div className="mt-4 flex flex-col gap-2">
          <Label>Reasignar sus tareas a</Label>
          <Select value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
            <option value="">Elegí una opción…</option>
            <option value="none">Sin responsable</option>
            {people
              .filter((p) => p.id !== blocked?.person.id)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </Select>
        </div>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button onClick={() => setBlocked(null)}>Cerrar</Button>
          <Button
            disabled={pending}
            onClick={() => {
              const person = blocked!.person;
              const form = new FormData();
              form.set("id", String(person.id));
              form.set("name", person.name);
              form.set("role", person.role);
              form.set("color", person.color);
              run(() => savePerson(form), {
                success: `${person.name} quedó inactivo.`,
                onSuccess: () => setBlocked(null),
              });
            }}
          >
            Desactivar en lugar de borrar
          </Button>
          {reassignTo ? (
            <Button
              variant="primary"
              disabled={pending}
              onClick={() => {
                const from = blocked!.person.id;
                const to = reassignTo === "none" ? null : Number(reassignTo);
                run(() => reassignTasks(from, to), {
                  onSuccess: (data) =>
                    run(() => deletePerson(from), {
                      success: `Reasignadas ${data.moved} tarea(s) y borrado.`,
                      onSuccess: () => setBlocked(null),
                    }),
                });
              }}
            >
              Reasignar y borrar
            </Button>
          ) : null}
        </div>
      </Dialog>
    </section>
  );
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
