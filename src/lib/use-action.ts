"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import type { ActionResult } from "@/actions/result";

/** Ejecuta una server action y traduce su resultado a la UI:
 *  - `ok` → refresca y (opcional) avisa
 *  - `error` → toast con el mensaje y la salida sugerida
 *
 *  Así ninguna acción falla en silencio, que es el modo de romper
 *  la confianza en un tablero. */
export function useAction() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function run<T>(
    action: () => Promise<ActionResult<T>>,
    options: {
      success?: string;
      onSuccess?: (data: T) => void;
      onError?: (result: { error: string; hint?: string }) => void;
    } = {},
  ) {
    startTransition(async () => {
      const result = await action();
      if (result.ok) {
        if (options.success) toast.success(options.success);
        options.onSuccess?.(result.data);
        router.refresh();
        return;
      }
      if (options.onError) options.onError(result);
      else toast.error(result.error, { description: result.hint });
    });
  }

  return { run, pending };
}
