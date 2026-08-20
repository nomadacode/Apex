import { WifiOff } from "lucide-react";

export const metadata = { title: "Sin conexión · Apex" };

/** Pantalla que muestra el service worker cuando no hay red.
 *
 *  No intenta fingir que la app funciona: dice qué pasó y qué está a
 *  salvo, que es lo que uno quiere saber en ese momento. */
export default function SinConexion() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <WifiOff className="size-10 text-muted" />
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Sin conexión</h1>
        <p className="max-w-sm text-sm text-muted">
          No se pudo alcanzar el planificador. Revisá que la computadora
          donde corre siga encendida y en la misma red.
        </p>
      </div>
      <p className="max-w-sm text-xs text-muted">
        Tus datos están intactos: viven en la base de esa computadora, no en
        este dispositivo.
      </p>
    </div>
  );
}
