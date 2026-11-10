import type { RespuestaInicioEquipo } from '@paselibre/contracts';
import { IconChevronRight, IconFileText, IconFlag, IconMessage } from '@tabler/icons-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { cuandoFue } from '@/shared/fechas';
import { iniciales } from '@/shared/iniciales';
import { conPlural } from '@/shared/plural';

const FECHA = new Intl.DateTimeFormat('es-PE', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  timeZone: 'America/Lima',
});

/** «quedan 2 h 41 min» o «venció». */
function quedan(iso: string): string {
  const minutos = Math.round((new Date(iso).getTime() - Date.now()) / 60_000);
  if (minutos <= 0) return 'venció el plazo';
  if (minutos < 60) return `quedan ${minutos} min`;
  return `quedan ${Math.floor(minutos / 60)} h ${minutos % 60} min`;
}

function Pendiente({
  href,
  icono,
  numero,
  titulo,
  detalle,
  urgente = false,
}: {
  href: string;
  icono: ReactNode;
  numero: number;
  titulo: string;
  detalle: string;
  urgente?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 rounded-[20px] border p-4 text-tinta no-underline hover:shadow-[0_6px_16px_rgba(15,20,18,0.08)] ${
        urgente ? 'border-[#F5B5B5] bg-error-fondo' : 'border-linea bg-white'
      }`}
    >
      <span
        aria-hidden="true"
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${urgente ? 'bg-[#FBD5D5] text-error' : 'bg-superficie'}`}
      >
        {icono}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="flex items-baseline gap-1.5">
          <b className="text-[24px] font-bold leading-7">{numero}</b>
          <b className="text-cuerpo font-bold">{titulo}</b>
        </span>
        <span className="text-nota text-secundario">{detalle}</span>
      </span>
      <IconChevronRight size={18} stroke={1.8} aria-hidden="true" />
    </Link>
  );
}

const conSigno = (n: number) => `${n >= 0 ? '+' : '−'}${Math.abs(n)}`;

/** El inicio del panel (ADM_Web): «Para hoy», «Números del piloto» y «Lo último del equipo». */
export function InicioEquipo({ nombre, datos }: { nombre: string; datos: RespuestaInicioEquipo }) {
  const { reportes, numeros } = datos;
  const primero = reportes.primero;
  const cambioVentas =
    numeros.ventas_semana_anterior > 0
      ? Math.round(
          ((numeros.ventas_semana - numeros.ventas_semana_anterior) /
            numeros.ventas_semana_anterior) *
            100,
        )
      : null;
  const hoy = FECHA.format(new Date());
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-titulo">Hola, {nombre.split(' ')[0]}</h1>
        <span className="text-cuerpo text-secundario">
          {hoy.charAt(0).toUpperCase() + hoy.slice(1)} ·{' '}
          {datos.por_revisar === 0
            ? 'no tienes nada pendiente'
            : `tienes ${datos.por_revisar} ${datos.por_revisar === 1 ? 'cosa' : 'cosas'} por revisar`}
        </span>
      </div>

      <section aria-labelledby="para-hoy" className="flex flex-col gap-3">
        <h2 id="para-hoy" className="text-[20px] font-bold">
          Para hoy
        </h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <Pendiente
            href="/equipo/reportes"
            urgente={reportes.urgentes > 0}
            icono={<IconFlag size={20} stroke={1.8} />}
            numero={reportes.abiertos}
            titulo="Reportes"
            detalle={
              primero
                ? `${reportes.urgentes > 0 ? `${conPlural(reportes.urgentes, 'urgente', 'urgentes')}: ` : ''}${primero.motivo.toLowerCase()} · ${primero.tienda ?? 'sin tienda'} · ${quedan(primero.vence_en)}`
                : 'Nada por revisar'
            }
          />
          <Pendiente
            href="/equipo/solicitudes"
            icono={<IconFileText size={20} stroke={1.8} />}
            numero={datos.solicitudes}
            titulo="Solicitudes"
            detalle={datos.solicitudes ? 'Tiendas que pidieron entrar' : 'Ninguna esperando'}
          />
          <Pendiente
            href="/equipo/chats"
            icono={<IconMessage size={20} stroke={1.8} />}
            numero={datos.chats}
            titulo="Chats sin responder"
            detalle="Tiendas que le escribieron al equipo"
          />
        </div>
      </section>

      <section aria-labelledby="numeros" className="flex flex-col gap-3">
        <h2 id="numeros" className="text-[20px] font-bold">
          Números del piloto
        </h2>
        <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 lg:grid-cols-4">
          {[
            ['Tiendas activas', numeros.tiendas, `${conSigno(numeros.tiendas_semana)} esta semana`],
            [
              'Publicaciones activas',
              numeros.publicaciones,
              `${conSigno(numeros.publicaciones_semana)} esta semana`,
            ],
            [
              'Pedidos en vivo hoy',
              numeros.en_vivo_hoy,
              `${numeros.en_vivo_respondidos} con respuesta`,
            ],
            [
              'Ventas cerradas · semana',
              numeros.ventas_semana,
              cambioVentas === null
                ? 'primera semana con ventas'
                : `${conSigno(cambioVentas)} % que la anterior`,
            ],
          ].map(([titulo, valor, detalle]) => (
            <li
              key={String(titulo)}
              className="flex flex-col gap-1 rounded-[20px] border border-linea bg-white p-4"
            >
              <span className="text-apoyo text-secundario">{titulo}</span>
              <b className="text-[30px] font-bold leading-9">
                {Number(valor).toLocaleString('es-PE')}
              </b>
              <span className="text-nota text-secundario">{detalle}</span>
            </li>
          ))}
        </ul>
      </section>

      <section
        aria-labelledby="ultimo"
        className="flex flex-col gap-2 rounded-[24px] border border-linea bg-white p-5"
      >
        <h2 id="ultimo" className="text-[20px] font-bold">
          Lo último del equipo
        </h2>
        {datos.actividad.length === 0 ? (
          <p className="m-0 text-apoyo text-secundario">
            Aquí queda anotado quién del equipo decidió qué y cuándo.
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {datos.actividad.map((fila) => (
              <li
                key={fila.id}
                className="flex items-center gap-3 border-b border-linea py-3 last:border-0"
              >
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pase-medio text-nota font-bold text-marca"
                >
                  {iniciales(fila.autor)}
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-apoyo">
                    <b className="font-bold">{fila.autor}</b> {fila.accion}
                  </span>
                  <span className="text-nota text-secundario">{cuandoFue(fila.fecha)}</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
