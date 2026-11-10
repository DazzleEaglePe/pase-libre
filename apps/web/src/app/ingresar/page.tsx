import type { RespuestaOpcionesRegistro } from '@paselibre/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { FormularioAcceso } from '@/features/acceso/formulario-acceso';
import { consultarApi, obtenerSesion } from '@/shared/api/servidor';
import { Marca } from '@/shared/ui/marca';

export const metadata: Metadata = {
  title: 'Inicia sesión',
  robots: { index: false },
};

/**
 * `/ingresar` (D_Acceso, M_Acceso): pantalla enfocada, sin la barra del sitio. En la
 * computadora, partida: a la izquierda el verde de la marca con la frase; a la derecha el
 * formulario. En el celular, el bloque verde arriba y el formulario debajo.
 */
export default async function PaginaIngresar({
  searchParams,
}: {
  searchParams: Promise<{ pestana?: string }>;
}) {
  const sesion = await obtenerSesion();
  // Con sesión y clave propia no hay nada que hacer aquí.
  if (sesion && !sesion.usuario.debe_cambiar_clave) {
    redirect(sesion.usuario.rol === 'EQUIPO' ? '/equipo' : '/');
  }
  const { pestana } = await searchParams;
  const { cuerpo: registro } = await consultarApi<RespuestaOpcionesRegistro>('/registro/opciones');

  return (
    <div className="flex min-h-dvh flex-col md:grid md:grid-cols-[minmax(0,744fr)_minmax(0,696fr)]">
      <aside className="flex flex-col justify-between gap-10 bg-marca px-14 py-12 text-white max-md:hidden">
        <Marca sobreMarca />
        <div className="flex max-w-[500px] flex-col gap-5">
          <p className="text-[44px] font-bold leading-[50px] tracking-[-0.01em]">
            Lo que te falta, otra tienda de la galería lo tiene.
          </p>
          <p className="text-[18px] leading-7 text-pase-medio">
            Con tu cuenta ves los precios de pase, la tienda y el stand, y escribes directo por chat
            o WhatsApp.
          </p>
        </div>
        <p className="text-nota text-white">Gratis para el piloto · El trato es entre vendedores</p>
      </aside>
      <main className="flex flex-1 justify-center px-5 pb-12 pt-8 md:items-center md:px-10 md:py-12">
        <div className="w-full max-w-[420px]">
          <FormularioAcceso
            primerIngreso={sesion?.usuario.debe_cambiar_clave ? sesion.usuario.usuario : null}
            pestanaInicial={pestana === 'crear' ? 'crear' : 'ingresar'}
            registroActivo={registro?.activo === true}
          />
        </div>
      </main>
    </div>
  );
}
