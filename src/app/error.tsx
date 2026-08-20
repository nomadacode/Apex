"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Cualquier fallo no previsto termina acá, con salida: reintentar o
 *  volver al Dashboard. Nunca una pantalla en blanco. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <AlertTriangle className="size-10 text-danger" />
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Algo se rompió</h1>
        <p className="max-w-md text-sm text-muted">
          {error.message || "Ocurrió un error inesperado."}
        </p>
        {error.digest ? (
          <p className="font-mono text-xs text-muted">ref: {error.digest}</p>
        ) : null}
      </div>
      <div className="flex gap-2">
        <Button variant="primary" onClick={reset}>
          Reintentar
        </Button>
        <Link href="/">
          <Button>Ir al Dashboard</Button>
        </Link>
      </div>
      <p className="max-w-md text-xs text-muted">
        Los datos están a salvo en <code>data/apex.db</code>: un error de
        pantalla no toca la base.
      </p>
    </div>
  );
}
