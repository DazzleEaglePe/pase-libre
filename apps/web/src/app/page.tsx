import Link from 'next/link';

import { BotonSalir } from '@/features/acceso/boton-salir';
import { obtenerSesion } from '@/shared/api/servidor';
import { Marca } from '@/shared/ui/marca';
import { PieCompacto } from '@/shared/ui/pie-compacto';

/**
 * Portada provisional: solo muestra si hay sesión. La portada del lienzo
 * (F_Portada con categorías y recién publicado) reemplaza esta página.
 */
export default async function Portada() {
  const sesion = await obtenerSesion();

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-linea">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between gap-4 px-4 py-3.5 sm:px-8">
          <Marca />
          {sesion ? (
            <BotonSalir />
          ) : (
            <Link
              href="/ingresar"
              className="flex h-10 items-center rounded-full border border-borde px-4 text-apoyo font-medium no-underline"
            >
              Ingresar
            </Link>
          )}
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-12 sm:px-8">
        {sesion ? (
          <section className="flex flex-col gap-1">
            <h1 className="text-titulo">Hola, {sesion.tienda?.nombre ?? sesion.usuario.nombre}</h1>
            <p className="text-apoyo text-secundario">
              {sesion.tienda
                ? [sesion.tienda.galeria, sesion.tienda.stand && `Stand ${sesion.tienda.stand}`]
                    .filter(Boolean)
                    .join(' · ') || 'Independiente'
                : 'Equipo de PaseLibre'}
            </p>
          </section>
        ) : (
          <section className="flex max-w-[560px] flex-col gap-2">
            <h1 className="text-titulo">Lo que hay para pase en las galerías de Wilson</h1>
            <p className="text-secundario">
              Los precios y el contacto con la tienda se ven al iniciar sesión; las cuentas las
              entrega el equipo de PaseLibre.
            </p>
          </section>
        )}
      </main>
      <PieCompacto />
    </div>
  );
}
