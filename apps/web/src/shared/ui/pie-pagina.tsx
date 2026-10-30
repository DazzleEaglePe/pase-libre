import {
  IconBrandFacebook,
  IconBrandInstagram,
  IconBrandTiktok,
  IconBrandWhatsapp,
  IconClock,
  IconMail,
} from '@tabler/icons-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { CONTACTO, REDES, type DatoContacto, type Red } from '@/shared/contacto';

import { Marca } from './marca';

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

const claseEnlace =
  'inline-flex min-h-6 items-center text-apoyo text-secundario no-underline hover:text-tinta hover:underline';

/** Íconos de línea de Tabler, con el trazo de la marca: 1,5 (docs/10 §5). */
const TRAZO = 1.5;

const ICONOS = {
  whatsapp: <IconBrandWhatsapp size={16} stroke={TRAZO} aria-hidden="true" />,
  correo: <IconMail size={16} stroke={TRAZO} aria-hidden="true" />,
  horario: <IconClock size={16} stroke={TRAZO} aria-hidden="true" />,
} as const;

const REDES_ICONO: Record<Red, ReactNode> = {
  facebook: <IconBrandFacebook size={20} stroke={TRAZO} aria-hidden="true" />,
  instagram: <IconBrandInstagram size={20} stroke={TRAZO} aria-hidden="true" />,
  tiktok: <IconBrandTiktok size={20} stroke={TRAZO} aria-hidden="true" />,
};

function FilaContacto({ icono, dato }: { icono: ReactNode; dato: DatoContacto }) {
  const texto = <span className={dato.falta ? 'text-detalle' : undefined}>{dato.texto}</span>;
  return (
    <li className="flex min-h-8 items-center gap-2.5 text-apoyo text-secundario">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-superficie text-tinta">
        {icono}
      </span>
      {dato.href ? (
        <a
          href={dato.href}
          target={dato.href.startsWith('http') ? '_blank' : undefined}
          rel="noopener noreferrer"
          className="no-underline hover:text-tinta hover:underline"
        >
          {texto}
        </a>
      ) : (
        texto
      )}
    </li>
  );
}

/**
 * Pie de página (C_Footer, elegido el 28/10): la marca, tres columnas de enlaces y Contacto,
 * con WhatsApp, correo, horario y redes. Debajo, el aviso de que el trato es entre
 * vendedores. «Libro de Reclamaciones» sigue sin enlace hasta decidir si aplica a PaseLibre
 * (docs/CHECKLIST.md §4).
 */
export function PiePagina() {
  const contacto = [
    CONTACTO.whatsapp && { icono: ICONOS.whatsapp, dato: CONTACTO.whatsapp },
    CONTACTO.correo && { icono: ICONOS.correo, dato: CONTACTO.correo },
    CONTACTO.horario && { icono: ICONOS.horario, dato: CONTACTO.horario },
  ].filter((fila) => fila !== null);
  const hayContacto = contacto.length > 0 || REDES.length > 0;

  return (
    <footer className="border-t border-linea bg-white">
      <div className="mx-auto grid max-w-[1280px] grid-cols-2 gap-x-8 gap-y-10 px-4 pb-10 pt-12 sm:px-8 md:grid-cols-4 lg:grid-cols-[1.5fr_1fr_1fr_1fr_1.25fr]">
        <div className="col-span-2 flex flex-col gap-3 md:col-span-4 lg:col-span-1">
          <Marca conFrase />
          <p className="max-w-[300px] text-apoyo text-secundario">
            El catálogo para pasarse productos entre tiendas. Gratis para el piloto.
          </p>
        </div>

        {COLUMNAS.map(({ titulo, enlaces }) => (
          <nav key={titulo} aria-label={titulo} className="flex flex-col gap-2.5">
            <h2 className="text-apoyo font-semibold">{titulo}</h2>
            {enlaces.map(({ href, texto }) => (
              <Link key={texto} href={href} className={claseEnlace}>
                {texto}
              </Link>
            ))}
            {titulo === 'Legal' && (
              <span className="inline-flex min-h-6 items-center text-apoyo text-secundario">
                Libro de Reclamaciones
              </span>
            )}
          </nav>
        ))}

        {hayContacto && (
          <div className="flex flex-col gap-2.5">
            <h2 className="text-apoyo font-semibold">Contacto</h2>
            <ul className="flex flex-col gap-2.5">
              {contacto.map((fila) => (
                <FilaContacto key={fila.dato.texto} icono={fila.icono} dato={fila.dato} />
              ))}
            </ul>
            {REDES.length > 0 && (
              <ul aria-label="Redes de PaseLibre" className="mt-1.5 flex gap-2">
                {REDES.map(({ red, nombre, url }) => {
                  const clase =
                    'flex h-10 w-10 items-center justify-center rounded-full bg-superficie transition-colors';
                  return (
                    <li key={red}>
                      {url ? (
                        <a
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`PaseLibre en ${nombre}`}
                          className={`${clase} text-tinta hover:bg-tinta hover:text-white`}
                        >
                          {REDES_ICONO[red]}
                        </a>
                      ) : (
                        <span
                          aria-label={`${nombre}: falta el enlace`}
                          title={`${nombre}: falta el enlace`}
                          className={`${clase} text-detalle`}
                        >
                          {REDES_ICONO[red]}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-linea">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4 text-nota text-detalle sm:px-8">
          <span>
            © 2026 PaseLibre. El trato es entre vendedores: PaseLibre no interviene en las ventas.
          </span>
          <span>Español (Perú) · Precios en US$ y S/</span>
        </div>
      </div>
    </footer>
  );
}
