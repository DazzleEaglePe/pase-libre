import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFalsa } from '@/test/api-falsa';

import { enSeccionDeLaBarra, InvitacionSecciones } from './invitacion-secciones';

const navegacion = vi.hoisted(() => ({ ruta: '/', parametros: '' }));
vi.mock('next/navigation', () => ({
  usePathname: () => navegacion.ruta,
  useSearchParams: () => new URLSearchParams(navegacion.parametros),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...resto }: { href: string; children: ReactNode }) => (
    <a href={href} {...resto}>
      {children}
    </a>
  ),
}));

function en(ruta: string, parametros = '') {
  navegacion.ruta = ruta;
  navegacion.parametros = parametros;
}

const BANDA = '¿Conoces una tienda que debería estar aquí?';

beforeEach(() => en('/'));
afterEach(() => vi.unstubAllGlobals());

// La X se recuerda en el módulo durante la visita: su prueba va al final.
describe('La banda de invitar en las secciones (doc 19, punto 14)', () => {
  it('va en las secciones de la barra negra y en ninguna otra página', () => {
    const sin = new URLSearchParams();
    for (const ruta of [
      '/categorias',
      '/categorias/memorias-ram',
      '/pedidos-en-vivo',
      '/tiendas-que-sigues',
      '/wilson-en-vivo',
    ]) {
      expect(enSeccionDeLaBarra(ruta, sin), ruta).toBe(true);
    }
    // Remates de hoy, Recién llegados y una categoría desde «Todas las categorías».
    expect(enSeccionDeLaBarra('/pedidos-en-vivo', new URLSearchParams('tipo=remato'))).toBe(true);
    expect(enSeccionDeLaBarra('/buscar', new URLSearchParams('orden=recientes'))).toBe(true);
    expect(enSeccionDeLaBarra('/buscar', new URLSearchParams('categoria=ram'))).toBe(true);

    for (const ruta of [
      '/',
      '/buscar',
      '/mensajes',
      '/mensajes/equipo',
      '/publicar',
      '/pedidos-en-vivo/publicar',
      '/cuenta/configuracion',
      '/mis-publicaciones',
      '/avisos',
      '/equipo/cuentas',
      '/p/rtx-4060',
      '/tiendas/123',
    ]) {
      expect(enSeccionDeLaBarra(ruta, sin), ruta).toBe(false);
    }
    expect(enSeccionDeLaBarra('/buscar', new URLSearchParams('q=rtx'))).toBe(false);
  });

  it('sale al final de Pedidos en vivo con su X, y no en Mensajes', () => {
    en('/pedidos-en-vivo');
    const { unmount } = render(<InvitacionSecciones cerrada={false} />);
    expect(screen.getByRole('heading', { name: BANDA })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cerrar: no volver a mostrar' })).toBeInTheDocument();
    unmount();

    en('/mensajes');
    render(<InvitacionSecciones cerrada={false} />);
    expect(screen.queryByRole('heading', { name: BANDA })).not.toBeInTheDocument();
  });

  it('cerrada en la cuenta, no sale', () => {
    en('/wilson-en-vivo');
    render(<InvitacionSecciones cerrada />);
    expect(screen.queryByRole('heading', { name: BANDA })).not.toBeInTheDocument();
  });

  it('la X la guarda en la cuenta y no vuelve en otra sección', async () => {
    const usuario = userEvent.setup();
    const { pedidos } = apiFalsa(({ metodo, ruta }) =>
      metodo === 'POST' && ruta === '/secciones/invitar-cerrado' ? { estado: 204 } : undefined,
    );
    en('/categorias');
    const { unmount } = render(<InvitacionSecciones cerrada={false} />);
    await usuario.click(screen.getByRole('button', { name: 'Cerrar: no volver a mostrar' }));
    expect(screen.queryByRole('heading', { name: BANDA })).not.toBeInTheDocument();
    expect(pedidos).toContainEqual({
      metodo: 'POST',
      ruta: '/secciones/invitar-cerrado',
      cuerpo: {},
    });
    unmount();

    // El pie de otra sección, con la sesión que trajo el servidor antes de la X.
    en('/tiendas-que-sigues');
    render(<InvitacionSecciones cerrada={false} />);
    expect(screen.queryByRole('heading', { name: BANDA })).not.toBeInTheDocument();
  });
});
