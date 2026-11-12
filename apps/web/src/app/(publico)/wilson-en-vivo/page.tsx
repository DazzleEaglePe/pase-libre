import type { RespuestaDirectorioTiendas, RespuestaWilson } from '@paselibre/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import {
  hrefDirectorio,
  leerConsultaDirectorio,
  parametrosDirectorio,
} from '@/features/wilson/consulta-directorio';
import { DirectorioTiendas } from '@/features/wilson/directorio-tiendas';
import { hrefPestanaTiendas, MarcoWilson, VistaGalerias } from '@/features/wilson/pagina-wilson';
import { cargarApi, obtenerSesion } from '@/shared/api/servidor';

export const metadata: Metadata = {
  title: 'Wilson en vivo',
  description: 'Qué hay publicado en cada galería de la avenida Wilson y qué tan lejos está.',
};

/**
 * `/wilson-en-vivo` (CAT_Web3, N08, N13): las galerías de la avenida y lo de cada una; con
 * `?pestana=tiendas`, el directorio de tiendas (solo con sesión: sin ella, a iniciar sesión).
 * `?vista=tiendas` era «Tiendas por piso»: ahora abre el directorio en esa galería.
 */
export default async function WilsonEnVivo({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [parametros, sesion] = await Promise.all([searchParams, obtenerSesion()]);
  const conSesion = Boolean(sesion);

  if (parametros.pestana === 'tiendas' || parametros.vista === 'tiendas') {
    const consulta = leerConsultaDirectorio(parametros);
    if (!sesion) redirect(hrefPestanaTiendas(false, hrefDirectorio(consulta)));
    const datos = await cargarApi<RespuestaDirectorioTiendas>(
      `/wilson/tiendas?${parametrosDirectorio(consulta).toString()}`,
    );
    return (
      <MarcoWilson pestana="tiendas" conSesion>
        <DirectorioTiendas
          key={parametrosDirectorio(consulta).toString()}
          inicial={datos}
          consulta={consulta}
        />
      </MarcoWilson>
    );
  }

  const consulta = new URLSearchParams();
  for (const clave of ['galeria', 'categoria'] as const) {
    const valor = parametros[clave];
    if (typeof valor === 'string' && valor) consulta.set(clave, valor);
  }
  const datos = await cargarApi<RespuestaWilson>(
    `/wilson${consulta.size > 0 ? `?${consulta.toString()}` : ''}`,
  );
  return (
    <MarcoWilson pestana="galerias" conSesion={conSesion}>
      <VistaGalerias datos={datos} />
    </MarcoWilson>
  );
}
