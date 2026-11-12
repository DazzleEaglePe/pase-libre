import {
  NIVELES_REPUTACION,
  OPINIONES_PARA_NIVEL,
  TEXTO_NIVEL,
  type NivelReputacion,
  type ReputacionDetallada,
} from '@paselibre/contracts';
import { IconStar, IconStarFilled } from '@tabler/icons-react';
import type { ReactNode } from 'react';

import { conPlural } from '@/shared/plural';

/** «4,8» con coma, como se escribe en Perú. */
export const decimal = (valor: number) => valor.toFixed(1).replace('.', ',');

export function Estrellas({ valor, tamano = 18 }: { valor: number; tamano?: number }) {
  return (
    <span
      className="flex text-[#F59E0B]"
      aria-label={`${decimal(valor)} de 5 estrellas`}
      role="img"
    >
      {[1, 2, 3, 4, 5].map((n) =>
        n <= Math.round(valor) ? (
          <IconStarFilled key={n} size={tamano} aria-hidden="true" />
        ) : (
          <IconStar key={n} size={tamano} stroke={1.6} aria-hidden="true" />
        ),
      )}
    </span>
  );
}

/** Los cinco tramos de la barra (N04_Bordes): rojo, naranja, amarillo, verde claro y verde. */
const TRAMOS = ['#F4B6BE', '#F8D1A6', '#F6E38A', '#B7E9CF', '#00875A'];
const APAGADO = '#E6EBE8';

/** El color del texto de cada nivel (N04_Bordes). */
export const COLOR_NIVEL: Record<NivelReputacion, string> = {
  BAJA: '#B4141F',
  REGULAR: '#9A3412',
  BUENA: '#7A5B00',
  MUY_BUENA: '#006B47',
  EXCELENTE: '#006B47',
};

/** «Muy buena · las tiendas confían en ella» (o «en ti», en tu propio perfil). */
export function fraseNivel(nivel: NivelReputacion, propia: boolean): string {
  const quien = propia ? 'ti' : 'ella';
  const frase: Record<NivelReputacion, string> = {
    EXCELENTE: 'de las más confiables de Wilson',
    MUY_BUENA: `las tiendas confían en ${quien}`,
    BUENA: 'cumple con lo que acuerda',
    REGULAR: 'algunas tiendas tuvieron problemas',
    BAJA: 'varias tiendas tuvieron problemas',
  };
  return `${TEXTO_NIVEL[nivel]} · ${frase[nivel]}`;
}

/** La barra de Baja a Excelente que se enciende hasta el nivel de la tienda; el resto, gris. */
export function BarraReputacion({ nivel }: { nivel: NivelReputacion }) {
  const hasta = NIVELES_REPUTACION.indexOf(nivel);
  return (
    <span
      role="img"
      aria-label={`Reputación ${TEXTO_NIVEL[nivel].toLowerCase()}: ${hasta + 1} de 5`}
      className="flex gap-1.5"
    >
      {TRAMOS.map((color, i) => (
        <span
          key={color}
          className="h-2.5 flex-1 rounded-full"
          style={{ background: i <= hasta ? color : APAGADO }}
        />
      ))}
    </span>
  );
}

/** «🌱 Nueva en PaseLibre · Todavía juntando opiniones · 1 de 5», con la barra gris. */
function Nueva({ opiniones, propia }: { opiniones: number; propia: boolean }) {
  const avance = Math.min(OPINIONES_PARA_NIVEL, opiniones);
  return (
    <>
      <span className="self-start rounded-full bg-[#F1F4F2] px-3 py-1 text-nota font-extrabold text-secundario">
        🌱 Nueva en PaseLibre
      </span>
      <span className="text-apoyo text-secundario">
        Todavía juntando opiniones ·{' '}
        <b className="font-bold text-tinta">
          {avance} de {OPINIONES_PARA_NIVEL}
        </b>
      </span>
      <span
        aria-hidden="true"
        className="h-2 rounded-full"
        style={{
          background: `linear-gradient(90deg, #8A968F ${avance * 20}%, #E2E7E4 ${avance * 20}%)`,
        }}
      />
      <span className="text-nota text-detalle">
        {propia
          ? `Con ${OPINIONES_PARA_NIVEL} opiniones ya tendrás tu nivel.`
          : `Con ${OPINIONES_PARA_NIVEL} opiniones ya tendrá su nivel.`}
      </span>
    </>
  );
}

function Dato({ valor, texto }: { valor: ReactNode; texto: string }) {
  return (
    <span className="flex flex-1 flex-col gap-0.5 rounded-xl bg-superficie px-3 py-2.5">
      <b className="text-[20px] font-bold leading-7">{valor}</b>
      <span className="text-[12px] leading-4 text-detalle">{texto}</span>
    </span>
  );
}

/**
 * La reputación de una tienda (N03_ReputacionWeb, N04_PerfilA_Web):
 * - `lateral`: debajo de «Sobre la tienda», con la barra que se ilumina y dos datos.
 * - `completa`: el promedio grande con sus estrellas, el nivel y los tres datos (pases cerrados
 *   en 60 días, minutos para responder y chats respondidos), con cómo se calcula.
 * Con menos de 5 opiniones, «🌱 Nueva en PaseLibre» con la barra gris, sin nivel ni color.
 */
export function Reputacion({
  reputacion,
  propia = false,
  variante,
  verDetalle,
}: {
  reputacion: ReputacionDetallada;
  propia?: boolean;
  variante: 'lateral' | 'completa';
  /** «Ver detalle ›»: lleva a las opiniones. */
  verDetalle?: () => void;
}) {
  const { nivel } = reputacion;
  const titulo = (
    <span className="flex items-center justify-between gap-2">
      <h2 className="text-[16px] font-bold leading-6">Reputación</h2>
      {verDetalle && (
        <button
          type="button"
          onClick={verDetalle}
          className="text-nota font-extrabold text-marca hover:underline"
        >
          Ver detalle ›
        </button>
      )}
    </span>
  );

  if (nivel === null) {
    return (
      <section aria-label="Reputación" className="flex flex-col gap-2.5">
        {titulo}
        <Nueva opiniones={reputacion.opiniones} propia={propia} />
      </section>
    );
  }

  const opiniones = conPlural(reputacion.opiniones, 'opinión', 'opiniones');
  const pases = <Dato valor={reputacion.pases_60} texto="pases cerrados en 60 días" />;

  if (variante === 'lateral') {
    return (
      <section aria-label="Reputación" className="flex flex-col gap-2.5">
        {titulo}
        <BarraReputacion nivel={nivel} />
        <b className="text-apoyo font-extrabold" style={{ color: COLOR_NIVEL[nivel] }}>
          {fraseNivel(nivel, propia)}
        </b>
        <span className="flex gap-2">
          <Dato
            valor={reputacion.promedio !== null ? `${decimal(reputacion.promedio)} ★` : '—'}
            texto={opiniones}
          />
          {pases}
        </span>
      </section>
    );
  }

  return (
    <section aria-label="Reputación" className="flex flex-col gap-2.5">
      {titulo}
      {reputacion.promedio !== null && (
        <span className="flex flex-wrap items-center gap-2">
          <b className="text-[30px] font-bold leading-9">{decimal(reputacion.promedio)}</b>
          <Estrellas valor={reputacion.promedio} />
          <span className="text-nota text-detalle">de {opiniones}</span>
        </span>
      )}
      <span
        className="self-start rounded-full px-3 py-1 text-nota font-extrabold"
        style={{
          color: COLOR_NIVEL[nivel],
          background: nivel === 'MUY_BUENA' || nivel === 'EXCELENTE' ? '#EBFAF1' : '#F6F8F7',
        }}
      >
        {fraseNivel(nivel, propia)}
      </span>
      <BarraReputacion nivel={nivel} />
      <span className="grid grid-cols-3 gap-2">
        {pases}
        <Dato
          valor={reputacion.responde_en !== null ? `~${reputacion.responde_en} min` : '—'}
          texto="para responder"
        />
        <Dato
          valor={reputacion.respondidos !== null ? `${reputacion.respondidos} %` : '—'}
          texto="chats respondidos"
        />
      </span>
      <span className="text-nota text-detalle">
        El nivel junta estrellas + pases cerrados + rapidez. Lo reciente pesa más. Un solo 5 no te
        pone arriba ni un solo 1 te hunde.
      </span>
    </section>
  );
}
