"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Keyboard } from "lucide-react";

import { Dialog } from "@/components/ui/dialog";

/** Atajos de teclado globales. Se listan con `?` para que existan de
 *  verdad y no sean folklore escondido. */
const ROUTES: [string, string, string][] = [
  ["d", "/", "Dashboard"],
  ["r", "/reportes", "Reportes"],
  ["t", "/tareas", "Trabajo · lista"],
  ["k", "/kanban", "Trabajo · tablero"],
  ["g", "/gantt", "Trabajo · cronograma"],
  ["c", "/calendario", "Trabajo · calendario"],
  ["s", "/calendario/semana", "Trabajo · semana"],
  ["m", "/matriz", "Trabajo · prioridades"],
  [",", "/configuracion", "Configuración"],
];

export function Shortcuts() {
  const router = useRouter();
  const [helpOpen, setHelpOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      // Nunca robarle el teclado a quien está escribiendo.
      const target = event.target as HTMLElement | null;
      if (
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        target?.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "")
      ) {
        return;
      }

      if (event.key === "?") {
        event.preventDefault();
        setHelpOpen(true);
        return;
      }

      const route = ROUTES.find(([key]) => key === event.key.toLowerCase());
      if (route) {
        event.preventDefault();
        router.push(route[1]);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [router]);

  return (
    <Dialog
      open={helpOpen}
      onClose={() => setHelpOpen(false)}
      title="Atajos de teclado"
      description="Funcionan cuando no estás escribiendo en un campo."
      width="sm"
    >
      <ul className="flex flex-col gap-1.5">
        {ROUTES.map(([key, , label]) => (
          <li key={key} className="flex items-center justify-between text-sm">
            <span>{label}</span>
            <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-xs">
              {key}
            </kbd>
          </li>
        ))}
        <li className="mt-1 flex items-center justify-between border-t border-border pt-2 text-sm">
          <span className="flex items-center gap-1.5">
            <Keyboard className="size-3.5" /> Ver esta ayuda
          </span>
          <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-xs">
            ?
          </kbd>
        </li>
        <li className="flex items-center justify-between text-sm">
          <span>Cerrar cualquier panel o diálogo</span>
          <kbd className="rounded border border-border bg-surface-2 px-1.5 py-0.5 font-mono text-xs">
            Esc
          </kbd>
        </li>
      </ul>
    </Dialog>
  );
}
