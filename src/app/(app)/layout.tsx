import { Shortcuts } from "@/components/nav/shortcuts";
import { InstallHint } from "@/components/pwa/install-hint";
import { Sidebar } from "@/components/nav/sidebar";
import { getSettings } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default function AppLayout({ children }: LayoutProps<"/">) {
  const settings = getSettings();

  return (
    // En celular se apila (barra superior arriba, contenido abajo); en
    // escritorio, la navegación pasa a ser una columna a la izquierda.
    <div className="safe-area flex h-dvh flex-col overflow-hidden md:flex-row">
      <Sidebar workspaceName={settings.workspaceName} />
      <main className="min-h-0 min-w-0 flex-1 overflow-hidden">{children}</main>
      <Shortcuts />
      <InstallHint />
    </div>
  );
}
