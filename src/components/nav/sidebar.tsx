"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  LayoutDashboard,
  ListTodo,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  X,
} from "lucide-react";

import { cn } from "@/lib/cn";
import { useLocalFlag } from "@/lib/use-local-flag";

/** El menú tiene una entrada por sección, no por vista.
 *
 *  Lista, tablero, cronograma, calendarios y prioridades son seis formas
 *  de mirar el mismo trabajo, así que viven como pestañas dentro de una
 *  sola pantalla en lugar de seis destinos sueltos. */
const GROUPS = [
  {
    label: "Visión general",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/reportes", label: "Reportes", icon: BarChart3 },
    ],
  },
  {
    label: "Gestión de trabajo",
    items: [{ href: "/tareas", label: "Trabajo", icon: ListTodo }],
  },
  {
    label: "Configuración y control",
    items: [{ href: "/configuracion", label: "Configuración", icon: Settings }],
  },
];

/** Rutas que son vistas de Trabajo: con cualquiera de ellas abierta, esa
 *  entrada del menú queda marcada. */
const WORK_ROUTES = [
  "/tareas",
  "/kanban",
  "/gantt",
  "/calendario",
  "/calendario/semana",
  "/matriz",
];

const STORAGE_KEY = "apex:sidebar-collapsed";

/**
 * Navegación. Tiene dos formas según el ancho:
 *
 * - En celular es un cajón que se abre sobre el contenido. Una barra fija
 *   se comería la mitad de la pantalla, así que ahí no existe.
 * - En escritorio es una columna fija que además se puede comprimir a
 *   solo íconos.
 */
export function Sidebar({ workspaceName }: { workspaceName: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useLocalFlag(STORAGE_KEY);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Con el cajón abierto no se scrollea lo de atrás.
  useEffect(() => {
    if (!drawerOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [drawerOpen]);

  return (
    <>
      {/* Barra superior, solo en celular. */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border bg-surface px-3 md:hidden">
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Abrir el menú"
          aria-expanded={drawerOpen}
          className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-md text-foreground transition-colors hover:bg-surface-2"
        >
          <Menu className="size-5" />
        </button>
        <Link href="/" className="min-w-0">
          <span className="block truncate font-semibold tracking-tight">
            {workspaceName}
          </span>
        </Link>
      </header>

      {drawerOpen ? (
        <button
          aria-label="Cerrar el menú"
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
        />
      ) : null}

      <nav
        className={cn(
          "flex shrink-0 flex-col gap-5 border-r border-border bg-surface py-4",
          // Celular: cajón deslizante por encima del contenido. Como es
          // `fixed`, el resguardo del contenedor no lo alcanza: se le suma
          // acá al relleno propio en vez de reemplazarlo, para que el
          // primer y el último ítem del menú queden tocables.
          "fixed inset-y-0 left-0 z-50 w-64 px-3 transition-transform duration-200 md:static md:z-auto md:translate-x-0 md:transition-[width]",
          "max-md:pt-[calc(1rem+var(--safe-top))] max-md:pb-[calc(1rem+var(--safe-bottom))] max-md:pl-[calc(0.75rem+var(--safe-left))]",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
          // Escritorio: columna fija, comprimible.
          collapsed ? "md:w-14 md:px-2" : "md:w-60 md:px-3",
        )}
        aria-label="Navegación principal"
      >
        <div
          className={cn(
            "flex items-center gap-2",
            collapsed ? "md:flex-col" : "justify-between",
          )}
        >
          <Link
            href="/"
            className={cn("min-w-0 px-2", collapsed && "md:sr-only")}
            title={workspaceName}
          >
            <span className="block truncate text-lg font-semibold tracking-tight">
              {workspaceName}
            </span>
            <span className="block text-xs text-muted">
              Planificador de proyectos
            </span>
          </Link>

          {/* Cerrar, en celular; comprimir, en escritorio. */}
          <button
            onClick={() => setDrawerOpen(false)}
            aria-label="Cerrar el menú"
            className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-foreground md:hidden"
          >
            <X className="size-5" />
          </button>
          <button
            onClick={() => setCollapsed(!collapsed)}
            aria-label={collapsed ? "Expandir la barra" : "Comprimir la barra"}
            aria-expanded={!collapsed}
            title={collapsed ? "Expandir la barra" : "Comprimir la barra"}
            className="hidden size-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-foreground md:flex"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <PanelLeftClose className="size-4" />
            )}
          </button>
        </div>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto">
          {GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col gap-1">
              <span
                className={cn(
                  "px-2 text-[11px] font-medium uppercase tracking-wider text-muted",
                  collapsed && "md:hidden",
                )}
              >
                {group.label}
              </span>
              {/* Comprimida, el título sería ilegible: lo reemplaza un
                  separador y el nombre queda en el tooltip del ícono. */}
              {collapsed ? (
                <span
                  className="mx-auto my-1 hidden h-px w-6 bg-border md:block"
                  role="separator"
                  aria-label={group.label}
                />
              ) : null}

              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    // Al elegir un destino el cajón se cierra: en celular
                    // la pantalla nueva tiene que quedar a la vista sin un
                    // paso extra.
                    onClick={() => setDrawerOpen(false)}
                    title={collapsed ? item.label : undefined}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      // Alto cómodo para el dedo en celular.
                      "flex items-center gap-2.5 rounded-md px-2 py-2.5 text-sm transition-colors md:py-1.5",
                      collapsed && "md:justify-center md:px-0",
                      active
                        ? "bg-accent text-accent-fg"
                        : "text-foreground/80 hover:bg-surface-2",
                    )}
                  >
                    <Icon className="size-4 shrink-0" />
                    <span className={cn("truncate", collapsed && "md:sr-only")}>
                      {item.label}
                    </span>
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </nav>
    </>
  );
}

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/tareas") return WORK_ROUTES.includes(pathname);
  return pathname === href || pathname.startsWith(`${href}/`);
}
