"use client";

import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useDevice } from "@/lib/use-device";
import { useLocalFlag } from "@/lib/use-local-flag";

const DISMISSED_KEY = "apex:install-hint-dismissed";

type Install = {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

/**
 * Invitación a instalar la app en la pantalla de inicio.
 *
 * Solo aparece en el teléfono, cuando todavía no está instalada, y se
 * puede descartar para siempre. Hay dos caminos según el sistema:
 *
 * - Android ofrece un diálogo nativo, que se dispara con el botón.
 * - iOS no lo permite: hay que explicarle a la persona dónde tocar, así
 *   que ahí el aviso es una instrucción y no un botón.
 */
export function InstallHint() {
  const [dismissed, setDismissed] = useLocalFlag(DISMISSED_KEY);
  const [deferred, setDeferred] = useState<Install | null>(null);
  const device = useDevice();

  useEffect(() => {
    function onPrompt(event: Event) {
      // Se guarda el evento para disparar el diálogo cuando la persona
      // toque el botón, no apenas entra.
      event.preventDefault();
      setDeferred(event as unknown as Install);
    }

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (dismissed || device.installed || !device.phone) return null;
  // En Android sin evento de instalación disponible no hay nada que
  // ofrecer todavía; en iOS siempre se puede explicar el camino manual.
  if (!device.ios && !deferred) return null;

  return (
    // Los tres cuartos de rem de separación se cuentan desde el borde
    // seguro, no desde el del vidrio: pegado abajo, el aviso quedaba
    // debajo de la barra de gestos.
    <div className="fixed bottom-[calc(0.75rem+var(--safe-bottom))] left-[calc(0.75rem+var(--safe-left))] right-[calc(0.75rem+var(--safe-right))] z-40 flex items-start gap-3 rounded-lg border border-border bg-surface p-3 shadow-lg md:hidden">
      <Download className="mt-0.5 size-5 shrink-0 text-accent" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">Instalala en tu teléfono</p>
        {device.ios ? (
          <p className="mt-0.5 text-xs text-muted">
            Tocá <Share className="inline size-3" /> Compartir y después
            &quot;Agregar a inicio&quot;. Se abre a pantalla completa, sin la
            barra del navegador.
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-muted">
            Se abre a pantalla completa, con su propio ícono.
          </p>
        )}

        {deferred ? (
          <Button
            variant="primary"
            size="sm"
            className="mt-2"
            onClick={async () => {
              await deferred.prompt();
              const { outcome } = await deferred.userChoice;
              if (outcome === "accepted") setDismissed(true);
              setDeferred(null);
            }}
          >
            Instalar
          </Button>
        ) : null}
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="No mostrar más"
        className="shrink-0 cursor-pointer rounded p-1 text-muted hover:bg-surface-2 hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
