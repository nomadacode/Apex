/**
 * Service worker de Apex.
 *
 * Regla de oro: **los datos nunca se sirven desde la caché**. Un
 * planificador que muestra tareas viejas como si fueran las de ahora es
 * peor que uno que avisa que no hay conexión. Por eso:
 *
 * - Navegación y datos → primero la red. Si no hay red, se muestra la
 *   pantalla de "sin conexión".
 * - Recursos estáticos (JS, CSS, fuentes, íconos) → primero la caché, que
 *   es lo que hace que la app abra al instante.
 */

const VERSION = "apex-v1";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/sin-conexion";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      await cache.addAll([OFFLINE_URL]);
      // La versión nueva toma el control sin esperar a que se cierren las
      // pestañas viejas.
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => !name.startsWith(VERSION))
          .map((name) => caches.delete(name)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  // Las mutaciones (server actions, subida de archivos) jamás se tocan.
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Recursos con hash en el nombre: inmutables, se sirven de la caché.
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/");

  if (isStatic) {
    event.respondWith(cacheFirst(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
  }
});

async function cacheFirst(request) {
  const cache = await caches.open(STATIC_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;

  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

async function networkFirstPage(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(STATIC_CACHE);
    const offline = await cache.match(OFFLINE_URL);
    return (
      offline ??
      new Response("Sin conexión", {
        status: 503,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
      })
    );
  }
}
