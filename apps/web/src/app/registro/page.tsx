import type { RespuestaOpcionesRegistro } from '@paselibre/contracts';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { FormularioRegistro } from '@/features/registro/formulario-registro';
import { consultarApi, obtenerSesion } from '@/shared/api/servidor';
import { botonPrincipal } from '@/shared/ui/estilos';
import { MarcoPagina } from '@/shared/ui/marco-pagina';

export const metadata: Metadata = {
  title: 'Crea la cuenta de tu tienda',
  robots: { index: false },
};

/** `/registro` (REG_Web y REG_Cel del lienzo «Versión final»): la tienda pide su cuenta sola. */
export default async function PaginaRegistro() {
  const sesion = await obtenerSesion();
  if (sesion && !sesion.usuario.debe_cambiar_clave) redirect('/');
  const { cuerpo: opciones } = await consultarApi<RespuestaOpcionesRegistro>('/registro/opciones');

  return (
    <MarcoPagina sesion={null}>
      <main className="mx-auto w-full max-w-[1120px] flex-1 px-4 pb-16 pt-8 sm:px-8 sm:pt-12">
        {opciones?.activo ? (
          <FormularioRegistro opciones={opciones} />
        ) : (
          <div className="flex flex-col items-start gap-4 rounded-2xl border border-linea p-6">
            <h1 className="text-titulo">Todavía no se puede crear la cuenta aquí</h1>
            <p className="text-cuerpo text-secundario">
              Mientras dura el piloto, el equipo de PaseLibre crea las cuentas de las tiendas de
              Wilson y te las entrega por WhatsApp.
            </p>
            <Link href="/ingresar?pestana=crear" className={botonPrincipal}>
              Cómo pedir mi cuenta
            </Link>
          </div>
        )}
      </main>
    </MarcoPagina>
  );
}
