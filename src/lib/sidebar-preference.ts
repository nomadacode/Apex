/** Preferencia de barra lateral comprimida.
 *
 *  Va en una cookie y no en `localStorage` por una razón concreta: el
 *  servidor puede leer una cookie y no puede leer `localStorage`. Guardándola
 *  acá, el HTML ya sale con la barra en su ancho final —comprimida o no— en
 *  lugar de salir siempre expandida y que el navegador la corrija después.
 *
 *  Eso elimina dos cosas: el aviso de hidratación (el servidor dibujaba una
 *  cosa y el cliente otra) y el parpadeo de la barra al cargar la página. */
export const SIDEBAR_COOKIE = "apex_sidebar_collapsed";

/** Un año de vigencia. `SameSite=Lax` porque solo la lee este mismo sitio y
 *  no hay motivo para mandarla en pedidos que vengan de afuera. */
export function recordarBarraComprimida(comprimida: boolean) {
  document.cookie = `${SIDEBAR_COOKIE}=${comprimida ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
}
