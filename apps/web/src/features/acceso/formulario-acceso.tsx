'use client';

import type { RespuestaYo } from '@paselibre/contracts';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { enlaceWhatsappEquipo } from '@/shared/whatsapp-equipo';

type Pestana = 'ingresar' | 'crear';

/** El equipo entra directo a su panel; las tiendas, a la portada. */
function inicioPara(yo: RespuestaYo): string {
  return yo.usuario.rol === 'EQUIPO' ? '/equipo/cuentas' : '/';
}

const campo =
  'h-12 rounded-xl border border-borde px-3.5 text-cuerpo font-normal text-tinta placeholder:text-detalle';
const botonPrincipal =
  'h-12 rounded-full bg-pase text-cuerpo font-semibold text-white disabled:bg-borde-control';
const botonSecundario =
  'flex h-12 items-center justify-center rounded-full border border-borde text-cuerpo font-semibold no-underline';
const enlaceBoton = 'h-9 self-start text-apoyo font-medium underline';

/**
 * Pantalla «Iniciar sesión y primer ingreso» del lienzo (F_Acceso): ingresar con
 * usuario o correo (RF-02), «Crear cuenta» en mantenimiento (RF-43), contraseña
 * olvidada por el equipo (RF-50) y la clave propia en el primer ingreso.
 */
export function FormularioAcceso({
  primerIngreso,
  pestanaInicial,
}: {
  /** Usuario con la clave temporal todavía activa, o nulo. */
  primerIngreso: string | null;
  pestanaInicial: Pestana;
}) {
  const router = useRouter();
  const [paso, setPaso] = useState<'login' | 'primer' | 'listo'>(
    primerIngreso ? 'primer' : 'login',
  );
  const [usuarioPrimer, setUsuarioPrimer] = useState(primerIngreso ?? '');
  const [destino, setDestino] = useState('/');

  if (paso === 'primer') {
    return (
      <CrearClave
        usuario={usuarioPrimer}
        alTerminar={(yo) => {
          setDestino(inicioPara(yo));
          setPaso('listo');
        }}
      />
    );
  }
  if (paso === 'listo') {
    return (
      <div className="flex flex-col gap-4">
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#0B6B4A"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12l3 3 5-6" />
        </svg>
        <h1 className="text-titulo">Listo, ya entraste</h1>
        <p className="text-secundario">
          Tu contraseña quedó guardada. Puedes cambiarla cuando quieras en Configuración ›
          Seguridad.
        </p>
        <button type="button" className={botonPrincipal} onClick={() => router.replace(destino)}>
          Ir al inicio
        </button>
      </div>
    );
  }
  return (
    <Ingreso
      pestanaInicial={pestanaInicial}
      alIngresar={(yo) => {
        if (yo.usuario.debe_cambiar_clave) {
          setUsuarioPrimer(yo.usuario.usuario);
          setPaso('primer');
        } else {
          router.replace(inicioPara(yo));
          router.refresh();
        }
      }}
    />
  );
}

function Ingreso({
  pestanaInicial,
  alIngresar,
}: {
  pestanaInicial: Pestana;
  alIngresar: (yo: RespuestaYo) => void;
}) {
  const [pestana, setPestana] = useState<Pestana>(pestanaInicial);
  const [usuario, setUsuario] = useState('');
  const [clave, setClave] = useState('');
  const [verClave, setVerClave] = useState(false);
  const [recordar, setRecordar] = useState(true);
  const [olvide, setOlvide] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const whatsappClave = enlaceWhatsappEquipo(
    'Hola, olvidé mi contraseña de PaseLibre. Mi usuario es: ',
  );
  const whatsappCuenta = enlaceWhatsappEquipo(
    'Hola, quiero una cuenta de PaseLibre para mi tienda.',
  );

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!usuario.trim() || !clave) {
      setError('Escribe tu correo o usuario y tu contraseña.');
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      alIngresar(
        await llamarApi<RespuestaYo>('/sesion', {
          metodo: 'POST',
          cuerpo: { usuario, clave, recordar },
        }),
      );
    } catch (e) {
      setError(
        e instanceof ErrorApi ? e.message : 'No pudimos iniciar sesión. Vuelve a intentarlo.',
      );
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="Acceso" className="grid grid-cols-2 border-b border-linea">
        {(
          [
            ['ingresar', 'Iniciar sesión'],
            ['crear', 'Crear cuenta'],
          ] as const
        ).map(([clavePestana, texto]) => {
          const activa = pestana === clavePestana;
          return (
            <button
              key={clavePestana}
              type="button"
              role="tab"
              aria-selected={activa}
              onClick={() => {
                setPestana(clavePestana);
                setError(null);
              }}
              className={`-mb-px h-12 border-b-2 text-cuerpo ${
                activa
                  ? 'border-tinta font-semibold text-tinta'
                  : 'border-transparent font-medium text-secundario'
              }`}
            >
              {texto}
            </button>
          );
        })}
      </div>

      {pestana === 'ingresar' ? (
        <form onSubmit={enviar} noValidate className="flex flex-col gap-[18px]">
          <div className="flex flex-col gap-1">
            <h1 className="text-titulo">Inicia sesión</h1>
            <p className="text-apoyo text-secundario">Para ver precios y escribir a las tiendas.</p>
          </div>
          {error && (
            <p role="alert" className="rounded-xl bg-error-fondo px-3.5 py-3 text-apoyo text-error">
              {error}
            </p>
          )}
          <label htmlFor="usuario" className="flex flex-col gap-1.5 text-apoyo font-medium">
            Correo o usuario
            <input
              id="usuario"
              type="text"
              name="usuario"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              className={campo}
            />
          </label>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="clave" className="text-apoyo font-medium">
              Contraseña
            </label>
            <div className="flex h-12 items-center overflow-hidden rounded-xl border border-borde">
              <input
                id="clave"
                name="clave"
                type={verClave ? 'text' : 'password'}
                autoComplete="current-password"
                value={clave}
                onChange={(e) => setClave(e.target.value)}
                className="h-full min-w-0 flex-1 bg-transparent px-3.5 text-cuerpo"
              />
              <button
                type="button"
                aria-pressed={verClave}
                onClick={() => setVerClave(!verClave)}
                className="h-full px-3.5 text-apoyo font-medium"
              >
                {verClave ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>
          <label className="flex min-h-9 items-center gap-2.5 text-apoyo">
            <input
              type="checkbox"
              checked={recordar}
              onChange={(e) => setRecordar(e.target.checked)}
              className="h-[18px] w-[18px] accent-tinta"
            />
            Mantener la sesión en este equipo
          </label>
          <button type="submit" disabled={enviando} className={botonPrincipal}>
            {enviando ? 'Ingresando…' : 'Ingresar'}
          </button>
          <button
            type="button"
            aria-expanded={olvide}
            onClick={() => setOlvide(!olvide)}
            className={enlaceBoton}
          >
            ¿Olvidaste tu contraseña?
          </button>
          {olvide && (
            <div className="flex flex-col gap-2.5 rounded-xl border border-linea p-4">
              <b className="text-cuerpo font-semibold">Pídesela al equipo de PaseLibre</b>
              <span className="text-apoyo text-secundario">
                Por ahora no hay recuperación por correo. Escríbenos por WhatsApp con tu usuario y
                te damos una contraseña nueva; al entrar te pediremos cambiarla.
              </span>
              {whatsappClave && (
                <a
                  href={whatsappClave}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex h-10 items-center self-start rounded-full border border-borde px-4 text-apoyo font-medium no-underline"
                >
                  Escribir al equipo
                </a>
              )}
            </div>
          )}
        </form>
      ) : (
        <div className="flex flex-col gap-4">
          <h1 className="text-titulo">Crear cuenta</h1>
          <div className="flex flex-col gap-2 rounded-2xl border border-linea p-5">
            <b className="text-tarjeta">Estamos en mantenimiento; pronto podrás crear tu cuenta</b>
            <span className="text-apoyo text-secundario">
              Mientras dura el piloto, el equipo de PaseLibre crea las cuentas de las tiendas de
              Wilson y te las entrega por WhatsApp.
            </span>
          </div>
          {whatsappCuenta && (
            <a
              href={whatsappCuenta}
              target="_blank"
              rel="noopener noreferrer"
              className={botonSecundario}
            >
              Pedir una cuenta por WhatsApp
            </a>
          )}
          <button
            type="button"
            onClick={() => setPestana('ingresar')}
            className={`${enlaceBoton} self-center`}
          >
            Ya tengo cuenta
          </button>
        </div>
      )}
    </div>
  );
}

function CrearClave({
  usuario,
  alTerminar,
}: {
  usuario: string;
  alTerminar: (yo: RespuestaYo) => void;
}) {
  const [nueva, setNueva] = useState('');
  const [repite, setRepite] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  // Mismas reglas que `claveNuevaSchema` de los contratos.
  const largo = nueva.length >= 8;
  const conNumero = /\d/.test(nueva);
  const coincide = nueva !== '' && nueva === repite;
  const valida = largo && conNumero && coincide;

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!valida) return;
    setEnviando(true);
    setError(null);
    try {
      const yo = await llamarApi<RespuestaYo>('/sesion/clave', {
        metodo: 'POST',
        cuerpo: { clave_nueva: nueva },
      });
      alTerminar(yo);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos guardar la contraseña.');
      setEnviando(false);
    }
  }

  const reglas = [
    { ok: largo, texto: 'Al menos 8 caracteres' },
    { ok: conNumero, texto: 'Al menos un número' },
  ];

  return (
    <form onSubmit={guardar} className="flex flex-col gap-[18px]">
      <div className="flex flex-col gap-1">
        <span className="text-nota text-detalle">Primer ingreso · {usuario}</span>
        <h1 className="text-titulo">Crea tu contraseña</h1>
        <p className="text-apoyo text-secundario">
          La que te dio el equipo es temporal. Cámbiala por una que solo tú sepas.
        </p>
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-error-fondo px-3.5 py-3 text-apoyo text-error">
          {error}
        </p>
      )}
      <label className="flex flex-col gap-1.5 text-apoyo font-medium">
        Contraseña nueva
        <input
          type="password"
          autoComplete="new-password"
          value={nueva}
          onChange={(e) => setNueva(e.target.value)}
          className={campo}
        />
      </label>
      <ul className="-mt-1.5 flex flex-col gap-1 text-nota">
        {reglas.map((regla) => (
          <li
            key={regla.texto}
            className={`flex items-center gap-2 ${regla.ok ? 'text-ok' : 'text-detalle'}`}
          >
            <span aria-hidden="true" className="w-3.5 text-center">
              {regla.ok ? '✓' : '·'}
            </span>
            {regla.texto}
            <span className="sr-only">{regla.ok ? ', cumplido' : ', falta'}</span>
          </li>
        ))}
      </ul>
      <label className="flex flex-col gap-1.5 text-apoyo font-medium">
        Repite la contraseña
        <input
          type="password"
          autoComplete="new-password"
          value={repite}
          onChange={(e) => setRepite(e.target.value)}
          className={campo}
        />
      </label>
      {repite !== '' && !coincide && (
        <p role="alert" className="-mt-2 text-nota text-error">
          Las contraseñas no coinciden.
        </p>
      )}
      <button type="submit" disabled={!valida || enviando} className={botonPrincipal}>
        {enviando ? 'Guardando…' : 'Guardar y entrar'}
      </button>
    </form>
  );
}
