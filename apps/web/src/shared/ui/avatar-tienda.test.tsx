import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AvatarTienda } from './avatar-tienda';

const circulo = (contenedor: HTMLElement) => contenedor.firstElementChild as HTMLElement;

describe('AvatarTienda (1.9.0, punto 6)', () => {
  it('con logo, lo muestra recortado en círculo y sin las iniciales', () => {
    const { container } = render(
      <AvatarTienda nombre="Dark Alien Planeta" logo="tiendas/dark.webp" tamano={52} />,
    );
    const logo = container.querySelector('img');
    expect(logo).toHaveAttribute('src', '/media/tiendas/dark.webp');
    expect(logo).toHaveAttribute('alt', '');
    expect(logo).toHaveClass('rounded-full', 'object-cover', 'h-full', 'w-full');
    expect(screen.queryByText('DA')).toBeNull();
    expect(circulo(container)).toHaveAttribute('data-logo', 'si');
  });

  it('sin logo, salen las iniciales como antes', () => {
    const { container } = render(<AvatarTienda nombre="Dark Alien Planeta" logo={null} />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('DA')).toBeInTheDocument();
    expect(circulo(container)).toHaveAttribute('data-logo', 'no');
  });

  it('un logo vacío cuenta como sin logo', () => {
    const { container } = render(<AvatarTienda nombre="Byte Center" logo="" />);
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('BC')).toBeInTheDocument();
  });

  it.each([28, 32, 40, 44, 52])('mide %i px', (tamano) => {
    const { container } = render(<AvatarTienda nombre="Tienda A" logo={null} tamano={tamano} />);
    const estilo = circulo(container).style;
    expect(estilo.getPropertyValue('--avatar')).toBe(`${tamano}px`);
    // Sin tamaño de celular, el mismo.
    expect(estilo.getPropertyValue('--avatar-cel')).toBe(`${tamano}px`);
  });

  it('40 px por defecto, y otro tamaño en el celular si se pide', () => {
    const { container } = render(<AvatarTienda nombre="Tienda A" logo={null} tamanoCelular={44} />);
    const estilo = circulo(container).style;
    expect(estilo.getPropertyValue('--avatar')).toBe('40px');
    expect(estilo.getPropertyValue('--avatar-cel')).toBe('44px');
    expect(circulo(container)).toHaveClass('h-[var(--avatar)]', 'max-sm:h-[var(--avatar-cel)]');
  });

  it('respeta las letras y el fondo de cada lugar', () => {
    const { container } = render(
      <AvatarTienda
        nombre="Tienda Dark"
        logo={null}
        letras="D"
        fondo="bg-tinta font-semibold text-white"
      />,
    );
    expect(screen.getByText('D')).toBeInTheDocument();
    expect(circulo(container)).toHaveClass('bg-tinta', 'font-semibold', 'text-white');
  });

  it('con logo, el fondo de las iniciales no se usa', () => {
    const { container } = render(
      <AvatarTienda nombre="Tienda A" logo="a.webp" fondo="bg-marca text-white" />,
    );
    expect(circulo(container)).not.toHaveClass('bg-marca');
  });

  it('el puntito verde se anuncia, salvo cuando el círculo es solo de adorno', () => {
    const { rerender, container } = render(<AvatarTienda nombre="Tienda A" logo={null} enLinea />);
    expect(screen.getByText('En línea ahora')).toBeInTheDocument();
    rerender(<AvatarTienda nombre="Tienda A" logo={null} enLinea oculto />);
    expect(screen.queryByText('En línea ahora')).toBeNull();
    expect(circulo(container)).toHaveAttribute('aria-hidden', 'true');
  });
});
