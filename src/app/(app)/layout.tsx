import { cookies } from "next/headers";

import { Shortcuts } from "@/components/nav/shortcuts";
import { InstallHint } from "@/components/pwa/install-hint";
import { Sidebar } from "@/components/nav/sidebar";
import { getSettings } from "@/lib/queries";
import { SIDEBAR_COOKIE } from "@/lib/sidebar-preference";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const settings = getSettings();
  // Leer la preferencia acá es lo que permite mandar la barra ya comprimida
  // en el HTML, sin que el navegador tenga que corregirla al hidratar.
  const barraComprimida =
    (await cookies()).get(SIDEBAR_COOKIE)?.value === "1";

  return (
    // En celular se apila (barra superior arriba, contenido abajo); en
    // escritorio, la navegación pasa a ser una columna a la izquierda.
    <div className="safe-area flex h-dvh flex-col overflow-hidden md:flex-row">
      <Sidebar
          workspaceName={settings.workspaceName}
          comprimida={barraComprimida}
        />
      <main className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</main>
      <Shortcuts />
      <InstallHint />
    </div>
  );
}
