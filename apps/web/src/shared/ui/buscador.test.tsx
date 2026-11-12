import type { RespuestaSugerenciasConTiendas } from '@paselibre/contracts';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiFalsa } from '@/test/api-falsa';

import { Buscador } from './buscador';

const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...resto }: { href: string; children: ReactNode }) => (
    <a href={href} {...resto}>
      {children}
    </a>
  ),
}));

const nuevas = { estrellas: null, opiniones: 0, nueva: true };

/** La opción que dice eso (el nombre resaltado parte el texto en pedazos). */
const opcionCon = (texto: string) => {
  const opcion = screen.getAllByRole('option').find((o) => o.textContent?.includes(texto));
  if (!opcion) throw new Error(`No hay una opción con «${texto}»`);
  return opcion;
};

function conTiendas(tiendas: RespuestaSugerenciasConTiendas['tiendas']) {
  return apiFalsa(({ ruta }) => {
    if (ruta === '/buscar/populares') return { cuerpo: { terminos: [] } };
    if (ruta.startsWith('/buscar/sugerencias'))
      return { cuerpo: { correccion: null, total_productos: 0, productos: [], tiendas } };
    return undefined;
  });
}

describe('Buscador de arriba: tiendas (N13)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    push.mockReset();
  });

  it('con sesión dice «o tienda» y muestra la sección TIENDAS con lo escrito resaltado', async () => {
    conTiendas([
      {
        id: 'a1',
        nombre: 'Pegasus5000',
        logo: null,
        galeria: 'Cyberplaza',
        stand: '3A-110',
        reputacion: { estrellas: 4.9, opiniones: 31, nueva: false },
        en_linea: true,
      },
      {
        id: 'b2',
        nombre: 'Pegaso Computer',
        logo: null,
        galeria: 'Maxiplaza',
        stand: '1-24',
        reputacion: nuevas,
        en_linea: false,
      },
    ]);
    render(<Buscador sobreMarca conSesion />);
    const campo = screen.getByRole('combobox');
    expect(campo).toHaveAttribute('placeholder', 'Busca por modelo, marca, código o tienda');
    await userEvent.type(campo, 'pega');

    expect(await screen.findByText('Tiendas')).toBeInTheDocument();
    const pegasus = opcionCon('Pegasus5000');
    expect(pegasus).toHaveAttribute('href', '/tiendas/a1');
    expect(pegasus.querySelector('u')?.textContent).toBe('Pega');
    expect(pegasus).toHaveTextContent('Cyberplaza · Stand 3A-110');
    expect(pegasus).toHaveTextContent('4,9 ★');
    expect(pegasus).toHaveTextContent('En línea ahora');
    expect(opcionCon('Pegaso Computer')).toHaveTextContent('Nueva');
    expect(
      screen.getByRole('option', { name: 'Ver productos de tiendas «pega…»' }),
    ).toHaveAttribute('href', '/wilson-en-vivo?pestana=tiendas&q=pega');
    expect(screen.getByRole('option', { name: /Ver todas las tiendas/ })).toHaveAttribute(
      'href',
      '/wilson-en-vivo?pestana=tiendas',
    );
  });

  it('con una sola tienda, «Ver productos de …» abre su perfil', async () => {
    conTiendas([
      {
        id: 'a1',
        nombre: 'Pegasus5000',
        logo: null,
        galeria: null,
        stand: null,
        reputacion: nuevas,
        en_linea: false,
      },
    ]);
    render(<Buscador sobreMarca conSesion />);
    await userEvent.type(screen.getByRole('combobox'), 'pegas');
    const opcion = await screen.findByRole('option', { name: 'Ver productos de Pegasus5000' });
    expect(opcion).toHaveAttribute('href', '/tiendas/a1');
    expect(opcionCon('Pegasus5000')).toHaveTextContent('Independiente');
  });

  it('sin sesión no habla de tiendas ni muestra la sección', async () => {
    conTiendas([]);
    render(<Buscador sobreMarca />);
    const campo = screen.getByRole('combobox');
    expect(campo).toHaveAttribute('placeholder', 'Busca por modelo, marca o código');
    await userEvent.type(campo, 'pega');
    await waitFor(() => expect(screen.getByText(/Nadie lo tiene publicado/)).toBeInTheDocument());
    expect(screen.queryByText('Tiendas')).not.toBeInTheDocument();
    expect(screen.queryByText(/Ver todas las tiendas/)).not.toBeInTheDocument();
  });
});
