'use client';

import type { MiCuentaEquipo, RespuestaSesiones, SesionAbierta } from '@paselibre/contracts';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';

import { IconoDispositivo, cuandoYDonde } from '@/features/acceso/dispositivo';
import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { botonPrincipal, campo, etiqueta } from '@/shared/ui/estilos';

const tarjeta = 'flex flex-col gap-3 rounded-[16px] border border-linea bg-white p-4 sm:p-5';

function Aviso({ ok, texto }: { ok: boolean; texto: string }) {
  return (
    <p
      role={ok ? 'status' : 'alert'}
      className={`m-0 rounded-xl px-3.5 py-3 text-apoyo ${
        ok ? 'bg-pase-suave text-pase-texto' : 'bg-error-fondo text-error'
      }`}
    >
      {texto}
    </p>
  );
}

/**
 * «Mi cuenta» del Equipo (doc 19, punto 7): tus datos, tu contraseña, tus sesiones y tu rol. Cada
 * persona del Equipo ve solo la suya. La contraseña y las sesiones usan los mismos pedidos que
 * Configuración › Seguridad de las tiendas.
 */
export function MiCuentaDelEquipo({ datos: iniciales }: { datos: MiCuentaEquipo }) {
  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-titulo">Mi cuenta</h1>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)]">
        <TusDatos iniciales={iniciales} />
        <CambiarClave />
        <div className="flex flex-col gap-4">
          <SesionesAbiertas />
          <section aria-labelledby="tu-rol" className={tarjeta}>
            <h2 id="tu-rol" className="text-[16px] font-bold">
              Tu rol
            </h2>
            <span className="text-apoyo">Administrador</span>
            <span className="text-nota text-secundario">Lo cambia solo otro administrador.</span>
          </section>
        </div>
      </div>
    </div>
  );
}

function TusDatos({ iniciales }: { iniciales: MiCuentaEquipo }) {
  const id = useId();
  const router = useRouter();
  const [guardados, setGuardados] = useState(iniciales);
  const [nombre, setNombre] = useState(iniciales.nombre);
  const [usuario, setUsuario] = useState(iniciales.usuario);
  const [correo, setCorreo] = useState(iniciales.correo ?? '');
  const [estado, setEstado] = useState<{ ok: boolean; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const cambios = {
      ...(nombre.trim() !== guardados.nombre ? { nombre } : {}),
      ...(usuario.trim().toLowerCase() !== guardados.usuario ? { usuario } : {}),
      ...(correo.trim() !== (guardados.correo ?? '') ? { correo } : {}),
    };
    if (Object.keys(cambios).length === 0) {
      setEstado({ ok: true, texto: 'No hay cambios.' });
      return;
    }
    setGuardando(true);
    setEstado(null);
    try {
      const nuevos = await llamarApi<MiCuentaEquipo>('/equipo/mi-cuenta', {
        metodo: 'PATCH',
        cuerpo: cambios,
      });
      setGuardados(nuevos);
      setNombre(nuevos.nombre);
      setUsuario(nuevos.usuario);
      setCorreo(nuevos.correo ?? '');
      setEstado({ ok: true, texto: 'Guardamos tus datos.' });
      // El nombre de la barra de arriba también cambia.
      router.refresh();
    } catch (e) {
      setEstado({
        ok: false,
        texto: e instanceof ErrorApi ? e.message : 'No pudimos guardar tus datos.',
      });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={(evento) => void guardar(evento)} className={tarjeta}>
      <h2 className="text-[16px] font-bold">Tus datos</h2>
      <label htmlFor={`${id}-nombre`} className={etiqueta}>
        Nombre
        <input
          id={`${id}-nombre`}
          required
          minLength={2}
          maxLength={120}
          autoComplete="name"
          value={nombre}
          onChange={(evento) => setNombre(evento.target.value)}
          className={campo}
        />
      </label>
      <label htmlFor={`${id}-usuario`} className={etiqueta}>
        Usuario para ingresar
        <input
          id={`${id}-usuario`}
          required
          autoCapitalize="none"
          spellCheck={false}
          autoComplete="username"
          value={usuario}
          onChange={(evento) => setUsuario(evento.target.value)}
          className={`${campo} font-mono text-apoyo`}
        />
      </label>
      <label htmlFor={`${id}-correo`} className={etiqueta}>
        <span>
          Correo <span className="font-normal text-detalle">(opcional)</span>
        </span>
        <input
          id={`${id}-correo`}
          type="email"
          autoComplete="email"
          value={correo}
          onChange={(evento) => setCorreo(evento.target.value)}
          className={campo}
        />
      </label>
      {estado && <Aviso {...estado} />}
      <button type="submit" disabled={guardando} className={`${botonPrincipal} self-start`}>
        {guardando ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  );
}

function CambiarClave() {
  const id = useId();
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [estado, setEstado] = useState<{ ok: boolean; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function cambiar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEstado(null);
    if (nueva !== repetida) {
      setEstado({ ok: false, texto: 'Las dos contraseñas nuevas no coinciden.' });
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
      setEstado({ ok: true, texto: 'Cambiaste tu contraseña. Cerramos tus otras sesiones.' });
      window.dispatchEvent(new Event(SESIONES_CAMBIARON));
    } catch (e) {
      setEstado({
        ok: false,
        texto: e instanceof ErrorApi ? e.message : 'No pudimos cambiar la contraseña.',
      });
    } finally {
      setGuardando(false);
    }
  }

  const campoClave = (
    sufijo: string,
    texto: string,
    valor: string,
    alCambiar: (valor: string) => void,
    autoComplete: string,
  ) => (
    <label htmlFor={`${id}-${sufijo}`} className={etiqueta}>
      {texto}
      <input
        id={`${id}-${sufijo}`}
        type="password"
        required
        minLength={sufijo === 'actual' ? undefined : 8}
        autoComplete={autoComplete}
        value={valor}
        onChange={(evento) => alCambiar(evento.target.value)}
        className={campo}
      />
    </label>
  );

  return (
    <form onSubmit={(evento) => void cambiar(evento)} className={tarjeta}>
      <h2 className="text-[16px] font-bold">Cambiar contraseña</h2>
      {campoClave('actual', 'Contraseña actual', actual, setActual, 'current-password')}
      {campoClave('nueva', 'Contraseña nueva', nueva, setNueva, 'new-password')}
      {campoClave('repetida', 'Repite la nueva', repetida, setRepetida, 'new-password')}
      <span className="text-nota text-secundario">
        Al menos 8 caracteres y un número. Al guardar se cierran tus sesiones en los otros equipos.
      </span>
      {estado && <Aviso {...estado} />}
      <button type="submit" disabled={guardando} className={`${botonPrincipal} self-start`}>
        {guardando ? 'Cambiando…' : 'Cambiar contraseña'}
      </button>
    </form>
  );
}

/** Al cambiar la contraseña se cierran las otras sesiones: la lista se vuelve a pedir. */
const SESIONES_CAMBIARON = 'paselibre:sesiones-equipo';

function SesionesAbiertas() {
  const [sesiones, setSesiones] = useState<SesionAbierta[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(() => {
    llamarApi<RespuestaSesiones>('/cuenta/sesiones').then(
      (datos) => setSesiones(datos.sesiones),
      () => setSesiones([]),
    );
  }, []);

  useEffect(() => {
    cargar();
    window.addEventListener(SESIONES_CAMBIARON, cargar);
    return () => window.removeEventListener(SESIONES_CAMBIARON, cargar);
  }, [cargar]);

  async function cerrar(sesion: SesionAbierta) {
    setError(null);
    try {
      await llamarApi(`/cuenta/sesiones/${sesion.id}`, { metodo: 'DELETE' });
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos cerrar la sesión.');
    } finally {
      cargar();
    }
  }

  return (
    <section aria-labelledby="sesiones-abiertas" className={tarjeta}>
      <h2 id="sesiones-abiertas" className="text-[16px] font-bold">
        Sesiones abiertas
      </h2>
      {sesiones === null ? (
        <p className="m-0 text-secundario">Cargando…</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {sesiones.map((sesion) => (
            <li key={sesion.id} className="flex items-center gap-2.5 text-apoyo">
              <IconoDispositivo dispositivo={sesion.dispositivo} size={18} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-semibold">
                  {sesion.actual ? `Este equipo · ${sesion.dispositivo}` : sesion.dispositivo}
                </span>
                <span className="text-nota text-secundario">
                  {cuandoYDonde(sesion, sesion.actual)}
                </span>
              </span>
              {!sesion.actual && (
                <button
                  type="button"
                  onClick={() => void cerrar(sesion)}
                  className="h-9 text-apoyo font-semibold text-pase-texto underline"
                >
                  Cerrar
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {error && <Aviso ok={false} texto={error} />}
    </section>
  );
}
