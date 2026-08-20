"use client";

import { useCallback, useSyncExternalStore } from "react";

/** Preferencia booleana guardada en `localStorage`.
 *
 *  Se lee con `useSyncExternalStore` en lugar de un efecto: en el servidor
 *  devuelve el valor por defecto (sin salto de hidratación) y en el cliente
 *  toma el valor real ya en la primera pintura. */
export function useLocalFlag(
  key: string,
  fallback = false,
): [boolean, (next: boolean) => void] {
  const subscribe = useCallback(
    (onChange: () => void) => {
      // `storage` cubre otras pestañas; el evento propio, esta misma.
      const handler = () => onChange();
      window.addEventListener("storage", handler);
      window.addEventListener(EVENT, handler);
      return () => {
        window.removeEventListener("storage", handler);
        window.removeEventListener(EVENT, handler);
      };
    },
    [],
  );

  const value = useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(key) === "1",
    () => fallback,
  );

  const set = useCallback(
    (next: boolean) => {
      window.localStorage.setItem(key, next ? "1" : "0");
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );

  return [value, set];
}

const EVENT = "apex:local-flag";
