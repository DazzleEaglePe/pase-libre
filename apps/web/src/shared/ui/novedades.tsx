'use client';

import { NOVEDADES, VERSION, versionCorta } from '@paselibre/contracts';
import { useState } from 'react';

import { Ventana } from './ventana';

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

/** «2026-11-12» → «Noviembre 2026». */
export function mesDe(fecha: string): string {
  const [anio, mes] = fecha.split('-');
  return `${MESES[Number(mes) - 1] ?? ''} ${anio ?? ''}`.trim();
}

/**
 * «PaseLibre 1.9 · Novedades» en el pie de las tiendas (docs/18 §9). «Novedades» abre una ventana
 * con las frases de la última versión: lo que la tienda nota, sin nada técnico.
 */
export function VersionDelPie({ oscuro = false }: { oscuro?: boolean }) {
  const [abierta, setAbierta] = useState(false);
  const ultima = NOVEDADES.find((n) => n.version === VERSION);
  const corta = versionCorta();
  return (
    <span className={oscuro ? 'text-white' : 'text-secundario'}>
      PaseLibre {corta}
      {ultima && ultima.publico.length > 0 && (
        <>
          {' · '}
          <button
            type="button"
            onClick={() => setAbierta(true)}
            className={`underline underline-offset-2 ${
              oscuro ? 'text-[#22D37A] hover:text-white' : 'text-marca hover:text-tinta'
            }`}
          >
            Novedades
          </button>
          <Ventana
            titulo={`Novedades de la ${corta}`}
            abierta={abierta}
            alCerrar={() => setAbierta(false)}
          >
            <p className="-mt-2 text-nota text-secundario">{mesDe(ultima.fecha)}</p>
            <ul className="flex flex-col gap-2 text-cuerpo text-tinta">
              {ultima.publico.map((frase) => (
                <li key={frase}>· {frase}</li>
              ))}
            </ul>
          </Ventana>
        </>
      )}
    </span>
  );
}
