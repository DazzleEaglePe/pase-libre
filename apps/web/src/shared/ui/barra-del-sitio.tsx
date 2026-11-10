import type { CategoriaResumen, RespuestaBarra, RespuestaYo } from '@paselibre/contracts';

import { consultarApiCompartida } from '@/shared/api/servidor';

import { Cabecera } from './cabecera';

/**
 * La barra de arriba con sus datos: las categorías del menú y los numeritos de `/barra`, los
 * dos con caché de un minuto e iguales para todos. La usan los tres marcos de página.
 */
export async function BarraDelSitio({ sesion }: { sesion: RespuestaYo | null }) {
  const [{ cuerpo: categorias }, { cuerpo: barra }] = await Promise.all([
    // Si la API no responde, la barra sale sin categorías y la página muestra su propio error.
    consultarApiCompartida<CategoriaResumen[]>('/categorias'),
    consultarApiCompartida<RespuestaBarra>('/barra'),
  ]);
  return <Cabecera sesion={sesion} categorias={categorias ?? []} barra={barra} />;
}
