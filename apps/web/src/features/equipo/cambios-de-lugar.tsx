'use client';

import type { CambioDeLugar, LugarTienda } from '@paselibre/contracts';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { haceRato } from '@/shared/fechas';
import { botonLista, botonPrincipal, campo } from '@/shared/ui/estilos';

/** «Cyberplaza · Piso 2 · Stand 2B 105». */
function lugar(datos: LugarTienda): string {
  return [
    datos.galeria ?? 'Independiente',
    datos.piso && `Piso ${datos.piso}`,
    datos.stand && `Stand ${datos.stand}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

/**
 * Cambios de galería, piso o stand que piden las tiendas (N09): quedan «Pendiente de aprobación»
 * hasta que alguien del Equipo los confirma aquí. Si no hay ninguno, no se muestra.
 */
export function CambiosDeLugar() {
  const [cambios, setCambios] = useState<CambioDeLugar[]>([]);
  const [rechazando, setRechazando] = useState<string | null>(null);
  const [motivo, setMotivo] = useState('');
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    try {
      setCambios(await llamarApi<CambioDeLugar[]>('/equipo/cambios-de-lugar'));
    } catch {
      // Si falla, la cola de solicitudes igual se ve.
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function decidir(cambio: CambioDeLugar, accion: 'aprobar' | 'rechazar') {
    setTrabajando(cambio.id);
    setError(null);
    try {
      await llamarApi(`/equipo/cambios-de-lugar/${cambio.id}/${accion}`, {
        metodo: 'POST',
        ...(accion === 'rechazar'
          ? { cuerpo: motivo.trim() ? { motivo: motivo.trim() } : {} }
          : {}),
      });
      setHecho(
        accion === 'aprobar'
          ? `${cambio.tienda.nombre} ya está en ${lugar(cambio.despues)}.`
          : `${cambio.tienda.nombre} sigue en ${lugar(cambio.antes)}. Le avisamos.`,
      );
      setRechazando(null);
      setMotivo('');
      await cargar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos guardar la decisión.');
    } finally {
      setTrabajando(null);
    }
  }

  if (cambios.length === 0 && !hecho) return null;

  return (
    <section aria-labelledby="cambios-de-lugar" className="flex flex-col gap-3">
      <span className="flex flex-col gap-1">
        <h2 id="cambios-de-lugar" className="text-seccion">
          Cambios de galería o stand · {cambios.length}
        </h2>
        <span className="text-apoyo text-secundario">
          La tienda los pidió en Configuración. Hasta que los confirmes, su perfil sigue con el
          lugar de antes.
        </span>
      </span>
      {hecho && (
        <p role="status" className="m-0 rounded-xl bg-ok-fondo px-3.5 py-2.5 text-apoyo text-ok">
          {hecho}
        </p>
      )}
      {error && (
        <p
          role="alert"
          className="m-0 rounded-xl bg-error-fondo px-3.5 py-2.5 text-apoyo text-error"
        >
          {error}
        </p>
      )}
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
        {cambios.map((cambio) => (
          <li
            key={cambio.id}
            className="flex flex-col gap-3 rounded-2xl border border-linea bg-white p-4"
          >
            <span className="flex flex-wrap items-baseline justify-between gap-2">
              <Link
                href={`/tiendas/${cambio.tienda.id}`}
                className="text-cuerpo font-bold text-tinta"
              >
                {cambio.tienda.nombre}
              </Link>
              <span className="text-nota text-detalle">
                Lo pidió {cambio.pedido_por} · {haceRato(cambio.pedido_en).toLowerCase()}
              </span>
            </span>
            <span className="grid gap-1 text-apoyo sm:grid-cols-2">
              <span>
                <span className="text-detalle">Antes: </span>
                {lugar(cambio.antes)}
              </span>
              <span>
                <span className="text-detalle">Ahora pide: </span>
                <b className="font-bold">{lugar(cambio.despues)}</b>
              </span>
            </span>
            {rechazando === cambio.id ? (
              <form
                onSubmit={(evento) => {
                  evento.preventDefault();
                  void decidir(cambio, 'rechazar');
                }}
                className="flex flex-col gap-2"
              >
                <label className="flex flex-col gap-1.5 text-apoyo font-medium">
                  ¿Por qué no? (le llega a la tienda, opcional)
                  <input
                    value={motivo}
                    maxLength={300}
                    onChange={(evento) => setMotivo(evento.target.value)}
                    placeholder="Ese stand no existe en la galería."
                    className={campo}
                  />
                </label>
                <span className="flex gap-2">
                  <button type="submit" disabled={trabajando === cambio.id} className={botonLista}>
                    No confirmar
                  </button>
                  <button
                    type="button"
                    onClick={() => setRechazando(null)}
                    className="h-10 px-3 text-apoyo font-medium underline"
                  >
                    Cancelar
                  </button>
                </span>
              </form>
            ) : (
              <span className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={trabajando === cambio.id}
                  onClick={() => void decidir(cambio, 'aprobar')}
                  className={botonPrincipal}
                >
                  Confirmar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setRechazando(cambio.id);
                    setMotivo('');
                  }}
                  className={botonLista}
                >
                  No confirmar
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
