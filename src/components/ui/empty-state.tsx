import Link from "next/link";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";

/** Todo estado vacío dice *por qué* está vacío y ofrece la salida.
 *  Nunca una pantalla muda. */
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: ReactNode;
  action?: { label: string; href: string } | ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border px-6 py-14 text-center">
      {icon ? <div className="text-muted">{icon}</div> : null}
      <div className="space-y-1">
        <p className="font-medium">{title}</p>
        {description ? (
          <p className="mx-auto max-w-md text-sm text-muted">{description}</p>
        ) : null}
      </div>
      {action ? (
        isLinkAction(action) ? (
          <Link href={action.href}>
            <Button variant="primary">{action.label}</Button>
          </Link>
        ) : (
          action
        )
      ) : null}
    </div>
  );
}

function isLinkAction(
  action: { label: string; href: string } | ReactNode,
): action is { label: string; href: string } {
  return (
    typeof action === "object" &&
    action !== null &&
    "href" in action &&
    "label" in action
  );
}
