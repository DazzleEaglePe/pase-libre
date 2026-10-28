'use client';

import type { SesionAbierta } from '@paselibre/contracts';
import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { haceRato } from '@/shared/fechas';
import { botonLista, botonPrincipal, campo, etiqueta } from '@/shared/ui/estilos';

function IconoDispositivo({ celular }: { celular: boolean }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {celular ? (
        <>
          <rect x="7" y="2" width="10" height="20" rx="2" />
          <path d="M11 18h2" />
        </>
      ) : (
        <>
          <rect x="3" y="4" width="18" height="12" rx="2" />
          <path d="M8 20h8M12 16v4" />
        </>
      )}
    </svg>
  );
}

/**
 * Configuración · Seguridad (RF-60): cambiar la contraseña y ver las sesiones abiertas,
 * útil cuando alguien entró desde la computadora de otra tienda y no salió.
 */
export function SeccionSeguridad({ alAvisar }: { alAvisar: (mensaje: string) => void }) {
  const id = useId();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [sesiones, setSesiones] = useState<SesionAbierta[] | null>(null);

  const cargarSesiones = useCallback(() => {
    llamarApi<SesionAbierta[]>('/cuenta/sesiones').then(setSesiones, () => setSesiones([]));
  }, []);
  useEffect(cargarSesiones, [cargarSesiones]);

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
      cargarSesiones();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos cambiar la contraseña.');
    } finally {
      setGuardando(false);
    }
  }

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

  const otras = sesiones?.filter((s) => !s.actual) ?? [];

  return (
    <>
      <form onSubmit={cambiarClave} className="flex flex-col gap-4">
        <b className="text-tarjeta">Cambiar contraseña</b>
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
          <p role="alert" className="rounded-xl bg-error-fondo px-3.5 py-3 text-apoyo text-error">
            {error}
          </p>
        )}
        <button type="submit" disabled={guardando} className={`${botonPrincipal} self-start`}>
          {guardando ? 'Cambiando…' : 'Cambiar contraseña'}
        </button>
      </form>

      <div className="flex flex-col gap-2 border-t border-linea pt-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <b className="text-tarjeta">Sesiones abiertas</b>
          {otras.length > 0 && (
            <button type="button" onClick={() => void cerrarOtras()} className={botonLista}>
              Cerrar todas las demás
            </button>
          )}
        </div>
        {sesiones === null ? (
          <p className="text-secundario">Cargando…</p>
        ) : (
          <ul className="flex flex-col">
            {sesiones.map((sesion) => (
              <li
                key={sesion.id}
                className="flex items-center gap-3 border-b border-linea py-3 last:border-0"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-superficie">
                  <IconoDispositivo celular={/Android|iPhone/.test(sesion.dispositivo)} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="font-medium">{sesion.dispositivo}</b>
                  <span className="text-nota text-detalle">
                    {sesion.actual
                      ? 'Ahora'
                      : `Última vez: ${haceRato(sesion.ultimo_uso).toLowerCase()}`}
                  </span>
                </span>
                {sesion.actual ? (
                  <span className="rounded-full bg-lima-suave px-2.5 text-[12px] font-semibold leading-6 text-ok">
                    Esta sesión
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void cerrar(sesion)}
                    className="h-10 text-apoyo font-medium underline"
                  >
                    Cerrar sesión
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-superficie px-4 py-3.5">
        <span className="flex flex-col">
          <b className="font-semibold">Verificación en dos pasos</b>
          <span className="text-apoyo text-secundario">
            Un código extra al entrar desde otro dispositivo.
          </span>
        </span>
        <span className="rounded-full bg-white px-3 text-[12px] font-semibold leading-6 text-secundario">
          Próximamente
        </span>
      </div>
    </>
  );
}
