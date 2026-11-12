import type { ReputacionCorta } from '@paselibre/contracts';

import { conPlural } from './plural';

const decimal = (valor: number) => valor.toFixed(1).replace('.', ',');

/**
 * La reputación corta de una tienda (N13): «4,9 ★ · 31 opiniones» en el directorio, «4,9 ★»
 * en el buscador y en el celular, y «Nueva» mientras no tenga historia.
 */
export function textoReputacion(reputacion: ReputacionCorta, corta = false): string {
  if (reputacion.nueva || reputacion.estrellas === null) return 'Nueva';
  const estrellas = `${decimal(reputacion.estrellas)} ★`;
  return corta
    ? estrellas
    : `${estrellas} · ${conPlural(reputacion.opiniones, 'opinión', 'opiniones')}`;
}

/** Lo mismo para los lectores de pantalla: «4,9 de 5 estrellas, 31 opiniones». */
export function reputacionParaLeer(reputacion: ReputacionCorta): string {
  if (reputacion.nueva || reputacion.estrellas === null) return 'Nueva en PaseLibre';
  return `${decimal(reputacion.estrellas)} de 5 estrellas, ${conPlural(
    reputacion.opiniones,
    'opinión',
    'opiniones',
  )}`;
}

/** «Piso 2» para los números; «Sótano» o «Mezanine» tal cual. */
export function textoPiso(piso: string): string {
  return /^\d+$/.test(piso) ? `Piso ${piso}` : piso;
}

/**
 * «Cyberplaza · Stand 3A-110» (buscador) o «Cyberplaza · 3A-110» (directorio). Sin galería,
 * «Independiente».
 */
export function lugarDeTienda(
  tienda: { galeria: string | null; stand: string | null },
  conPalabraStand = false,
): string {
  const stand = tienda.stand ? (conPalabraStand ? `Stand ${tienda.stand}` : tienda.stand) : null;
  return [tienda.galeria ?? 'Independiente', stand].filter(Boolean).join(' · ');
}

/** Sin tildes y en minúsculas, letra por letra: el texto queda del mismo largo. */
function comparable(texto: string): string {
  return [...texto]
    .map((letra) =>
      letra
        .normalize('NFD')
        .replace(/\p{Diacritic}/gu, '')
        .toLowerCase(),
    )
    .join('');
}

/**
 * Para resaltar lo escrito en el nombre («<u>Pega</u>sus5000»): lo de antes, lo que coincide y
 * lo de después, sin importar tildes ni mayúsculas. Nulo si no aparece.
 */
export function partirCoincidencia(
  nombre: string,
  buscado: string,
): [antes: string, igual: string, despues: string] | null {
  const letras = [...nombre];
  const limpio = comparable(nombre);
  const aguja = comparable(buscado.trim());
  if (!aguja) return null;
  // Las letras sueltas: un índice de `limpio` es el mismo de `letras` (mismo largo).
  const limpias = [...limpio];
  const inicio = limpias.findIndex(
    (_, i) => limpias.slice(i, i + [...aguja].length).join('') === aguja,
  );
  if (inicio === -1) return null;
  const fin = inicio + [...aguja].length;
  return [
    letras.slice(0, inicio).join(''),
    letras.slice(inicio, fin).join(''),
    letras.slice(fin).join(''),
  ];
}
