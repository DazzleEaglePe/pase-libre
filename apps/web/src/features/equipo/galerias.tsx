'use client';

import type { AvisoGaleria, GaleriaEquipo, RespuestaGaleriasEquipo } from '@paselibre/contracts';
import { IconArrowDown, IconArrowUp, IconGripVertical } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { conPlural } from '@/shared/plural';
import {
  botonLista,
  botonPeligro,
  botonPrincipal,
  botonSecundario,
  campo,
  etiqueta,
} from '@/shared/ui/estilos';

const mensajeDe = (falla: unknown, otro: string) =>
  falla instanceof ErrorApi ? falla.message : otro;

/** Metros del campo: vacío es «sin dato». */
const metrosDe = (texto: string): number | null =>
  texto.trim() === '' ? null : Number(texto.trim());

/** Nombre y metros: lo mismo para «+ Agregar galería» y para «Editar». */
function CamposGaleria({
  prefijo,
  nombre,
  metros,
  alCambiarNombre,
  alCambiarMetros,
}: {
  prefijo: string;
  nombre: string;
  metros: string;
  alCambiarNombre: (valor: string) => void;
  alCambiarMetros: (valor: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <label className={`${etiqueta} min-w-[220px] flex-1`}>
        Nombre
        <input
          id={`${prefijo}-nombre`}
          value={nombre}
          maxLength={80}
          onChange={(evento) => alCambiarNombre(evento.target.value)}
          placeholder="Galería Plaza Tecno"
          className={campo}
        />
      </label>
      <label className={`${etiqueta} w-[180px]`}>
        Metros (opcional)
        <input
          id={`${prefijo}-metros`}
          value={metros}
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={4}
          onChange={(evento) => alCambiarMetros(evento.target.value.replace(/\D/g, ''))}
          placeholder="Desde la esquina"
          className={campo}
        />
      </label>
    </div>
  );
}

/** «+ Agregar galería»: va al final de la lista. */
function NuevaGaleria({
  alCrear,
  alCerrar,
}: {
  alCrear: (galeria: GaleriaEquipo) => void;
  alCerrar: () => void;
}) {
  const [nombre, setNombre] = useState('');
  const [metros, setMetros] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const creada = await llamarApi<GaleriaEquipo>('/equipo/galerias', {
        metodo: 'POST',
        cuerpo: { nombre, metros: metrosDe(metros) },
      });
      alCrear(creada);
    } catch (falla) {
      setError(mensajeDe(falla, 'No pudimos agregarla.'));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form
      aria-label="Agregar galería"
      onSubmit={(evento) => void guardar(evento)}
      className="flex flex-col gap-3 rounded-[20px] border border-linea bg-white p-4"
    >
      <b className="text-tarjeta">Galería nueva</b>
      <CamposGaleria
        prefijo="nueva"
        nombre={nombre}
        metros={metros}
        alCambiarNombre={setNombre}
        alCambiarMetros={setMetros}
      />
      <span className="text-nota text-detalle">
        Los metros son desde una esquina de la avenida: con ellos sale «a 3 min caminando».
      </span>
      {error && (
        <p
          role="alert"
          className="m-0 rounded-xl bg-error-fondo px-3.5 py-2.5 text-apoyo text-error"
        >
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={guardando || nombre.trim().length < 2}
          className={botonPrincipal}
        >
          {guardando ? 'Agregando…' : 'Agregar al final'}
        </button>
        <button type="button" onClick={alCerrar} className={botonSecundario}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/** «Editar»: nombre, metros y ocultar. Sin tiendas, también se puede borrar. */
function EditarGaleria({
  galeria,
  alGuardar,
  alBorrar,
  alCerrar,
}: {
  galeria: GaleriaEquipo;
  alGuardar: (galeria: GaleriaEquipo) => void;
  alBorrar: (id: string) => void;
  alCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(galeria.nombre);
  const [metros, setMetros] = useState(galeria.metros === null ? '' : String(galeria.metros));
  const [activa, setActiva] = useState(galeria.activa);
  const [borrando, setBorrando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const editada = await llamarApi<GaleriaEquipo>(`/equipo/galerias/${galeria.id}`, {
        metodo: 'PATCH',
        cuerpo: { nombre, metros: metrosDe(metros), activa },
      });
      alGuardar(editada);
    } catch (falla) {
      setError(mensajeDe(falla, 'No pudimos guardar los cambios.'));
    } finally {
      setGuardando(false);
    }
  }

  async function borrar() {
    setGuardando(true);
    setError(null);
    try {
      await llamarApi(`/equipo/galerias/${galeria.id}`, { metodo: 'DELETE' });
      alBorrar(galeria.id);
    } catch (falla) {
      setError(mensajeDe(falla, 'No pudimos borrarla.'));
      setBorrando(false);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form
      aria-label={`Editar ${galeria.nombre}`}
      onSubmit={(evento) => void guardar(evento)}
      className="flex flex-col gap-3 border-t border-linea pt-3"
    >
      <CamposGaleria
        prefijo={`editar-${galeria.id}`}
        nombre={nombre}
        metros={metros}
        alCambiarNombre={setNombre}
        alCambiarMetros={setMetros}
      />
      <label className="flex items-start gap-2.5 text-apoyo">
        <input
          type="checkbox"
          checked={!activa}
          onChange={(evento) => setActiva(!evento.target.checked)}
          className="mt-0.5 h-5 w-5 accent-tinta"
        />
        <span className="flex flex-col">
          <b className="font-bold">Ocultar la galería</b>
          <span className="text-secundario">
            No sale al crear cuenta, en Datos de la tienda ni en Wilson en vivo. Sus tiendas siguen
            igual.
          </span>
        </span>
      </label>
      {error && (
        <p
          role="alert"
          className="m-0 rounded-xl bg-error-fondo px-3.5 py-2.5 text-apoyo text-error"
        >
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="submit"
          disabled={guardando || nombre.trim().length < 2}
          className={botonPrincipal}
        >
          {guardando ? 'Guardando…' : 'Guardar'}
        </button>
        <button type="button" onClick={alCerrar} className={botonSecundario}>
          Cancelar
        </button>
        {galeria.tiendas > 0 ? (
          <span className="text-nota text-detalle">
            Tiene {conPlural(galeria.tiendas, 'tienda', 'tiendas')}: no se puede borrar, solo
            ocultar.
          </span>
        ) : borrando ? (
          <span className="flex flex-wrap items-center gap-2 text-apoyo">
            ¿Borrar {galeria.nombre}?
            <button
              type="button"
              disabled={guardando}
              onClick={() => void borrar()}
              className={botonPeligro}
            >
              Sí, borrar
            </button>
            <button
              type="button"
              onClick={() => setBorrando(false)}
              className="h-10 px-2 font-bold"
            >
              No
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setBorrando(true)}
            className="h-10 px-2 text-apoyo font-bold text-error"
          >
            Borrar galería
          </button>
        )}
      </div>
    </form>
  );
}

/** «Galería nueva: X», arriba de la lista, con «Agregar» o «Descartar». */
function Aviso({
  aviso,
  ocupado,
  alAgregar,
  alDescartar,
}: {
  aviso: AvisoGaleria;
  ocupado: boolean;
  alAgregar: () => void;
  alDescartar: () => void;
}) {
  const [primera, ...resto] = aviso.tiendas;
  return (
    <li className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl bg-aviso-fondo px-4 py-3 text-aviso">
      <span className="flex min-w-0 flex-1 flex-col">
        <b className="text-tarjeta">Galería nueva: {aviso.nombre}</b>
        <span className="text-apoyo">
          {resto.length === 0
            ? `La escribió ${primera ?? 'una tienda'} al registrarse.`
            : `La escribieron ${conPlural(aviso.tiendas.length, 'tienda', 'tiendas')} al registrarse: ${aviso.tiendas.join(', ')}.`}{' '}
          Si la agregas, quedan en ella.
        </span>
      </span>
      <span className="flex shrink-0 gap-2">
        <button
          type="button"
          disabled={ocupado}
          onClick={alAgregar}
          aria-label={`Agregar ${aviso.nombre}`}
          className={botonPrincipal}
        >
          Agregar
        </button>
        <button
          type="button"
          disabled={ocupado}
          onClick={alDescartar}
          aria-label={`Descartar ${aviso.nombre}`}
          className={botonLista}
        >
          Descartar
        </button>
      </span>
    </li>
  );
}

/**
 * Equipo › Galerías (docs/18 §3, tablero 3 del lienzo «PaseLibre Demo 2»): la lista única de
 * galerías del sitio. Se arrastran (o se suben y bajan con las flechas) para dejarlas como están
 * en la avenida; ese orden siguen Crear cuenta, Datos de la tienda y Wilson en vivo. Arriba, los
 * avisos de quienes se registraron con «Otra galería».
 */
export function GaleriasPanel() {
  const router = useRouter();
  const [datos, setDatos] = useState<RespuestaGaleriasEquipo | null>(null);
  const [nueva, setNueva] = useState(false);
  const [editando, setEditando] = useState<string | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const arrastrada = useRef<number | null>(null);

  const cargar = useCallback(async () => {
    try {
      setDatos(await llamarApi<RespuestaGaleriasEquipo>('/equipo/galerias'));
    } catch (falla) {
      setError(mensajeDe(falla, 'No pudimos cargar las galerías.'));
    }
  }, []);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const galerias = datos?.galerias ?? [];

  function avisar(mensaje: string) {
    setAviso(mensaje);
    setError(null);
  }

  async function mover(desde: number, hasta: number) {
    if (!datos || desde === hasta || hasta < 0 || hasta >= galerias.length) return;
    const nuevas = [...galerias];
    const [movida] = nuevas.splice(desde, 1);
    if (!movida) return;
    nuevas.splice(hasta, 0, movida);
    const ordenadas = nuevas.map((galeria, indice) => ({ ...galeria, orden: indice + 1 }));
    setDatos({ ...datos, galerias: ordenadas });
    try {
      await llamarApi('/equipo/galerias/orden', {
        metodo: 'PUT',
        cuerpo: { ids: ordenadas.map((galeria) => galeria.id) },
      });
      avisar(`${movida.nombre} quedó en el puesto ${hasta + 1}.`);
    } catch (falla) {
      setError(mensajeDe(falla, 'No pudimos guardar el orden.'));
      await cargar();
    }
  }

  async function resolver(avisoGaleria: AvisoGaleria, accion: 'agregar' | 'descartar') {
    setOcupado(true);
    try {
      if (accion === 'agregar') {
        const galeria = await llamarApi<GaleriaEquipo>(
          `/equipo/galerias/avisos/${avisoGaleria.id}/agregar`,
          { metodo: 'POST', cuerpo: {} },
        );
        avisar(`${galeria.nombre} está en la lista. Ponla en su lugar arrastrándola.`);
      } else {
        await llamarApi(`/equipo/galerias/avisos/${avisoGaleria.id}/descartar`, {
          metodo: 'POST',
        });
        avisar(`Descartaste «${avisoGaleria.nombre}».`);
      }
      await cargar();
      // El numerito de «Galerías» en la barra del panel.
      router.refresh();
    } catch (falla) {
      setError(mensajeDe(falla, 'No pudimos resolver el aviso.'));
      await cargar();
    } finally {
      setOcupado(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-titulo">Galerías</h1>
          <span className="text-secundario">
            Arrástralas para dejarlas como están en la avenida. Ese orden sale al crear cuenta, en
            Datos de la tienda y en Wilson en vivo.
          </span>
        </div>
        {!nueva && (
          <button
            type="button"
            onClick={() => {
              setNueva(true);
              setEditando(null);
            }}
            className={botonPrincipal}
          >
            + Agregar galería
          </button>
        )}
      </div>

      {datos && datos.avisos.length > 0 && (
        <section aria-label="Avisos" className="flex flex-col gap-2">
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {datos.avisos.map((avisoGaleria) => (
              <Aviso
                key={avisoGaleria.id}
                aviso={avisoGaleria}
                ocupado={ocupado}
                alAgregar={() => void resolver(avisoGaleria, 'agregar')}
                alDescartar={() => void resolver(avisoGaleria, 'descartar')}
              />
            ))}
          </ul>
        </section>
      )}

      {aviso && (
        <p
          role="status"
          className="m-0 rounded-xl bg-pase-suave px-3.5 py-2.5 text-apoyo font-bold text-marca"
        >
          {aviso}
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

      {nueva && (
        <NuevaGaleria
          alCerrar={() => setNueva(false)}
          alCrear={(galeria) => {
            setNueva(false);
            avisar(`Agregaste ${galeria.nombre} al final. Arrástrala a su lugar.`);
            void cargar();
          }}
        />
      )}

      {datos === null ? (
        !error && <p className="m-0 text-secundario">Cargando…</p>
      ) : (
        <ol aria-label="Galerías en orden" className="m-0 flex list-none flex-col gap-2 p-0">
          {galerias.map((galeria, indice) => (
            <li
              key={galeria.id}
              draggable={editando !== galeria.id}
              onDragStart={() => {
                arrastrada.current = indice;
              }}
              onDragOver={(evento) => evento.preventDefault()}
              onDrop={(evento) => {
                evento.preventDefault();
                if (arrastrada.current !== null) void mover(arrastrada.current, indice);
                arrastrada.current = null;
              }}
              className={`flex flex-col gap-3 rounded-2xl border bg-white px-3 py-2.5 ${
                galeria.activa ? 'border-linea' : 'border-dashed border-borde'
              }`}
            >
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <IconGripVertical
                  size={18}
                  stroke={1.8}
                  className="shrink-0 cursor-grab text-detalle"
                  aria-hidden="true"
                />
                <span className="w-6 shrink-0 text-right text-apoyo font-bold text-detalle">
                  {indice + 1}
                </span>
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                  <b className={`text-tarjeta ${galeria.activa ? '' : 'text-detalle'}`}>
                    {galeria.nombre}
                  </b>
                  {!galeria.activa && (
                    <span className="rounded-full bg-superficie px-2 py-0.5 text-nota font-bold text-detalle">
                      Oculta
                    </span>
                  )}
                  {galeria.metros !== null && (
                    <span className="text-nota text-detalle">{galeria.metros} m</span>
                  )}
                </span>
                <span className="shrink-0 text-apoyo text-secundario">
                  {conPlural(galeria.tiendas, 'tienda', 'tiendas')}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    disabled={indice === 0}
                    onClick={() => void mover(indice, indice - 1)}
                    aria-label={`Subir ${galeria.nombre}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-secundario hover:bg-superficie disabled:opacity-30"
                  >
                    <IconArrowUp size={16} stroke={2} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    disabled={indice === galerias.length - 1}
                    onClick={() => void mover(indice, indice + 1)}
                    aria-label={`Bajar ${galeria.nombre}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-secundario hover:bg-superficie disabled:opacity-30"
                  >
                    <IconArrowDown size={16} stroke={2} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-expanded={editando === galeria.id}
                    aria-label={`Editar ${galeria.nombre}`}
                    onClick={() => {
                      setEditando((actual) => (actual === galeria.id ? null : galeria.id));
                      setNueva(false);
                    }}
                    className="h-9 rounded-full px-3 text-apoyo font-bold text-pase-texto hover:bg-pase-suave"
                  >
                    Editar
                  </button>
                </span>
              </div>
              {editando === galeria.id && (
                <EditarGaleria
                  galeria={galeria}
                  alCerrar={() => setEditando(null)}
                  alGuardar={(editada) => {
                    setEditando(null);
                    setDatos(
                      (antes) =>
                        antes && {
                          ...antes,
                          galerias: antes.galerias.map((g) => (g.id === editada.id ? editada : g)),
                        },
                    );
                    avisar(
                      editada.activa === galeria.activa
                        ? `Guardaste ${editada.nombre}.`
                        : editada.activa
                          ? `${editada.nombre} vuelve a salir en las listas.`
                          : `Ocultaste ${editada.nombre}.`,
                    );
                  }}
                  alBorrar={(id) => {
                    setEditando(null);
                    setDatos(
                      (antes) =>
                        antes && { ...antes, galerias: antes.galerias.filter((g) => g.id !== id) },
                    );
                    avisar(`Borraste ${galeria.nombre}.`);
                  }}
                />
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
