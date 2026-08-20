"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/** Los filtros viven en la URL: el enlace se puede compartir, el botón
 *  "atrás" funciona y una recarga no pierde el recorte de la vista. */
export function useFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const get = useCallback(
    (key: string) => searchParams.get(key) ?? "",
    [searchParams],
  );

  const getNumber = useCallback(
    (key: string): number | null => {
      const raw = searchParams.get(key);
      if (!raw) return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    },
    [searchParams],
  );

  const set = useCallback(
    (updates: Record<string, string | number | null | undefined>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === undefined || value === "") {
          next.delete(key);
        } else {
          next.set(key, String(value));
        }
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  const clear = useCallback(
    (keys: string[]) => {
      const next = new URLSearchParams(searchParams.toString());
      keys.forEach((key) => next.delete(key));
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  const activeCount = useMemo(
    () =>
      FILTER_KEYS.filter((key) => {
        const value = searchParams.get(key);
        return value !== null && value !== "";
      }).length,
    [searchParams],
  );

  return { get, getNumber, set, clear, activeCount, searchParams };
}

/** Las claves que cuentan como "filtro activo" en la barra. */
export const FILTER_KEYS = [
  "proyecto",
  "fase",
  "responsable",
  "estado",
  "prioridad",
  "etapa",
  "desde",
  "hasta",
  "q",
  "vista",
];
