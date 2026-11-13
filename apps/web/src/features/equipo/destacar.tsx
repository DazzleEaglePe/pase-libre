'use client';

import type {
  DestacadoActivo,
  DetalleTiendaPanel,
  DuracionDestacado,
  FuerzaDestacado,
  RespuestaDestacados,
} from '@paselibre/contracts';
import { IconCheck, IconStar } from '@tabler/icons-react';
import { useEffect, useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { Ventana } from '@/shared/ui/ventana';

const HORA = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});
const hora = (iso: string) => HORA.format(new Date(iso));
/** «9:34 a. m.» ya termina en punto: no se le pone otro. */
const conPunto = (texto: string) => (texto.endsWith('.') ? texto : `${texto}.`);

/** «termina en 35 min» */
function terminaEn(iso: string): string {
  const minutos = Math.max(1, Math.round((new Date(iso).getTime() - Date.now()) / 60_000));
  return minutos < 60 ? `termina en ${minutos} min` : `termina en ${Math.round(minutos / 60)} h`;
}

const DURACIONES: Array<[DuracionDestacado, string, number]> = [
  ['1h', '1 hora', 1],
  ['3h', '3 horas', 3],
  ['dia', 'Todo el día', 0],
];

/**
 * «¿Con qué fuerza?» (doc 20, punto 4b): cada opción con su mapita de la grilla del Inicio (5 por
 * fila, 4 filas) y, en negro, los lugares donde suele caer. Solo suma puntos: nunca lugares fijos.
 */
const FUERZAS: Array<{
  clave: FuerzaDestacado;
  titulo: string;
  texto: string;
  lugares: readonly number[];
}> = [
  {
    clave: 'SUAVE',
    titulo: 'Suave',
    texto: 'Sube un poco y queda repartida.',
    lugares: [8, 10, 17],
  },
  { clave: 'MEDIA', titulo: 'Media', texto: 'Sale en las primeras filas.', lugares: [3, 6, 14] },
  {
    clave: 'FUERTE',
    titulo: 'Fuerte',
    texto: 'Casi seguro en la primera fila.',
    lugares: [0, 2, 9],
  },
];

/** El mapita de una fuerza: la grilla del Inicio con sus lugares en negro. */
function Mapita({ lugares }: { lugares: readonly number[] }) {
  return (
    <span aria-hidden="true" className="grid grid-cols-5 gap-[3px] rounded-lg bg-[#EEF1EF] p-1.5">
      {Array.from({ length: 20 }, (_, n) => (
        <span
          key={n}
          className={`aspect-[1/1.2] rounded-[3px] ${
            lugares.includes(n) ? 'bg-tinta' : 'border border-[#DDE4E0] bg-white'
          }`}
        />
      ))}
    </span>
  );
}

const chip = (activo: boolean) =>
  `h-10 rounded-full border px-4 text-apoyo ${
    activo ? 'border-tinta bg-tinta font-bold text-white' : 'border-borde bg-white font-medium'
  }`;

export function EtiquetaDestacado() {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full bg-[#FDE68A] px-2 text-nota font-bold text-ambar-texto">
      <IconStar size={12} stroke={2} aria-hidden="true" />
      Destacado
    </span>
  );
}

/** «Destacadas ahora · solo lo ve el equipo» (COR16). */
export function DestacadasAhora({ recargar }: { recargar: number }) {
  const [datos, setDatos] = useState<RespuestaDestacados | null>(null);
  useEffect(() => {
    void llamarApi<RespuestaDestacados>('/equipo/destacados').then(setDatos, () => undefined);
  }, [recargar]);
  if (!datos || datos.activas.length === 0) return null;
  return (
    <section className="flex flex-col gap-2 rounded-[20px] border border-linea bg-white p-4">
      <span className="flex items-baseline justify-between gap-2">
        <b className="text-cuerpo font-bold">
          Destacadas ahora{' '}
          <span className="text-nota font-normal text-secundario">· solo lo ve el equipo</span>
        </b>
        <span className="text-nota font-bold text-ambar-texto">
          {datos.activas.length} de {datos.maximo}
        </span>
      </span>
      {datos.activas.map((d: DestacadoActivo) => (
        <span key={d.id} className="flex flex-wrap items-center gap-2 text-apoyo">
          <EtiquetaDestacado />
          <b>{d.tienda.nombre}</b>
          <span className="text-secundario">
            · {d.publicaciones} {d.publicaciones === 1 ? 'publicación' : 'publicaciones'} · fuerza{' '}
            {d.fuerza.toLowerCase()} · {terminaEn(d.hasta)} · por {d.por}
          </span>
        </span>
      ))}
    </section>
  );
}

/**
 * «Destacar» de la ficha de tienda (COR16): por cuánto tiempo, qué publicaciones (todas o hasta
 * 3), con qué fuerza (doc 20, punto 4b: Suave, Media o Fuerte, con su mapita), dónde va a salir, cuántas hay destacadas y el aviso 🤫 a la tienda (opcional). Si ya está
 * destacada, «Destacado hasta las …» con «Quitar ahora».
 */
export function Destacar({
  detalle,
  alCambiar,
}: {
  detalle: DetalleTiendaPanel;
  alCambiar: () => void;
}) {
  const [abierta, setAbierta] = useState(false);
  const [duracion, setDuracion] = useState<DuracionDestacado>('1h');
  const [todas, setTodas] = useState(false);
  const [elegidas, setElegidas] = useState<string[]>([]);
  const [avisar, setAvisar] = useState(true);
  const [fuerza, setFuerza] = useState<FuerzaDestacado>('MEDIA');
  const [activas, setActivas] = useState<RespuestaDestacados | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState(false);

  useEffect(() => {
    if (!abierta) return;
    setElegidas(detalle.para_destacar.slice(0, 2).map((p) => p.oferta_id));
    setFuerza('MEDIA');
    setError(null);
    void llamarApi<RespuestaDestacados>('/equipo/destacados').then(setActivas, () => undefined);
  }, [abierta, detalle.para_destacar]);

  const horas = DURACIONES.find(([clave]) => clave === duracion)?.[2] ?? 1;
  const hastaPrevisto = (() => {
    if (horas > 0) return hora(new Date(Date.now() + horas * 3_600_000).toISOString());
    return '11:59 p. m.';
  })();
  const otras = (activas?.activas ?? []).filter((d) => d.tienda.id !== detalle.id);
  const lleno = otras.length >= (activas?.maximo ?? 3);

  async function destacar() {
    setTrabajando(true);
    setError(null);
    try {
      await llamarApi(`/equipo/panel/tiendas/${detalle.id}/destacar`, {
        metodo: 'POST',
        cuerpo: { duracion, ofertas: todas ? [] : elegidas, avisar, fuerza },
      });
      setAbierta(false);
      alCambiar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos destacarla.');
    } finally {
      setTrabajando(false);
    }
  }

  async function quitar() {
    if (!detalle.destacado) return;
    setTrabajando(true);
    try {
      await llamarApi(`/equipo/destacados/${detalle.destacado.id}`, { metodo: 'DELETE' });
      alCambiar();
    } finally {
      setTrabajando(false);
    }
  }

  return (
    <>
      {detalle.destacado ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#FDE68A] bg-ambar px-4 py-3">
          <span className="flex flex-col gap-1">
            <EtiquetaDestacado />
            <span className="text-apoyo text-ambar-texto">
              <b>{detalle.nombre}</b> está destacada hasta las{' '}
              {conPunto(hora(detalle.destacado.hasta))}{' '}
              {detalle.destacado.avisada ? 'Le avisamos. ' : ''}Solo el equipo ve esta marca.
            </span>
          </span>
          <button
            type="button"
            disabled={trabajando}
            onClick={() => void quitar()}
            className="h-10 rounded-full border border-ambar-texto px-4 text-apoyo font-bold text-ambar-texto"
          >
            Quitar ahora
          </button>
        </div>
      ) : (
        !detalle.suspendida && (
          <button
            type="button"
            onClick={() => setAbierta(true)}
            className="flex h-11 items-center gap-2 rounded-full bg-[#FDE68A] px-5 text-apoyo font-bold text-ambar-texto"
          >
            <IconStar size={16} stroke={2} aria-hidden="true" />
            Destacar
          </button>
        )
      )}

      <Ventana
        titulo={`Destacar a ${detalle.nombre}`}
        abierta={abierta}
        alCerrar={() => setAbierta(false)}
      >
        <div className="flex flex-col gap-4">
          <p className="m-0 text-apoyo text-secundario">
            Sus publicaciones salen más arriba. Es en silencio: solo el equipo lo sabe.
          </p>
          {error && (
            <p
              role="alert"
              className="m-0 rounded-xl bg-error-fondo px-3.5 py-2.5 text-apoyo text-error"
            >
              {error}
            </p>
          )}
          <div className="flex flex-col gap-2">
            <b className="text-apoyo">¿Por cuánto tiempo?</b>
            <div className="flex flex-wrap gap-2">
              {DURACIONES.map(([clave, texto]) => (
                <button
                  key={clave}
                  type="button"
                  aria-pressed={duracion === clave}
                  onClick={() => setDuracion(clave)}
                  className={chip(duracion === clave)}
                >
                  {texto}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <b className="text-apoyo">¿Qué publicaciones?</b>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                aria-pressed={todas}
                onClick={() => setTodas(true)}
                className={chip(todas)}
              >
                Todas sus publicaciones
              </button>
              <button
                type="button"
                aria-pressed={!todas}
                onClick={() => setTodas(false)}
                className={chip(!todas)}
              >
                Elegir hasta 3
              </button>
            </div>
            {!todas && (
              <>
                <span className="text-nota text-secundario">Elegidas: {elegidas.length} de 3</span>
                <ul className="m-0 flex max-h-[240px] list-none flex-col gap-1.5 overflow-y-auto p-0">
                  {detalle.para_destacar.map((p) => {
                    const marcada = elegidas.includes(p.oferta_id);
                    return (
                      <li key={p.oferta_id}>
                        <label
                          className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-apoyo ${
                            marcada ? 'border-2 border-pase bg-pase-suave' : 'border border-linea'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={marcada}
                            disabled={!marcada && elegidas.length >= 3}
                            onChange={() =>
                              setElegidas(
                                marcada
                                  ? elegidas.filter((id) => id !== p.oferta_id)
                                  : [...elegidas, p.oferta_id],
                              )
                            }
                            className="h-5 w-5 accent-pase"
                          />
                          <b className="min-w-0 flex-1 truncate">{p.titulo}</b>
                          <span className="shrink-0 text-secundario">
                            {p.precio ?? 'Al interno'}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
          <fieldset className="m-0 flex flex-col gap-2 rounded-[14px] border-[1.5px] border-dashed border-[#F97316] bg-[#FFF7ED] p-3">
            <legend className="sr-only">¿Con qué fuerza?</legend>
            <span aria-hidden="true" className="flex flex-wrap items-center gap-2">
              <b className="text-apoyo">¿Con qué fuerza?</b>
              <span className="rounded-full bg-[#F97316] px-2.5 py-0.5 text-[10.5px] font-extrabold text-tinta">
                NUEVO
              </span>
              <span className="text-nota text-detalle">
                En negro, dónde suelen caer en el Inicio
              </span>
            </span>
            <div className="grid grid-cols-3 gap-2 max-sm:grid-cols-1">
              {FUERZAS.map((opcion) => (
                <label
                  key={opcion.clave}
                  className={`flex cursor-pointer flex-col gap-2 rounded-[14px] p-3 ${
                    fuerza === opcion.clave
                      ? 'border-2 border-pase bg-[#E9F7EF]'
                      : 'border-[1.5px] border-[#D5DED9] bg-white'
                  }`}
                >
                  <input
                    type="radio"
                    name="fuerza-destacado"
                    value={opcion.clave}
                    checked={fuerza === opcion.clave}
                    onChange={() => setFuerza(opcion.clave)}
                    className="sr-only"
                  />
                  <b className="text-apoyo">{opcion.titulo}</b>
                  <Mapita lugares={opcion.lugares} />
                  <span className="text-nota leading-4 text-detalle">{opcion.texto}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="flex flex-col gap-1.5 rounded-2xl bg-superficie px-4 py-3 text-apoyo">
            <b>Dónde va a salir</b>
            {[
              'Suben en el Inicio según la fuerza; nunca salen todas juntas',
              'Más arriba en las búsquedas de su categoría',
              'Nadie más lo nota: las otras tiendas no ven ninguna etiqueta',
              'Se apaga solo al terminar el tiempo',
            ].map((texto) => (
              <span key={texto} className="flex items-center gap-2">
                <IconCheck size={15} stroke={2.2} aria-hidden="true" className="text-pase" />
                {texto}
              </span>
            ))}
            <span className="text-nota text-secundario">
              Destacadas ahora: {otras.length} de {activas?.maximo ?? 3}
              {otras[0] ? ` (${otras[0].tienda.nombre}, ${terminaEn(otras[0].hasta)})` : ''}.
            </span>
          </div>
          <div className="flex flex-col gap-2 rounded-2xl border border-linea p-3.5">
            <label className="flex items-center gap-2.5 text-apoyo">
              <input
                type="checkbox"
                checked={avisar}
                onChange={(e) => setAvisar(e.target.checked)}
                className="h-5 w-5 accent-pase"
              />
              <b>Avisarle a la tienda</b>
              <span className="text-nota text-secundario">(solo ella lo ve · opcional)</span>
            </label>
            {avisar && (
              <div className="flex gap-3 rounded-xl bg-superficie px-3 py-2.5">
                <span aria-hidden="true" className="text-[22px]">
                  🤫
                </span>
                <span className="flex flex-col text-apoyo">
                  <b>Te dimos un empujoncito</b>
                  <span className="text-secundario">
                    Tus publicaciones salen primero hasta las {conPunto(hastaPrevisto)} Es un regalo
                    del equipo PaseLibre. ¡Disfrútalo!
                  </span>
                </span>
              </div>
            )}
          </div>
          {lleno && (
            <p className="m-0 rounded-xl bg-aviso-fondo px-3.5 py-2.5 text-apoyo text-aviso">
              Ya hay {activas?.maximo ?? 3} tiendas destacadas. Quita una o espera a que termine.
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={trabajando || lleno || (!todas && elegidas.length === 0)}
              onClick={() => void destacar()}
              className="flex h-11 items-center gap-2 rounded-full bg-[#FDE68A] px-5 text-apoyo font-bold text-ambar-texto disabled:opacity-50"
            >
              <IconStar size={16} stroke={2} aria-hidden="true" />
              {trabajando
                ? 'Destacando…'
                : `Destacar ${DURACIONES.find(([c]) => c === duracion)?.[0] === 'dia' ? 'todo el día' : `por ${DURACIONES.find(([c]) => c === duracion)?.[1]}`}`}
            </button>
            <button
              type="button"
              onClick={() => setAbierta(false)}
              className="h-11 rounded-full border border-tinta px-5 text-apoyo font-bold"
            >
              Cancelar
            </button>
          </div>
        </div>
      </Ventana>
    </>
  );
}
