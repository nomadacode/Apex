"use client";

import { useCallback, useSyncExternalStore } from "react";

export type Device = {
  /** Corre instalada, sin la barra del navegador. */
  installed: boolean;
  ios: boolean;
  phone: boolean;
};

const SERVER: Device = { installed: false, ios: false, phone: false };

/** Último snapshot, para devolver la misma referencia mientras nada
 *  cambie: `useSyncExternalStore` re-renderiza si la identidad cambia. */
let cached: Device = SERVER;

function read(): Device {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  const next: Device = {
    installed:
      window.matchMedia("(display-mode: standalone)").matches ||
      nav.standalone === true,
    ios: /iPad|iPhone|iPod/.test(navigator.userAgent),
    phone: window.matchMedia("(max-width: 768px)").matches,
  };

  if (
    next.installed !== cached.installed ||
    next.ios !== cached.ios ||
    next.phone !== cached.phone
  ) {
    cached = next;
  }
  return cached;
}

/** Cómo se está usando la app: en el teléfono, instalada, en iOS.
 *
 *  Se lee del navegador como sistema externo en lugar de con un efecto,
 *  así el primer render ya tiene el dato y no hay parpadeo. */
export function useDevice(): Device {
  const subscribe = useCallback((onChange: () => void) => {
    const queries = [
      window.matchMedia("(display-mode: standalone)"),
      window.matchMedia("(max-width: 768px)"),
    ];
    queries.forEach((q) => q.addEventListener("change", onChange));
    return () =>
      queries.forEach((q) => q.removeEventListener("change", onChange));
  }, []);

  return useSyncExternalStore(subscribe, read, () => SERVER);
}
