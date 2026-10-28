'use client';

import type {
  CuentaEquipo,
  EstadoCuenta,
  GaleriaResumen,
  RespuestaAcceso,
  RespuestaCuentas,
} from '@paselibre/contracts';
import { useCallback, useEffect, useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import {
  botonLista,
  botonPeligro,
  botonPrincipal,
  botonSecundario,
  enlaceBoton,
} from '@/shared/ui/estilos';
import { Ventana } from '@/shared/ui/ventana';

import { AccesoEnviado } from './acceso-enviado';
import { FormularioCuenta } from './formulario-cuenta';

type Filtro = 'todas' | 'activa' | 'sin_primer_ingreso' | 'suspendida';

const ESTADOS: Record<EstadoCuenta, { texto: string; clases: string }> = {
  ACTIVA: { texto: 'Activa', clases: 'bg-ok-fondo text-ok' },
  SIN_PRIMER_INGRESO: { texto: 'Sin primer ingreso', clases: 'bg-aviso-fondo text-aviso' },
  SUSPENDIDA: { texto: 'Suspendida', clases: 'bg-superficie text-secundario' },
};

const TIPO_DE_CUENTA = { DUENO: 'Dueño de tienda', ASESOR: 'Asesor' } as const;

type Confirmacion = { cuenta: CuentaEquipo; accion: 'clave' | 'suspender' };

const columnas =
  'lg:grid lg:grid-cols-[minmax(0,1.5fr)_120px_minmax(0,1fr)_130px_110px_150px_minmax(260px,auto)] lg:items-center lg:gap-x-4';

/** Cuentas del piloto (RF-49), con las acciones de la fila según su estado. */
export function PanelCuentas() {
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [galeria, setGaleria] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [consulta, setConsulta] = useState('');
  const [datos, setDatos] = useState<RespuestaCuentas | null>(null);
  const [galerias, setGalerias] = useState<GaleriaResumen[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [acceso, setAcceso] = useState<RespuestaAcceso | null>(null);
  const [confirmar, setConfirmar] = useState<Confirmacion | null>(null);
  const [trabajando, setTrabajando] = useState<string | null>(null);

  // Espera a que se termine de escribir antes de buscar.
  useEffect(() => {
    const espera = setTimeout(() => setConsulta(busqueda.trim()), 300);
    return () => clearTimeout(espera);
  }, [busqueda]);

  const cargar = useCallback(async () => {
    const parametros = new URLSearchParams({ estado: filtro });
    if (galeria) parametros.set('galeria', galeria);
    if (consulta) parametros.set('q', consulta);
    try {
      setDatos(await llamarApi<RespuestaCuentas>(`/equipo/cuentas?${parametros}`));
      setError(null);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos cargar las cuentas.');
    }
  }, [filtro, galeria, consulta]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  useEffect(() => {
    void llamarApi<GaleriaResumen[]>('/galerias').then(setGalerias);
  }, []);

  async function claveTemporal(cuenta: CuentaEquipo) {
    setTrabajando(cuenta.id);
    try {
      setAcceso(
        await llamarApi<RespuestaAcceso>(`/equipo/cuentas/${cuenta.id}/clave-temporal`, {
          metodo: 'POST',
        }),
      );
      await cargar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos generar la clave.');
    } finally {
      setTrabajando(null);
    }
  }

  async function cambiarEstado(cuenta: CuentaEquipo, estado: 'ACTIVA' | 'SUSPENDIDA') {
    setTrabajando(cuenta.id);
    try {
      await llamarApi(`/equipo/cuentas/${cuenta.id}`, { metodo: 'PATCH', cuerpo: { estado } });
      await cargar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos cambiar el estado.');
    } finally {
      setTrabajando(null);
    }
  }

  const resumen = datos?.resumen;
  const pestanas: Array<[Filtro, string, number | undefined]> = [
    ['todas', 'Todas', resumen?.total],
    ['activa', 'Activas', resumen?.activas],
    ['sin_primer_ingreso', 'Sin primer ingreso', resumen?.sin_primer_ingreso],
    ['suspendida', 'Suspendidas', resumen?.suspendidas],
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-titulo">Cuentas del piloto</h1>
          <span className="text-apoyo text-secundario">
            {resumen
              ? `${resumen.total} cuentas · ${resumen.activas} activas · ${resumen.sin_primer_ingreso} sin primer ingreso`
              : 'Cargando…'}
          </span>
        </div>
        <button type="button" onClick={() => setCreando(true)} className={botonPrincipal}>
          Crear cuenta
        </button>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-linea">
        <div role="tablist" aria-label="Estado de la cuenta" className="flex flex-wrap gap-x-6">
          {pestanas.map(([valor, texto, cantidad]) => (
            <button
              key={valor}
              type="button"
              role="tab"
              aria-selected={filtro === valor}
              onClick={() => setFiltro(valor)}
              className={`-mb-px h-11 border-b-2 text-apoyo ${
                filtro === valor
                  ? 'border-tinta font-semibold text-tinta'
                  : 'border-transparent font-medium text-secundario'
              }`}
            >
              {texto}
              {cantidad !== undefined && (
                <span className="ml-1.5 font-normal text-detalle">{cantidad}</span>
              )}
            </button>
          ))}
        </div>
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-apoyo text-secundario">
            Galería
            <select
              value={galeria}
              onChange={(e) => setGaleria(e.target.value)}
              className="h-10 rounded-[10px] border border-borde bg-white px-2.5 text-apoyo font-medium text-tinta"
            >
              <option value="">Todas</option>
              {galerias.map((g) => (
                <option key={g.slug} value={g.slug}>
                  {g.nombre}
                </option>
              ))}
            </select>
          </label>
          <input
            type="search"
            aria-label="Buscar por tienda, persona o usuario"
            placeholder="Buscar tienda, persona o usuario"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="h-10 w-64 max-w-full rounded-full border border-borde px-4 text-apoyo"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-error-fondo px-3.5 py-3 text-apoyo text-error">
          {error}
        </p>
      )}

      <div role="table" aria-label="Cuentas" className="-mt-2 flex flex-col">
        <div
          role="row"
          className={`hidden min-h-10 border-b border-linea text-nota font-semibold text-detalle ${columnas}`}
        >
          <span role="columnheader">Tienda y persona</span>
          <span role="columnheader">Tipo</span>
          <span role="columnheader">Galería · stand</span>
          <span role="columnheader">Usuario</span>
          <span role="columnheader">WhatsApp</span>
          <span role="columnheader">Estado</span>
          <span role="columnheader" className="sr-only">
            Acciones
          </span>
        </div>
        {datos?.cuentas.map((cuenta) => {
          const estado = ESTADOS[cuenta.estado];
          const ocupado = trabajando === cuenta.id;
          return (
            <div
              key={cuenta.id}
              role="row"
              className={`flex flex-col gap-2 border-b border-linea py-4 lg:min-h-[68px] lg:py-2 ${columnas}`}
            >
              <span role="cell" className="flex min-w-0 flex-col">
                <span className="text-cuerpo font-medium">{cuenta.tienda.nombre}</span>
                <span className="text-nota text-detalle">{cuenta.nombre}</span>
              </span>
              <span role="cell" className="text-apoyo text-secundario">
                {cuenta.tienda.tipo === 'INDEPENDIENTE'
                  ? 'Independiente'
                  : TIPO_DE_CUENTA[cuenta.rol]}
              </span>
              <span role="cell" className="text-apoyo text-secundario">
                {[cuenta.tienda.galeria ?? 'Sin galería', cuenta.tienda.stand]
                  .filter(Boolean)
                  .join(' · ')}
              </span>
              <span role="cell" className="font-mono text-nota">
                {cuenta.usuario}
              </span>
              <span role="cell" className="text-apoyo text-secundario">
                {cuenta.whatsapp ?? '—'}
              </span>
              <span role="cell" className="flex flex-col items-start gap-1">
                <span
                  className={`rounded-full px-2.5 text-nota font-medium leading-6 ${estado.clases}`}
                >
                  {estado.texto}
                </span>
                {cuenta.clave_temporal_pendiente && (
                  <span className="text-nota text-detalle">Clave temporal sin cambiar</span>
                )}
              </span>
              <span
                role="cell"
                className="flex flex-wrap items-center gap-x-4 gap-y-2 lg:justify-end"
              >
                {cuenta.estado === 'SUSPENDIDA' ? (
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => cambiarEstado(cuenta, 'ACTIVA')}
                    className={botonLista}
                  >
                    Reactivar
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() =>
                        cuenta.estado === 'SIN_PRIMER_INGRESO'
                          ? claveTemporal(cuenta)
                          : setConfirmar({ cuenta, accion: 'clave' })
                      }
                      className={botonLista}
                    >
                      {cuenta.estado === 'SIN_PRIMER_INGRESO'
                        ? 'Reenviar acceso'
                        : 'Nueva contraseña'}
                    </button>
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => setConfirmar({ cuenta, accion: 'suspender' })}
                      className={enlaceBoton}
                    >
                      Suspender
                    </button>
                  </>
                )}
              </span>
            </div>
          );
        })}
        {datos && datos.cuentas.length === 0 && (
          <p className="py-8 text-secundario">No hay cuentas con estos filtros.</p>
        )}
      </div>
      <p className="text-nota text-detalle">
        «Sin primer ingreso» quiere decir que la persona aún no entró ni cambió la contraseña
        temporal. Reenvía el acceso por WhatsApp si pasa más de un día.
      </p>

      <Ventana
        titulo={acceso ? 'Cuenta creada' : 'Crear cuenta'}
        abierta={creando}
        lateral
        alCerrar={() => {
          setCreando(false);
          setAcceso(null);
        }}
      >
        {creando && !acceso && (
          <FormularioCuenta
            alCancelar={() => setCreando(false)}
            alCrear={(nuevo) => {
              setAcceso(nuevo);
              void cargar();
            }}
          />
        )}
        {creando && acceso && (
          <AccesoEnviado
            acceso={acceso}
            alTerminar={() => {
              setCreando(false);
              setAcceso(null);
            }}
          />
        )}
      </Ventana>

      <Ventana
        titulo="Acceso nuevo"
        abierta={!creando && acceso !== null}
        alCerrar={() => setAcceso(null)}
      >
        {!creando && acceso && <AccesoEnviado acceso={acceso} alTerminar={() => setAcceso(null)} />}
      </Ventana>

      <Ventana
        titulo={
          confirmar?.accion === 'suspender'
            ? '¿Suspender esta cuenta?'
            : '¿Darle una contraseña nueva?'
        }
        abierta={confirmar !== null}
        alCerrar={() => setConfirmar(null)}
      >
        {confirmar && (
          <div className="flex flex-col gap-4">
            <p className="text-secundario">
              {confirmar.accion === 'suspender'
                ? `${confirmar.cuenta.nombre} (${confirmar.cuenta.tienda.nombre}) no podrá entrar y se cerrarán sus sesiones. Sus publicaciones siguen a la vista; puedes reactivarla cuando quieras.`
                : `La contraseña actual de ${confirmar.cuenta.nombre} deja de servir y se cierran sus sesiones. Le enviarás una temporal por WhatsApp.`}
            </p>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmar(null)} className={botonSecundario}>
                Cancelar
              </button>
              <button
                type="button"
                className={confirmar.accion === 'suspender' ? botonPeligro : botonPrincipal}
                onClick={() => {
                  const { cuenta, accion } = confirmar;
                  setConfirmar(null);
                  void (accion === 'suspender'
                    ? cambiarEstado(cuenta, 'SUSPENDIDA')
                    : claveTemporal(cuenta));
                }}
              >
                {confirmar.accion === 'suspender' ? 'Suspender' : 'Generar contraseña'}
              </button>
            </div>
          </div>
        )}
      </Ventana>
    </div>
  );
}
