'use client';

import type { RespuestaYo } from '@paselibre/contracts';
import { IconBrandWhatsapp, IconLock } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent, type ReactNode } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { iniciales } from '@/shared/iniciales';
import { Marca } from '@/shared/ui/marca';
import { enlaceWhatsappEquipo } from '@/shared/whatsapp-equipo';

type Pestana = 'ingresar' | 'crear';

/** El equipo entra directo a su panel; las tiendas, a la portada. */
function inicioPara(yo: RespuestaYo): string {
  return yo.usuario.rol === 'EQUIPO' ? '/equipo/cuentas' : '/';
}

const campo =
  'h-12 rounded-xl border border-borde px-4 text-cuerpo font-normal text-tinta placeholder:text-detalle';
const botonPrincipal =
  'inline-flex h-12 items-center justify-center rounded-full bg-pase px-5 text-cuerpo font-semibold text-white no-underline disabled:bg-borde-control';
const botonSecundario =
  'flex h-12 items-center justify-center gap-2 rounded-full bg-tinta text-cuerpo font-bold text-white no-underline hover:bg-black';

/**
 * El encabezado de cada paso (COR3). En el celular, arriba, el bloque verde con el logo, la frase
 * y «Tus precios de pase están protegidos»; en la computadora eso va en el verde de la izquierda.
 * Debajo, si llegaste por un enlace, qué tienda te compartieron, y el título del paso.
 */
function Encabezado({
  titulo,
  bajada,
  antes,
  compartida,
}: {
  titulo: string;
  bajada?: ReactNode;
  /** Una línea chica arriba del título («Primer ingreso · tiendab»). */
  antes?: string;
  /** El nombre de la tienda del enlace compartido. */
  compartida?: string | null;
}) {
  return (
    <>
      <div className="-mx-5 -mt-8 mb-1 flex flex-col gap-2.5 bg-marca px-5 pb-5 pt-4 text-white md:hidden">
        <Marca sobreMarca />
        <p className="m-0 text-[22px] font-bold leading-7">
          Lo que te falta, otra tienda de la galería lo tiene.
        </p>
        <span className="flex items-center gap-1.5 text-nota text-white/90">
          <IconLock size={14} stroke={1.8} aria-hidden="true" />
          Tus precios de pase están protegidos
        </span>
      </div>
      {compartida && (
        <div className="flex items-center gap-3.5 rounded-2xl border border-[#A7E3C3] bg-pase-suave px-4 py-3.5">
          <span
            aria-hidden="true"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-marca text-[15px] font-extrabold text-white"
          >
            {iniciales(compartida)}
          </span>
          <span className="flex flex-col text-apoyo">
            <b className="font-bold">Te compartieron {compartida}</b>
            <span className="text-secundario">
              Inicia sesión para ver sus productos y precios. Te llevamos directo ahí.
            </span>
          </span>
        </div>
      )}
      <div className="flex flex-col gap-2">
        {antes && <span className="text-nota text-detalle">{antes}</span>}
        <h1 className="text-[30px] leading-9">{titulo}</h1>
        {bajada && <p className="m-0 text-apoyo text-secundario">{bajada}</p>}
      </div>
    </>
  );
}

/**
 * «Inicia sesión» del lienzo final (D_Acceso, M_Acceso): ingresar con usuario o correo (RF-02),
 * contraseña olvidada por el equipo (RF-50), «¿Aún no tienes cuenta?» (el registro propio o,
 * apagado, la cuenta por WhatsApp, RF-43) y la clave propia en el primer ingreso.
 */
export function FormularioAcceso({
  primerIngreso,
  pestanaInicial,
  registroActivo = false,
  volver = null,
  compartida = null,
}: {
  /** Usuario con la clave temporal todavía activa, o nulo. */
  primerIngreso: string | null;
  pestanaInicial: Pestana;
  /** Con el registro propio encendido, «Crear cuenta» lleva al formulario en vez de al aviso. */
  registroActivo?: boolean;
  /** A dónde volver después de entrar (el enlace que te compartieron). */
  volver?: string | null;
  /** El nombre de la tienda del enlace compartido, para «Te compartieron…». */
  compartida?: string | null;
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
          setDestino(volver ?? inicioPara(yo));
          setPaso('listo');
        }}
      />
    );
  }
  if (paso === 'listo') {
    return (
      <div className="flex flex-col gap-4">
        <Encabezado
          titulo="Listo, ya entraste"
          bajada="Tu contraseña quedó guardada. Puedes cambiarla cuando quieras en Configuración › Seguridad."
        />
        <button type="button" className={botonPrincipal} onClick={() => router.replace(destino)}>
          {volver ? 'Seguir' : 'Ir al inicio'}
        </button>
      </div>
    );
  }
  return (
    <Ingreso
      pestanaInicial={pestanaInicial}
      registroActivo={registroActivo}
      compartida={compartida}
      alIngresar={(yo) => {
        if (yo.usuario.debe_cambiar_clave) {
          setUsuarioPrimer(yo.usuario.usuario);
          setPaso('primer');
        } else {
          router.replace(volver ?? inicioPara(yo));
          router.refresh();
        }
      }}
    />
  );
}

function Ingreso({
  pestanaInicial,
  registroActivo,
  compartida,
  alIngresar,
}: {
  pestanaInicial: Pestana;
  registroActivo: boolean;
  compartida: string | null;
  alIngresar: (yo: RespuestaYo) => void;
}) {
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
      setError('Escribe tu celular, correo o usuario y tu contraseña.');
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
    <form onSubmit={enviar} noValidate className="flex flex-col gap-[18px]">
      <Encabezado titulo="Inicia sesión" compartida={compartida} />
      {error && (
        <p role="alert" className="rounded-xl bg-error-fondo px-3.5 py-3 text-apoyo text-error">
          {error}
        </p>
      )}
      <label htmlFor="usuario" className="flex flex-col gap-2 text-apoyo font-semibold">
        {/* Las cuentas del registro propio entran con su celular. */}
        {registroActivo ? 'Celular, correo o usuario' : 'Correo o usuario'}
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
      <div className="flex flex-col gap-2">
        <label htmlFor="clave" className="text-apoyo font-semibold">
          Contraseña
        </label>
        <div className="flex h-12 items-center overflow-hidden rounded-xl border border-borde focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-tinta">
          <input
            id="clave"
            name="clave"
            type={verClave ? 'text' : 'password'}
            autoComplete="current-password"
            value={clave}
            onChange={(e) => setClave(e.target.value)}
            className="h-full min-w-0 flex-1 bg-transparent px-3.5 text-cuerpo outline-none"
          />
          <button
            type="button"
            aria-pressed={verClave}
            onClick={() => setVerClave(!verClave)}
            className="h-full px-3.5 text-apoyo font-medium text-secundario"
          >
            {verClave ? 'Ocultar' : 'Mostrar'}
          </button>
        </div>
      </div>
      <label className="flex min-h-11 items-center gap-3 text-apoyo">
        <input
          type="checkbox"
          checked={recordar}
          onChange={(e) => setRecordar(e.target.checked)}
          className="h-5 w-5 accent-pase"
        />
        <span className="md:hidden">Mantener la sesión en este celular</span>
        <span className="max-md:hidden">Mantener la sesión en este equipo</span>
      </label>
      <button type="submit" disabled={enviando} className={`${botonPrincipal} h-[52px]`}>
        {enviando ? 'Ingresando…' : 'Ingresar'}
      </button>
      <button
        type="button"
        aria-expanded={olvide}
        onClick={() => setOlvide(!olvide)}
        className="min-h-11 self-center text-nota font-semibold underline"
      >
        ¿Olvidaste tu contraseña? Pídesela al equipo
      </button>
      {olvide && (
        <div className="flex flex-col gap-2.5 rounded-xl border border-linea p-4">
          <span className="text-apoyo text-secundario">
            Por ahora no hay recuperación por correo. Escríbenos por WhatsApp con tu usuario y te
            damos una contraseña nueva; al entrar te pediremos cambiarla.
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

      <div
        id="crear-cuenta"
        className={`mt-3 flex flex-col gap-2.5 rounded-2xl border border-linea bg-superficie p-[18px] ${
          pestanaInicial === 'crear' ? 'outline outline-2 outline-pase' : ''
        }`}
      >
        <b className="text-cuerpo font-bold">¿Aún no tienes cuenta?</b>
        {registroActivo ? (
          <>
            <span className="text-apoyo text-secundario">
              Pide tu cuenta con o sin RUC. Una persona del equipo la revisa en máximo 3 horas.
            </span>
            <Link href="/registro" className={botonSecundario}>
              Crear cuenta de tienda
            </Link>
          </>
        ) : (
          <>
            <span className="text-apoyo text-secundario">
              Durante el piloto, el equipo de PaseLibre crea las cuentas de las tiendas de Wilson.
            </span>
            {whatsappCuenta && (
              <a
                href={whatsappCuenta}
                target="_blank"
                rel="noopener noreferrer"
                className={botonSecundario}
              >
                <IconBrandWhatsapp size={18} stroke={1.8} aria-hidden="true" />
                Pedir mi cuenta por WhatsApp
              </a>
            )}
          </>
        )}
      </div>
    </form>
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
      <Encabezado
        antes={`Primer ingreso · ${usuario}`}
        titulo="Crea tu contraseña"
        bajada="La que te dio el equipo es temporal. Cámbiala por una que solo tú sepas."
      />
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
