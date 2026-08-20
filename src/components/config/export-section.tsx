"use client";

import { Download, FileJson, FileSpreadsheet } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Salida de datos: el producto no encierra la información. Se exporta
 *  todo, con los valores derivados ya calculados. */
export function ExportSection({ counts }: { counts: { projects: number; tasks: number } }) {
  return (
    <section className="rounded-lg border border-border bg-surface">
      <header className="border-b border-border px-4 py-3">
        <h2 className="font-medium">Exportar</h2>
        <p className="text-sm text-muted">
          Bajate todo: {counts.projects} proyecto(s) y {counts.tasks} tarea(s),
          con días restantes y días laborables ya resueltos.
        </p>
      </header>

      <div className="flex flex-wrap gap-2 px-4 py-4">
        <a href="/api/exportar?formato=xlsx" download>
          <Button variant="primary">
            <FileSpreadsheet className="size-4" /> Descargar XLSX
          </Button>
        </a>
        <a href="/api/exportar?formato=json" download>
          <Button>
            <FileJson className="size-4" /> Descargar JSON
          </Button>
        </a>
      </div>

      <div className="border-t border-border px-4 py-3 text-xs text-muted">
        <p className="flex items-start gap-1.5">
          <Download className="mt-0.5 size-3.5 shrink-0" />
          <span>
            El XLSX trae una hoja por entidad (Tareas, Proyectos, Fases,
            Responsables, Estados, Etapas, Prioridades, Festivos y
            Dependencias). El JSON es el volcado crudo, útil para respaldos.
            La base entera vive en <code>data/apex.db</code>: copiar esa
            carpeta también es un respaldo válido.
          </span>
        </p>
      </div>
    </section>
  );
}
