import { ImageResponse } from "next/og";

/**
 * Íconos de la aplicación, dibujados con código en vez de archivos.
 *
 * Así el ícono vive junto al resto del producto: cambiar el color de la
 * marca es editar esta función, no reexportar seis PNG a mano.
 *
 * Tamaños que se usan: 192 y 512 para el manifest, 180 para iOS, 32 para
 * la pestaña del navegador.
 */
const ALLOWED = [32, 180, 192, 512] as const;

export function generateStaticParams() {
  return ALLOWED.map((size) => ({ size: String(size) }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ size: string }> },
) {
  const { size: raw } = await params;
  const size = Number(raw);
  if (!ALLOWED.includes(size as (typeof ALLOWED)[number])) {
    return new Response("Tamaño no disponible", { status: 404 });
  }

  // Todo se mide en fracciones del lienzo para que el dibujo sea el mismo
  // a 32 px que a 512.
  const unit = size / 32;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)",
          borderRadius: size * 0.22,
        }}
      >
        {/* Tres renglones con su marca de verificación: una lista de
            tareas, que es de lo que trata la app. */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: unit * 3,
          }}
        >
          {[1, 0.72, 0.44].map((width, index) => (
            <div
              key={index}
              style={{ display: "flex", alignItems: "center", gap: unit * 2.5 }}
            >
              <div
                style={{
                  width: unit * 4,
                  height: unit * 4,
                  borderRadius: unit * 1.2,
                  background: index === 0 ? "#ffffff" : "rgba(255,255,255,0.45)",
                }}
              />
              <div
                style={{
                  width: unit * 13 * width,
                  height: unit * 2.4,
                  borderRadius: unit * 1.2,
                  background:
                    index === 0 ? "#ffffff" : "rgba(255,255,255,0.45)",
                }}
              />
            </div>
          ))}
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
