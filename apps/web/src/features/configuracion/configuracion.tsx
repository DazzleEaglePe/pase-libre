'use client';

import type { RespuestaCuenta } from '@paselibre/contracts';
import {
  IconAdjustmentsHorizontal,
  IconBan,
  IconBell,
  IconBuildingStore,
  IconChevronRight,
  IconFlag,
  IconLock,
  IconShieldCheck,
  IconUser,
  IconUsers,
  type Icon,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { CabeceraMovil } from '@/shared/ui/cabecera-movil';

import { SeccionAcceso } from './acceso';
import { SeccionAvisos } from './avisos';
import { SeccionBloqueadas } from './bloqueadas';
import { SeccionDatos } from './datos';
import { SeccionPreferencias } from './preferencias';
import { SeccionPrivacidad } from './privacidad';
import { SeccionReportes } from './reportes';
import { SeccionSeguridad } from './seguridad';

/**
 * El menú de Configuración (N09_ConfigWebTodo, N09_Celulares): cada opción con su ícono y su
 * subtítulo, en este orden. Preferencias va con «ajustes» y Tiendas bloqueadas con «restringido».
 */
export const SECCIONES = {
  datos: {
    titulo: 'Datos de la tienda',
    resumen: 'Logo, contacto y horario',
    icono: IconBuildingStore,
  },
  acceso: { titulo: 'Mi acceso', resumen: 'Usuario, correo y mi WhatsApp', icono: IconUser },
  seguridad: { titulo: 'Seguridad', resumen: 'Contraseña y sesiones', icono: IconLock },
  avisos: { titulo: 'Avisos', resumen: 'Qué te avisamos y cuándo', icono: IconBell },
  privacidad: {
    titulo: 'Privacidad',
    resumen: 'El «Visto» de tus mensajes',
    icono: IconShieldCheck,
  },
  preferencias: {
    titulo: 'Preferencias',
    resumen: 'Al publicar y respuestas rápidas',
    icono: IconAdjustmentsHorizontal,
  },
  asesores: { titulo: 'Asesores', resumen: 'Hasta 3 personas', icono: IconUsers },
  reportes: { titulo: 'Mis reportes', resumen: 'Lo que reportaste', icono: IconFlag },
  bloqueadas: { titulo: 'Tiendas bloqueadas', resumen: 'No te escriben', icono: IconBan },
} satisfies Record<string, { titulo: string; resumen: string; icono: Icon }>;

export type Seccion = keyof typeof SECCIONES;

const esSeccion = (valor: string | null): valor is Seccion =>
  valor !== null && Object.hasOwn(SECCIONES, valor);

/** Datos de la tienda y Mi acceso traen sus propias tarjetas (N09); las demás van en una. */
const CON_TARJETAS: readonly Seccion[] = ['datos', 'acceso'];

/** Una opción del menú: ícono en círculo, título y subtítulo; la elegida, en verde. */
function OpcionMenu({
  clave,
  elegida,
  soloEnComputadora,
  alElegir,
}: {
  clave: Seccion;
  elegida: boolean;
  /** En el menú del celular ninguna va marcada: la de por defecto solo se marca en la computadora. */
  soloEnComputadora: boolean;
  alElegir: () => void;
}) {
  const { titulo, resumen, icono: Icono } = SECCIONES[clave];
  const marcada = !elegida
    ? ['hover:bg-superficie', 'bg-pase-suave text-marca']
    : soloEnComputadora
      ? [
          'hover:bg-superficie md:bg-pase-suave md:shadow-[inset_3px_0_0_#00875A]',
          'bg-pase-suave text-marca md:bg-pase md:text-white',
        ]
      : ['bg-pase-suave shadow-[inset_3px_0_0_#00875A]', 'bg-pase text-white'];
  return (
    <li className="border-b border-linea px-2 py-1 last:border-0">
      <button
        type="button"
        role="tab"
        aria-selected={elegida}
        onClick={alElegir}
        className={`flex w-full items-center gap-3 rounded-xl px-2.5 py-2.5 text-left md:min-h-[60px] ${marcada[0]}`}
      >
        <span
          aria-hidden="true"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${marcada[1]}`}
        >
          <Icono size={18} stroke={1.8} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="text-apoyo font-bold">{titulo}</b>
          <span className="text-[12px] leading-4 text-detalle">{resumen}</span>
        </span>
        <IconChevronRight
          size={18}
          stroke={1.8}
          aria-hidden="true"
          className="shrink-0 text-detalle md:hidden"
        />
      </button>
    </li>
  );
}

/** Asesores (hasta 3, con permisos) los arma otra parte de esta ronda; mientras, cómo pedirlos. */
function SeccionAsesores() {
  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-cuerpo text-secundario">
        Puedes tener hasta 3 asesores, cada uno con su usuario y su contraseña.
      </p>
      <Link
        href="/mensajes/equipo"
        className="self-start text-apoyo font-bold text-pase-texto underline"
      >
        Pídeselos al Equipo PaseLibre por el chat
      </Link>
    </div>
  );
}

/**
 * Configuración (N09_ConfigWebTodo, A + B): en la computadora, el menú a la izquierda con rayitas
 * entre opciones y la sección a la derecha. En el celular (N09_Celulares), primero el menú y al
 * tocar una opción, su pantalla con «volver».
 */
export function Configuracion({ seccionInicial }: { seccionInicial: Seccion }) {
  const router = useRouter();
  const pedida = useSearchParams().get('seccion');
  const seccion: Seccion = esSeccion(pedida) ? pedida : seccionInicial;
  /** En el celular, sin `?seccion=` se ve solo el menú. */
  const soloMenu = !esSeccion(pedida);
  const [cuenta, setCuenta] = useState<RespuestaCuenta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  useEffect(() => {
    llamarApi<RespuestaCuenta>('/cuenta').then(setCuenta, (e: unknown) =>
      setError(e instanceof ErrorApi ? e.message : 'No pudimos cargar tu cuenta.'),
    );
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const reloj = setTimeout(() => setAviso(null), 3500);
    return () => clearTimeout(reloj);
  }, [aviso]);

  function elegir(nueva: Seccion) {
    const destino = `/cuenta/configuracion?seccion=${nueva}`;
    // En el celular cada sección es otra pantalla: «volver» regresa al menú.
    if (window.matchMedia('(min-width: 768px)').matches) router.replace(destino, { scroll: false });
    else router.push(destino);
  }

  /** Lo que cambió el nombre de la tienda o los valores por defecto: la barra también. */
  function alGuardarCuenta(nueva: RespuestaCuenta, mensaje: string) {
    setCuenta(nueva);
    setAviso(mensaje);
    router.refresh();
  }

  const { titulo } = SECCIONES[seccion];
  const contenido = (
    <>
      {error && (
        <p role="alert" className="text-apoyo text-error">
          {error}
        </p>
      )}
      {!cuenta && !error && <p className="text-secundario">Cargando…</p>}
      {cuenta && seccion === 'datos' && (
        <SeccionDatos cuenta={cuenta} alGuardar={alGuardarCuenta} />
      )}
      {cuenta && seccion === 'acceso' && (
        <SeccionAcceso cuenta={cuenta} alGuardar={alGuardarCuenta} />
      )}
      {cuenta && seccion === 'seguridad' && <SeccionSeguridad alAvisar={setAviso} />}
      {cuenta && seccion === 'avisos' && <SeccionAvisos alAvisar={setAviso} />}
      {cuenta && seccion === 'privacidad' && (
        <SeccionPrivacidad cuenta={cuenta} alGuardar={alGuardarCuenta} />
      )}
      {cuenta && seccion === 'asesores' && <SeccionAsesores />}
      {cuenta && seccion === 'reportes' && <SeccionReportes />}
      {cuenta && seccion === 'bloqueadas' && <SeccionBloqueadas alAvisar={setAviso} />}
      {cuenta && seccion === 'preferencias' && (
        <SeccionPreferencias cuenta={cuenta} alGuardar={alGuardarCuenta} alAvisar={setAviso} />
      )}
    </>
  );

  return (
    <div className="flex flex-col gap-5">
      <CabeceraMovil
        centro={
          <span className="flex min-w-0 flex-1 flex-col leading-tight">
            <b className="truncate text-[17px] font-bold">{soloMenu ? 'Configuración' : titulo}</b>
            <span className="truncate text-nota text-white/85">
              {soloMenu ? (cuenta?.tienda?.nombre ?? '') : 'Configuración'}
            </span>
          </span>
        }
      />
      <h1 className="text-titulo max-md:hidden">Configuración</h1>
      <div className="flex items-start gap-6">
        <nav
          aria-label="Secciones de Configuración"
          className={`w-full shrink-0 md:block md:w-[300px] ${soloMenu ? '' : 'max-md:hidden'}`}
        >
          <ul
            role="tablist"
            aria-orientation="vertical"
            className="m-0 flex list-none flex-col rounded-2xl border-[1.5px] border-linea bg-white p-1.5"
          >
            {(Object.keys(SECCIONES) as Seccion[]).map((clave) => (
              <OpcionMenu
                key={clave}
                clave={clave}
                elegida={clave === seccion}
                soloEnComputadora={soloMenu}
                alElegir={() => elegir(clave)}
              />
            ))}
          </ul>
        </nav>

        <section
          role="tabpanel"
          aria-label={titulo}
          className={`min-w-0 max-w-[880px] flex-1 flex-col gap-4 md:flex ${
            soloMenu ? 'hidden' : 'flex'
          }`}
        >
          {CON_TARJETAS.includes(seccion) ? (
            contenido
          ) : (
            <div className="flex flex-col gap-5 rounded-2xl border-[1.5px] border-linea bg-white p-5 sm:p-6">
              <h2 className="text-seccion">{titulo}</h2>
              {contenido}
            </div>
          )}
        </section>
      </div>

      {aviso && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-50 max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-full bg-tinta px-5 py-3.5 text-center text-cuerpo font-semibold text-white shadow-[0_12px_30px_rgba(20,22,26,0.3)] md:bottom-7"
        >
          {aviso}
        </div>
      )}
    </div>
  );
}
