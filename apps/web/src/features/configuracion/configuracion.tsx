'use client';

import type { RespuestaCuenta } from '@paselibre/contracts';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';

import { SeccionAvisos } from './avisos';
import { SeccionDatos } from './datos';
import { SeccionPreferencias } from './preferencias';
import { SeccionPrivacidad } from './privacidad';
import { SeccionSeguridad } from './seguridad';

export const SECCIONES = {
  datos: { titulo: 'Datos de la cuenta', resumen: 'Tienda, contacto y horario' },
  seguridad: { titulo: 'Seguridad', resumen: 'Contraseña y sesiones' },
  avisos: { titulo: 'Avisos', resumen: 'Qué te avisamos y cuándo' },
  privacidad: { titulo: 'Privacidad', resumen: '«Visto» y bloqueados' },
  preferencias: { titulo: 'Preferencias', resumen: 'Al publicar y respuestas rápidas' },
} as const;

export type Seccion = keyof typeof SECCIONES;

/**
 * Configuración (C_Configuracion): las secciones a la izquierda y la elegida a la derecha.
 * Entra lo de la primera salida; perfil privado, «Quién puede escribirte», respuesta
 * automática e idioma quedan para la fase 2.
 */
export function Configuracion({ seccionInicial }: { seccionInicial: Seccion }) {
  const router = useRouter();
  const [seccion, setSeccion] = useState<Seccion>(seccionInicial);
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
    const reloj = setTimeout(() => setAviso(null), 3000);
    return () => clearTimeout(reloj);
  }, [aviso]);

  function elegir(nueva: Seccion) {
    setSeccion(nueva);
    router.replace(`/cuenta/configuracion?seccion=${nueva}`, { scroll: false });
  }

  /** Lo que cambió el nombre de la tienda o los valores por defecto: la barra también. */
  function alGuardarCuenta(nueva: RespuestaCuenta, mensaje: string) {
    setCuenta(nueva);
    setAviso(mensaje);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-titulo">Configuración</h1>
      <div className="flex flex-wrap items-start gap-6">
        <div
          role="tablist"
          aria-label="Secciones"
          aria-orientation="vertical"
          className="flex w-full gap-1 overflow-x-auto pb-1 md:w-[260px] md:shrink-0 md:flex-col md:overflow-visible"
        >
          {(Object.keys(SECCIONES) as Seccion[]).map((clave) => {
            const elegida = clave === seccion;
            return (
              <button
                key={clave}
                type="button"
                role="tab"
                aria-selected={elegida}
                onClick={() => elegir(clave)}
                className={`flex shrink-0 flex-col rounded-2xl px-3.5 py-2.5 text-left md:py-3 ${
                  elegida ? 'bg-lima-suave' : 'hover:bg-superficie'
                }`}
              >
                <b className="text-apoyo font-semibold">{SECCIONES[clave].titulo}</b>
                <span className="hidden text-nota text-detalle md:block">
                  {SECCIONES[clave].resumen}
                </span>
              </button>
            );
          })}
        </div>

        <section
          role="tabpanel"
          aria-label={SECCIONES[seccion].titulo}
          className="flex min-w-0 max-w-[720px] flex-[1_1_480px] flex-col gap-5 rounded-3xl border-[1.5px] border-linea p-5 sm:p-7"
        >
          <h2 className="text-seccion">{SECCIONES[seccion].titulo}</h2>
          {error && (
            <p role="alert" className="text-apoyo text-error">
              {error}
            </p>
          )}
          {!cuenta && !error && <p className="text-secundario">Cargando…</p>}
          {cuenta && seccion === 'datos' && (
            <SeccionDatos cuenta={cuenta} alGuardar={alGuardarCuenta} />
          )}
          {cuenta && seccion === 'seguridad' && <SeccionSeguridad alAvisar={setAviso} />}
          {cuenta && seccion === 'avisos' && <SeccionAvisos alAvisar={setAviso} />}
          {cuenta && seccion === 'privacidad' && (
            <SeccionPrivacidad cuenta={cuenta} alGuardar={alGuardarCuenta} alAvisar={setAviso} />
          )}
          {cuenta && seccion === 'preferencias' && (
            <SeccionPreferencias cuenta={cuenta} alGuardar={alGuardarCuenta} alAvisar={setAviso} />
          )}
        </section>
      </div>

      {aviso && (
        <div
          role="status"
          className="fixed bottom-7 left-1/2 z-50 -translate-x-1/2 whitespace-nowrap rounded-full bg-tinta px-5 py-3.5 text-cuerpo font-semibold text-white shadow-[0_12px_30px_rgba(20,22,26,0.3)]"
        >
          {aviso}
        </div>
      )}
    </div>
  );
}
