'use client';

import type { EstadoSoporteTienda } from '@paselibre/contracts';
import { IconLifebuoy } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { hora } from '@/shared/fechas';

/**
 * «Pedir ayuda al Equipo» (N14, la forma recomendada de empezar el modo soporte): la cuenta
 * principal autoriza que alguien del equipo entre como la tienda por 1 hora. Solo sale con
 * sesión de una tienda; sin ella no se muestra.
 */
export function PedirAyudaEquipo() {
  const [estado, setEstado] = useState<EstadoSoporteTienda | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pidiendo, setPidiendo] = useState(false);

  useEffect(() => {
    llamarApi<EstadoSoporteTienda>('/cuenta/soporte').then(setEstado, () => setEstado(null));
  }, []);

  if (!estado) return null;

  async function pedir() {
    setPidiendo(true);
    setError(null);
    try {
      setEstado(await llamarApi<EstadoSoporteTienda>('/cuenta/soporte', { metodo: 'POST' }));
    } catch (e) {
      setError(
        e instanceof ErrorApi && e.estado === 403
          ? 'Solo la cuenta principal de la tienda puede pedirlo.'
          : e instanceof ErrorApi
            ? e.message
            : 'No pudimos pedirlo. Vuelve a intentarlo.',
      );
    } finally {
      setPidiendo(false);
    }
  }

  return (
    <section id="ayuda-equipo" className="flex flex-col gap-3 text-cuerpo">
      <h2 className="text-seccion">Que el Equipo te ayude</h2>
      <div className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-linea bg-white p-4 sm:p-5">
        <b className="flex items-center gap-2 text-tarjeta">
          <IconLifebuoy size={20} stroke={1.8} className="text-marca" aria-hidden="true" />
          Pedir ayuda al Equipo
        </b>
        <p className="m-0 text-apoyo text-secundario">
          Autoriza que alguien del Equipo PaseLibre entre como tu tienda por 1 hora para acomodar tu
          perfil o publicar por ti. No puede chatear ni cerrar ventas, y te avisamos de cada cambio.
        </p>
        {estado.activo ? (
          <p
            role="status"
            className="m-0 rounded-xl bg-pase-suave px-3.5 py-3 text-apoyo font-semibold text-marca"
          >
            {estado.activo.equipo} del Equipo te está ayudando ahora, hasta las{' '}
            {hora(estado.activo.vence_en)}.
          </p>
        ) : estado.pedido_en ? (
          <p
            role="status"
            className="m-0 rounded-xl bg-pase-suave px-3.5 py-3 text-apoyo font-semibold text-marca"
          >
            Ya lo pediste. Te avisamos cuando alguien del Equipo entre.
          </p>
        ) : (
          <button
            type="button"
            disabled={pidiendo}
            onClick={() => void pedir()}
            className="inline-flex h-11 items-center justify-center self-start rounded-full bg-pase px-5 text-cuerpo font-semibold text-white disabled:bg-borde-control"
          >
            {pidiendo ? 'Pidiendo…' : 'Pedir ayuda al Equipo'}
          </button>
        )}
        {error && (
          <p role="alert" className="m-0 text-apoyo text-error">
            {error}
          </p>
        )}
      </div>
    </section>
  );
}
