/**
 * Dirección pública del sitio, sin barra final. En el servidor la fija `WEB_URL` (compose la
 * toma de `PUBLIC_URL`); la usan la vista al compartir, el sitemap y el robots.txt.
 */
export const URL_SITIO = (process.env.WEB_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

/**
 * Solo producción se deja indexar: *staging* lleva datos de demostración y no debe aparecer
 * en Google (compose pasa `ENTORNO` a la web).
 */
export const SITIO_INDEXABLE = process.env.ENTORNO === 'produccion';
