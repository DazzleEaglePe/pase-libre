'use client';

import type { RespuestaSesiones, Rol, SesionAbierta } from '@paselibre/contracts';
import { IconDeviceDesktop, IconLock, IconShieldCheck } from '@tabler/icons-react';
import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';

import { IconoDispositivo, cuandoYDonde } from '@/features/acceso/dispositivo';
import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { botonPrincipal, campo, etiqueta } from '@/shared/ui/estilos';

const tarjeta =
  'flex flex-col gap-3 rounded-[18px] border-[1.5px] border-linea bg-white p-4 sm:p-5';

/**
 * Configuración · Seguridad en tarjetas (N10, RF-60): las sesiones abiertas («2 de 2» en la
 * cuenta principal), cerrar una o todas las demás, la verificación en dos pasos que viene y el
 * cambio de contraseña. La del asesor la pone el dueño: él no la cambia.
 */
export function SeccionSeguridad({
  alAvisar,
  rol,
}: {
  alAvisar: (mensaje: string) => void;
  rol: Rol;
}) {
  const [datos, setDatos] = useState<RespuestaSesiones | null>(null);

  const cargarSesiones = useCallback(() => {
    llamarApi<RespuestaSesiones>('/cuenta/sesiones').then(setDatos, () =>
      setDatos({ sesiones: [], limite: null }),
    );
  }, []);
  useEffect(cargarSesiones, [cargarSesiones]);

  async function cerrar(sesion: SesionAbierta) {
    try {
      await llamarApi(`/cuenta/sesiones/${sesion.id}`, { metodo: 'DELETE' });
      alAvisar(`Cerraste la sesión en ${sesion.dispositivo}.`);
    } finally {
      cargarSesiones();
    }
  }

  async function cerrarOtras() {
    const { cerradas } = await llamarApi<{ cerradas: number }>('/cuenta/sesiones/cerrar-otras', {
      metodo: 'POST',
    });
    alAvisar(cerradas === 1 ? 'Cerraste 1 sesión.' : `Cerraste ${cerradas} sesiones.`);
    cargarSesiones();
  }

  const sesiones = datos?.sesiones ?? [];
  const hayOtras = sesiones.some((s) => !s.actual);

  return (
    <>
      <div className={tarjeta}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-cuerpo font-bold">
            <IconDeviceDesktop size={20} stroke={1.7} className="text-marca" aria-hidden="true" />
            Sesiones abiertas
            {datos && (
              <>
                {' · '}
                {datos.limite === null ? sesiones.length : `${sesiones.length} de ${datos.limite}`}
              </>
            )}
          </h3>
          {hayOtras && (
            <button
              type="button"
              onClick={() => void cerrarOtras()}
              className="inline-flex h-10 items-center rounded-full border-[1.5px] border-tinta bg-white px-4 text-apoyo font-semibold"
            >
              Cerrar todas las demás
            </button>
          )}
        </div>
        {datos === null ? (
          <p className="text-secundario">Cargando…</p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
            {sesiones.map((sesion) => (
              <li
                key={sesion.id}
                className="flex items-center gap-3 rounded-2xl border-[1.5px] border-linea px-3.5 py-3"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-superficie">
                  <IconoDispositivo dispositivo={sesion.dispositivo} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="font-semibold">{sesion.dispositivo}</b>
                  <span className="text-nota text-secundario">
                    {cuandoYDonde(sesion, sesion.actual)}
                  </span>
                </span>
                {sesion.actual ? (
                  <span className="rounded-full bg-ok-fondo px-2.5 text-[12px] font-bold leading-6 text-ok">
                    Esta sesión
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void cerrar(sesion)}
                    className="h-10 text-apoyo font-semibold underline"
                  >
                    Cerrar sesión
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="m-0 text-nota text-secundario">
          Si una sesión se cierra porque entraste desde otro equipo, te llega un aviso. Si no fuiste
          tú, cambia tu contraseña.
        </p>
      </div>

      <div className={tarjeta}>
        <h3 className="flex flex-wrap items-center gap-2 text-cuerpo font-bold">
          <IconShieldCheck size={20} stroke={1.7} className="text-marca" aria-hidden="true" />
          Verificación en dos pasos
          <span className="rounded-full bg-superficie px-2.5 text-[12px] font-bold leading-6 text-secundario">
            Próximamente
          </span>
        </h3>
        <p className="m-0 text-apoyo text-secundario">
          Un código extra al entrar desde otro dispositivo.
        </p>
      </div>

      {rol === 'ASESOR' ? (
        <div className={tarjeta}>
          <h3 className="flex items-center gap-2 text-cuerpo font-bold">
            <IconLock size={20} stroke={1.7} className="text-marca" aria-hidden="true" />
            Contraseña
          </h3>
          <p className="m-0 text-apoyo text-secundario">
            Tu contraseña la pone el dueño de la tienda. Si necesitas una nueva, pídesela a él.
          </p>
        </div>
      ) : (
        <CambiarClave alAvisar={alAvisar} alCambiar={cargarSesiones} />
      )}
    </>
  );
}

function CambiarClave({
  alAvisar,
  alCambiar,
}: {
  alAvisar: (mensaje: string) => void;
  alCambiar: () => void;
}) {
  const id = useId();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function cambiarClave(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setError(null);
    if (nueva !== repetida) {
      setError('Las dos contraseñas nuevas no coinciden.');
      return;
    }
    setGuardando(true);
    try {
      await llamarApi('/sesion/clave', {
        metodo: 'POST',
        cuerpo: { clave_actual: actual, clave_nueva: nueva },
      });
      setActual('');
      setNueva('');
      setRepetida('');
      alAvisar('Cambiaste tu contraseña. Cerramos tus otras sesiones.');
      alCambiar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos cambiar la contraseña.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={cambiarClave} className={tarjeta}>
      <h3 className="flex items-center gap-2 text-cuerpo font-bold">
        <IconLock size={20} stroke={1.7} className="text-marca" aria-hidden="true" />
        Cambiar contraseña
      </h3>
      <div className="grid gap-4 sm:grid-cols-3">
        <label htmlFor={`${id}-actual`} className={etiqueta}>
          Actual
          <input
            id={`${id}-actual`}
            type="password"
            required
            autoComplete="current-password"
            value={actual}
            onChange={(evento) => setActual(evento.target.value)}
            className={campo}
          />
        </label>
        <label htmlFor={`${id}-nueva`} className={etiqueta}>
          Nueva
          <input
            id={`${id}-nueva`}
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={nueva}
            onChange={(evento) => setNueva(evento.target.value)}
            className={campo}
          />
        </label>
        <label htmlFor={`${id}-repetida`} className={etiqueta}>
          Repite la nueva
          <input
            id={`${id}-repetida`}
            type="password"
            required
            autoComplete="new-password"
            value={repetida}
            onChange={(evento) => setRepetida(evento.target.value)}
            className={campo}
          />
        </label>
      </div>
      <span className="text-nota text-detalle">
        Al menos 8 caracteres y un número. Al cambiarla, se cierran tus otras sesiones.
      </span>
      {error && (
        <p role="alert" className="m-0 rounded-xl bg-error-fondo px-3.5 py-3 text-apoyo text-error">
          {error}
        </p>
      )}
      <button type="submit" disabled={guardando} className={`${botonPrincipal} self-start`}>
        {guardando ? 'Cambiando…' : 'Cambiar contraseña'}
      </button>
    </form>
  );
}
