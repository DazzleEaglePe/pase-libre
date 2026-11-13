import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';

import { fotosDeFicha } from './fotos-ficha';
import { GaleriaFicha } from './galeria-ficha';

const foto = (ruta: string) => ({ ruta, ancho: 1200, alto: 1200 });
const CATALOGO = foto('catalogo/ak820.webp');
const TIENDA_1 = foto('2026/11/tienda-1.webp');
const TIENDA_2 = foto('2026/11/tienda-2.webp');
const TIENDA_3 = foto('2026/11/tienda-3.webp');

/** La galería con su estado, como la usa la ficha. */
function Galeria({ portada }: { portada: string | null }) {
  const [actual, setActual] = useState(0);
  return (
    <GaleriaFicha
      fotos={fotosDeFicha([CATALOGO], { fotos: [TIENDA_1, TIENDA_2, TIENDA_3], portada })}
      categoria="teclados"
      actual={actual}
      alCambiar={setActual}
    />
  );
}

const miniaturas = () => screen.getAllByRole('tab');
const rutaDe = (miniatura: HTMLElement) =>
  miniatura.querySelector('img')?.getAttribute('src') ?? '';

describe('Ficha del producto: foto grande y miniaturas (doc 20 · punto 23)', () => {
  it('la primera miniatura es la portada que eligió la tienda, y está activa', () => {
    render(<Galeria portada={TIENDA_2.ruta} />);
    expect(miniaturas().map(rutaDe)).toEqual([
      `/media/${TIENDA_2.ruta}`,
      `/media/${CATALOGO.ruta}`,
      `/media/${TIENDA_1.ruta}`,
      `/media/${TIENDA_3.ruta}`,
    ]);
    expect(miniaturas()[0]).toHaveAttribute('aria-selected', 'true');
    expect(miniaturas()[0]).toHaveTextContent('De la tienda');
    expect(miniaturas()[1]).toHaveTextContent('Del catálogo');
    expect(screen.getByText('1 / 4')).toBeInTheDocument();
    // La foto grande que se ve primero es la portada, entera (`object-fit: contain`).
    const grande = screen.getByAltText('Foto 1 de 4');
    expect(grande).toHaveAttribute('src', `/media/${TIENDA_2.ruta}`);
    expect(grande).toHaveClass('object-contain');
  });

  it('las flechas ‹ › cambian la foto y el contador, y dan la vuelta', () => {
    render(<Galeria portada={null} />);
    fireEvent.click(screen.getByRole('button', { name: 'Foto siguiente' }));
    expect(screen.getByText('2 / 4')).toBeInTheDocument();
    expect(miniaturas()[1]).toHaveAttribute('aria-selected', 'true');
    // La activa lleva el borde verde.
    expect(miniaturas()[1]?.firstElementChild).toHaveClass('border-marca');
    expect(miniaturas()[0]?.firstElementChild).not.toHaveClass('border-marca');

    fireEvent.click(screen.getByRole('button', { name: 'Foto anterior' }));
    fireEvent.click(screen.getByRole('button', { name: 'Foto anterior' }));
    expect(screen.getByText('4 / 4')).toBeInTheDocument();
  });

  it('tocar una miniatura la muestra grande', () => {
    render(<Galeria portada={null} />);
    fireEvent.click(miniaturas()[2] as HTMLElement);
    expect(screen.getByText('3 / 4')).toBeInTheDocument();
    expect(miniaturas()[2]).toHaveAttribute('aria-selected', 'true');
  });

  it('con una sola foto: sin flechas, sin contador y sin miniaturas', () => {
    render(
      <GaleriaFicha
        fotos={fotosDeFicha([CATALOGO], { fotos: [], portada: null })}
        categoria="teclados"
        actual={0}
        alCambiar={() => undefined}
      />,
    );
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Foto siguiente' })).toBeNull();
    expect(screen.queryByText('1 / 1')).toBeNull();
  });
});
