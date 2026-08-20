# La "cajita" de Apex: todo lo que la app necesita para correr, sin
# depender de nada instalado en el servidor. El mismo archivo produce la
# misma imagen en tu Mac y en el VPS.
#
# Son tres etapas y solo la última viaja: las dos primeras existen para
# compilar y se descartan. Así el node_modules de desarrollo y las
# herramientas de compilación no terminan expuestos en producción.

# ---------------------------------------------------------------- deps --
# Debian y no Alpine a propósito: `better-sqlite3` publica binarios ya
# compilados para glibc (Debian) pero no para musl (Alpine). En Alpine
# habría que compilarlo a mano en cada build.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
# La imagen de node:22 trae npm 10, pero el package-lock.json de este repo
# lo escribio npm 11, que anota distinto las dependencias opcionales por
# plataforma (los `@esbuild/*`). npm 10 lee ese formato y cree que faltan,
# asi que `npm ci` aborta. Fijar la version acá es lo que hace que el build
# de la imagen y el de tu maquina partan del mismo lugar.
#
# Al actualizar npm en el equipo, actualizar tambien esta linea.
RUN npm install -g npm@11.12.1

# `better-sqlite3` es C++: no publica un binario listo para esta
# combinación de Node y plataforma, así que se compila en la instalación y
# necesita compilador y Python. Vive solo en esta etapa —la imagen final no
# lleva nada de esto, solo el `.node` ya compilado.
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*

# Solo los manifiestos: mientras no cambien, Docker reutiliza la capa de
# instalación en vez de bajar todo de nuevo en cada build.
COPY package.json package-lock.json ./
RUN npm ci

# --------------------------------------------------------------- build --
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Esta variable es la que activa `output: "standalone"` en next.config.ts.
ENV DOCKER_BUILD=1
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

# -------------------------------------------------------------- runner --
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# El servidor de Next escucha en localhost por defecto; adentro de un
# contenedor eso significa "solo yo me escucho a mí mismo" y Coolify nunca
# lograría enrutarle tráfico.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
# La base y los adjuntos viven acá, que es el único punto que se monta
# como volumen: es lo que sobrevive a cada nuevo despliegue.
ENV APEX_DB_PATH=/app/data/apex.db

# Correr como usuario sin privilegios: si alguien lograra ejecutar algo
# dentro del contenedor, no sería root.
RUN useradd --system --uid 1001 --create-home apex

COPY --from=build --chown=apex:apex /app/.next/standalone ./
COPY --from=build --chown=apex:apex /app/.next/static ./.next/static
COPY --from=build --chown=apex:apex /app/public ./public
# Las migraciones se leen en caliente al primer acceso (src/db/bootstrap.ts
# las busca en `process.cwd()/drizzle`), así que tienen que viajar.
COPY --from=build --chown=apex:apex /app/drizzle ./drizzle

RUN mkdir -p /app/data/uploads && chown -R apex:apex /app/data
VOLUME ["/app/data"]

USER apex
EXPOSE 3000

# Coolify usa esto para saber si el despliegue salió bien: hasta que la app
# no conteste, no manda tráfico ni da de baja la versión anterior.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
