'use client';

import type { RespuestaInicio } from '@paselibre/contracts';
import { IconBrandWhatsapp, IconCheck, IconChevronRight } from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { CLAVE_INVITO, invitarPorWhatsApp } from '@/shared/ui/invitacion-pie';

/**
 * «Invita a una tienda vecina»: abre WhatsApp con el enlace del sitio. Se recuerda en este
 * navegador para tachar el paso de «Primeros pasos».
 */
function useInvito(): boolean {
  const [invito, setInvito] = useState(false);
  useEffect(() => {
    try {
      setInvito(window.localStorage.getItem(CLAVE_INVITO) === '1');
    } catch {
      // Sin almacenamiento, el paso sale sin tachar.
    }
    const alInvitar = () => setInvito(true);
    window.addEventListener('paselibre:invito', alInvitar);
    return () => window.removeEventListener('paselibre:invito', alInvitar);
  }, []);
  return invito;
}

/** El dorado de las fundadoras (doc 20, punto 7): la pastilla, la barra y el sello. */
export const DORADO = 'bg-[linear-gradient(135deg,#F7D774,#C99A2E)] text-[#3B2A00]';

/**
 * «★ Tiendas fundadoras · 7 de 10 ya entraron» (doc 20, punto 7; antes «Piloto en la
 * galería»): cuántas fundadoras hay de las 10, sus iniciales, la barra dorada, qué ganan y el
 * botón para invitar. Con `compacto` (primera semana) se achica: sin la frase.
 */
export function PilotoGaleria({
  fundadoras,
  compacto = false,
}: {
  fundadoras: RespuestaInicio['fundadoras'];
  compacto?: boolean;
}) {
  const avance = Math.min(100, Math.round((fundadoras.entraron / fundadoras.total) * 100));
  return (
    <section
      aria-label="Tiendas fundadoras"
      className="flex flex-col gap-3 rounded-[18px] bg-marca p-[18px] text-white"
    >
      <span
        className={`self-start rounded-full px-2.5 py-[3px] text-[11px] font-extrabold ${DORADO}`}
      >
        ★ Tiendas fundadoras
      </span>
      <div className="flex items-center gap-2.5">
        {fundadoras.iniciales.length > 0 && (
          <span aria-hidden="true" className="flex shrink-0 pl-2">
            {fundadoras.iniciales.slice(0, 4).map((iniciales, n) => (
              <span
                key={`${iniciales}-${n}`}
                className="-ml-2 flex h-[30px] w-[30px] items-center justify-center rounded-full border-2 border-pase bg-pase-medio text-[11px] font-extrabold text-marca"
              >
                {iniciales}
              </span>
            ))}
          </span>
        )}
        <span className="text-apoyo font-bold">
          {fundadoras.entraron} de {fundadoras.total} ya entraron
        </span>
      </div>
      <span className="h-2 rounded-full bg-white/20">
        <span
          className="block h-full rounded-full bg-[linear-gradient(90deg,#F7D774,#C99A2E)]"
          style={{ width: `${avance}%` }}
        />
      </span>
      {!compacto && (
        <p className="m-0 text-apoyo text-white/90">
          Las {fundadoras.total} primeras tienen un día a la semana en que sus publicaciones salen
          primero.
        </p>
      )}
      <button
        type="button"
        onClick={invitarPorWhatsApp}
        className="flex h-11 items-center gap-2 self-start rounded-full bg-white px-5 text-cuerpo font-bold text-marca hover:bg-pase-suave"
      >
        <IconBrandWhatsapp size={18} stroke={1.8} aria-hidden="true" />
        Invita a una tienda vecina
      </button>
    </section>
  );
}

/** «Primeros pasos · 1 de 4 listos» (N16): cada uno lleva a donde se hace. */
export function PrimerosPasos({ pasos }: { pasos: RespuestaInicio['pasos'] }) {
  const invito = useInvito();
  const lista: Array<{ titulo: string; detalle: string; hecho: boolean; href?: string }> = [
    {
      titulo: 'Completa tu perfil',
      detalle: 'Portada y horario',
      hecho: pasos.perfil,
      href: '/cuenta/configuracion',
    },
    {
      titulo: 'Publica 3 productos',
      detalle: `${Math.min(3, pasos.publicadas)} de 3`,
      hecho: pasos.publicadas >= 3,
      href: '/publicar',
    },
    {
      titulo: 'Pide algo en vivo',
      detalle: 'Lo ven todas las tiendas al instante',
      hecho: pasos.en_vivo,
      href: '/pedidos-en-vivo/publicar',
    },
    {
      titulo: 'Invita a una tienda vecina',
      detalle: 'Entre más tiendas, más ventas para todos',
      hecho: invito,
    },
  ];
  const listos = lista.filter((paso) => paso.hecho).length;
  if (listos === lista.length) return null;

  return (
    <section
      aria-labelledby="primeros-pasos"
      className="flex flex-col rounded-[18px] border-[1.5px] border-linea bg-white px-[18px] pb-1 pt-4"
    >
      <div className="flex flex-col gap-2.5 pb-2">
        <span className="flex items-center justify-between">
          <h2 id="primeros-pasos" className="text-[18px] font-bold">
            Primeros pasos
          </h2>
          <span className="text-nota font-bold text-marca">{listos} de 4 listos</span>
        </span>
        <span className="h-1.5 rounded-full bg-superficie">
          <span
            className="block h-full rounded-full bg-pase"
            style={{ width: `${listos * 25}%` }}
          />
        </span>
      </div>
      <ul className="m-0 list-none p-0">
        {lista.map((paso) => {
          const contenido = (
            <>
              <span
                aria-hidden="true"
                className={`flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full ${
                  paso.hecho ? 'bg-pase text-white' : 'border-2 border-borde'
                }`}
              >
                {paso.hecho && <IconCheck size={15} stroke={3} />}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span
                  className={`text-[15px] font-semibold ${paso.hecho ? 'text-detalle line-through' : ''}`}
                >
                  {paso.titulo}
                  {paso.hecho && <span className="sr-only"> (listo)</span>}
                </span>
                <span className="text-nota text-secundario">{paso.detalle}</span>
              </span>
              <IconChevronRight size={18} stroke={1.8} aria-hidden="true" />
            </>
          );
          const clase =
            'flex w-full items-center gap-3 border-t-[1.5px] border-linea py-3 text-left text-tinta no-underline hover:bg-superficie';
          return (
            <li key={paso.titulo}>
              {paso.href ? (
                <Link href={paso.href} className={clase}>
                  {contenido}
                </Link>
              ) : (
                <button type="button" onClick={invitarPorWhatsApp} className={clase}>
                  {contenido}
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
