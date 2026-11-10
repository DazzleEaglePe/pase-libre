'use client';

import type { RespuestaInicio } from '@paselibre/contracts';
import { IconCheck, IconChevronRight, IconShare2 } from '@tabler/icons-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';

import { iniciales } from '@/shared/iniciales';

const CLAVE_INVITO = 'paselibre:invito-tienda';

/**
 * «Invita a una tienda vecina»: copia el enlace del sitio para pasarlo por WhatsApp. Se
 * recuerda en este navegador para tachar el paso de «Primeros pasos».
 */
function useInvitar() {
  const [invito, setInvito] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

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

  const invitar = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setAviso('Enlace copiado. Pásalo por WhatsApp a la tienda vecina.');
    } catch {
      setAviso(`Pásale este enlace a la tienda vecina: ${window.location.origin}`);
    }
    try {
      window.localStorage.setItem(CLAVE_INVITO, '1');
    } catch {
      // Igual se tacha mientras dure la página.
    }
    setInvito(true);
    window.dispatchEvent(new Event('paselibre:invito'));
  }, []);

  return { invito, aviso, cerrarAviso: () => setAviso(null), invitar };
}

function Aviso({ texto, alCerrar }: { texto: string; alCerrar: () => void }) {
  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-[460px] items-center justify-between gap-4 rounded-2xl bg-tinta px-4 py-3 text-apoyo text-white shadow-[0_12px_28px_rgba(20,22,26,0.24)] md:bottom-8"
    >
      {texto}
      <button
        type="button"
        onClick={alCerrar}
        className="h-9 rounded-full px-3 font-bold text-acento"
      >
        OK
      </button>
    </div>
  );
}

/**
 * «Piloto en la galería · Eres de las primeras tiendas de PaseLibre» (FI_Web): cuántas
 * entraron de la meta, sus iniciales y el botón para invitar.
 */
export function PilotoGaleria({
  tiendas,
  miTienda,
}: {
  tiendas: RespuestaInicio['tiendas'];
  miTienda: string;
}) {
  const { invito, aviso, cerrarAviso, invitar } = useInvitar();
  const circulos = [miTienda, ...tiendas.visibles.map((tienda) => tienda.nombre)].slice(0, 5);
  return (
    <section
      aria-label="Piloto en la galería"
      className="flex flex-col gap-3.5 rounded-[28px] bg-marca p-5 text-white"
    >
      <span className="self-start rounded-full bg-contador px-2.5 py-1 text-nota font-bold text-tinta">
        Piloto en la galería
      </span>
      <h2 className="text-[22px] font-bold leading-7">Eres de las primeras tiendas de PaseLibre</h2>
      <div className="flex items-center gap-3">
        <span className="flex shrink-0">
          {circulos.map((nombre) => (
            <span
              key={nombre}
              aria-hidden="true"
              className="-ml-1.5 flex h-9 w-9 items-center justify-center rounded-full border-2 border-marca bg-pase-medio text-[11px] font-bold text-marca first:ml-0"
            >
              {iniciales(nombre)}
            </span>
          ))}
        </span>
        <span className="text-apoyo">
          {tiendas.activas} de {tiendas.meta} tiendas ya entraron
        </span>
      </div>
      <span className="h-2 rounded-full bg-white/20">
        <span
          className="block h-full rounded-full bg-contador"
          style={{ width: `${Math.min(100, Math.round((tiendas.activas / tiendas.meta) * 100))}%` }}
        />
      </span>
      <p className="m-0 text-apoyo text-white/90">
        Con {tiendas.meta} tiendas, aquí vas a encontrar casi todo lo que buscas sin salir del
        stand.
      </p>
      <button
        type="button"
        onClick={() => void invitar()}
        className="flex h-12 items-center gap-2 self-start rounded-full bg-white px-5 font-bold text-marca"
      >
        <IconShare2 size={18} stroke={2} aria-hidden="true" />
        Invita a una tienda vecina
      </button>
      <span className="text-nota text-white/85">
        {invito
          ? 'Gracias por invitar. Te avisamos cuando entre.'
          : 'Si entra con tu recomendación, la revisamos más rápido.'}
      </span>
      {aviso && <Aviso texto={aviso} alCerrar={cerrarAviso} />}
    </section>
  );
}

/** «Primeros pasos · 1 de 4 listos» (FI_Web): cada uno lleva a donde se hace. */
export function PrimerosPasos({ pasos }: { pasos: RespuestaInicio['pasos'] }) {
  const { invito, aviso, cerrarAviso, invitar } = useInvitar();
  const lista: Array<{ titulo: string; detalle: string; hecho: boolean; href?: string }> = [
    {
      titulo: 'Completa tu perfil',
      detalle: 'Horario y qué vendes',
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
      className="flex flex-col overflow-hidden rounded-[20px] border border-linea bg-white"
    >
      <div className="flex flex-col gap-2.5 px-4 pb-3 pt-4">
        <span className="flex items-center justify-between">
          <h2 id="primeros-pasos" className="text-[18px] font-bold">
            Primeros pasos
          </h2>
          <span className="text-nota font-bold text-pase-texto">{listos} de 4 listos</span>
        </span>
        <span className="h-2 rounded-full bg-superficie">
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
            'flex w-full items-center gap-3 border-t border-linea px-4 py-3 text-left text-tinta no-underline hover:bg-superficie';
          return (
            <li key={paso.titulo}>
              {paso.href ? (
                <Link href={paso.href} className={clase}>
                  {contenido}
                </Link>
              ) : (
                <button type="button" onClick={() => void invitar()} className={clase}>
                  {contenido}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {aviso && <Aviso texto={aviso} alCerrar={cerrarAviso} />}
    </section>
  );
}
