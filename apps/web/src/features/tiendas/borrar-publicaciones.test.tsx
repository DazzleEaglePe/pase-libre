import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  AvisoDeshacer,
  BarraSeleccion,
  ConfirmarVarias,
  SEGUNDOS_DESHACER,
  useBorradoConDeshacer,
} from './borrar-publicaciones';

/** Un perfil de mentira que borra con «Deshacer». */
function Prueba({ alFallar = () => undefined }: { alFallar?: (ids: string[]) => void }) {
  const borrado = useBorradoConDeshacer(alFallar);
  return (
    <>
      <button type="button" onClick={() => borrado.programar(['a', 'b'])}>
        Borrar dos
      </button>
      <button type="button" onClick={() => borrado.programar(['c'])}>
        Borrar otra
      </button>
      {borrado.pendiente && (
        <AvisoDeshacer
          cuantas={borrado.pendiente.ids.length}
          desde={borrado.pendiente.desde}
          alDeshacer={() => borrado.deshacer()}
        />
      )}
    </>
  );
}

/** Lo que se mandó a la API: el cuerpo y si iba con `keepalive`. */
const mandados = (fetch: ReturnType<typeof vi.fn>) =>
  fetch.mock.calls.map((llamada) => {
    const [ruta, opciones] = llamada as [string, RequestInit];
    return {
      ruta,
      ids: JSON.parse(String(opciones.body)).ids as string[],
      keepalive: opciones.keepalive === true,
    };
  });

describe('Borrar desde tu perfil con «Deshacer» (docs/19 §12)', () => {
  let fetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    fetch = vi.fn(async () => new Response(JSON.stringify({ eliminadas: 1 }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('manda el borrado recién al terminar los 8 s', async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Prueba />);
    await usuario.click(screen.getByRole('button', { name: 'Borrar dos' }));
    expect(screen.getByRole('status')).toHaveTextContent('Eliminaste 2 publicaciones');
    expect(fetch).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(SEGUNDOS_DESHACER * 1000 - 100));
    expect(fetch).not.toHaveBeenCalled();
    await act(() => vi.advanceTimersByTimeAsync(200));
    expect(mandados(fetch)).toEqual([
      { ruta: '/v1/ofertas/eliminar', ids: ['a', 'b'], keepalive: false },
    ]);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('con «Deshacer» no se manda nada', async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Prueba />);
    await usuario.click(screen.getByRole('button', { name: 'Borrar dos' }));
    await usuario.click(screen.getByRole('button', { name: 'Deshacer' }));
    await act(() => vi.advanceTimersByTimeAsync(SEGUNDOS_DESHACER * 1000 + 500));
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('otro borrado manda el anterior en ese momento', async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Prueba />);
    await usuario.click(screen.getByRole('button', { name: 'Borrar dos' }));
    await usuario.click(screen.getByRole('button', { name: 'Borrar otra' }));
    expect(mandados(fetch)).toEqual([
      { ruta: '/v1/ofertas/eliminar', ids: ['a', 'b'], keepalive: false },
    ]);
    expect(screen.getByRole('status')).toHaveTextContent('Eliminaste 1 publicación');
  });

  it('si se cierra la página (o se sale del perfil) antes, se manda con keepalive', async () => {
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const { unmount } = render(<Prueba />);
    await usuario.click(screen.getByRole('button', { name: 'Borrar dos' }));
    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });
    expect(mandados(fetch)).toEqual([
      { ruta: '/v1/ofertas/eliminar', ids: ['a', 'b'], keepalive: true },
    ]);
    await usuario.click(screen.getByRole('button', { name: 'Borrar otra' }));
    unmount();
    expect(mandados(fetch)[1]).toEqual({
      ruta: '/v1/ofertas/eliminar',
      ids: ['c'],
      keepalive: true,
    });
    await act(() => vi.advanceTimersByTimeAsync(SEGUNDOS_DESHACER * 1000 + 500));
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('si la API no puede, las devuelve', async () => {
    fetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { codigo: 'NO_ENCONTRADO', mensaje: 'No está.' } }), {
        status: 404,
      }),
    );
    const alFallar = vi.fn();
    const usuario = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<Prueba alFallar={alFallar} />);
    await usuario.click(screen.getByRole('button', { name: 'Borrar dos' }));
    await act(() => vi.advanceTimersByTimeAsync(SEGUNDOS_DESHACER * 1000 + 100));
    expect(alFallar).toHaveBeenCalledWith(['a', 'b'], 'No está.');
  });
});

describe('«Eliminar varias»: la barra negra y la confirmación', () => {
  it('«(N) seleccionadas · Cancelar · Eliminar N»', async () => {
    const alEliminar = vi.fn();
    const { rerender } = render(
      <BarraSeleccion cuantas={0} alCancelar={() => undefined} alEliminar={alEliminar} />,
    );
    expect(screen.getByRole('button', { name: 'Eliminar 0' })).toBeDisabled();
    rerender(<BarraSeleccion cuantas={2} alCancelar={() => undefined} alEliminar={alEliminar} />);
    expect(screen.getByRole('region', { name: 'Eliminar varias' })).toHaveTextContent(
      '2seleccionadas',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar 2' }));
    expect(alEliminar).toHaveBeenCalled();
  });

  it('«¿Eliminar 2 publicaciones?» sugiere «No disponible»', async () => {
    const alPausar = vi.fn();
    const alEliminar = vi.fn();
    render(
      <ConfirmarVarias
        cuantas={2}
        trabajando={false}
        alEliminar={alEliminar}
        alPausar={alPausar}
        alCancelar={() => undefined}
      />,
    );
    expect(screen.getByRole('alertdialog')).toHaveTextContent('¿Eliminar 2 publicaciones?');
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Si solo no tienes stock, mejor «No disponible».',
    );
    await userEvent.click(screen.getByRole('button', { name: 'No disponible' }));
    expect(alPausar).toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: 'Sí, eliminar' }));
    expect(alEliminar).toHaveBeenCalled();
  });
});
