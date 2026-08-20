"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Modal sobre `<dialog>` nativo: cierra con Escape, con el botón y con
 *  clic afuera. Ningún modal queda sin salida. */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = "md",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: "sm" | "md" | "lg";
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  if (!open) return null;

  const maxWidth =
    width === "sm" ? "max-w-sm" : width === "lg" ? "max-w-3xl" : "max-w-lg";

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      // El ancho no se declara: `.modal-safe` fija los cuatro bordes contra
      // el rectángulo seguro, así que el modal se estira solo hasta donde
      // puede y `max-width` lo frena antes. Declarar un ancho acá volvía a
      // la caja sobredeterminada y el borde derecho se ignoraba.
      className={`modal-safe flex flex-col ${maxWidth} rounded-lg border border-border bg-surface p-0 text-foreground backdrop:bg-black/40`}
    >
      <div className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-sm text-muted">{description}</p>
          ) : null}
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} aria-label="Cerrar">
          <X className="size-4" />
        </Button>
      </div>
      {/* `min-h-0` es lo que permite que este bloque se achique dentro del
          flex y aparezca su propia barra: sin eso, el contenido largo
          empujaba el modal más allá del alto seguro. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {footer ? (
        <div className="flex shrink-0 justify-end gap-2 border-t border-border px-5 py-3">
          {footer}
        </div>
      ) : null}
    </dialog>
  );
}
