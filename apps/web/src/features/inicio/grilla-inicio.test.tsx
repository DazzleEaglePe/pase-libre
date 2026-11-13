import type { ChapitaInicio, TarjetaInicio } from '@paselibre/contracts';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFalsa } from '@/test/api-falsa';

import { GrillaInicio } from './grilla-inicio';

const hace = (minutos: number) => new Date(Date.now() - minutos * 60_000).toISOString();

const tarjeta = (
  n: number,
  chapita: ChapitaInicio | null = null,
  bajo: number | null = null,
): TarjetaInicio => ({
  oferta_id: `oferta-${n}`,
  producto: {
    slug: `producto-${n}`,
    titulo: `Producto ${n}`,
    categoria: { slug: 'graficas', nombre: 'Tarjetas de video' },
    foto: null,
  },
  condicion: 'NUEVO',
  stock: 1,
  galeria: null,
  actualizada_en: hace(5),
  tienda: { nombre: `Tienda ${n % 3}`, stand: null },
  tienda_visible: true,
  precio: { moneda: 'PEN', centimos: 36_000, monto: '360.00' },
  precio_visible: true,
  propia: false,
  precio_socio: false,
  negociable: false,
  chapita,
  bajo_centimos: bajo,
});

const pagina = (desde: number, cuantas: number) =>
  Array.from({ length: cuantas }, (_, n) => tarjeta(desde + n + 1));

const grilla = () =>
  within(screen.getByRole('region', { name: 'Publicaciones de las tiendas' })).getAllByRole(
    'list',
  )[0]!;
const enlaces = () =>
  within(screen.getByRole('region', { name: 'Publicaciones de las tiendas' }))
    .getAllByRole('link')
    .filter((enlace) => enlace.getAttribute('href')?.startsWith('/p/'));

beforeEach(() => {
  window.scrollTo = vi.fn();
  Element.prototype.scrollIntoView = vi.fn();
  window.matchMedia = vi.fn().mockReturnValue({ matches: false });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** El Inicio sin títulos, con paginación (doc 20, puntos 4 y 22). */
describe('GrillaInicio', () => {
  it('una sola grilla de 20, sin títulos de sección, y «Ver todas las publicaciones (130)»', () => {
    render(<GrillaInicio primera={pagina(0, 20)} totalPaginas={7} enPaginas={130} total={130} />);
    expect(enlaces()).toHaveLength(20);
    expect(screen.queryByRole('heading')).toBeNull();
    expect(
      screen.getByRole('link', { name: /Ver todas las publicaciones \(130\)/ }),
    ).toHaveAttribute('href', '/buscar?orden=recientes');
  });

  it('la paginación de la computadora es 1 2 3 … 7 Siguiente, y la del celular va de a 10', () => {
    render(<GrillaInicio primera={pagina(0, 20)} totalPaginas={7} enPaginas={130} total={130} />);
    const [computadora, celular] = screen.getAllByRole('navigation', {
      name: 'Páginas del Inicio',
    });
    expect(computadora).toHaveClass('max-sm:hidden');
    expect(within(computadora!).getByRole('button', { name: 'Página 1' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(
      within(computadora!)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['1', '2', '3', '7', 'Siguiente']);
    expect(within(computadora!).queryByRole('button', { name: 'Página anterior' })).toBeNull();
    expect(celular).toHaveClass('sm:hidden');
    expect(within(celular!).getByRole('button', { name: 'Página 13' })).toBeInTheDocument();
    // En el celular se ven las 10 primeras: las otras 10 se esconden con CSS.
    const items = grilla().querySelectorAll(':scope > li');
    expect([...items].filter((li) => li.classList.contains('max-sm:hidden'))).toHaveLength(10);
    expect(items[10]).toHaveClass('max-sm:hidden');
  });

  it('«Siguiente» pide la página 2 a la API y muestra las 20 siguientes', async () => {
    const { pedidos } = apiFalsa(({ ruta }) =>
      ruta === '/inicio/recien?pagina=2'
        ? {
            cuerpo: {
              tarjetas: pagina(20, 20),
              pagina: 2,
              total_paginas: 7,
              en_paginas: 130,
              total: 130,
            },
          }
        : undefined,
    );
    render(<GrillaInicio primera={pagina(0, 20)} totalPaginas={7} enPaginas={130} total={130} />);
    const [computadora] = screen.getAllByRole('navigation', { name: 'Páginas del Inicio' });
    fireEvent.click(within(computadora!).getByRole('button', { name: /Siguiente/ }));
    await waitFor(() => expect(enlaces()[0]).toHaveTextContent('Producto 21'));
    expect(pedidos.map((p) => p.ruta)).toEqual(['/inicio/recien?pagina=2']);
    expect(within(computadora!).getByRole('button', { name: 'Página 2' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(within(computadora!).getByRole('button', { name: 'Página anterior' })).toBeEnabled();
    // Volver a la 1 no vuelve a pedirla.
    fireEvent.click(within(computadora!).getByRole('button', { name: 'Página 1' }));
    await waitFor(() => expect(enlaces()[0]).toHaveTextContent('Producto 1'));
    expect(pedidos).toHaveLength(1);
  });

  it('en el celular, la página 2 es la otra mitad de la 1 y no pide nada', () => {
    const { pedidos } = apiFalsa(() => undefined);
    render(<GrillaInicio primera={pagina(0, 20)} totalPaginas={7} enPaginas={130} total={130} />);
    const [, celular] = screen.getAllByRole('navigation', { name: 'Páginas del Inicio' });
    fireEvent.click(within(celular!).getByRole('button', { name: 'Página 2' }));
    const items = [...grilla().querySelectorAll(':scope > li')];
    expect(items[0]).toHaveClass('max-sm:hidden');
    expect(items[10]).not.toHaveClass('max-sm:hidden');
    expect(pedidos).toHaveLength(0);
  });

  it('con una sola página no hay paginación', () => {
    render(<GrillaInicio primera={pagina(0, 8)} totalPaginas={1} enPaginas={8} total={8} />);
    expect(screen.queryByRole('navigation')).toBeNull();
  });
});

/** Las chapitas y la tarjeta (doc 20, puntos 18, 19 y 22). */
describe('TarjetaInicio en la grilla', () => {
  it('cada chapita con su texto y su color; «Bajó S/ 40» con cuánto bajó', () => {
    render(
      <GrillaInicio
        primera={[
          tarjeta(1, 'RECIEN'),
          tarjeta(2, 'MAS_BARATO'),
          tarjeta(3, 'MUY_BUSCADO'),
          tarjeta(4, 'BAJO', 4_000),
          tarjeta(5),
        ]}
        totalPaginas={1}
        enPaginas={5}
        total={5}
      />,
    );
    const chapita = (texto: string) => screen.getByText(texto).closest('.pl-chapita');
    expect(chapita('Recién publicado')).toHaveStyle({ color: '#00875A' });
    expect(chapita('Más barato de la galería')).toHaveStyle({ color: '#C2410C' });
    expect(chapita('Muy buscado hoy')).toHaveStyle({ color: '#6D3FD1' });
    expect(chapita('Bajó S/ 40')).toHaveStyle({ color: '#1D5FD1' });
    expect(enlaces()[4]!.querySelector('.pl-chapita')).toBeNull();
  });

  it('la foto arriba, la línea gris en el bloque de texto y la flechita «›» escondida', () => {
    render(<GrillaInicio primera={[tarjeta(1)]} totalPaginas={1} enPaginas={1} total={1} />);
    const [enlace] = enlaces();
    expect(enlace).toHaveClass('pl-tarjeta-inicio');
    expect(enlace!.firstElementChild).toHaveClass('pl-foto-inicio');
    expect(enlace!.children[1]).toHaveClass('pl-texto-inicio');
    expect(enlace!.querySelector('.pl-flechita')).toHaveAttribute('aria-hidden', 'true');
    expect(within(enlace!).getByText('Nuevo · Tienda 1')).toBeInTheDocument();
    expect(within(enlace!).getByText('Hace 5 min')).toBeInTheDocument();
  });
});
