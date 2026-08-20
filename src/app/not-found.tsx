import Link from "next/link";
import { Compass } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <Compass className="size-10 text-muted" />
      <div className="space-y-1">
        <h1 className="text-lg font-semibold">Esta pantalla no existe</h1>
        <p className="text-sm text-muted">
          La dirección que buscabas no corresponde a ninguna vista del
          planificador.
        </p>
      </div>
      <Link href="/">
        <Button variant="primary">Ir al Dashboard</Button>
      </Link>
    </div>
  );
}
