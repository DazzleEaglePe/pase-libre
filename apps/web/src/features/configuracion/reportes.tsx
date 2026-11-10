'use client';

import type { MiReporte } from '@paselibre/contracts';
import { useEffect, useState } from 'react';

import { horaReloj, tituloMotivo } from '@/features/reportes/ventanas';
import { llamarApi } from '@/shared/api/cliente';
import { haceCuanto } from '@/shared/fechas';
import { enlaceWhatsappEquipo } from '@/shared/whatsapp-equipo';

const DIA = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  day: 'numeric',
  month: 'short',
});

/** «Hoy, 4:06 p. m.», «Ayer» o «2 nov». */
function cuando(iso: string): string {
  const dia = haceCuanto(iso);
  if (dia === 'Hoy') return `Hoy, ${horaReloj(iso)}`;
  if (dia === 'Ayer') return 'Ayer';
  return DIA.format(new Date(iso)).replace('.', '');
}

const ESTADOS: Record<MiReporte['estado'], { texto: string; clase: string }> = {
  ENVIADO: { texto: 'Enviado', clase: 'bg-superficie text-secundario' },
  EN_REVISION: { texto: 'En revisión', clase: 'bg-aviso-fondo text-aviso' },
  RESUELTO: { texto: 'Resuelto', clase: 'bg-pase-medio text-marca' },
};

/**
 * Tu cuenta · Mis reportes (REP_WebMisReportes): lo que reportaste y qué pasó con cada uno.
 * La tienda reportada nunca sabe quién fue.
 */
export function SeccionReportes() {
  const [reportes, setReportes] = useState<MiReporte[] | null>(null);
  const equipo = enlaceWhatsappEquipo('Hola, quiero hablar con el equipo de PaseLibre.');

  useEffect(() => {
    llamarApi<MiReporte[]>('/cuenta/reportes').then(setReportes, () => setReportes([]));
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-apoyo text-secundario">Lo que reportaste y qué pasó con cada uno.</p>
      {reportes === null ? (
        <p className="text-secundario">Cargando…</p>
      ) : reportes.length === 0 ? (
        <div className="flex flex-col gap-1 rounded-2xl bg-superficie p-5">
          <b className="text-tarjeta">No reportaste nada</b>
          <span className="text-apoyo text-secundario">
            Si una tienda te quiere estafar, no cumple lo que publicó o te trata mal, repórtala
            desde su chat, su publicación o su perfil.
          </span>
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {reportes.map((reporte) => (
            <li
              key={reporte.codigo}
              className="flex flex-col gap-1 rounded-2xl border border-linea px-4 py-3.5"
            >
              <span className="flex items-start justify-between gap-3">
                <b className={`font-bold ${reporte.tienda === 'Tienda reservada' ? 'italic' : ''}`}>
                  {reporte.tienda}
                </b>
                <span
                  className={`shrink-0 rounded-full px-2.5 text-[12px] font-bold leading-6 ${ESTADOS[reporte.estado].clase}`}
                >
                  {ESTADOS[reporte.estado].texto}
                </span>
              </span>
              <span className="text-nota text-secundario">
                {reporte.tipo ? tituloMotivo(reporte.tipo) : 'Denuncia'} ·{' '}
                {cuando(reporte.creada_en)} · {reporte.codigo}
              </span>
              <span className="text-apoyo">
                {reporte.estado === 'RESUELTO'
                  ? reporte.resolucion
                  : reporte.estado === 'EN_REVISION'
                    ? `Una persona del equipo lo está viendo. Te avisamos antes de las ${horaReloj(reporte.revisar_antes_de)}`
                    : `Lo revisa una persona del equipo antes de las ${horaReloj(reporte.revisar_antes_de)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-nota text-secundario">
        La tienda que reportaste no sabe que fuiste tú. Si alguien reporta en falso a propósito, la
        que queda en revisión es su cuenta.
      </p>
      {equipo && (
        <a
          href={equipo}
          target="_blank"
          rel="noopener noreferrer"
          className="self-start text-apoyo font-bold text-pase-texto"
        >
          Hablar con el equipo PaseLibre
        </a>
      )}
    </div>
  );
}
