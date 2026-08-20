"use client";

import { useCallback, useSyncExternalStore } from "react";

const EVENT = "apex:local-record";

/** Caché del último JSON leído por clave.
 *
 *  `useSyncExternalStore` exige que el snapshot devuelva la MISMA
 *  referencia mientras el valor no cambie; si se parseara el JSON en cada
 *  llamada, cada objeto nuevo dispararía otro render, y otro, sin fin. */
const cache = new Map<string, { raw: string | null; value: unknown }>();

/** Objeto de preferencias guardado en `localStorage`.
 *
 *  Se lee sin efectos: en el servidor devuelve los valores por defecto y
 *  en el cliente los guardados, ya en la primera pintura. */
export function useLocalRecord<T extends Record<string, number>>(
  key: string,
  fallback: T,
): [T, (next: T) => void] {
  const subscribe = useCallback((onChange: () => void) => {
    const handler = () => onChange();
    window.addEventListener("storage", handler);
    window.addEventListener(EVENT, handler);
    return () => {
      window.removeEventListener("storage", handler);
      window.removeEventListener(EVENT, handler);
    };
  }, []);

  const getSnapshot = useCallback((): T => {
    const raw = window.localStorage.getItem(key);
    const cached = cache.get(key);
    if (cached && cached.raw === raw) return cached.value as T;

    let value = fallback;
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<T>;
        // Se mezcla con los valores por defecto: si mañana aparece una
        // columna nueva, las preferencias viejas no la dejan sin ancho.
        value = { ...fallback, ...parsed };
      } catch {
        value = fallback;
      }
    }
    cache.set(key, { raw, value });
    return value;
  }, [key, fallback]);

  const value = useSyncExternalStore(subscribe, getSnapshot, () => fallback);

  const set = useCallback(
    (next: T) => {
      window.localStorage.setItem(key, JSON.stringify(next));
      window.dispatchEvent(new Event(EVENT));
    },
    [key],
  );

  return [value, set];
}
