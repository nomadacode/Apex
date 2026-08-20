import { revalidatePath } from "next/cache";

/** Contrato único de retorno de las server actions.
 *
 *  Nada de excepciones para reglas de negocio: los bloqueos de la
 *  casuística (borrar un estado en uso, cerrar un ciclo de dependencias)
 *  son respuestas esperadas, y la UI las muestra como aviso accionable.
 */

export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; /** Sugerencia de salida para la UI. */ hint?: string };

export function ok(): ActionResult<undefined>;
export function ok<T>(data: T): ActionResult<T>;
export function ok<T>(data?: T): ActionResult<T | undefined> {
  return { ok: true, data };
}

export function fail(error: string, hint?: string): ActionResult<never> {
  return { ok: false, error, hint };
}

/** Refresca la UI después de una mutación.
 *
 *  Va aislado a propósito: la revalidación es un efecto de presentación y
 *  ocurre *después* de que el dato ya se guardó. Si fallara (por ejemplo
 *  al invocar la acción fuera de un request, como hacen los scripts de
 *  verificación), reportar la mutación como fallida sería mentir. */
export function refreshUI() {
  try {
    revalidatePath("/", "layout");
  } catch {
    // Sin contexto de request no hay nada que revalidar.
  }
}

/** Envuelve una acción para que un error inesperado llegue a la UI como
 *  mensaje en vez de romper la pantalla entera. */
export async function guard<T>(
  fn: () => Promise<ActionResult<T>> | ActionResult<T>,
): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error inesperado.";
    return fail(message);
  }
}
