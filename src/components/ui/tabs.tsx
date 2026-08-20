"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** Pestañas cuyo estado vive en la URL: se puede compartir el enlace y
 *  el botón "atrás" del navegador funciona como se espera. */
export function Tabs({
  param = "tab",
  tabs,
  children,
}: {
  param?: string;
  tabs: { id: string; label: string }[];
  children: (active: string) => ReactNode;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requested = searchParams.get(param);
  const active = tabs.some((t) => t.id === requested)
    ? requested!
    : (tabs[0]?.id ?? "");

  function select(id: string) {
    const next = new URLSearchParams(searchParams.toString());
    next.set(param, id);
    router.replace(`?${next.toString()}`, { scroll: false });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {/* La línea inferior vive en el contenedor de afuera, que no
          desplaza: así el borde del botón activo la tapa sin que su
          margen negativo genere un scroll vertical. */}
      <div className="border-b border-border">
        <div role="tablist" className="tab-strip -mb-px flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={tab.id === active}
              onClick={() => select(tab.id)}
              className={cn(
                "shrink-0 cursor-pointer border-b-2 px-3 py-2 text-sm transition-colors",
                tab.id === active
                  ? "border-accent font-medium text-foreground"
                  : "border-transparent text-muted hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1">{children(active)}</div>
    </div>
  );
}
