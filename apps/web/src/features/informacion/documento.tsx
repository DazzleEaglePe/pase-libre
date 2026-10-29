import type { ReactNode } from 'react';

import { enlaceWhatsappEquipo } from '@/shared/whatsapp-equipo';

/**
 * Los textos de Términos, Privacidad y Ayuda son un borrador hasta que el equipo los revise
 * (y, los dos primeros, alguien que conozca la Ley 29733). Mientras lo sean, cada página lo
 * avisa arriba. Se apaga aquí.
 */
export const BORRADOR = true;

/** Fecha de la última versión de los textos, para mostrarla arriba de cada página. */
export const ACTUALIZADO = '28 de octubre de 2026';

/**
 * Quién responde por PaseLibre ante la ley: titular del banco de datos (Ley 29733) y parte de
 * los términos. Falta definirlo con Fabrizio; `null` se muestra como «por definir».
 */
export const RESPONSABLE: Record<'nombre' | 'ruc' | 'direccion' | 'correo', string | null> = {
  nombre: null,
  ruc: null,
  direccion: null,
  correo: null,
};

export function DatoResponsable({ campo }: { campo: keyof typeof RESPONSABLE }) {
  const valor = RESPONSABLE[campo];
  return valor ? <>{valor}</> : <span className="text-aviso">[por definir]</span>;
}

/** Página de texto largo: título, fecha, aviso de borrador y secciones. */
export function Documento({
  titulo,
  resumen,
  children,
}: {
  titulo: string;
  resumen: string;
  children: ReactNode;
}) {
  return (
    <article className="flex max-w-[720px] flex-col gap-8 py-6">
      <header className="flex flex-col gap-2">
        <h1 className="text-titulo">{titulo}</h1>
        <p className="text-secundario">{resumen}</p>
        <p className="text-nota text-detalle">Última actualización: {ACTUALIZADO}</p>
        {BORRADOR && (
          <p className="mt-2 rounded-xl bg-aviso-fondo px-4 py-3 text-apoyo text-aviso">
            Borrador: el equipo de PaseLibre todavía está revisando este texto. Puede cambiar antes
            del lanzamiento.
          </p>
        )}
      </header>
      {children}
    </article>
  );
}

export function Seccion({
  titulo,
  id,
  children,
}: {
  titulo: string;
  /** Para enlazar directo a la sección, como «Cómo evitar estafas» desde el pie. */
  id?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="flex flex-col gap-3 text-cuerpo [&_li]:pl-1 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5"
    >
      <h2 className="text-seccion">{titulo}</h2>
      {children}
    </section>
  );
}

/** Cómo escribirle al equipo: su WhatsApp si ya existe, o a quien te entregó la cuenta. */
export function ContactoEquipo({ mensaje }: { mensaje: string }) {
  const enlace = enlaceWhatsappEquipo(mensaje);
  if (!enlace) {
    return <>escríbele a la persona del equipo de PaseLibre que te entregó tu cuenta</>;
  }
  return (
    <>
      escríbenos por{' '}
      <a href={enlace} target="_blank" rel="noopener noreferrer" className="font-medium underline">
        WhatsApp
      </a>
    </>
  );
}
