'use client';

import { botonPrincipal } from '@/shared/ui/estilos';

/** Cuando la API no responde: una frase y un botón, no una pantalla rota. */
export default function ErrorPublico({ reset }: { error: Error; reset: () => void }) {
  return (
    <section className="flex max-w-[520px] flex-col items-start gap-3 py-12">
      <h1 className="text-titulo">No pudimos cargar el catálogo</h1>
      <p className="text-secundario">
        Es un problema de nuestro lado, no de tu conexión. Vuelve a intentarlo en unos segundos.
      </p>
      <button type="button" onClick={reset} className={botonPrincipal}>
        Reintentar
      </button>
    </section>
  );
}
