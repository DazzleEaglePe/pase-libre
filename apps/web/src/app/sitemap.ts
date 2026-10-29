import type { CategoriaResumen, RespuestaMapaDelSitio } from '@paselibre/contracts';
import type { MetadataRoute } from 'next';

import { cargarApiPublica } from '@/shared/api/servidor';
import { URL_SITIO } from '@/shared/sitio';

// Se arma cada vez que se pide: al construir la imagen no hay API a la que preguntarle.
export const dynamic = 'force-dynamic';

/**
 * `/sitemap.xml` (RNF-42): la portada, las categorías con productos, cada ficha que ve un
 * visitante y las páginas de información. Nada que pida sesión.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [mapa, categorias] = await Promise.all([
    cargarApiPublica<RespuestaMapaDelSitio>('/mapa-del-sitio'),
    cargarApiPublica<CategoriaResumen[]>('/categorias'),
  ]);

  return [
    { url: `${URL_SITIO}/`, changeFrequency: 'hourly', priority: 1 },
    ...categorias
      .filter((categoria) => categoria.productos > 0)
      .map((categoria) => ({
        url: `${URL_SITIO}/buscar?categoria=${encodeURIComponent(categoria.slug)}`,
        changeFrequency: 'daily' as const,
        priority: 0.6,
      })),
    ...mapa.productos.map((producto) => ({
      url: `${URL_SITIO}/p/${encodeURIComponent(producto.slug)}`,
      lastModified: producto.actualizado_en,
      changeFrequency: 'daily' as const,
      priority: 0.8,
    })),
    ...['/ayuda', '/terminos', '/privacidad'].map((ruta) => ({
      url: `${URL_SITIO}${ruta}`,
      changeFrequency: 'monthly' as const,
      priority: 0.2,
    })),
  ];
}
