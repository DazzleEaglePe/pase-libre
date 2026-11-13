import type { AvisoCampanita, Contadores, RespuestaAvisos } from '@paselibre/contracts';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

function aviso(id: string, titulo: string): AvisoCampanita {
  return {
    id,
    tipo: 'SISTEMA',
    categoria: 'CUENTA',
    titulo,
    extracto: null,
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

function apiDeAvisos(contadores: Contadores) {
  return apiFalsa(({ metodo, ruta }) => {
    if (metodo === 'GET' && ruta === '/contadores') return { cuerpo: contadores };
    if (metodo === 'GET' && ruta.startsWith('/avisos')) return { cuerpo: AVISOS };
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
});
