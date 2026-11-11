import type { RespuestaOpcionesRegistro, RespuestaTiendaCompartida } from '@paselibre/contracts';
import { IconCheck, IconLock } from '@tabler/icons-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { FormularioAcceso } from '@/features/acceso/formulario-acceso';
import { FrasesQueCambian } from '@/features/acceso/frases';
import { consultarApi, obtenerSesion } from '@/shared/api/servidor';
import { Marca } from '@/shared/ui/marca';

export const metadata: Metadata = {
  title: 'Inicia sesión',
  robots: { index: false },
};

/** Solo direcciones de este sitio («/tiendas/…»): nunca otro dominio ni «//algo». */
function volverSeguro(volver: string | undefined): string | null {
  if (!volver || !volver.startsWith('/') || volver.startsWith('//') || volver.includes('\\')) {
    return null;
  }
  return volver.slice(0, 300);
}

const PROTEGIDOS = [
  'Solo entran tiendas verificadas de Wilson',
  'Sin cuenta nadie ve tus precios ni tu tienda',
  'El trato es entre vendedores: sin comisiones',
];

/**
 * `/ingresar` (COR3 del lienzo final): paselibre.shop abre aquí si no hay sesión. Pantalla
 * enfocada, sin la barra del sitio. En la computadora, partida: a la izquierda el verde de la
 * marca con la frase, lo que protege tu cuenta y frases que van cambiando; a la derecha el
 * formulario. En el celular, el bloque verde arriba y el formulario debajo. Si llegaste por el
 * enlace de una tienda (`?volver=/tiendas/…`), te dice cuál te compartieron y te lleva ahí.
 */
export default async function PaginaIngresar({
  searchParams,
}: {
  searchParams: Promise<{ pestana?: string; volver?: string }>;
}) {
  const { pestana, volver: volverPedido } = await searchParams;
  const volver = volverSeguro(volverPedido);
  const sesion = await obtenerSesion();
  // Con sesión y clave propia no hay nada que hacer aquí.
  if (sesion && !sesion.usuario.debe_cambiar_clave) {
    redirect(volver ?? (sesion.usuario.rol === 'EQUIPO' ? '/equipo' : '/'));
  }
  const idTienda = volver?.match(/^\/tiendas\/([0-9a-f-]{36})$/i)?.[1];
  const [{ cuerpo: registro }, compartida] = await Promise.all([
    consultarApi<RespuestaOpcionesRegistro>('/registro/opciones'),
    idTienda
      ? consultarApi<RespuestaTiendaCompartida>(`/tiendas/${idTienda}/compartida`)
      : Promise.resolve(null),
  ]);

  return (
    <div className="flex min-h-dvh flex-col bg-white md:grid md:grid-cols-[minmax(0,749fr)_minmax(0,691fr)]">
      <aside className="flex flex-col justify-between gap-10 bg-marca px-14 py-11 text-white max-md:hidden">
        <Marca sobreMarca />
        <div className="flex max-w-[520px] flex-col gap-5">
          <p className="tit m-0 text-[42px] leading-[44px]">
            Lo que te falta, otra tienda de la galería lo tiene.
          </p>
          <p className="m-0 text-[18px] leading-7 text-white/90">
            Con tu cuenta ves los precios de pase, la tienda y el stand, y escribes directo por chat
            o WhatsApp.
          </p>
          <div className="flex flex-col gap-2.5 rounded-2xl border border-white/20 bg-white/10 px-5 py-4">
            <b className="flex items-center gap-2 text-[16px]">
              <IconLock size={18} stroke={1.8} aria-hidden="true" />
              Tus precios de pase están protegidos
            </b>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {PROTEGIDOS.map((texto) => (
                <li key={texto} className="flex items-center gap-2.5 text-[15px]">
                  <IconCheck size={16} stroke={2.2} aria-hidden="true" className="text-acento" />
                  {texto}
                </li>
              ))}
            </ul>
          </div>
        </div>
        <FrasesQueCambian />
      </aside>
      <main className="flex flex-1 justify-center px-5 pb-12 pt-8 md:items-center md:px-10 md:py-12">
        <div className="w-full max-w-[380px]">
          <FormularioAcceso
            primerIngreso={sesion?.usuario.debe_cambiar_clave ? sesion.usuario.usuario : null}
            pestanaInicial={pestana === 'crear' ? 'crear' : 'ingresar'}
            registroActivo={registro?.activo === true}
            volver={volver}
            compartida={compartida?.estado === 200 ? (compartida.cuerpo?.nombre ?? null) : null}
          />
        </div>
      </main>
    </div>
  );
}
