'use client';

import {
  MAX_EN_VIVO_POR_CUENTA,
  type Contadores,
  type RespuestaAvisosCuenta,
  type RespuestaMisEnVivo,
  type RespuestaMisOfertas,
  type ResumenCuenta,
  type TiendaDeSesion,
} from '@paselibre/contracts';
import { IconCheck, IconChevronRight } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type ReactNode } from 'react';

import { llamarApi } from '@/shared/api/cliente';
import { conPlural } from '@/shared/plural';
import { AvatarTienda } from '@/shared/ui/avatar-tienda';
import { Interruptor } from '@/shared/ui/interruptor';

const MES = new Intl.DateTimeFormat('es-PE', {
  month: 'long',
  year: 'numeric',
  timeZone: 'America/Lima',
});

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="m-0 px-1 text-etiqueta uppercase text-detalle">{titulo}</h2>
      <ul className="m-0 flex list-none flex-col overflow-hidden rounded-[20px] border border-linea bg-white p-0">
        {children}
      </ul>
    </section>
  );
}

function Fila({
  href,
  titulo,
  detalle,
  cuenta,
}: {
  href: string;
  titulo: string;
  detalle: string;
  cuenta?: number;
}) {
  return (
    <li className="border-b border-linea last:border-0">
      <Link
        href={href}
        className="flex min-h-[72px] items-center gap-3 px-4 py-3 text-tinta no-underline hover:bg-superficie"
      >
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="text-cuerpo font-bold">{titulo}</b>
          <span className="truncate text-apoyo text-secundario">{detalle}</span>
        </span>
        {cuenta ? (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-contador px-1.5 text-[11px] font-bold text-tinta">
            {cuenta}
          </span>
        ) : null}
        <IconChevronRight size={18} stroke={1.8} aria-hidden="true" />
      </Link>
    </li>
  );
}

/**
 * «Tu cuenta» (D_Cuenta, M_Cuenta, sección 14 del lienzo final): tu tienda con sus números,
 * «Ver mi perfil» y «Cerrar sesión», atajos a todo lo tuyo, tu WhatsApp, los dos avisos que más
 * importan y cómo escribirle al equipo.
 */
export function TuCuenta({ tienda }: { tienda: TiendaDeSesion }) {
  const router = useRouter();
  const [resumen, setResumen] = useState<ResumenCuenta | null>(null);
  const [ofertas, setOfertas] = useState<RespuestaMisOfertas | null>(null);
  const [enVivo, setEnVivo] = useState<RespuestaMisEnVivo | null>(null);
  const [contadores, setContadores] = useState<Contadores | null>(null);
  const [avisos, setAvisos] = useState<RespuestaAvisosCuenta | null>(null);
  const [saliendo, setSaliendo] = useState(false);

  useEffect(() => {
    const nada = () => undefined;
    llamarApi<ResumenCuenta>('/cuenta/resumen').then(setResumen, nada);
    llamarApi<RespuestaMisOfertas>('/mis-ofertas?estado=vigentes').then(setOfertas, nada);
    llamarApi<RespuestaMisEnVivo>('/en-vivo/mios').then(setEnVivo, nada);
    llamarApi<Contadores>('/contadores').then(setContadores, nada);
    llamarApi<RespuestaAvisosCuenta>('/cuenta/avisos').then(setAvisos, nada);
  }, []);

  async function cambiarAviso(clave: 'EN_VIVO' | 'MENSAJE', activo: boolean) {
    if (!avisos) return;
    const nuevos = { ...avisos, campanita: { ...avisos.campanita, [clave]: activo } };
    setAvisos(nuevos);
    try {
      setAvisos(
        await llamarApi<RespuestaAvisosCuenta>('/cuenta/avisos', { metodo: 'PUT', cuerpo: nuevos }),
      );
    } catch {
      setAvisos(avisos);
    }
  }

  async function salir() {
    setSaliendo(true);
    try {
      await llamarApi('/sesion', { metodo: 'DELETE' });
    } finally {
      router.push('/');
      router.refresh();
    }
  }

  const activas = ofertas?.conteos.vigentes ?? 0;
  const porRevisar = ofertas?.por_revisar ?? 0;
  const vivos = enVivo?.en_vivo ?? [];
  const primero = vivos[0];
  const lugar = [tienda.galeria ?? 'Independiente', tienda.stand && `Stand ${tienda.stand}`]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-titulo">Tu cuenta</h1>
      <div className="grid items-start gap-5 lg:grid-cols-[390px_minmax(0,1fr)]">
        <section
          aria-label="Tu tienda"
          className="flex flex-col gap-4 rounded-[24px] border border-linea bg-white p-5 sm:p-6"
        >
          <div className="flex items-center gap-4">
            <AvatarTienda
              nombre={tienda.nombre}
              logo={tienda.logo}
              tamano={72}
              letra={26}
              fondo="bg-marca font-bold text-white"
              oculto
            />
            <span className="flex min-w-0 flex-col gap-1">
              <b className="truncate text-[22px] font-bold">{tienda.nombre}</b>
              <span className="text-apoyo text-secundario">{lugar}</span>
              <span className="flex h-6 items-center gap-1 self-start rounded-full bg-pase-medio px-2 text-nota font-bold text-marca">
                <IconCheck size={12} stroke={3} aria-hidden="true" />
                Cuenta verificada
              </span>
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              [activas, activas === 1 ? 'publicación' : 'publicaciones'],
              [vivos.length, 'pedidos en vivo'],
              [
                resumen?.chats_abiertos ?? 0,
                resumen?.chats_abiertos === 1 ? 'chat abierto' : 'chats abiertos',
              ],
            ].map(([valor, texto]) => (
              <span
                key={String(texto)}
                className="flex flex-col gap-0.5 rounded-2xl bg-superficie p-3"
              >
                <b className="text-[24px] font-bold leading-7">{valor}</b>
                <span className="text-apoyo leading-5 text-secundario">{texto}</span>
              </span>
            ))}
          </div>
          <Link
            href={`/tiendas/${tienda.id}`}
            className="flex h-12 items-center justify-center rounded-full bg-pase font-bold text-white no-underline"
          >
            Ver mi perfil
          </Link>
          <button
            type="button"
            disabled={saliendo}
            onClick={() => void salir()}
            className="h-12 rounded-full border border-borde bg-white font-bold text-error"
          >
            {saliendo ? 'Saliendo…' : 'Cerrar sesión'}
          </button>
          {resumen && (
            <span className="text-nota text-secundario">
              Miembro desde {MES.format(new Date(resumen.miembro_desde))} ·{' '}
              {resumen.por_registro
                ? 'te registraste tú'
                : 'cuenta creada por el equipo de PaseLibre'}
            </span>
          )}
        </section>

        <div className="grid items-start gap-5 xl:grid-cols-2">
          <Grupo titulo="Tu tienda">
            <Fila
              href="/mis-publicaciones"
              titulo="Mis publicaciones"
              detalle={`${activas} ${activas === 1 ? 'activa' : 'activas'}${porRevisar ? ` · ${porRevisar} por revisar` : ''}`}
              cuenta={porRevisar}
            />
            <Fila
              href="/pedidos-en-vivo"
              titulo="Mis pedidos en vivo"
              detalle={
                primero
                  ? `${vivos.length} de ${MAX_EN_VIVO_POR_CUENTA} activos`
                  : 'Pide algo o remata: les llega al toque'
              }
            />
            <Fila
              href="/mensajes"
              titulo="Mensajes"
              detalle={`${conPlural(resumen?.chats_abiertos ?? 0, 'chat abierto', 'chats abiertos')} · ${contadores?.mensajes ?? 0} sin leer`}
              cuenta={contadores?.mensajes}
            />
            <Fila
              href="/historial"
              titulo="Historial de ventas"
              detalle="Lo que vendiste y compraste · 💪 🎉 🔥"
            />
            <Fila
              href="/cuenta/socios"
              titulo="Tus socios"
              detalle="Tiendas que ven tu precio socio"
            />
            <Fila
              href="/cuenta/configuracion?seccion=reportes"
              titulo="Mis reportes"
              detalle="Lo que reportaste y qué pasó"
            />
            <Fila
              href="/cuenta/configuracion?seccion=bloqueadas"
              titulo="Tiendas bloqueadas"
              detalle="No pueden escribirte y no las ves"
            />
            <Fila
              href="/cuenta/configuracion?seccion=datos"
              titulo="Datos de la tienda"
              detalle={[lugar, resumen ? null : null].filter(Boolean).join(' · ')}
            />
          </Grupo>

          <div className="flex flex-col gap-5">
            <Grupo titulo="Privacidad y WhatsApp">
              <Fila
                href="/cuenta/configuracion?seccion=datos"
                titulo="Tu WhatsApp"
                detalle={`${resumen?.whatsapp ?? '—'} · solo lo ven las tiendas con sesión`}
              />
              <Fila
                href="/cuenta/configuracion?seccion=privacidad"
                titulo="Privacidad"
                detalle="«Visto» en el chat y quién ve qué"
              />
            </Grupo>
            <Grupo titulo="Avisos">
              {(
                [
                  ['EN_VIVO', 'Pedidos en vivo de lo que vendes', 'Te llegan al instante'],
                  ['MENSAJE', 'Mensajes nuevos', 'Te avisamos en la campanita'],
                ] as const
              ).map(([clave, titulo, detalle]) =>
                avisos && avisos.campanita[clave] !== undefined ? (
                  <li
                    key={clave}
                    className="flex min-h-[64px] items-center gap-3 border-b border-linea px-4 py-3 last:border-0"
                  >
                    <span className="flex min-w-0 flex-1 flex-col">
                      <b className="text-cuerpo font-bold">{titulo}</b>
                      <span className="text-apoyo text-secundario">{detalle}</span>
                    </span>
                    <Interruptor
                      etiqueta={titulo}
                      activo={avisos.campanita[clave] ?? true}
                      alCambiar={(activo) => void cambiarAviso(clave, activo)}
                    />
                  </li>
                ) : null,
              )}
              <Fila
                href="/avisos#configurar"
                titulo="Todos los avisos"
                detalle="Horario silencioso y por dónde te llegan"
              />
            </Grupo>
            <Grupo titulo="Ayuda">
              <Fila
                href="/mensajes/equipo"
                titulo="Escribir al equipo PaseLibre"
                detalle="Para cambios de stand, cuentas o lo que necesites"
              />
              <Fila href="/ayuda" titulo="Cómo funciona PaseLibre" detalle="Preguntas frecuentes" />
            </Grupo>
          </div>
        </div>
      </div>
    </div>
  );
}
