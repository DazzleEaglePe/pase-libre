import {
  IconArrowsExchange,
  IconBolt,
  IconBook,
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandTiktok,
  IconBrandWhatsapp,
  IconChevronDown,
  IconCoin,
  IconLock,
  IconMail,
  IconMapPin,
  IconMessages,
  IconShieldCheck,
} from '@tabler/icons-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { CONTACTO, REDES, VISITANOS, type Red } from '@/shared/contacto';

import { SiHayPasesDelDia } from './beneficio-pases';
import { InvitacionPie } from './invitacion-pie';
import { Marca } from './marca';

/** Íconos de línea de Tabler, con el trazo de la marca: 1,5 (docs/10 §5). */
const TRAZO = 1.5;

const COLUMNAS: Array<{ titulo: string; enlaces: Array<{ href: string; texto: string }> }> = [
  {
    titulo: 'PaseLibre',
    enlaces: [
      { href: '/ayuda#sobre', texto: '¿Qué es PaseLibre?' },
      { href: '/buscar', texto: 'Todas las categorías' },
      { href: '/publicar', texto: 'Publicar un producto' },
      { href: '/ingresar?pestana=crear', texto: 'Pide tu cuenta' },
    ],
  },
  {
    titulo: 'Ayuda',
    enlaces: [
      { href: '/ayuda', texto: 'Preguntas frecuentes' },
      { href: '/ayuda#cuenta', texto: 'Olvidé mi contraseña' },
      { href: '/ayuda#mensajes', texto: 'Bloquear o denunciar' },
      { href: '/terminos#no-intermedia', texto: 'Cómo evitar estafas' },
    ],
  },
  {
    titulo: 'Legal',
    enlaces: [
      { href: '/terminos', texto: 'Términos de uso' },
      { href: '/terminos#reglas', texto: 'Reglas para publicar' },
      { href: '/privacidad', texto: 'Política de privacidad' },
    ],
  },
];

const REDES_ICONO: Record<Red, ReactNode> = {
  facebook: <IconBrandFacebook size={22} stroke={TRAZO} aria-hidden="true" />,
  instagram: <IconBrandInstagram size={22} stroke={TRAZO} aria-hidden="true" />,
  tiktok: <IconBrandTiktok size={22} stroke={TRAZO} aria-hidden="true" />,
};

function Beneficio({
  icono,
  titulo,
  texto,
  href,
  enlace,
}: {
  icono: ReactNode;
  titulo: string;
  texto: string;
  href: string;
  enlace: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 text-center lg:flex-1">
      <span className="flex text-pase">{icono}</span>
      <b className="mt-1 text-apoyo font-semibold text-tinta lg:text-cuerpo">{titulo}</b>
      <span className="text-nota text-secundario">{texto}</span>
      <Link href={href} className="text-nota font-semibold text-[#1F3FC2]">
        {enlace}
      </Link>
    </div>
  );
}

/** La franja de beneficios arriba del pie (idea del pie de Oechsle), con íconos de línea. */
function FranjaBeneficios() {
  const icono = (Icono: typeof IconBolt) => <Icono size={30} stroke={TRAZO} aria-hidden="true" />;
  const whatsapp = CONTACTO.whatsapp?.href ?? null;
  return (
    <section aria-label="Por qué PaseLibre" className="border-t border-linea bg-white">
      <div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-x-4 gap-y-7 px-4 py-7 sm:grid-cols-3 sm:px-8 lg:flex lg:gap-6 lg:py-9">
        <Beneficio
          icono={icono(IconArrowsExchange)}
          titulo="Pases entre tiendas"
          texto="Lo que te falta, otra tienda de la galería lo tiene."
          href="/ayuda#sobre"
          enlace="Cómo funciona"
        />
        <SiHayPasesDelDia>
          <Beneficio
            icono={icono(IconBolt)}
            titulo="Pases del día"
            texto="Publica un busco o un remate y te responden en minutos."
            href="/pases-del-dia"
            enlace="Ver los de hoy"
          />
        </SiHayPasesDelDia>
        <Beneficio
          icono={icono(IconMessages)}
          titulo="Chat y WhatsApp"
          texto="Escríbele directo a la tienda que lo tiene."
          href="/mensajes"
          enlace="Ir a Mensajes"
        />
        <Beneficio
          icono={icono(IconLock)}
          titulo="Precios entre tiendas"
          texto="Tus precios solo los ven cuentas verificadas."
          href="/privacidad"
          enlace="Privacidad"
        />
        <Beneficio
          icono={icono(IconCoin)}
          titulo="Sin comisiones"
          texto="Gratis para el piloto: PaseLibre no cobra ni intermedia."
          href="/terminos#no-intermedia"
          enlace="Términos"
        />
        <Beneficio
          icono={icono(IconBrandWhatsapp)}
          titulo="¿Dudas?"
          texto="Escríbenos y te ayudamos a usar PaseLibre."
          href={whatsapp ?? '/ayuda'}
          enlace={whatsapp ? 'Escribir al equipo' : 'Ver la ayuda'}
        />
      </div>
    </section>
  );
}

function FilaContacto({
  icono,
  titulo,
  dato,
  falta,
  enlace = null,
}: {
  icono: ReactNode;
  titulo: string;
  dato: string;
  falta: boolean;
  enlace?: { href: string; texto: string; externo: boolean } | null;
}) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-px flex shrink-0">{icono}</span>
      <span className="flex flex-col gap-0.5">
        <b className="text-cuerpo font-semibold">{titulo}</b>
        <span className={`text-apoyo ${falta ? 'italic' : ''}`}>{dato}</span>
        {enlace && (
          <a
            href={enlace.href}
            target={enlace.externo ? '_blank' : undefined}
            rel="noopener noreferrer"
            className="text-apoyo font-semibold text-white"
          >
            {enlace.texto}
          </a>
        )}
      </span>
    </li>
  );
}

function Contactanos() {
  const { whatsapp, correo, horario } = CONTACTO;
  const icono = (Icono: typeof IconMail) => <Icono size={24} stroke={TRAZO} aria-hidden="true" />;
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-tarjeta">Contáctanos</h2>
      <ul className="flex flex-col gap-4">
        {whatsapp && (
          <FilaContacto
            icono={icono(IconBrandWhatsapp)}
            titulo="Escríbenos por WhatsApp"
            dato={[whatsapp.texto, horario?.texto].filter(Boolean).join(' · ')}
            falta={whatsapp.falta}
            enlace={
              whatsapp.href ? { href: whatsapp.href, texto: 'Abrir el chat', externo: true } : null
            }
          />
        )}
        {correo && (
          <FilaContacto
            icono={icono(IconMail)}
            titulo="Correo"
            dato={correo.texto}
            falta={correo.falta}
            enlace={
              correo.href
                ? { href: correo.href, texto: 'Escribir un correo', externo: false }
                : null
            }
          />
        )}
        <FilaContacto icono={icono(IconMapPin)} titulo="Visítanos" dato={VISITANOS} falta={false} />
      </ul>
    </div>
  );
}

/** «Libro de Reclamaciones» como sello; sigue sin enlace hasta decidir si aplica (CHECKLIST §4). */
const LIBRO = (
  <span className="mt-2 inline-flex items-center gap-2.5 self-start rounded-xl border border-linea bg-white px-3.5 py-2.5 text-apoyo font-semibold leading-[18px] text-tinta">
    <IconBook size={26} stroke={TRAZO} aria-hidden="true" />
    <span>
      Libro de
      <br />
      Reclamaciones
    </span>
  </span>
);

function ColumnaEnlaces({ titulo, enlaces }: (typeof COLUMNAS)[number]) {
  const lista = enlaces.map(({ href, texto }) => (
    <Link
      key={texto}
      href={href}
      className="flex min-h-10 items-center text-cuerpo text-white no-underline hover:underline md:min-h-0"
    >
      {texto}
    </Link>
  ));
  const libro = titulo === 'Legal' ? LIBRO : null;
  return (
    <>
      {/* En el celular cada columna es un acordeón, como en la referencia. */}
      <details className="group border-t border-white/35 md:hidden">
        <summary className="flex min-h-[52px] cursor-pointer list-none items-center justify-between text-tarjeta [&::-webkit-details-marker]:hidden">
          {titulo}
          <IconChevronDown
            size={20}
            stroke={TRAZO}
            aria-hidden="true"
            className="transition-transform group-open:rotate-180"
          />
        </summary>
        <div className="flex flex-col pb-3">
          {lista}
          {libro && <div className="pb-1 pt-2">{libro}</div>}
        </div>
      </details>
      <nav aria-label={titulo} className="flex flex-col gap-3 max-md:hidden">
        <h2 className="mb-1 text-tarjeta">{titulo}</h2>
        {lista}
        {libro}
      </nav>
    </>
  );
}

/**
 * Pie de página (D del lienzo, elegido el 06/11): en el celular el pie D y en computadora el
 * diseño de la E, los dos en azul pase. Arriba, la franja de beneficios; en el pie, la marca
 * con la invitación a pedir cuenta (o a invitar a otra tienda), Contáctanos con íconos, tres
 * columnas de enlaces (acordeones en el celular) con el Libro de Reclamaciones, las redes,
 * dos sellos de confianza y la línea legal. Lo que falta del equipo no sale en producción.
 */
export function PiePagina({ conSesion = false }: { conSesion?: boolean }) {
  const legal = CONTACTO.legal;
  return (
    <>
      <FranjaBeneficios />
      <footer className="bg-pase text-white">
        <div className="mx-auto max-w-[1280px] px-4 sm:px-8">
          <div className="flex flex-wrap items-center gap-x-12 gap-y-6 pt-8 lg:pt-12">
            <div className="flex flex-[0_1_340px] flex-col gap-2.5">
              <span className="text-white">
                <Marca sobrePase />
              </span>
              <p className="text-cuerpo">
                El catálogo para pasarse productos entre tiendas de Wilson. Gratis para el piloto.
              </p>
            </div>
            <div className="min-w-0 flex-[1_1_560px]">
              <InvitacionPie conSesion={conSesion} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-x-10 gap-y-6 pb-8 pt-8 md:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))] md:pb-9 md:pt-11">
            <Contactanos />
            <div className="border-b border-white/35 md:contents md:border-0">
              {COLUMNAS.map((columna) => (
                <ColumnaEnlaces key={columna.titulo} {...columna} />
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-t border-white/35 py-6">
            {REDES.length > 0 && (
              <div className="flex items-center gap-3">
                <span className="text-cuerpo font-semibold">Síguenos en</span>
                <ul aria-label="Redes de PaseLibre" className="flex gap-3">
                  {REDES.map(({ red, nombre, url }) => (
                    <li key={red}>
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`PaseLibre en ${nombre}`}
                          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-pase hover:bg-pase-suave"
                        >
                          {REDES_ICONO[red]}
                        </a>
                      ) : (
                        <span
                          aria-label={`${nombre}: falta el enlace`}
                          title={`${nombre}: falta el enlace`}
                          className="flex h-11 w-11 items-center justify-center rounded-full border border-white/50 text-white"
                        >
                          {REDES_ICONO[red]}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <div className="flex flex-wrap gap-2.5">
              <span className="inline-flex items-center gap-2.5 rounded-full border border-white/50 px-3.5 py-2 text-apoyo font-semibold">
                <IconShieldCheck size={20} stroke={TRAZO} aria-hidden="true" />
                Cuentas verificadas por el equipo
              </span>
              <span className="inline-flex items-center gap-2.5 rounded-full border border-white/50 px-3.5 py-2 text-apoyo font-semibold">
                <IconCoin size={20} stroke={TRAZO} aria-hidden="true" />
                Sin comisiones ni pagos en línea
              </span>
            </div>
          </div>

          <p className="pb-7 text-nota md:text-center">
            © 2026 PaseLibre. El trato es entre vendedores: PaseLibre no interviene en las ventas.
            <br />
            {[legal?.texto, 'Español (Perú) · Precios en US$ y S/'].filter(Boolean).join(' · ')}
          </p>
        </div>
      </footer>
    </>
  );
}
