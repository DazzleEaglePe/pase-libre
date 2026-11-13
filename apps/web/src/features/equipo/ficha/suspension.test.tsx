import type { FichaTienda } from '@paselibre/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { EstadoSuspension, faltaParaEliminar, suspendidaHace } from './suspension';

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }));

const HORA = 3_600_000;
// Viernes 13/11/2026 22:04 en Lima (UTC−5).
const AHORA = new Date('2026-11-14T03:04:00Z');

function ficha(suspendidaHaceHoras: number, administrador = true): FichaTienda {
  const en = new Date(AHORA.getTime() - suspendidaHaceHoras * HORA);
  return {
    id: 't1',
    nombre: 'Prueba',
    suspendida: true,
    suspension: {
      en: en.toISOString(),
      por: 'Fabrizio',
      motivo: 'Spam o publicaciones falsas',
      eliminable_desde: new Date(en.getTime() + 24 * HORA).toISOString(),
      publicaciones: { activas: 0, antiguas: 3 },
    },
    puede_eliminar: administrador,
  } as FichaTienda;
}

/** Doc 19 §9: «Eliminar definitivamente» apagado las primeras 24 h y rojo después. */
describe('Suspendida (doc 19 §9)', () => {
  it('dice hace cuánto y cuánto falta, con la hora de Lima', () => {
    expect(suspendidaHace(new Date(AHORA.getTime() - 3 * HORA).toISOString(), AHORA)).toBe(
      'Suspendida hace 3 h',
    );
    expect(suspendidaHace(new Date(AHORA.getTime() - 50 * HORA).toISOString(), AHORA)).toBe(
      'Suspendida hace 2 días',
    );
    // Suspendida hace 3 h: faltan 21 h y se habilita mañana a las 19:04.
    expect(faltaParaEliminar(new Date(AHORA.getTime() + 21 * HORA).toISOString(), AHORA)).toBe(
      '21 h (mañana 19:04)',
    );
  });

  it('las primeras 24 h el botón está apagado y explica cuándo se podrá', () => {
    render(
      <EstadoSuspension
        ficha={ficha(3)}
        alReactivar={vi.fn()}
        alEliminar={vi.fn()}
        ahora={AHORA}
      />,
    );
    expect(screen.getByRole('button', { name: 'Eliminar definitivamente' })).toBeDisabled();
    expect(
      screen.getByText(/Podrás eliminarla en 21 h \(mañana 19:04\)\. Mientras tanto/),
    ).toBeInTheDocument();
  });

  it('después de 24 h se habilita; quien no es administrador no lo ve', () => {
    const { unmount } = render(
      <EstadoSuspension
        ficha={ficha(30)}
        alReactivar={vi.fn()}
        alEliminar={vi.fn()}
        ahora={AHORA}
      />,
    );
    expect(screen.getByRole('button', { name: 'Eliminar definitivamente' })).toBeEnabled();
    expect(screen.queryByText(/Podrás eliminarla/)).toBeNull();
    unmount();
    render(
      <EstadoSuspension
        ficha={ficha(30, false)}
        alReactivar={vi.fn()}
        alEliminar={vi.fn()}
        ahora={AHORA}
      />,
    );
    expect(screen.queryByRole('button', { name: 'Eliminar definitivamente' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Reactivar' })).toBeEnabled();
  });
});
