import type { MetadataRoute } from 'next';

import { SITIO_INDEXABLE, URL_SITIO } from '@/shared/sitio';

// El entorno se lee al pedirlo, no al construir la imagen: la misma imagen sirve para los dos.
export const dynamic = 'force-dynamic';

/**
 * `/robots.txt`: en producción, el catálogo público se indexa y lo que pide sesión no
 * (RNF-42). En *staging* y en local no se indexa nada.
 */
export default function robots(): MetadataRoute.Robots {
  if (!SITIO_INDEXABLE) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/v1/',
        '/ingresar',
        '/publicar',
        '/mis-publicaciones',
        '/mensajes',
        '/cuenta',
        '/equipo',
        '/salud',
      ],
    },
    sitemap: `${URL_SITIO}/sitemap.xml`,
  };
}
