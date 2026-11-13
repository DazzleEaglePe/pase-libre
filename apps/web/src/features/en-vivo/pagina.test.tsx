import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FotoEnVivo, fotoDeTarjeta } from './pagina';

const categoria = { slug: 'tarjetas-de-video', nombre: 'Tarjetas de video' };

/** Página Pedidos en vivo con foto (doc 20, A3 y punto 8; diseño C). */
describe('Pedidos en vivo: la foto de cada tarjeta de la página', () => {
  it('primero la del producto, si no la primera propia y si no ninguna', () => {
    expect(
      fotoDeTarjeta({
        producto: { slug: 'rtx-4060', foto: 'catalogo/rtx-4060.webp' },
        fotos: ['busco/propia-1.webp', 'busco/propia-2.webp'],
      }),
    ).toBe('catalogo/rtx-4060.webp');
    expect(
      fotoDeTarjeta({
        producto: { slug: 'rtx-4060', foto: null },
        fotos: ['busco/propia-1.webp', 'busco/propia-2.webp'],
      }),
    ).toBe('busco/propia-1.webp');
    expect(fotoDeTarjeta({ producto: null, fotos: ['busco/propia-1.webp'] })).toBe(
      'busco/propia-1.webp',
    );
    expect(fotoDeTarjeta({ producto: null, fotos: [] })).toBeNull();
  });

  it('la foto va alta, de 120 px, sobre blanco y entera', () => {
    const { container } = render(
      <FotoEnVivo
        item={{
          categoria,
          producto: { slug: 'rtx-4060', foto: 'catalogo/rtx-4060.webp' },
          fotos: ['busco/propia-1.webp'],
        }}
      />,
    );
    const caja = container.querySelector('[data-foto-en-vivo]');
    expect(caja).toHaveClass('w-[120px]', 'self-stretch', 'bg-white');
    const foto = caja?.querySelector('img');
    expect(foto).toHaveAttribute('src', '/media/catalogo/rtx-4060.webp');
    expect(foto).toHaveClass('object-contain', 'h-full', 'w-full');
  });

  it('sin foto propia ni del producto, el dibujo de su categoría sobre blanco', () => {
    const { container } = render(<FotoEnVivo item={{ categoria, producto: null, fotos: [] }} />);
    const caja = container.querySelector('[data-foto-en-vivo]');
    expect(caja).toHaveClass('bg-white');
    expect(caja?.querySelector('img')).toBeNull();
    expect(caja?.querySelector('svg')).not.toBeNull();
  });
});
