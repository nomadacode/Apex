"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";

import { cn } from "@/lib/cn";

const subscribeNoop = () => () => {};

const OPTIONS = [
  { value: "light", label: "Claro", icon: Sun },
  { value: "dark", label: "Oscuro", icon: Moon },
  { value: "system", label: "Sistema", icon: Monitor },
] as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  // El tema real solo se conoce en el cliente: en el servidor no hay
  // localStorage. Sin esto, la primera pintura marcaría la opción
  // equivocada y React se quejaría de la hidratación.
  const mounted = useSyncExternalStore(
    subscribeNoop,
    () => true,
    () => false,
  );

  return (
    <div className="flex rounded-md border border-border p-0.5">
      {OPTIONS.map((option) => {
        const Icon = option.icon;
        const active = mounted && theme === option.value;
        return (
          <button
            key={option.value}
            onClick={() => setTheme(option.value)}
            aria-label={`Tema ${option.label.toLowerCase()}`}
            title={option.label}
            className={cn(
              "cursor-pointer rounded px-2 py-1 transition-colors",
              active ? "bg-surface-2 text-foreground" : "text-muted hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
          </button>
        );
      })}
    </div>
  );
}
