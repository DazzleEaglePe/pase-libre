'use client';

import {
  MAX_LIMITE_DISPOSITIVOS,
  type CambioDelEquipo,
  type FichaTienda,
  type RespuestaClaveTienda,
} from '@paselibre/contracts';
import { IconBrandWhatsapp, IconEye, IconEyeOff } from '@tabler/icons-react';
import { useEffect, useId, useState } from 'react';

import { IconoDispositivo, cuandoYDonde } from '@/features/acceso/dispositivo';
import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { cuandoFue } from '@/shared/fechas';

import { botonBorde, botonVerde, campoFicha, ruta, tarjetaFicha } from './comun';

/**
 * Pestaña Acceso (N14): contraseña nueva temporal o definitiva (nunca se ve la de ahora), las
 * sesiones de la cuenta principal con «Cerrar» y «Cerrar todas», y el límite de dispositivos.
 */
export function PestanaAcceso({
  ficha,
  alCambiar,
}: {
  ficha: FichaTienda;
  alCambiar: (ficha: FichaTienda) => void;
}) {
  const id = useId();
  const [tipo, setTipo] = useState<'TEMPORAL' | 'DEFINITIVA'>('TEMPORAL');
  const [clave, setClave] = useState('');
  const [ver, setVer] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [resultado, setResultado] = useState<RespuestaClaveTienda | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [historial, setHistorial] = useState<CambioDelEquipo[] | null>(null);

  useEffect(() => {
    llamarApi<CambioDelEquipo[]>(ruta(ficha.id, '/historial')).then(setHistorial, () =>
      setHistorial([]),
    );
  }, [ficha]);

  async function guardar(conWhatsapp = false) {
    setGuardando(true);
    setError(null);
    try {
      const cuerpo = conWhatsapp || tipo === 'TEMPORAL' ? { tipo: 'TEMPORAL' } : { tipo, clave };
      const respuesta = await llamarApi<RespuestaClaveTienda>(ruta(ficha.id, '/clave'), {
        metodo: 'POST',
        cuerpo,
      });
      setResultado(respuesta);
      setClave('');
      alCambiar(await llamarApi<FichaTienda>(ruta(ficha.id, '/ficha')));
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos cambiar la contraseña.');
    } finally {
      setGuardando(false);
    }
  }

  async function cerrar(sesionId?: string) {
    setError(null);
    try {
      alCambiar(
        sesionId
          ? await llamarApi<FichaTienda>(ruta(ficha.id, `/sesiones/${sesionId}`), {
              metodo: 'DELETE',
            })
          : await llamarApi<FichaTienda>(ruta(ficha.id, '/sesiones/cerrar-todas'), {
              metodo: 'POST',
            }),
      );
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos cerrar la sesión.');
    }
  }

  async function limite(nuevo: number) {
    try {
      alCambiar(
        await llamarApi<FichaTienda>(ruta(ficha.id, '/limite'), {
          metodo: 'PUT',
          cuerpo: { limite: nuevo },
        }),
      );
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos cambiar el límite.');
    }
  }

  const opcion = (valor: 'TEMPORAL' | 'DEFINITIVA', titulo: string, ayuda: string) => (
    <label
      className={`flex cursor-pointer items-start gap-3 rounded-2xl border-[1.5px] px-4 py-3 ${
        tipo === valor ? 'border-pase bg-pase-suave' : 'border-linea'
      }`}
    >
      <input
        type="radio"
        name={`${id}-tipo`}
        checked={tipo === valor}
        onChange={() => setTipo(valor)}
        className="mt-1 h-5 w-5 accent-pase"
      />
      <span className="flex flex-col">
        <b className="font-bold">{titulo}</b>
        <span className="text-nota text-secundario">{ayuda}</span>
      </span>
    </label>
  );

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          void guardar();
        }}
        className={tarjetaFicha}
      >
        <h2 className="text-[18px] font-bold">Nueva contraseña</h2>
        {opcion(
          'TEMPORAL',
          'Temporal',
          'Al entrar le pide cambiarla. Es la que se usa al crear cuentas nuevas.',
        )}
        {opcion(
          'DEFINITIVA',
          'Definitiva',
          'Escribe la que el dueño te dicte. No le pide cambiarla.',
        )}
        {tipo === 'DEFINITIVA' && (
          <label htmlFor={`${id}-clave`} className="flex flex-col gap-1.5 text-apoyo font-bold">
            Contraseña que dictó el dueño
            <span className="relative">
              <input
                id={`${id}-clave`}
                type={ver ? 'text' : 'password'}
                autoComplete="off"
                spellCheck={false}
                required
                minLength={8}
                value={clave}
                onChange={(evento) => setClave(evento.target.value)}
                className={`${campoFicha} pr-12 font-normal`}
              />
              <button
                type="button"
                aria-label={ver ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
                onClick={() => setVer(!ver)}
                className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center text-secundario"
              >
                {ver ? (
                  <IconEye size={19} stroke={1.7} aria-hidden="true" />
                ) : (
                  <IconEyeOff size={19} stroke={1.7} aria-hidden="true" />
                )}
              </button>
            </span>
          </label>
        )}
        <p className="m-0 text-nota text-secundario">
          Al guardar: se cierran todas sus sesiones y le llega el aviso «El Equipo PaseLibre cambió
          tu contraseña. Si no lo pediste, escríbenos».
        </p>
        {error && (
          <p
            role="alert"
            className="m-0 rounded-xl bg-error-fondo px-3.5 py-3 text-apoyo text-error"
          >
            {error}
          </p>
        )}
        {resultado && (
          <div role="status" className="flex flex-col gap-1.5 rounded-xl bg-pase-suave px-3.5 py-3">
            <b className="text-apoyo font-bold">
              Listo: se cerraron {resultado.cerradas}{' '}
              {resultado.cerradas === 1 ? 'sesión' : 'sesiones'}.
            </b>
            {resultado.clave_temporal && (
              <span className="text-apoyo">
                Contraseña temporal (se ve solo ahora):{' '}
                <b className="font-mono">{resultado.clave_temporal}</b>
              </span>
            )}
            {resultado.enlace_whatsapp && resultado.clave_temporal && (
              <a
                href={resultado.enlace_whatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="text-apoyo font-bold text-pase-texto"
              >
                Enviársela por WhatsApp ›
              </a>
            )}
          </div>
        )}
        <div className="flex flex-wrap gap-2.5">
          <button type="submit" disabled={guardando} className={botonVerde}>
            {guardando ? 'Guardando…' : 'Guardar contraseña'}
          </button>
          <button
            type="button"
            disabled={guardando}
            onClick={() => void guardar(true)}
            className={botonBorde}
          >
            <IconBrandWhatsapp size={18} stroke={1.8} aria-hidden="true" />
            Mejor: enviar enlace por WhatsApp
          </button>
        </div>
      </form>

      <div className="flex flex-col gap-4">
        <section aria-label="Sesiones" className={tarjetaFicha}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[18px] font-bold">
              Sesiones · {ficha.sesiones.length} de {ficha.limite_dispositivos}
            </h2>
            {ficha.sesiones.length > 0 && (
              <button type="button" onClick={() => void cerrar()} className={botonBorde}>
                Cerrar todas
              </button>
            )}
          </div>
          {ficha.sesiones.length === 0 && (
            <p className="m-0 text-apoyo text-secundario">No tiene sesiones abiertas.</p>
          )}
          <ul className="m-0 flex list-none flex-col p-0">
            {ficha.sesiones.map((sesion) => (
              <li
                key={sesion.id}
                className="flex items-center gap-3 border-b-[1.5px] border-linea py-3"
              >
                <IconoDispositivo dispositivo={sesion.dispositivo} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="font-bold">{sesion.dispositivo}</b>
                  <span className="text-nota text-secundario">{cuandoYDonde(sesion)}</span>
                </span>
                <button
                  type="button"
                  onClick={() => void cerrar(sesion.id)}
                  className="h-10 text-apoyo font-semibold underline"
                >
                  Cerrar
                </button>
              </li>
            ))}
          </ul>
          <label className="flex items-center justify-between gap-3 text-cuerpo">
            Límite de dispositivos
            <select
              value={ficha.limite_dispositivos}
              onChange={(evento) => void limite(Number(evento.target.value))}
              className="h-10 rounded-xl border-[1.5px] border-linea bg-white px-3 font-bold"
            >
              {Array.from({ length: MAX_LIMITE_DISPOSITIVOS }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        </section>

        <section aria-label="Historial de cambios del Equipo" className={tarjetaFicha}>
          <h2 className="text-[18px] font-bold">Historial de cambios del Equipo</h2>
          <Historial cambios={historial?.slice(0, 5) ?? null} />
        </section>
      </div>
    </div>
  );
}

export function Historial({ cambios }: { cambios: CambioDelEquipo[] | null }) {
  if (cambios === null) return <p className="m-0 text-secundario">Cargando…</p>;
  if (cambios.length === 0) {
    return <p className="m-0 text-apoyo text-secundario">Todavía no hay cambios del Equipo.</p>;
  }
  return (
    <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
      {cambios.map((cambio) => (
        <li key={cambio.id} className="flex items-start justify-between gap-3 text-apoyo">
          <span>{cambio.texto}</span>
          <span className="shrink-0 text-nota text-secundario">{cuandoFue(cambio.fecha)}</span>
        </li>
      ))}
    </ul>
  );
}
