import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { FormularioAcceso } from '@/features/acceso/formulario-acceso';
import { obtenerSesion } from '@/shared/api/servidor';
import { Marca } from '@/shared/ui/marca';
import { PieCompacto } from '@/shared/ui/pie-compacto';

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

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-linea">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-4 py-3.5 sm:px-8">
          <Marca />
          <Link href="/" className="text-apoyo font-medium">
            Volver al catálogo
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[440px] flex-1 px-5 pb-16 pt-12">
        <FormularioAcceso
          primerIngreso={sesion?.usuario.debe_cambiar_clave ? sesion.usuario.usuario : null}
          pestanaInicial={pestana === 'crear' ? 'crear' : 'ingresar'}
        />
      </main>
      <PieCompacto />
    </div>
  );
}
