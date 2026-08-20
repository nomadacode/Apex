"use server";

import fs from "node:fs/promises";
import path from "node:path";

import { eq } from "drizzle-orm";

import { ensureDb } from "@/db/bootstrap";
import { attachments } from "@/db/schema";
import { fail, guard, ok, refreshUI, type ActionResult } from "@/actions/result";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");
const MAX_BYTES = 25 * 1024 * 1024;

/** Los archivos se guardan en `data/uploads/` junto a la base: todo el
 *  producto vive en una carpeta, sin servicios externos. */
export async function uploadAttachment(
  formData: FormData,
): Promise<ActionResult<{ id: number }>> {
  return guard(async () => {
    const taskId = Number(formData.get("taskId"));
    const file = formData.get("file");

    if (!Number.isFinite(taskId)) return fail("Falta la tarea.");
    if (!(file instanceof File) || file.size === 0) {
      return fail("Elegí un archivo.");
    }
    if (file.size > MAX_BYTES) {
      return fail(
        `El archivo pesa ${(file.size / 1024 / 1024).toFixed(1)} MB.`,
        "El límite es 25 MB por archivo.",
      );
    }

    await fs.mkdir(UPLOAD_DIR, { recursive: true });

    // Nombre en disco único e inofensivo; el original se guarda aparte.
    const safeName = `${taskId}-${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(path.join(UPLOAD_DIR, safeName), buffer);

    const row = ensureDb()
      .insert(attachments)
      .values({
        taskId,
        name: file.name,
        path: safeName,
        mime: file.type,
        size: file.size,
      })
      .returning({ id: attachments.id })
      .get();

    refreshUI();
    return ok({ id: row.id });
  });
}

export async function deleteAttachment(id: number): Promise<ActionResult> {
  return guard(async () => {
    const db = ensureDb();
    const row = db.select().from(attachments).where(eq(attachments.id, id)).get();
    if (!row) return ok();

    // Si el archivo ya no está en disco igual se limpia el registro:
    // dejar una fila huérfana sería peor.
    await fs.rm(path.join(UPLOAD_DIR, row.path), { force: true });
    db.delete(attachments).where(eq(attachments.id, id)).run();
    refreshUI();
    return ok();
  });
}
