import type { AvisoCampanita, Contadores, RespuestaAvisos } from '@paselibre/contracts';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFalsa } from '@/test/api-falsa';

import { Campanita, useContadores } from './campanita';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...resto }: { href: string; children: ReactNode }) => (
    <a href={href} {...resto}>
      {children}
    </a>
  ),
}));

afterEach(() => vi.unstubAllGlobals());

/** jsdom no navega: el clic en un aviso marca (lo que se prueba) pero no abre la página. */
const sinNavegar = (evento: MouseEvent) => evento.preventDefault();
beforeEach(() => document.addEventListener('click', sinNavegar));
afterEach(() => document.removeEventListener('click', sinNavegar));

function aviso(id: string, titulo: string): AvisoCampanita {
  return {
    id,
    tipo: 'SISTEMA',
    categoria: 'CUENTA',
    titulo,
    extracto: null,
    foto: null,
    enlace: null,
    accion: null,
    leido: false,
    actualizado_en: new Date().toISOString(),
  };
}

const AVISOS: RespuestaAvisos = {
  avisos: [
    aviso('a1', 'Pegasus5000 te escribió 2 mensajes'),
    aviso('a2', 'Vendiste 1 ASUS RTX 5060'),
    aviso('a3', 'Nueva opinión: ★★★★★'),
  ],
  sin_leer: 3,
  sin_leer_por_categoria: { EN_VIVO: 0, VENTAS: 0, MENSAJES: 0, PUBLICACIONES: 0, CUENTA: 3 },
};

/** Como la cabecera: el número sale de `/contadores` y va a la campanita. */
function ConContadores() {
  const { avisos } = useContadores();
  return <Campanita sinLeer={avisos} />;
}

function apiDeAvisos(
  contadores: Contadores,
  { falla }: { falla?: 'MODO_SOPORTE' | 'ERROR_INTERNO' } = {},
) {
  const error = (codigo: string) => ({
    estado: codigo === 'MODO_SOPORTE' ? 403 : 500,
    cuerpo: { error: { codigo, mensaje: 'No se pudo.' } },
  });
  return apiFalsa(({ metodo, ruta }) => {
    if (metodo === 'GET' && ruta === '/contadores') return { cuerpo: contadores };
    if (metodo === 'GET' && ruta.startsWith('/avisos')) return { cuerpo: AVISOS };
    if (metodo === 'POST' && falla) return error(falla);
    if (metodo === 'POST' && ruta === '/avisos/vistos')
      return { cuerpo: { ...contadores, avisos: 0 } };
    if (metodo === 'POST' && ruta === '/avisos/leidos') return { cuerpo: AVISOS };
    return undefined;
  });
}

describe('La campanita (doc 19, punto 15)', () => {
  it('al abrirla el número se va, y los avisos siguen sin leer', async () => {
    const usuario = userEvent.setup();
    const { pedidos } = apiDeAvisos({ mensajes: 0, avisos: 3 });
    render(<ConContadores />);

    const campana = await screen.findByRole('button', { name: 'Avisos, 3 nuevos' });
    expect(campana).toHaveTextContent('3');

    await usuario.click(campana);
    // Al toque, sin esperar a la API.
    expect(screen.getByRole('button', { name: 'Avisos' })).not.toHaveTextContent('3');
    await waitFor(() =>
      expect(pedidos).toContainEqual({ metodo: 'POST', ruta: '/avisos/vistos', cuerpo: {} }),
    );

    const ventana = screen.getByRole('dialog', { name: 'Avisos' });
    // Cada aviso sigue «sin leer» hasta tocarlo.
    expect(await within(ventana).findAllByText('(sin leer)')).toHaveLength(3);
    expect(pedidos.filter((p) => p.ruta === '/avisos/leidos')).toHaveLength(0);
  });

  it('«Marcar todo como leído» va abajo de la ventanita', async () => {
    const usuario = userEvent.setup();
    const { pedidos } = apiDeAvisos({ mensajes: 0, avisos: 0 });
    render(<Campanita sinLeer={0} />);

    await usuario.click(screen.getByRole('button', { name: 'Avisos' }));
    const ventana = screen.getByRole('dialog', { name: 'Avisos' });
    const marcar = await within(ventana).findByRole('button', { name: 'Marcar todo como leído' });
    // Después de la lista, junto a «Ver todos los avisos».
    const verTodos = within(ventana).getByRole('link', { name: 'Ver todos los avisos' });
    expect(
      within(ventana).getByText('Vendiste 1 ASUS RTX 5060').compareDocumentPosition(marcar),
    ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(marcar.parentElement).toBe(verTodos.parentElement);

    await usuario.click(marcar);
    await waitFor(() =>
      expect(pedidos).toContainEqual({ metodo: 'POST', ruta: '/avisos/leidos', cuerpo: {} }),
    );
  });

  describe('nunca falla en silencio (doc 20, A1)', () => {
    it('si «vistos» responde 403, vuelve a pedir /contadores y el número vuelve (sin un 0 falso)', async () => {
      const usuario = userEvent.setup();
      const { pedidos } = apiDeAvisos({ mensajes: 0, avisos: 3 }, { falla: 'MODO_SOPORTE' });
      render(<ConContadores />);

      const campana = await screen.findByRole('button', { name: 'Avisos, 3 nuevos' });
      const antes = pedidos.filter((p) => p.ruta === '/contadores').length;
      await usuario.click(campana);
      await waitFor(() =>
        expect(pedidos.filter((p) => p.ruta === '/contadores').length).toBeGreaterThan(antes),
      );
      // Lo que dice la API: 3, no el 0 que se puso al toque.
      expect(await screen.findByRole('button', { name: 'Avisos, 3 nuevos' })).toHaveTextContent(
        '3',
      );
      // El 403 de soporte no se anuncia como falla.
      expect(screen.queryByText('No pudimos marcar el aviso. Vuelve a intentarlo.')).toBeNull();
    });

    it('si la API falla al marcar, lo dice por 4 segundos dentro de la ventanita', async () => {
      const usuario = userEvent.setup();
      apiDeAvisos({ mensajes: 0, avisos: 3 }, { falla: 'ERROR_INTERNO' });
      render(<ConContadores />);

      await usuario.click(await screen.findByRole('button', { name: 'Avisos, 3 nuevos' }));
      const ventana = screen.getByRole('dialog', { name: 'Avisos' });
      expect(
        await within(ventana).findByText('No pudimos marcar el aviso. Vuelve a intentarlo.'),
      ).toBeInTheDocument();
      expect(await screen.findByRole('button', { name: 'Avisos, 3 nuevos' })).toBeInTheDocument();
      await waitFor(
        () =>
          expect(
            within(ventana).queryByText('No pudimos marcar el aviso. Vuelve a intentarlo.'),
          ).toBeNull(),
        { timeout: 5_000 },
      );
    });

    it('tocar un aviso lo marca con keepalive, para que el pedido siga al cambiar de página', async () => {
      const usuario = userEvent.setup();
      const { fetchFalso } = apiDeAvisos({ mensajes: 0, avisos: 0 });
      render(<Campanita sinLeer={0} />);

      await usuario.click(screen.getByRole('button', { name: 'Avisos' }));
      const ventana = screen.getByRole('dialog', { name: 'Avisos' });
      await usuario.click(await within(ventana).findByText('Vendiste 1 ASUS RTX 5060'));
      await waitFor(() =>
        expect(fetchFalso).toHaveBeenCalledWith(
          '/v1/avisos/leidos',
          expect.objectContaining({ method: 'POST', keepalive: true }),
        ),
      );
    });
  });

  describe('en modo soporte solo se mira (doc 20, A1)', () => {
    function EnSoporte() {
      const { avisos } = useContadores({ soporte: true });
      return <Campanita sinLeer={avisos} soporte tienda="Tienda A" />;
    }

    it('sin insignia, abrirla no hace ningún POST y dice de quién son los avisos', async () => {
      const usuario = userEvent.setup();
      const { pedidos } = apiDeAvisos({ mensajes: 0, avisos: 3 });
      render(<EnSoporte />);

      await waitFor(() => expect(pedidos.some((p) => p.ruta === '/contadores')).toBe(true));
      const campana = screen.getByRole('button', { name: 'Avisos' });
      expect(campana).not.toHaveTextContent('3');

      await usuario.click(campana);
      const ventana = screen.getByRole('dialog', { name: 'Avisos' });
      expect(
        within(ventana).getByText(
          'Estás viendo los avisos de Tienda A. Para ella siguen sin leer.',
        ),
      ).toBeInTheDocument();
      // Siguen sin leer y sin «Marcar todo como leído».
      expect(await within(ventana).findAllByText('(sin leer)')).toHaveLength(3);
      expect(within(ventana).queryByRole('button', { name: 'Marcar todo como leído' })).toBeNull();

      // Tocar un aviso abre su enlace sin marcarlo.
      await usuario.click(within(ventana).getByText('Vendiste 1 ASUS RTX 5060'));
      expect(pedidos.filter((p) => p.metodo === 'POST')).toEqual([]);
    });
  });
});
