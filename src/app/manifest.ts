import type { MetadataRoute } from "next";

import { getSettings } from "@/lib/queries";

export const dynamic = "force-dynamic";

/**
 * Manifiesto de la aplicación instalable.
 *
 * Toma el nombre del espacio de trabajo que se configuró, así el ícono en
 * la pantalla de inicio dice lo mismo que la app por dentro.
 */
export default function manifest(): MetadataRoute.Manifest {
  const { workspaceName } = getSettings();

  return {
    name: `${workspaceName} · Planificador de proyectos`,
    short_name: workspaceName,
    description:
      "Planificá proyectos: tareas, tablero, cronograma, calendarios y reportes.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#0d0f13",
    theme_color: "#4f46e5",
    lang: "es",
    dir: "ltr",
    categories: ["productivity", "business"],
    icons: [
      { src: "/icons/192", sizes: "192x192", type: "image/png", purpose: "any" },
      {
        src: "/icons/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    // Accesos rápidos al mantener presionado el ícono.
    shortcuts: [
      {
        name: "Tareas",
        url: "/tareas",
        description: "La lista de trabajo",
      },
      {
        name: "Tablero",
        url: "/kanban",
        description: "El Kanban",
      },
      {
        name: "Reportes",
        url: "/reportes",
        description: "Demoras y cumplimiento",
      },
    ],
  };
}
