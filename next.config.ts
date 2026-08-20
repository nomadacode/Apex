import type { NextConfig } from "next";

/**
 * En desarrollo, Next bloquea con 403 los pedidos a sus archivos internos
 * (`/_next/*`) que vengan de un origen distinto de `localhost`. Al abrir la
 * app desde el celular por la IP de la red, eso deja la página sin
 * JavaScript: se ve, pero ningún botón responde.
 *
 * Acá se habilitan los rangos de IP privados —los que reparte un router
 * doméstico— y los nombres `.local` de Bonjour. Es una lista solo de
 * desarrollo: no afecta al build de producción.
 */
const LOCAL_NETWORK_ORIGINS = [
  "192.168.*.*",
  "10.*.*.*",
  "172.16.*.*",
  "172.17.*.*",
  "172.18.*.*",
  "172.19.*.*",
  "172.2*.*.*",
  "172.30.*.*",
  "172.31.*.*",
  "*.local",
];

const nextConfig: NextConfig = {
  allowedDevOrigins: LOCAL_NETWORK_ORIGINS,

  /**
   * `standalone` deja en `.next/standalone` un servidor con solo las
   * dependencias que la app realmente usa: la imagen de Docker pasa de
   * arrastrar todo `node_modules` a unos pocos megas.
   *
   * Va detrás de una variable de entorno a propósito. Activado siempre,
   * `npm start` deja de servir la app —hay que arrancar el servidor
   * generado a mano— y eso rompería el flujo local sin avisar. Solo el
   * build de la imagen define `DOCKER_BUILD`.
   */
  output: process.env.DOCKER_BUILD ? "standalone" : undefined,

  /**
   * `better-sqlite3` es un módulo nativo: adentro trae un `.node`
   * compilado que el empaquetador no sabe leer. Sin declararlo acá,
   * el build intenta meterlo en el bundle y falla.
   */
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
