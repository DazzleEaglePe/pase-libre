import type { GaleriaEquipo, RespuestaGaleriasEquipo } from '@paselibre/contracts';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiFalsa } from '@/test/api-falsa';

import { GaleriasPanel } from './galerias';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

const galeria = (id: string, nombre: string, orden: number, tiendas: number): GaleriaEquipo => ({
  id,
  nombre,
  slug: id,
  activa: true,
  orden,
  metros: null,
  tiendas,
});

function conApi() {
  let datos: RespuestaGaleriasEquipo = {
    galerias: [
      galeria('cyberplaza', 'Cyberplaza', 1, 12),
      galeria('compuplaza', 'CompuPlaza', 2, 0),
      galeria('maxiplaza', 'Maxiplaza', 3, 4),
    ],
    avisos: [
      {
        id: 'aviso-1',
        nombre: 'Plaza Tecno',
        tiendas: ['Tienda Sol', 'Tienda Luna'],
        creada_en: '2026-11-12T15:00:00.000Z',
      },
    ],
  };
  return apiFalsa(({ metodo, ruta, cuerpo }) => {
    if (ruta === '/equipo/galerias' && metodo === 'GET') return { cuerpo: datos };
    if (ruta === '/equipo/galerias/orden' && metodo === 'PUT') return { estado: 204 };
    if (ruta === '/equipo/galerias/avisos/aviso-1/agregar') {
      const nueva = galeria('plaza-tecno', 'Plaza Tecno', 4, 0);
      datos = { galerias: [...datos.galerias, nueva], avisos: [] };
      return { estado: 201, cuerpo: nueva };
    }
    if (ruta === '/equipo/galerias/maxiplaza' && metodo === 'PATCH') {
      const cambios = cuerpo as Partial<GaleriaEquipo>;
      return { cuerpo: { ...galeria('maxiplaza', 'Maxiplaza', 3, 4), ...cambios } };
    }
    return undefined;
  });
}

const nombres = () =>
  within(screen.getByRole('list', { name: 'Galerías en orden' }))
    .getAllByRole('listitem')
    .map((fila) => fila.querySelector('b')?.textContent);

describe('Equipo › Galerías (docs/18 §3)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    refresh.mockClear();
  });

  it('lista las galerías en orden, con sus tiendas, y el aviso de la galería nueva arriba', async () => {
    conApi();
    render(<GaleriasPanel />);
    expect(await screen.findByText('Galería nueva: Plaza Tecno')).toBeTruthy();
    expect(nombres()).toEqual(['Cyberplaza', 'CompuPlaza', 'Maxiplaza']);
    expect(screen.getByText('12 tiendas')).toBeTruthy();
    expect(screen.getByText('0 tiendas')).toBeTruthy();
    expect(
      screen.getByText(/La escribieron 2 tiendas al registrarse: Tienda Sol, Tienda Luna/),
    ).toBeTruthy();
  });

  it('subir una galería guarda el orden nuevo con todas', async () => {
    const { pedidos } = conApi();
    render(<GaleriasPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Subir Maxiplaza' }));
    await waitFor(() =>
      expect(pedidos.find((p) => p.metodo === 'PUT')?.cuerpo).toEqual({
        ids: ['cyberplaza', 'maxiplaza', 'compuplaza'],
      }),
    );
    expect(nombres()).toEqual(['Cyberplaza', 'Maxiplaza', 'CompuPlaza']);
    expect(await screen.findByText('Maxiplaza quedó en el puesto 2.')).toBeTruthy();
  });

  it('«Agregar» del aviso la suma a la lista y actualiza el numerito del panel', async () => {
    conApi();
    render(<GaleriasPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Agregar Plaza Tecno' }));
    await waitFor(() =>
      expect(nombres()).toEqual(['Cyberplaza', 'CompuPlaza', 'Maxiplaza', 'Plaza Tecno']),
    );
    expect(screen.queryByText('Galería nueva: Plaza Tecno')).toBeNull();
    expect(refresh).toHaveBeenCalled();
  });

  it('una galería con tiendas no ofrece borrar, solo ocultar', async () => {
    const { pedidos } = conApi();
    render(<GaleriasPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar Maxiplaza' }));
    const formulario = screen.getByRole('form', { name: 'Editar Maxiplaza' });
    expect(within(formulario).queryByRole('button', { name: 'Borrar galería' })).toBeNull();
    expect(within(formulario).getByText(/no se puede borrar, solo ocultar/)).toBeTruthy();
    fireEvent.click(within(formulario).getByRole('checkbox'));
    fireEvent.click(within(formulario).getByRole('button', { name: 'Guardar' }));
    await waitFor(() =>
      expect(pedidos.find((p) => p.metodo === 'PATCH')?.cuerpo).toEqual({
        nombre: 'Maxiplaza',
        metros: null,
        activa: false,
      }),
    );
    expect(await screen.findByText('Ocultaste Maxiplaza.')).toBeTruthy();
    expect(screen.getByText('Oculta')).toBeTruthy();
  });

  it('una galería sin tiendas se puede borrar', async () => {
    conApi();
    render(<GaleriasPanel />);
    fireEvent.click(await screen.findByRole('button', { name: 'Editar CompuPlaza' }));
    expect(screen.getByRole('button', { name: 'Borrar galería' })).toBeTruthy();
  });
});
