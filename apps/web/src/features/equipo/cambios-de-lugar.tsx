'use client';

import type {
  CambioDeLugar,
  GaleriaEquipo,
  LugarTienda,
  RespuestaGaleriasEquipo,
} from '@paselibre/contracts';
import { IconArrowBackUp, IconCheck, IconTool } from '@tabler/icons-react';
import Link from 'next/link';
import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { haceRato } from '@/shared/fechas';
import { AvatarTienda } from '@/shared/ui/avatar-tienda';
import { botonLista, botonPrincipal, campo, etiqueta } from '@/shared/ui/estilos';

const PISOS = ['Sótano', '1', '2', '3', '4', '5'];

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

type Abierto = { id: string; que: 'corregir' | 'deshacer' | 'rechazar' } | null;

/**
 * «Cambios de galería o stand · N» en Solicitudes (doc 19 §10). La tienda los cambia sola y ya se
 * ven en su perfil: aquí el Equipo los da por buenos («Está bien», sin avisarle), los corrige ahí
 * mismo o los deshace (con aviso y motivo opcional). Las que eligieron «Otra galería» esperan a
 * que el Equipo la cree: se confirman eligiéndola. Si no hay ninguno, no se muestra.
 */
export function CambiosDeLugar() {
  const [cambios, setCambios] = useState<CambioDeLugar[]>([]);
  const [galerias, setGalerias] = useState<GaleriaEquipo[]>([]);
  const [abierto, setAbierto] = useState<Abierto>(null);
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

  // Las galerías, para «Corregir» y para confirmar una «Otra galería» ya creada.
  useEffect(() => {
    if (!abierto || abierto.que !== 'corregir' || galerias.length > 0) return;
    llamarApi<RespuestaGaleriasEquipo>('/equipo/galerias').then(
      (respuesta) => setGalerias(respuesta.galerias),
      () => undefined,
    );
  }, [abierto, galerias.length]);

  async function hacer(
    cambio: CambioDeLugar,
    accion: 'aprobar' | 'rechazar' | 'deshacer' | 'corregir',
    mensaje: string,
    cuerpo?: Record<string, unknown>,
  ) {
    setTrabajando(cambio.id);
    setError(null);
    try {
      await llamarApi(`/equipo/cambios-de-lugar/${cambio.id}/${accion}`, {
        metodo: 'POST',
        ...(cuerpo ? { cuerpo } : {}),
      });
      setHecho(mensaje);
      setAbierto(null);
      setMotivo('');
      await cargar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos guardar la decisión.');
    } finally {
      setTrabajando(null);
    }
  }

  function conMotivo() {
    return motivo.trim() ? { motivo: motivo.trim() } : {};
  }

  if (cambios.length === 0 && !hecho) return null;

  return (
    <section aria-labelledby="cambios-de-lugar" className="flex flex-col gap-3">
      <span className="flex flex-col gap-1">
        <h2 id="cambios-de-lugar" className="text-seccion">
          Cambios de galería o stand · {cambios.length}
        </h2>
        <span className="text-apoyo text-secundario">
          La tienda los cambió en Configuración y ya se ven en su perfil. «Está bien» los archiva
          sin avisarle; «Deshacer» vuelve a como estaba y le avisa.
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
        {cambios.map((cambio) => {
          const aplicado = cambio.estado === 'APLICADO_SIN_REVISAR';
          const abiertoAqui = abierto?.id === cambio.id ? abierto.que : null;
          return (
            <li
              key={cambio.id}
              className="flex flex-col gap-3 rounded-2xl border border-linea bg-white p-4"
            >
              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                <AvatarTienda
                  nombre={cambio.tienda.nombre}
                  logo={cambio.tienda.logo}
                  tamano={36}
                  letra={12}
                  oculto
                />
                <Link
                  href={`/equipo/tiendas/${cambio.tienda.id}`}
                  className="text-cuerpo font-bold text-tinta"
                >
                  {cambio.tienda.nombre}
                </Link>
                <span className="text-nota text-detalle">
                  {aplicado
                    ? `· lo cambió ${haceRato(cambio.pedido_en).toLowerCase()} · ya se ve así`
                    : `· lo pidió ${cambio.pedido_por} ${haceRato(cambio.pedido_en).toLowerCase()} · eligió «Otra galería»`}
                </span>
              </span>
              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-cuerpo">
                <span className="text-detalle line-through">{lugar(cambio.antes)}</span>
                <span aria-hidden="true" className="font-extrabold text-pase-texto">
                  →
                </span>
                <span className="sr-only">ahora</span>
                <b className="font-bold">{lugar(cambio.despues)}</b>
              </span>
              {!aplicado && cambio.galeria_otra && (
                <span className="text-nota text-secundario">
                  «{cambio.galeria_otra}» no está en la lista: créala en{' '}
                  <Link href="/equipo/galerias" className="font-bold text-tinta">
                    Galerías
                  </Link>{' '}
                  y confírmala eligiéndola aquí. Mientras, su perfil sigue con el lugar de antes.
                </span>
              )}

              {abiertoAqui === 'corregir' ? (
                <Corregir
                  cambio={cambio}
                  galerias={galerias}
                  trabajando={trabajando === cambio.id}
                  alCancelar={() => setAbierto(null)}
                  alGuardar={(datos, nombreGaleria) =>
                    void hacer(
                      cambio,
                      'corregir',
                      `${cambio.tienda.nombre} ya está en ${lugar({ ...datos, galeria: nombreGaleria })}.`,
                      datos,
                    )
                  }
                />
              ) : abiertoAqui === 'deshacer' || abiertoAqui === 'rechazar' ? (
                <form
                  onSubmit={(evento) => {
                    evento.preventDefault();
                    void hacer(
                      cambio,
                      abiertoAqui,
                      `${cambio.tienda.nombre} vuelve a ${lugar(cambio.antes)}. Le avisamos.`,
                      conMotivo(),
                    );
                  }}
                  className="flex flex-col gap-2"
                >
                  <label className={etiqueta}>
                    {abiertoAqui === 'deshacer'
                      ? 'Motivo (le llega a la tienda, opcional)'
                      : '¿Por qué no? (le llega a la tienda, opcional)'}
                    <input
                      value={motivo}
                      maxLength={300}
                      onChange={(evento) => setMotivo(evento.target.value)}
                      placeholder="Ese stand no existe en la galería."
                      className={campo}
                    />
                  </label>
                  <span className="flex gap-2">
                    <button
                      type="submit"
                      disabled={trabajando === cambio.id}
                      className={botonLista}
                    >
                      {abiertoAqui === 'deshacer' ? 'Deshacer' : 'No confirmar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAbierto(null)}
                      className="h-10 px-3 text-apoyo font-medium underline"
                    >
                      Cancelar
                    </button>
                  </span>
                </form>
              ) : aplicado ? (
                <span className="flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    disabled={trabajando === cambio.id}
                    onClick={() =>
                      void hacer(
                        cambio,
                        'aprobar',
                        `Listo: el cambio de ${cambio.tienda.nombre} queda archivado.`,
                      )
                    }
                    className="inline-flex h-10 items-center gap-1.5 rounded-full bg-pase px-4 text-apoyo font-bold text-white disabled:opacity-60"
                  >
                    <IconCheck size={17} stroke={2} aria-hidden="true" />
                    Está bien
                  </button>
                  <button
                    type="button"
                    onClick={() => setAbierto({ id: cambio.id, que: 'corregir' })}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full border-[1.5px] border-linea px-4 text-apoyo font-bold"
                  >
                    <IconTool size={17} stroke={1.8} aria-hidden="true" />
                    Corregir
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMotivo('');
                      setAbierto({ id: cambio.id, que: 'deshacer' });
                    }}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full border-[1.5px] border-error px-4 text-apoyo font-bold text-error"
                  >
                    <IconArrowBackUp size={17} stroke={1.8} aria-hidden="true" />
                    Deshacer
                  </button>
                </span>
              ) : (
                <span className="flex flex-wrap gap-2">
                  {cambio.despues.galeria_id ? (
                    <button
                      type="button"
                      disabled={trabajando === cambio.id}
                      onClick={() =>
                        void hacer(
                          cambio,
                          'aprobar',
                          `${cambio.tienda.nombre} ya está en ${lugar(cambio.despues)}.`,
                        )
                      }
                      className={botonPrincipal}
                    >
                      Confirmar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAbierto({ id: cambio.id, que: 'corregir' })}
                      className={botonPrincipal}
                    >
                      Confirmar
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMotivo('');
                      setAbierto({ id: cambio.id, que: 'rechazar' });
                    }}
                    className={botonLista}
                  >
                    No confirmar
                  </button>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** «Corregir»: galería, piso y stand ahí mismo (por ejemplo, «2b105» → «2B 105»). */
function Corregir({
  cambio,
  galerias,
  trabajando,
  alCancelar,
  alGuardar,
}: {
  cambio: CambioDeLugar;
  galerias: GaleriaEquipo[];
  trabajando: boolean;
  alCancelar: () => void;
  alGuardar: (
    datos: { galeria_id: string; piso: string | null; stand: string },
    galeria: string,
  ) => void;
}) {
  const id = useId();
  const [galeriaId, setGaleriaId] = useState(cambio.despues.galeria_id ?? '');
  const [piso, setPiso] = useState(cambio.despues.piso ?? '');
  const [stand, setStand] = useState(cambio.despues.stand ?? '');
  const pisos = piso && !PISOS.includes(piso) ? [...PISOS, piso] : PISOS;
  const visibles = galerias.filter((galeria) => galeria.activa || galeria.id === galeriaId);

  function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const elegida = galerias.find((galeria) => galeria.id === galeriaId);
    if (!elegida) return;
    alGuardar({ galeria_id: galeriaId, piso: piso || null, stand: stand.trim() }, elegida.nombre);
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-2.5">
      <div className="grid gap-2.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <label htmlFor={`${id}-galeria`} className={etiqueta}>
          Galería
          <select
            id={`${id}-galeria`}
            required
            value={galeriaId}
            onChange={(evento) => setGaleriaId(evento.target.value)}
            className={campo}
          >
            <option value="" disabled>
              {galerias.length === 0 ? 'Cargando…' : 'Elige la galería'}
            </option>
            {visibles.map((galeria) => (
              <option key={galeria.id} value={galeria.id}>
                {galeria.nombre}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${id}-piso`} className={etiqueta}>
          Piso
          <select
            id={`${id}-piso`}
            value={piso}
            onChange={(evento) => setPiso(evento.target.value)}
            className={campo}
          >
            <option value="">—</option>
            {pisos.map((opcion) => (
              <option key={opcion} value={opcion}>
                {opcion}
              </option>
            ))}
          </select>
        </label>
        <label htmlFor={`${id}-stand`} className={etiqueta}>
          Stand
          <input
            id={`${id}-stand`}
            required
            maxLength={20}
            value={stand}
            onChange={(evento) => setStand(evento.target.value)}
            className={campo}
          />
        </label>
      </div>
      <span className="flex gap-2">
        <button type="submit" disabled={trabajando || !galeriaId} className={botonPrincipal}>
          Guardar así
        </button>
        <button
          type="button"
          onClick={alCancelar}
          className="h-10 px-3 text-apoyo font-medium underline"
        >
          Cancelar
        </button>
      </span>
    </form>
  );
}
