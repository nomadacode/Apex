"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

import { deleteHoliday, saveHoliday, saveSettings } from "@/actions/config";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/field";
import type { Holiday } from "@/db/schema";
import { formatDate } from "@/lib/dates";
import { WEEKDAY_NAMES, type WorkspaceSettings } from "@/lib/settings";
import { useAction } from "@/lib/use-action";

export function CalendarSection({
  settings,
  holidays,
}: {
  settings: WorkspaceSettings;
  holidays: Holiday[];
}) {
  const { run, pending } = useAction();
  const [adding, setAdding] = useState(false);

  const sorted = [...holidays].sort((a, b) => a.date.localeCompare(b.date));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="rounded-lg border border-border bg-surface">
        <header className="border-b border-border px-4 py-3">
          <h2 className="font-medium">Calendario laboral</h2>
          <p className="text-sm text-muted">
            Define qué días cuentan como trabajo. Cambiarlo recalcula al vuelo
            las duraciones en días laborables de todas las vistas.
          </p>
        </header>
        <form
          action={(formData) =>
            run(() => saveSettings(formData), { success: "Ajustes guardados." })
          }
          className="flex flex-col gap-4 px-4 py-4"
        >
          <Field label="Nombre del espacio de trabajo">
            <Input name="workspaceName" defaultValue={settings.workspaceName} />
          </Field>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-medium text-muted">
              Días laborables
            </span>
            <div className="flex flex-wrap gap-1.5">
              {WEEKDAY_NAMES.map((name, index) => (
                <label
                  key={name}
                  className="flex cursor-pointer items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-sm has-checked:border-accent has-checked:bg-accent/10"
                >
                  <input
                    type="checkbox"
                    name={`workday-${index}`}
                    defaultChecked={settings.workdays[index]}
                  />
                  {name.slice(0, 3)}
                </label>
              ))}
            </div>
          </div>

          <Field
            label="La semana empieza en"
            hint="Afecta al calendario semanal."
          >
            <Select name="weekStart" defaultValue={settings.weekStart}>
              <option value="monday">Lunes</option>
              <option value="sunday">Domingo</option>
            </Select>
          </Field>

          <div className="flex justify-end">
            <Button type="submit" variant="primary" disabled={pending}>
              Guardar ajustes
            </Button>
          </div>
        </form>
      </section>

      <section className="rounded-lg border border-border bg-surface">
        <header className="flex items-start justify-between gap-4 border-b border-border px-4 py-3">
          <div>
            <h2 className="font-medium">Festivos y días libres</h2>
            <p className="text-sm text-muted">
              Se descuentan del cálculo de días laborables y se marcan en Gantt
              y calendarios.
            </p>
          </div>
          <Button variant="primary" size="sm" onClick={() => setAdding(true)}>
            <Plus className="size-3.5" /> Agregar
          </Button>
        </header>

        {sorted.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-muted">
            No hay festivos cargados. Solo se descuentan los días no laborables
            de la semana.
          </p>
        ) : (
          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {sorted.map((holiday) => (
              <li
                key={holiday.id}
                className="flex items-center gap-3 px-4 py-2 text-sm"
              >
                <span className="w-28 shrink-0 text-muted">
                  {formatDate(holiday.date)}
                </span>
                <span className="min-w-0 flex-1 truncate">
                  {holiday.description || "Sin descripción"}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Borrar"
                  onClick={() =>
                    run(() => deleteHoliday(holiday.id), { success: "Borrado." })
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog
        open={adding}
        onClose={() => setAdding(false)}
        title="Nuevo festivo o día libre"
        width="sm"
      >
        <form
          action={(formData) =>
            run(() => saveHoliday(formData), {
              success: "Guardado.",
              onSuccess: () => setAdding(false),
            })
          }
          className="flex flex-col gap-4"
        >
          <Field label="Fecha">
            <Input type="date" name="date" required autoFocus />
          </Field>
          <Field label="Descripción">
            <Input name="description" placeholder="Feriado nacional, vacaciones…" />
          </Field>
          <div className="flex justify-end gap-2">
            <Button type="button" onClick={() => setAdding(false)}>
              Cancelar
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              Guardar
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
