import type { OfertaPropia } from '@paselibre/contracts';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { BotonEditar, MenuNoDisponible, motivoNoDisponible } from './no-disponible';

const TITULO = 'Corsair Vengeance RGB 32GB DDR5 6000';

function ConMenu({ alElegir }: { alElegir: (razon: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  return (
    <MenuNoDisponible titulo={TITULO} abierto={abierto} alAbrir={setAbierto} alElegir={alElegir} />
  );
}

/** Mis publicaciones: «Editar» y «No disponible ▾» (doc 20, puntos 14 y 16). */
describe('Mis publicaciones: «Editar» y «No disponible ▾»', () => {
  it('«Editar» con lápiz lleva a la pantalla de editar', () => {
    render(
      <BotonEditar
        oferta={{ id: 'oferta-1', producto: { titulo: TITULO } as OfertaPropia['producto'] }}
      />,
    );
    const enlace = screen.getByRole('link', { name: `Editar ${TITULO}` });
    expect(enlace).toHaveAttribute('href', '/publicar?editar=oferta-1');
    expect(enlace).toHaveTextContent('Editar');
    expect(enlace.querySelector('svg')).not.toBeNull();
  });

  it('abre «¿Por qué no está disponible?» con los tres motivos y la nota', async () => {
    const alElegir = vi.fn();
    render(<ConMenu alElegir={alElegir} />);
    const boton = screen.getByRole('button', { name: `No disponible: ${TITULO}` });
    expect(boton).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(boton);

    const menu = screen.getByRole('menu', { name: '¿Por qué no está disponible?' });
    expect(menu).toHaveTextContent('¿Por qué no está disponible?');
    const opciones = screen.getAllByRole('menuitem');
    expect(opciones.map((opcion) => opcion.querySelector('b')?.textContent)).toEqual([
      'Se me acabó',
      'La separé para un cliente',
      'Otro motivo',
    ]);
    expect(opciones[0]).toHaveTextContent('Vuelve sola cuando subes la cantidad.');
    expect(opciones[1]).toHaveTextContent('En el chat dice «Separada».');
    expect(menu).toHaveTextContent(
      'Mientras no esté disponible, no sale en búsquedas ni en el feed.',
    );
    // El foco entra al menú.
    expect(opciones[0]).toHaveFocus();

    await userEvent.click(screen.getByRole('menuitem', { name: /La separé para un cliente/ }));
    expect(alElegir).toHaveBeenCalledWith('La separé para un cliente');
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('se cierra con Escape sin elegir nada', async () => {
    const alElegir = vi.fn();
    render(<ConMenu alElegir={alElegir} />);
    await userEvent.click(screen.getByRole('button', { name: `No disponible: ${TITULO}` }));
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(alElegir).not.toHaveBeenCalled();
  });

  it('en «No disponibles» se lee el motivo', () => {
    expect(motivoNoDisponible({ estado: 'ACTIVA', razon_pausa: null })).toBe('Sin stock');
    expect(
      motivoNoDisponible({ estado: 'PAUSADA', razon_pausa: 'La separé para un cliente' }),
    ).toBe('Separada para un cliente');
    expect(motivoNoDisponible({ estado: 'PAUSADA', razon_pausa: 'Se me acabó' })).toBe(
      'Se me acabó',
    );
    expect(motivoNoDisponible({ estado: 'PAUSADA', razon_pausa: null })).toBe('Oculta');
  });
});
