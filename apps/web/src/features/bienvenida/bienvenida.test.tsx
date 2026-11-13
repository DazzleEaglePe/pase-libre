import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFalsa } from '@/test/api-falsa';

import { AVISO_CLAVE_MS, Bienvenida, avisarClaveGuardada } from './bienvenida';

vi.mock('next/link', () => ({
  default: ({ href, children, ...resto }: { href: string; children: ReactNode }) => (
    <a href={href} {...resto}>
      {children}
    </a>
  ),
}));

beforeAll(() => {
  // jsdom no abre ventanas modales: basta con marcarla abierta.
  HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open');
  };
});

beforeEach(() => window.sessionStorage.clear());
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

/** Doc 19, punto 11: contraseña → «Conoce PaseLibre» (4 pantallas) → acuerdos. */
describe('Bienvenida del primer ingreso (doc 19, punto 11)', () => {
  it('después de crear la contraseña: paso 2 de 3, el aviso verde y las 4 pantallas', async () => {
    const usuario = userEvent.setup();
    apiFalsa(() => undefined);
    avisarClaveGuardada();
    render(<Bienvenida />);

    expect(await screen.findByText('PASO 2 DE 3 · 1 de 4')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Tu contraseña quedó guardada');
    expect(
      screen.getByRole('heading', { name: 'Todo lo que buscas, en un solo lugar' }),
    ).toBeInTheDocument();
    // En la primera no hay «Atrás».
    expect(screen.queryByRole('button', { name: 'Atrás' })).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getByText('PASO 2 DE 3 · 2 de 4')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Cuando la venta no espera' })).toBeInTheDocument();
    // El aviso es solo de la primera pantalla.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Atrás' }));
    expect(screen.getByText('PASO 2 DE 3 · 1 de 4')).toBeInTheDocument();

    for (const titulo of [
      'Cuando la venta no espera',
      'Tus precios, solo entre tiendas',
      '¿No lo encuentras? Pídelo en vivo',
    ]) {
      await usuario.click(screen.getByRole('button', { name: 'Siguiente' }));
      expect(screen.getByRole('heading', { name: titulo })).toBeInTheDocument();
    }
    // La cuarta también dice «Siguiente»: lleva a los acuerdos.
    await usuario.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(screen.getAllByText('Paso 3 de 3 · Último paso').length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /Qué bueno tenerte aquí/ })).toBeInTheDocument();

    // «Atrás» desde los acuerdos vuelve a la cuarta pantalla.
    await usuario.click(screen.getByRole('button', { name: 'Atrás' }));
    expect(screen.getByText('PASO 2 DE 3 · 4 de 4')).toBeInTheDocument();
  });

  it('«Saltar» lleva a los acuerdos, que hay que aceptar para «¡Empezar!»', async () => {
    const usuario = userEvent.setup();
    const { pedidos } = apiFalsa(({ metodo, ruta }) =>
      metodo === 'POST' && ruta === '/cuenta/bienvenida' ? { estado: 204 } : undefined,
    );
    avisarClaveGuardada();
    render(<Bienvenida />);

    await usuario.click(await screen.findByRole('button', { name: 'Saltar' }));
    const empezar = screen.getByRole('button', { name: '¡Empezar!' });
    expect(empezar).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Saltar' })).not.toBeInTheDocument();

    await usuario.click(screen.getByLabelText(/Acepto los acuerdos/));
    await usuario.click(empezar);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(pedidos).toContainEqual({
      metodo: 'POST',
      ruta: '/cuenta/bienvenida',
      cuerpo: undefined,
    });
    // Termina el primer ingreso: no queda nada guardado en la pestaña.
    expect(window.sessionStorage.length).toBe(0);
  });

  it('con contraseña definitiva no hubo paso 1: son 2 pasos y sin aviso verde', async () => {
    const usuario = userEvent.setup();
    apiFalsa(() => undefined);
    render(<Bienvenida />);

    expect(await screen.findByText('PASO 1 DE 2 · 1 de 4')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    await usuario.click(screen.getByRole('button', { name: 'Saltar' }));
    expect(screen.getAllByText('Paso 2 de 2 · Último paso').length).toBeGreaterThan(0);
  });

  it('el aviso verde se va solo a los 3 s y no vuelve al recargar', () => {
    vi.useFakeTimers();
    apiFalsa(() => undefined);
    avisarClaveGuardada();
    const { unmount } = render(<Bienvenida />);
    expect(screen.getByRole('status')).toHaveTextContent('Tu contraseña quedó guardada');

    act(() => vi.advanceTimersByTime(AVISO_CLAVE_MS));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();

    // Al recargar sigue siendo el paso 2 de 3, pero el aviso ya se mostró.
    unmount();
    render(<Bienvenida />);
    expect(screen.getByText('PASO 2 DE 3 · 1 de 4')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
