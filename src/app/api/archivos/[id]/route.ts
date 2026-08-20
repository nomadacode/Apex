import fs from "node:fs/promises";
import path from "node:path";

import { eq } from "drizzle-orm";

import { ensureDb } from "@/db/bootstrap";
import { attachments } from "@/db/schema";

const UPLOAD_DIR = path.join(process.cwd(), "data", "uploads");

/** Sirve un adjunto desde `data/uploads/`. La ruta en disco sale de la
 *  base, nunca del pedido, así no hay forma de pedir un archivo de
 *  afuera de esa carpeta. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const row = ensureDb()
    .select()
    .from(attachments)
    .where(eq(attachments.id, Number(id)))
    .get();

  if (!row) return new Response("No encontrado", { status: 404 });

  try {
    const file = await fs.readFile(path.join(UPLOAD_DIR, row.path));
    return new Response(new Uint8Array(file), {
      headers: {
        "Content-Type": row.mime || "application/octet-stream",
        "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(row.name)}`,
        "Content-Length": String(file.byteLength),
      },
    });
  } catch {
    return new Response("El archivo ya no está en disco", { status: 410 });
  }
}
