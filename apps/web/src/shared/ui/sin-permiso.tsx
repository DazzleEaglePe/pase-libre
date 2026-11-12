import { IconLock } from '@tabler/icons-react';
import Link from 'next/link';

/**
 * Una página que el asesor no puede usar (N12): lo dice en claro en vez de dejarlo llenar un
 * formulario que la API va a rechazar.
 */
export function SinPermiso({ que }: { que: string }) {
  return (
    <div className="mx-auto flex max-w-[480px] flex-col items-center gap-3 rounded-3xl border-[1.5px] border-linea bg-white px-6 py-10 text-center">
      <span
        aria-hidden="true"
        className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-superficie"
      >
        <IconLock size={24} stroke={1.8} />
      </span>
      <h1 className="text-seccion">No tienes permiso para {que}</h1>
      <p className="m-0 text-apoyo text-secundario">
        El dueño de tu tienda elige qué puede hacer cada asesor. Pídeselo si lo necesitas.
      </p>
      <Link href="/" className="text-apoyo font-semibold text-pase-texto">
        Volver al inicio
      </Link>
    </div>
  );
}
