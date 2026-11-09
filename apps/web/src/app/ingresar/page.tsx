import type { RespuestaOpcionesRegistro } from '@paselibre/contracts';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { FormularioAcceso } from '@/features/acceso/formulario-acceso';
import { consultarApi, obtenerSesion } from '@/shared/api/servidor';
import { MarcoPagina } from '@/shared/ui/marco-pagina';

export const metadata: Metadata = {
  title: 'Inicia sesión',
  robots: { index: false },
};

/** `/ingresar`: pantalla «Iniciar sesión y primer ingreso» del lienzo (F_Acceso). */
export default async function PaginaIngresar({
  searchParams,
}: {
  searchParams: Promise<{ pestana?: string }>;
}) {
  const sesion = await obtenerSesion();
  // Con sesión y clave propia no hay nada que hacer aquí.
  if (sesion && !sesion.usuario.debe_cambiar_clave) {
    redirect(sesion.usuario.rol === 'EQUIPO' ? '/equipo/cuentas' : '/');
  }
  const { pestana } = await searchParams;
  const { cuerpo: registro } = await consultarApi<RespuestaOpcionesRegistro>('/registro/opciones');

  // La barra va como la de un visitante: aquí o no hay sesión o es la clave temporal, y con ella
  // todavía se ve el catálogo como visitante (docs/08 §2).
  return (
    <MarcoPagina sesion={null}>
      <main className="mx-auto w-full max-w-[440px] flex-1 px-5 pb-16 pt-12">
        <FormularioAcceso
          primerIngreso={sesion?.usuario.debe_cambiar_clave ? sesion.usuario.usuario : null}
          pestanaInicial={pestana === 'crear' ? 'crear' : 'ingresar'}
          registroActivo={registro?.activo === true}
        />
      </main>
    </MarcoPagina>
  );
}
