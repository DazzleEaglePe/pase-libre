'use client';

import type {
  EstadoSolicitud,
  GaleriaResumen,
  RespuestaSolicitudesEquipo,
  SolicitudEquipo,
} from '@paselibre/contracts';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import {
  botonLista,
  botonPeligro,
  botonPrincipal,
  botonSecundario,
  campo,
} from '@/shared/ui/estilos';

type Filtro = EstadoSolicitud | 'todas';

const FILTROS: Array<{ valor: Filtro; texto: string }> = [
  { valor: 'PENDIENTE', texto: 'Por revisar' },
  { valor: 'REQUIERE_CAMBIOS', texto: 'Esperando cambios' },
  { valor: 'APROBADA', texto: 'Aprobadas' },
  { valor: 'RECHAZADA', texto: 'Rechazadas' },
  { valor: 'todas', texto: 'Todas' },
];

const ESTADO: Record<EstadoSolicitud, { texto: string; clases: string }> = {
  PENDIENTE: { texto: 'Por revisar', clases: 'bg-aviso-fondo text-aviso' },
  REQUIERE_CAMBIOS: { texto: 'Esperando cambios', clases: 'bg-superficie text-secundario' },
  APROBADA: { texto: 'Aprobada', clases: 'bg-ok-fondo text-ok' },
  RECHAZADA: { texto: 'Rechazada', clases: 'bg-error-fondo text-error' },
};

const METODO = {
  RUC: 'Con RUC',
  SIN_RUC_DNI: 'Sin RUC · DNI',
  SIN_RUC_RECOMENDACION: 'Sin RUC · lo recomienda una tienda',
  SIN_RUC_CREDENCIAL: 'Sin RUC · credencial de la galería',
} as const;

function plazo(vence: string | null, ahora: number): { texto: string; vencida: boolean } | null {
  if (!vence) return null;
  const minutos = Math.round((new Date(vence).getTime() - ahora) / 60_000);
  if (minutos < 0) return { texto: `Vencida hace ${Math.abs(minutos)} min`, vencida: true };
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  const texto = h === 0 ? `${m} min` : m === 0 ? `${h} h` : `${h} h ${m} min`;
  return { texto: `Quedan ${texto}`, vencida: false };
}

type Accion = { id: string; tipo: 'cambios' | 'rechazar' };

/**
 * La cola de solicitudes de cuenta (REG_Admin del lienzo): lo que se aprobó solo con el RUC,
 * lo que espera a una persona y lo que se devolvió. Aprobar crea la tienda y la cuenta.
 */
export function PanelSolicitudes() {
  const [filtro, setFiltro] = useState<Filtro>('PENDIENTE');
  const [datos, setDatos] = useState<RespuestaSolicitudesEquipo | null>(null);
  const [galerias, setGalerias] = useState<GaleriaResumen[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [accion, setAccion] = useState<Accion | null>(null);
  const [mensaje, setMensaje] = useState('');
  const [galeriaElegida, setGaleriaElegida] = useState<Record<string, string>>({});
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());

  const cargar = useCallback(async () => {
    try {
      setDatos(
        await llamarApi<RespuestaSolicitudesEquipo>(
          `/equipo/solicitudes${filtro === 'todas' ? '' : `?estado=${filtro}`}`,
        ),
      );
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos cargar las solicitudes.');
    }
  }, [filtro]);

  useEffect(() => {
    void cargar();
    const reloj = setInterval(() => {
      setAhora(Date.now());
      void cargar();
    }, 30_000);
    return () => clearInterval(reloj);
  }, [cargar]);

  useEffect(() => {
    llamarApi<GaleriaResumen[]>('/galerias').then(setGalerias, () => undefined);
  }, []);

  async function resolver(s: SolicitudEquipo, tipo: 'aprobar' | 'pedir-cambios' | 'rechazar') {
    setTrabajando(s.id);
    setError(null);
    try {
      await llamarApi(`/equipo/solicitudes/${s.id}/${tipo}`, {
        metodo: 'POST',
        cuerpo:
          tipo === 'aprobar'
            ? galeriaElegida[s.id]
              ? { galeria: galeriaElegida[s.id] }
              : {}
            : { mensaje: mensaje.trim() },
      });
      setHecho(
        tipo === 'aprobar'
          ? `Aprobaste a ${s.nombre_comercial}: ya puede entrar con su celular.`
          : tipo === 'rechazar'
            ? `Rechazaste la solicitud de ${s.nombre_comercial}.`
            : `Le pediste un cambio a ${s.nombre_comercial}.`,
      );
      setAccion(null);
      setMensaje('');
      await cargar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No se pudo. Vuelve a intentarlo.');
    } finally {
      setTrabajando(null);
    }
  }

  const resumen = datos?.resumen;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h1 className="text-titulo">Solicitudes de cuenta</h1>
        <p className="text-cuerpo text-secundario">
          Las tiendas que pidieron su cuenta solas. Con RUC activo y habido se aprueban solas y
          quedan aquí por si algo no cuadra.
        </p>
      </div>

      <div role="group" aria-label="Filtrar por estado" className="flex flex-wrap gap-2">
        {FILTROS.map(({ valor, texto }) => {
          const n =
            valor === 'PENDIENTE'
              ? resumen?.pendientes
              : valor === 'REQUIERE_CAMBIOS'
                ? resumen?.requieren_cambios
                : valor === 'APROBADA'
                  ? resumen?.aprobadas
                  : valor === 'RECHAZADA'
                    ? resumen?.rechazadas
                    : undefined;
          return (
            <button
              key={valor}
              type="button"
              aria-pressed={filtro === valor}
              onClick={() => setFiltro(valor)}
              className={`inline-flex h-10 items-center gap-2 rounded-full border px-4 text-apoyo ${
                filtro === valor
                  ? 'border-tinta bg-tinta font-semibold text-white'
                  : 'border-borde bg-white font-medium'
              }`}
            >
              {texto}
              {n !== undefined && <span className="text-nota opacity-80">{n}</span>}
            </button>
          );
        })}
      </div>

      {resumen && resumen.vencidas > 0 && (
        <p
          role="status"
          className="rounded-xl bg-error-fondo p-3 text-apoyo font-semibold text-error"
        >
          {resumen.vencidas === 1
            ? '1 solicitud ya pasó su plazo de 3 horas.'
            : `${resumen.vencidas} solicitudes ya pasaron su plazo de 3 horas.`}
        </p>
      )}
      {hecho && (
        <p role="status" className="rounded-xl bg-ok-fondo p-3 text-apoyo font-semibold text-ok">
          {hecho}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-xl bg-error-fondo p-3 text-apoyo text-error">
          {error}
        </p>
      )}

      {datos && datos.solicitudes.length === 0 && (
        <p className="rounded-2xl border border-linea p-6 text-center text-cuerpo text-detalle">
          {filtro === 'PENDIENTE'
            ? 'Nada por revisar. Las que pasaron solas con RUC están en «Aprobadas».'
            : 'No hay solicitudes en este estado.'}
        </p>
      )}

      <ul className="flex flex-col gap-4">
        {datos?.solicitudes.map((s) => {
          const tiempo = s.estado === 'PENDIENTE' ? plazo(s.vence_en, ahora) : null;
          const abierta = s.estado === 'PENDIENTE' || s.estado === 'REQUIERE_CAMBIOS';
          const ocupada = trabajando === s.id;
          return (
            <li
              key={s.id}
              className="flex flex-col gap-4 rounded-2xl border border-linea bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-seccion">{s.nombre_comercial}</h2>
                  <span className="text-apoyo text-secundario">
                    {s.encargado} · +51 {s.celular}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {s.aprobada_sola && (
                    <span className="rounded-full bg-pase-medio px-3 py-0.5 text-nota font-semibold text-ok">
                      Aprobada sola por el RUC
                    </span>
                  )}
                  <span
                    className={`rounded-full px-3 py-0.5 text-nota font-semibold ${ESTADO[s.estado].clases}`}
                  >
                    {ESTADO[s.estado].texto}
                  </span>
                </div>
              </div>

              {tiempo && (
                <p
                  className={`text-apoyo font-semibold ${tiempo.vencida ? 'text-error' : 'text-aviso'}`}
                >
                  {tiempo.texto}
                </p>
              )}

              <dl className="grid gap-x-8 gap-y-2 text-apoyo sm:grid-cols-2">
                <Dato titulo="Cómo se acredita">{METODO[s.metodo]}</Dato>
                {s.ruc && (
                  <Dato titulo="RUC">
                    {s.ruc}
                    {s.ruc_datos && (
                      <>
                        {' '}
                        · {s.ruc_datos.razon_social} · {s.ruc_datos.estado.toLowerCase()},{' '}
                        {s.ruc_datos.condicion.toLowerCase()}
                      </>
                    )}
                  </Dato>
                )}
                {s.dni && <Dato titulo="DNI del encargado">{s.dni}</Dato>}
                {s.recomienda_tienda && (
                  <Dato titulo="Dice que lo conoce">{s.recomienda_tienda}</Dato>
                )}
                <Dato titulo="Galería y stand">
                  {s.galeria ?? `«${s.galeria_otra}» (no está en la lista)`}
                  {s.piso ? ` · piso ${s.piso}` : ''} · stand {s.stand}
                </Dato>
                {s.referencia && <Dato titulo="Referencia">{s.referencia}</Dato>}
                <Dato titulo="Horario">{s.horario}</Dato>
                <Dato titulo="Vende">{s.categorias.join(', ')}</Dato>
              </dl>

              {s.mensaje_equipo && (
                <p className="rounded-xl bg-superficie p-3 text-apoyo">
                  <b className="font-semibold">Mensaje del equipo:</b> {s.mensaje_equipo}
                </p>
              )}

              {abierta && (
                <div className="flex flex-col gap-3 border-t border-linea pt-4">
                  {s.galeria_otra && !s.galeria && (
                    <label className="flex flex-col gap-1.5 text-apoyo font-medium">
                      Su galería no está en la lista: elige a cuál pertenece para aprobarla
                      <select
                        value={galeriaElegida[s.id] ?? ''}
                        onChange={(e) =>
                          setGaleriaElegida((g) => ({ ...g, [s.id]: e.target.value }))
                        }
                        className={`${campo} max-w-[320px]`}
                      >
                        <option value="">Elegir galería…</option>
                        {galerias.map((g) => (
                          <option key={g.slug} value={g.slug}>
                            {g.nombre}
                          </option>
                        ))}
                      </select>
                      <span className="text-nota text-detalle">
                        ¿Es una galería nueva? Agrégala desde el aviso en{' '}
                        <Link href="/equipo/galerias" className="font-bold text-pase-texto">
                          Galerías
                        </Link>{' '}
                        y queda elegida aquí.
                      </span>
                    </label>
                  )}

                  {accion?.id === s.id ? (
                    <div className="flex flex-col gap-2">
                      <label className="flex flex-col gap-1.5 text-apoyo font-medium">
                        {accion.tipo === 'cambios'
                          ? '¿Qué tiene que corregir? (lo lee quien se registró)'
                          : '¿Por qué no? (lo lee quien se registró)'}
                        <textarea
                          value={mensaje}
                          onChange={(e) => setMensaje(e.target.value)}
                          maxLength={500}
                          rows={3}
                          className="w-full rounded-xl border border-borde p-3 text-cuerpo"
                        />
                      </label>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          disabled={ocupada || mensaje.trim().length < 5}
                          onClick={() =>
                            resolver(s, accion.tipo === 'cambios' ? 'pedir-cambios' : 'rechazar')
                          }
                          className={accion.tipo === 'rechazar' ? botonPeligro : botonPrincipal}
                        >
                          {accion.tipo === 'cambios' ? 'Pedir el cambio' : 'Rechazar'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAccion(null);
                            setMensaje('');
                          }}
                          className={botonSecundario}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={
                          ocupada ||
                          (Boolean(s.galeria_otra) && !s.galeria && !galeriaElegida[s.id])
                        }
                        onClick={() => resolver(s, 'aprobar')}
                        className={botonPrincipal}
                      >
                        Aprobar
                      </button>
                      {s.estado === 'PENDIENTE' && (
                        <button
                          type="button"
                          onClick={() => setAccion({ id: s.id, tipo: 'cambios' })}
                          className={botonLista}
                        >
                          Pedir un cambio
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setAccion({ id: s.id, tipo: 'rechazar' })}
                        className={botonLista}
                      >
                        Rechazar
                      </button>
                    </div>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Dato({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-nota text-detalle">{titulo}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
