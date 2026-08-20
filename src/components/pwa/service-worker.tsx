"use client";

import { useEffect } from "react";

/**
 * Registra el service worker.
 *
 * El navegador solo lo permite en un "contexto seguro": `localhost` o
 * HTTPS. Abriendo la app desde el celular por IP (`http://192.168…`) no
 * lo es, así que ahí el registro no ocurre y la app funciona igual, solo
 * que sin caché ni pantalla de sin conexión. No es un error: es la regla
 * del navegador, y por eso se sale en silencio en lugar de avisar.
 */
export function ServiceWorker() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !window.isSecureContext) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // Un fallo acá no debe romper la app: solo se pierde el modo
        // sin conexión.
      });
    };

    // Se espera a que la página termine de cargar para no competir por
    // ancho de banda con lo que el usuario está esperando ver.
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });

    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}
