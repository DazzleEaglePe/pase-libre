'use client';

import type { RespuestaOpcionesRegistro, RespuestaSolicitud } from '@paselibre/contracts';
import { IconCheck } from '@tabler/icons-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { botonPrincipal, botonSecundario } from '@/shared/ui/estilos';

import { guardarConsulta } from './consulta-guardada';
import { FormularioRegistro } from './formulario-registro';

const CADA_CUANTO_MS = 30_000;

/** «7:12 p. m.», en hora de Lima. */
function horaDeLima(iso: string): string {
  return new Date(iso).toLocaleTimeString('es-PE', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Lima',
  });
}

/** «1 h 20 min», «45 min» o «3 h». */
function tiempoRestante(hasta: string, ahora: number): string | null {
  const minutos = Math.ceil((new Date(hasta).getTime() - ahora) / 60_000);
  if (minutos <= 0) return null;
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/**
 * Cómo va la solicitud (REG_Web: «en revisión», «falta algo», «aprobada»). Se consulta con el
 * código de la dirección y se refresca sola mientras espera a una persona del equipo.
 */
export function EstadoSolicitud({
  consulta,
  opciones,
  whatsappEquipo,
}: {
  consulta: string;
  opciones: RespuestaOpcionesRegistro;
  whatsappEquipo: string | null;
}) {
  const [solicitud, setSolicitud] = useState<RespuestaSolicitud | null>(null);
  const [error, setError] = useState<'no-existe' | 'falla' | null>(null);
  const [ahora, setAhora] = useState(() => Date.now());
  const [corrigiendo, setCorrigiendo] = useState(false);

  const cargar = useCallback(async () => {
    try {
      setSolicitud(await llamarApi<RespuestaSolicitud>(`/registro/solicitudes/${consulta}`));
      setError(null);
    } catch (e) {
      setError(
        e instanceof ErrorApi && (e.estado === 404 || e.estado === 400) ? 'no-existe' : 'falla',
      );
    }
  }, [consulta]);

  useEffect(() => {
    guardarConsulta(consulta);
    void cargar();
  }, [consulta, cargar]);

  const pendiente = solicitud?.estado === 'PENDIENTE';
  useEffect(() => {
    if (!pendiente) return;
    const reloj = setInterval(() => {
      setAhora(Date.now());
      void cargar();
    }, CADA_CUANTO_MS);
    return () => clearInterval(reloj);
  }, [pendiente, cargar]);

  if (error === 'no-existe') {
    return (
      <Aviso titulo="No encontramos esa solicitud">
        <p>Revisa que la dirección esté completa. Si no la guardaste, puedes crear otra.</p>
        <Link href="/registro" className={botonPrincipal}>
          Crear mi cuenta
        </Link>
      </Aviso>
    );
  }
  if (!solicitud) {
    return (
      <p role="status" className="py-12 text-center text-cuerpo text-detalle">
        {error === 'falla' ? 'No pudimos cargar tu solicitud. Vuelve a intentarlo.' : 'Cargando…'}
      </p>
    );
  }

  if (corrigiendo && solicitud.estado === 'REQUIERE_CAMBIOS') {
    return (
      <FormularioRegistro
        opciones={opciones}
        corregir={{ consulta, datos: solicitud.datos, mensaje: solicitud.mensaje_equipo }}
      />
    );
  }

  const { datos } = solicitud;
  const listos = [
    'Celular confirmado',
    datos.metodo === 'RUC'
      ? `RUC ${datos.ruc ?? ''} verificado en SUNAT`
      : datos.metodo === 'SIN_RUC_DNI'
        ? 'Sin RUC: DNI del encargado'
        : datos.metodo === 'SIN_RUC_RECOMENDACION'
          ? `Sin RUC: te recomienda ${datos.recomienda_tienda ?? 'una tienda'}`
          : 'Sin RUC: credencial de la galería',
    `Stand ${datos.stand}${datos.galeria ? '' : datos.galeria_otra ? ` en ${datos.galeria_otra}` : ''}`,
  ];

  if (solicitud.estado === 'APROBADA') {
    return (
      <Aviso titulo="¡Tu cuenta está aprobada!">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-pase-medio px-3 py-1 text-apoyo font-semibold text-ok">
          <IconCheck size={16} stroke={2.4} aria-hidden="true" />
          Cuenta verificada por PaseLibre
        </span>
        <p>
          Bienvenida, <b className="font-semibold">{datos.nombre_comercial}</b>.{' '}
          {solicitud.aprobada_sola
            ? 'Verificamos tu RUC con SUNAT y ya puedes entrar.'
            : 'Una persona del equipo revisó tus datos y ya puedes entrar.'}
        </p>
        <p className="rounded-xl bg-superficie p-3 text-apoyo">
          Entra con tu celular <b className="font-semibold">{datos.celular}</b> y la contraseña que
          elegiste.
        </p>
        <Link href="/ingresar" className={botonPrincipal}>
          Iniciar sesión
        </Link>
        <div className="flex w-full flex-col gap-2 border-t border-linea pt-4">
          <b className="text-tarjeta">Tus primeros pasos</b>
          <Link href="/publicar" className="text-cuerpo font-medium">
            Publica tu primer producto ›
          </Link>
          <Link href="/cuenta/configuracion" className="text-cuerpo font-medium">
            Completa los datos de tu tienda ›
          </Link>
        </div>
      </Aviso>
    );
  }

  if (solicitud.estado === 'REQUIERE_CAMBIOS') {
    return (
      <Aviso titulo="Falta algo para aprobarla">
        <p className="rounded-xl bg-aviso-fondo p-4 text-aviso">
          <b className="font-semibold">El equipo te escribió:</b> {solicitud.mensaje_equipo}
        </p>
        <button type="button" onClick={() => setCorrigiendo(true)} className={botonPrincipal}>
          Corregir mi solicitud
        </button>
      </Aviso>
    );
  }

  if (solicitud.estado === 'RECHAZADA') {
    return (
      <Aviso titulo="No pudimos aprobar tu solicitud">
        {solicitud.mensaje_equipo && <p className="text-secundario">{solicitud.mensaje_equipo}</p>}
        <p>Si crees que fue un error, escríbele al equipo. También puedes volver a intentarlo.</p>
        <div className="flex flex-wrap gap-3">
          {whatsappEquipo && (
            <a
              href={whatsappEquipo}
              target="_blank"
              rel="noopener noreferrer"
              className={botonSecundario}
            >
              Escribir al equipo
            </a>
          )}
          <Link href="/registro" className={botonPrincipal}>
            Volver a empezar
          </Link>
        </div>
      </Aviso>
    );
  }

  const quedan = solicitud.vence_en ? tiempoRestante(solicitud.vence_en, ahora) : null;
  return (
    <Aviso titulo="Estamos revisando tu solicitud">
      <p>
        Una persona de nuestro equipo la revisa y te avisamos en un máximo de 3 horas. Gracias por
        tu paciencia.
      </p>
      <p className="text-apoyo font-semibold">
        {quedan && solicitud.vence_en
          ? `Te respondemos antes de las ${horaDeLima(solicitud.vence_en)} · quedan ${quedan}.`
          : 'Ya pasó el plazo: la estamos viendo ahora mismo. Si tarda, escríbenos.'}
      </p>
      <ul className="flex flex-col gap-2 rounded-2xl border border-linea p-4 text-apoyo">
        {listos.map((texto) => (
          <li key={texto} className="flex items-center gap-2">
            <IconCheck size={18} stroke={2.4} aria-hidden="true" className="text-ok" />
            {texto}
          </li>
        ))}
      </ul>
      <p className="text-nota text-detalle">
        Guarda esta página: es la forma de ver cómo va tu solicitud. Se actualiza sola.
      </p>
    </Aviso>
  );
}

function Aviso({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-4 rounded-2xl border border-linea bg-white p-6 sm:p-8">
      <h1 className="text-titulo">{titulo}</h1>
      <div className="flex w-full flex-col items-start gap-4 text-cuerpo">{children}</div>
    </div>
  );
}
