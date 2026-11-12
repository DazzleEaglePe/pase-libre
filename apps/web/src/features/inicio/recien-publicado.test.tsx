import type { TarjetaOfertaConVendedor } from '@paselibre/contracts';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RecienPublicado } from './recien-publicado';

const hace = (minutos: number) => new Date(Date.now() - minutos * 60_000).toISOString();

const tarjeta = (n: number) =>
  ({
    oferta_id: `oferta-${n}`,
    producto: {
      slug: `producto-${n}`,
      titulo: `Producto ${n}`,
      categoria: { slug: 'tarjetas-de-video', nombre: 'Tarjetas de video' },
      foto: null,
    },
    condicion: 'NUEVO',
    stock: 1,
    galeria: null,
    actualizada_en: hace(5),
    tienda: { nombre: `Tienda ${n % 3}`, stand: null },
    tienda_visible: true,
    precio: { moneda: 'PEN', centimos: 10_000, monto: '100.00' },
    precio_visible: true,
    propia: false,
    precio_socio: false,
    negociable: false,
  }) as TarjetaOfertaConVendedor;

const lista = (cuantas: number) => Array.from({ length: cuantas }, (_, n) => tarjeta(n + 1));
const filas = () => screen.getAllByRole('list', { name: /^Fila \d de Recién publicado$/ });
const fila = (n: number) => {
  const encontrada = filas()[n];
  if (!encontrada) throw new Error(`No hay fila ${n + 1}`);
  return encontrada;
};
const corrida = (n: number) => fila(n).style.getPropertyValue('--corrida');
const siguientes = () => screen.queryAllByRole('button', { name: 'Ver más de esta fila' });
const anteriores = () =>
  screen.queryAllByRole('button', { name: 'Ver las anteriores de esta fila' });

describe('RecienPublicado (docs/18 §5)', () => {
  it('reparte en 4 filas por turnos, con lo más nuevo al principio de cada una', () => {
    render(<RecienPublicado tarjetas={lista(24)} total={24} />);
    expect(filas()).toHaveLength(4);
    const titulos = within(fila(0))
      .getAllByRole('link')
      .map((enlace) => enlace.querySelector('b')?.textContent);
    expect(titulos).toEqual([1, 5, 9, 13, 17, 21].map((n) => `Producto ${n}`));
    expect(within(fila(1)).getAllByRole('link')[0]).toHaveTextContent('Producto 2');
  });

  it('«Hace 5 min» va en su línea, debajo de «Nuevo · Tienda»', () => {
    render(<RecienPublicado tarjetas={lista(1)} total={1} />);
    const linea = screen.getByText('Nuevo · Tienda 1');
    const etiqueta = screen.getByText('Hace 5 min');
    expect(linea.nextElementSibling).toBe(etiqueta);
    expect(etiqueta).toHaveClass('text-[12px]', 'font-bold', 'text-secundario');
  });

  it('sin más que las 72, ni «Ver todas» ni «1–24 de N»; una fila de 6 no tiene flecha', () => {
    render(<RecienPublicado tarjetas={lista(24)} total={24} />);
    expect(screen.queryByText(/Ver todas las publicaciones/)).not.toBeInTheDocument();
    expect(siguientes()).toHaveLength(0);
    expect(screen.queryByText(/de 24/)).not.toBeInTheDocument();
  });

  it('cada fila se corre sola y la flecha de la derecha desaparece en la tarjeta del final', () => {
    render(<RecienPublicado tarjetas={lista(72)} total={130} />);
    // Las 4 filas llenas terminan en «Ver todas» y abajo sale el botón con el total.
    expect(screen.getAllByText('Ver todas las publicaciones')).toHaveLength(4);
    const boton = screen.getByRole('link', { name: 'Ver todas las publicaciones (130)' });
    expect(boton).toHaveAttribute('href', '/buscar?orden=recientes');

    expect(siguientes()).toHaveLength(4);
    expect(anteriores()).toHaveLength(0);

    // 19 piezas (18 y «Ver todas»): 6, 12 y 13, y ahí se acaba.
    fireEvent.click(siguientes()[0]!);
    expect(corrida(0)).toBe('calc(6 * (100% + 14px) / -6)');
    // Solo esa fila se movió, y solo ella tiene la flecha de volver.
    expect(corrida(1)).toBe('calc(0 * (100% + 14px) / -6)');
    expect(anteriores()).toHaveLength(1);
    fireEvent.click(siguientes()[0]!);
    fireEvent.click(siguientes()[0]!);
    expect(corrida(0)).toBe('calc(13 * (100% + 14px) / -6)');
    expect(siguientes()).toHaveLength(3);

    fireEvent.click(anteriores()[0]!);
    expect(corrida(0)).toBe('calc(7 * (100% + 14px) / -6)');
  });

  it('con 72 justas no hay «Ver todas»: la fila termina en su última tarjeta', () => {
    render(<RecienPublicado tarjetas={lista(72)} total={72} />);
    expect(screen.queryByText(/Ver todas las publicaciones/)).not.toBeInTheDocument();
    fireEvent.click(siguientes()[0]!);
    fireEvent.click(siguientes()[0]!);
    expect(corrida(0)).toBe('calc(12 * (100% + 14px) / -6)');
    expect(siguientes()).toHaveLength(3);
  });

  it('sin publicaciones no se dibuja nada', () => {
    const { container } = render(<RecienPublicado tarjetas={[]} total={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
