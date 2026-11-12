import type { RespuestaDirectorioTiendas, TiendaDelDirectorio } from '@paselibre/contracts';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiFalsa } from '@/test/api-falsa';

import { SIN_FILTROS } from './consulta-directorio';
import { DirectorioTiendas } from './directorio-tiendas';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...resto }: { href: string; children: ReactNode }) => (
    <a href={href} {...resto}>
      {children}
    </a>
  ),
}));

const tienda = (id: string, nombre: string, extra: Partial<TiendaDelDirectorio> = {}) => ({
  id,
  nombre,
  logo: null,
  galeria: 'Cyberplaza',
  stand: '3A-110',
  piso: '3',
  vende: ['Tarjetas de video', 'Monitores'],
  reputacion: { estrellas: null, opiniones: 0, nueva: true },
  en_linea: false,
  propia: false,
  ...extra,
});

const DATOS: RespuestaDirectorioTiendas = {
  tiendas: [
    tienda('a1', 'Pegasus5000', {
      reputacion: { estrellas: 4.9, opiniones: 31, nueva: false },
      en_linea: true,
    }),
    tienda('b2', 'Tienda B', { propia: true, vende: [] }),
  ],
  total: 3,
  pagina: 1,
  hay_mas: true,
  filtros: {
    galerias: [
      { slug: 'cyberplaza', nombre: 'Cyberplaza' },
      { slug: 'maxiplaza', nombre: 'Maxiplaza' },
    ],
    pisos: ['Sótano', '3'],
    categorias: [{ slug: 'tarjetas-de-video', nombre: 'Tarjetas de video' }],
  },
};

describe('Pestaña «Tiendas» de Wilson en vivo (N13)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    push.mockReset();
  });

  it('cada tienda con su lugar, lo que vende, la reputación o «Nueva» y «Ver tienda»', () => {
    render(<DirectorioTiendas inicial={DATOS} consulta={SIN_FILTROS} />);
    const [pegasus, propia] = screen.getAllByRole('listitem');
    expect(pegasus).toHaveTextContent('Cyberplaza · 3A-110 · Piso 3');
    expect(pegasus).toHaveTextContent('Tarjetas de video · Monitores');
    expect(pegasus).toHaveTextContent('4,9 ★ · 31 opiniones');
    expect(pegasus).toHaveTextContent('En línea ahora');
    expect(screen.getByRole('link', { name: 'Ver la tienda Pegasus5000' })).toHaveAttribute(
      'href',
      '/tiendas/a1',
    );
    expect(propia).toHaveTextContent('Nueva');
    expect(propia).toHaveTextContent('Aún no publica productos');
    expect(screen.getByRole('link', { name: 'Ver tu tienda' })).toHaveAttribute(
      'href',
      '/tiendas/b2',
    );
  });

  it('los filtros cambian la dirección; otra galería olvida el piso', async () => {
    render(
      <DirectorioTiendas
        inicial={DATOS}
        consulta={{ ...SIN_FILTROS, galeria: 'cyberplaza', piso: '3' }}
      />,
    );
    await userEvent.selectOptions(screen.getByLabelText('Galería'), 'maxiplaza');
    expect(push).toHaveBeenLastCalledWith('/wilson-en-vivo?pestana=tiendas&galeria=maxiplaza', {
      scroll: false,
    });
    await userEvent.selectOptions(screen.getByLabelText('Ordenar'), 'nombre');
    expect(push).toHaveBeenLastCalledWith(
      '/wilson-en-vivo?pestana=tiendas&galeria=cyberplaza&piso=3&orden=nombre',
      { scroll: false },
    );
  });

  it('«Ver más tiendas» trae la siguiente tanda con los mismos filtros', async () => {
    const { pedidos } = apiFalsa(({ ruta }) =>
      ruta.startsWith('/wilson/tiendas')
        ? {
            cuerpo: {
              ...DATOS,
              tiendas: [tienda('c3', 'Maxi Tech')],
              pagina: 2,
              hay_mas: false,
            },
          }
        : undefined,
    );
    render(
      <DirectorioTiendas
        inicial={DATOS}
        consulta={{ ...SIN_FILTROS, vende: 'tarjetas-de-video' }}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Ver más tiendas' }));
    expect(await screen.findByText('Maxi Tech')).toBeInTheDocument();
    expect(pedidos[0]?.ruta).toBe('/wilson/tiendas?vende=tarjetas-de-video&pagina=2');
    expect(screen.queryByRole('button', { name: 'Ver más tiendas' })).not.toBeInTheDocument();
  });
});
