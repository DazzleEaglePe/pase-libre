'use client';

import {
  DIAS_FUNDADORA,
  MAX_FUNDADORAS,
  type CambiarFundadoraDatos,
  type FundadoraEnPanel,
  type RespuestaFundadoras,
  type TiendaEnPanel,
} from '@paselibre/contracts';
import { useCallback, useEffect, useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { enPlural } from '@/shared/plural';
import { Interruptor } from '@/shared/ui/interruptor';
import { Ventana } from '@/shared/ui/ventana';

/** Al cambiar las fundadoras, la pestaña «★ Fundadoras 7 de 10» se pone al día. */
const EVENTO_FUNDADORAS = 'paselibre:fundadoras';

/**
 * Las pestañas de Equipo › Tiendas (doc 20, punto 7): «Todas» y «★ Fundadoras 7 de 10», con la
 * raya dorada debajo de la elegida.
 */
export function PestanasTiendas({
  vista,
  alCambiar,
}: {
  vista: 'todas' | 'fundadoras';
  alCambiar: (vista: 'todas' | 'fundadoras') => void;
}) {
  const [cuenta, setCuenta] = useState<number | null>(null);
  useEffect(() => {
    const contar = () =>
      void llamarApi<RespuestaFundadoras>('/equipo/fundadoras').then(
        (respuesta) => setCuenta(respuesta.fundadoras.length),
        () => undefined,
      );
    contar();
    window.addEventListener(EVENTO_FUNDADORAS, contar);
    return () => window.removeEventListener(EVENTO_FUNDADORAS, contar);
  }, []);
  const pestana = (activa: boolean) =>
    `border-b-[3px] pb-1 text-apoyo font-bold ${
      activa ? 'border-[#F7D774] text-tinta' : 'border-transparent text-secundario hover:text-tinta'
    }`;
  return (
    <div role="tablist" aria-label="Qué tiendas ver" className="flex gap-[18px]">
      <button
        type="button"
        role="tab"
        aria-selected={vista === 'todas'}
        onClick={() => alCambiar('todas')}
        className={pestana(vista === 'todas')}
      >
        Todas
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={vista === 'fundadoras'}
        onClick={() => alCambiar('fundadoras')}
        className={pestana(vista === 'fundadoras')}
      >
        ★ Fundadoras{cuenta === null ? '' : ` ${cuenta} de ${MAX_FUNDADORAS}`}
      </button>
    </div>
  );
}

const lugarDe = (fila: { galeria: string | null; stand: string | null }) =>
  [fila.galeria ?? 'Independiente', fila.stand].filter(Boolean).join(' · ');

/** «+ Agregar fundadora»: buscar una tienda activa que todavía no lo sea. */
function AgregarFundadora({
  abierta,
  yaSon,
  alCerrar,
  alAgregar,
}: {
  abierta: boolean;
  yaSon: ReadonlySet<string>;
  alCerrar: () => void;
  alAgregar: (tiendaId: string) => Promise<void>;
}) {
  const [q, setQ] = useState('');
  const [lista, setLista] = useState<TiendaEnPanel[] | null>(null);
  const [trabajando, setTrabajando] = useState<string | null>(null);

  useEffect(() => {
    if (!abierta) return;
    const espera = setTimeout(() => {
      llamarApi<TiendaEnPanel[]>(
        `/equipo/panel/tiendas?filtro=activas&q=${encodeURIComponent(q)}`,
      ).then(setLista, () => setLista([]));
    }, 250);
    return () => clearTimeout(espera);
  }, [abierta, q]);

  const candidatas = (lista ?? []).filter((tienda) => !yaSon.has(tienda.id));
  return (
    <Ventana titulo="Agregar fundadora" abierta={abierta} alCerrar={alCerrar}>
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-apoyo font-bold">
          Buscar tienda
          <input
            value={q}
            onChange={(evento) => setQ(evento.target.value)}
            placeholder="Buscar por nombre, galería o stand"
            className="h-11 rounded-full border border-borde px-4 text-cuerpo font-normal"
          />
        </label>
        {lista === null ? (
          <p className="m-0 text-secundario">Buscando…</p>
        ) : candidatas.length === 0 ? (
          <p className="m-0 text-secundario">No hay tiendas activas con ese nombre.</p>
        ) : (
          <ul className="m-0 flex max-h-[320px] list-none flex-col gap-1.5 overflow-y-auto p-0">
            {candidatas.map((tienda) => (
              <li
                key={tienda.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-linea px-3 py-2"
              >
                <span className="flex min-w-0 flex-col">
                  <b className="truncate text-apoyo">{tienda.nombre}</b>
                  <span className="truncate text-nota text-secundario">{lugarDe(tienda)}</span>
                </span>
                <button
                  type="button"
                  disabled={trabajando !== null}
                  onClick={() => {
                    setTrabajando(tienda.id);
                    void alAgregar(tienda.id).finally(() => setTrabajando(null));
                  }}
                  className="h-9 shrink-0 rounded-full bg-pase px-4 text-apoyo font-bold text-white disabled:opacity-50"
                >
                  {trabajando === tienda.id ? 'Agregando…' : 'Agregar'}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Ventana>
  );
}

/**
 * Equipo › Tiendas › Fundadoras (doc 20, punto 7): «★ Fundadoras · 7 de 10», agregar (máximo 10)
 * o quitar, y en cada fila su día destacado (de lunes a sábado, uno solo), «Sello en su perfil»
 * y «Prioridad en el chat».
 */
export function FundadorasPanel() {
  const [datos, setDatos] = useState<RespuestaFundadoras | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [quitando, setQuitando] = useState<FundadoraEnPanel | null>(null);

  const cargar = useCallback(async () => {
    try {
      setDatos(await llamarApi<RespuestaFundadoras>('/equipo/fundadoras'));
      window.dispatchEvent(new Event(EVENTO_FUNDADORAS));
    } catch {
      setError('No pudimos cargar las fundadoras.');
    }
  }, []);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function cambiar(fila: FundadoraEnPanel, cambio: CambiarFundadoraDatos) {
    setError(null);
    // Se ve al toque; si la API dice que no, vuelve lo que dice la base.
    setDatos(
      (antes) =>
        antes && {
          ...antes,
          fundadoras: antes.fundadoras.map((f) =>
            f.tienda_id === fila.tienda_id
              ? {
                  ...f,
                  ...(cambio.dia !== undefined ? { dia: cambio.dia } : {}),
                  ...(cambio.sello !== undefined ? { sello: cambio.sello } : {}),
                  ...(cambio.prioridad !== undefined ? { prioridad: cambio.prioridad } : {}),
                }
              : f,
          ),
        },
    );
    try {
      await llamarApi(`/equipo/fundadoras/${fila.tienda_id}`, { metodo: 'PATCH', cuerpo: cambio });
    } catch (falla) {
      setError(falla instanceof ErrorApi ? falla.message : 'No pudimos guardarlo.');
      await cargar();
    }
  }

  async function agregar(tiendaId: string) {
    setError(null);
    try {
      await llamarApi('/equipo/fundadoras', { metodo: 'POST', cuerpo: { tienda_id: tiendaId } });
      setAgregando(false);
    } catch (falla) {
      setError(falla instanceof ErrorApi ? falla.message : 'No pudimos agregarla.');
      setAgregando(false);
    }
    await cargar();
  }

  async function quitar(fila: FundadoraEnPanel) {
    setError(null);
    try {
      await llamarApi(`/equipo/fundadoras/${fila.tienda_id}`, { metodo: 'DELETE' });
    } catch (falla) {
      setError(falla instanceof ErrorApi ? falla.message : 'No pudimos quitarla.');
    }
    setQuitando(null);
    await cargar();
  }

  const fundadoras = datos?.fundadoras ?? [];
  const maximo = datos?.maximo ?? MAX_FUNDADORAS;
  const llenas = fundadoras.length >= maximo;
  const quedan = Math.max(0, maximo - fundadoras.length);

  return (
    <section
      aria-labelledby="fundadoras-titulo"
      className="flex flex-col gap-3 rounded-[24px] border border-linea bg-white p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="fundadoras-titulo" className="m-0 text-cuerpo font-bold">
          ★ Fundadoras · {fundadoras.length} de {maximo}
        </h2>
        <button
          type="button"
          disabled={llenas || datos === null}
          onClick={() => setAgregando(true)}
          className="h-10 rounded-full bg-pase px-[18px] text-apoyo font-extrabold text-white disabled:bg-borde disabled:text-secundario"
        >
          {llenas ? `Ya están las ${maximo}` : '+ Agregar fundadora'}
        </button>
      </div>
      {error && (
        <p
          role="alert"
          className="m-0 rounded-xl bg-error-fondo px-3.5 py-2.5 text-apoyo text-error"
        >
          {error}
        </p>
      )}
      {datos === null && !error ? (
        <p className="m-0 text-secundario">Cargando…</p>
      ) : fundadoras.length === 0 ? (
        <p className="m-0 text-secundario">Todavía no hay tiendas fundadoras.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-apoyo">
            <thead>
              <tr className="text-nota text-secundario">
                <th className="px-3 py-2 font-bold">Tienda</th>
                <th className="px-3 py-2 font-bold">Su día destacado</th>
                <th className="px-3 py-2 text-center font-bold">Sello en su perfil</th>
                <th className="px-3 py-2 text-center font-bold">Prioridad en el chat</th>
                <th className="px-3 py-2">
                  <span className="sr-only">Quitar</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {fundadoras.map((fila) => (
                <tr key={fila.tienda_id} className="border-t border-linea">
                  <td className="px-3 py-2.5">
                    <b className="block">{fila.nombre}</b>
                    <span className="text-nota text-secundario">{lugarDe(fila)}</span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span
                      role="group"
                      aria-label={`Día destacado de ${fila.nombre}`}
                      className="flex gap-1"
                    >
                      {DIAS_FUNDADORA.map(({ dia, corto, nombre }) => (
                        <button
                          key={dia}
                          type="button"
                          aria-pressed={fila.dia === dia}
                          aria-label={nombre}
                          onClick={() => fila.dia !== dia && void cambiar(fila, { dia })}
                          className={`h-8 min-w-[38px] rounded-lg px-1.5 text-nota font-bold ${
                            fila.dia === dia
                              ? 'bg-[#22C55E] text-tinta'
                              : 'bg-superficie text-secundario hover:text-tinta'
                          }`}
                        >
                          {corto}
                        </button>
                      ))}
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex justify-center">
                      <Interruptor
                        activo={fila.sello}
                        etiqueta={`Sello en el perfil de ${fila.nombre}`}
                        alCambiar={(sello) => void cambiar(fila, { sello })}
                      />
                    </span>
                  </td>
                  <td className="px-3 py-2.5">
                    <span className="flex justify-center">
                      <Interruptor
                        activo={fila.prioridad}
                        etiqueta={`Prioridad en el chat de ${fila.nombre}`}
                        alCambiar={(prioridad) => void cambiar(fila, { prioridad })}
                      />
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => setQuitando(fila)}
                      className="text-nota font-bold text-error underline"
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="m-0 text-nota text-secundario">
        Su día destacado: ese día sus publicaciones van primero en el Inicio y en las búsquedas, sin
        borde ni marca (las demás tiendas no lo notan). Quedan {quedan}{' '}
        {enPlural(quedan, 'lugar', 'lugares')}.
      </p>

      <AgregarFundadora
        abierta={agregando}
        yaSon={new Set(fundadoras.map((f) => f.tienda_id))}
        alCerrar={() => setAgregando(false)}
        alAgregar={agregar}
      />
      <Ventana
        titulo={quitando ? `¿Quitar a ${quitando.nombre}?` : 'Quitar fundadora'}
        abierta={quitando !== null}
        alCerrar={() => setQuitando(null)}
      >
        <div className="flex flex-col gap-4">
          <p className="m-0 text-apoyo text-secundario">
            Deja de ser fundadora: pierde su día destacado, el sello y la prioridad en el chat. Su
            lugar queda libre para otra tienda.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => quitando && void quitar(quitando)}
              className="h-11 rounded-full bg-error px-5 text-apoyo font-bold text-white"
            >
              Sí, quitar
            </button>
            <button
              type="button"
              onClick={() => setQuitando(null)}
              className="h-11 rounded-full border border-tinta px-5 text-apoyo font-bold"
            >
              Cancelar
            </button>
          </div>
        </div>
      </Ventana>
    </section>
  );
}
