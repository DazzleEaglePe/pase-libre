import type { AvisoCampanita, PerfilTienda, ProductoDeTienda } from '@paselibre/contracts';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiFalsa } from '@/test/api-falsa';

import { ListaAvisos } from '../avisos/lista-avisos';
import { PerfilDeTienda } from './perfil-tienda';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh, back: vi.fn(), replace: vi.fn() }),
  usePathname: () => '/tiendas/t1',
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next/link', () => ({
  default: ({ href, children, ...resto }: { href: string; children: ReactNode }) => (
    <a href={href} {...resto}>
      {children}
    </a>
  ),
}));

const producto = (id: string, categoria: string, extra: Partial<ProductoDeTienda> = {}) =>
  ({
    oferta_id: id,
    producto: {
      slug: `producto-${id}`,
      titulo: `Producto ${id}`,
      foto: null,
      categoria: { slug: categoria, nombre: categoria === 'ram' ? 'Memoria RAM' : 'Teclados' },
    },
    condicion: 'NUEVO',
    stock: 2,
    precio: { moneda: 'PEN', centimos: 10_000, monto: '100.00' },
    precio_socio: false,
    negociable: false,
    ...extra,
  }) satisfies ProductoDeTienda;

function perfilDe(extra: Partial<PerfilTienda> = {}): PerfilTienda {
  return {
    id: 't1',
    nombre: 'Dark Alien Planeta',
    iniciales: 'DA',
    galeria: 'Cyberplaza',
    stand: '2B-105',
    horario: null,
    descripcion: null,
    horario_tramos: null,
    indicaciones: null,
    logo: null,
    desde: '2026-11-01T00:00:00.000Z',
    reputacion: {
      promedio: null,
      opiniones: 0,
      ventas: 0,
      nivel: null,
      pases_60: 0,
      responde_en: null,
      respondidos: null,
    },
    seguidores: 48,
    siguiendo: null,
    explicar_seguir: false,
    propia: false,
    puede_seguir: true,
    bloqueada: false,
    total_productos: 3,
    productos: [producto('a', 'ram'), producto('b', 'ram'), producto('c', 'teclados')],
    portada: null,
    categorias_principales: ['Memoria RAM'],
    visibilidad: null,
    privada: false,
    oculta: false,
    logo_borroso: null,
    portada_borrosa: null,
    solicitud_enviada: false,
    puede_escribir: true,
    como_me_ven: false,
    fundadora: null,
    nuevas: [producto('a', 'ram')],
    mejores_precios: [producto('b', 'ram', { mas_barato: true })],
    categorias: [
      { slug: 'ram', nombre: 'Memoria RAM', cantidad: 2 },
      { slug: 'teclados', nombre: 'Teclados', cantidad: 1 },
    ],
    hay_mas: false,
    ...extra,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  refresh.mockClear();
});

describe('Perfil de tienda: lo nuevo, sus mejores precios y todo (doc 20, punto 20)', () => {
  it('arma las tres secciones con la chapita y las burbujas con cuántas tiene', () => {
    apiFalsa(() => undefined);
    render(<PerfilDeTienda perfil={perfilDe()} pestanaInicial="productos" />);
    const nuevas = screen.getByRole('region', { name: 'Lo nuevo de esta semana' });
    expect(within(nuevas).getByText('Producto a')).toBeTruthy();
    const mejores = screen.getByRole('region', { name: 'Sus mejores precios' });
    expect(within(mejores).getByText('Más barato de la galería')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Todo · 3' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: 'Memoria RAM · 2' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Teclados · 1' })).toBeTruthy();
  });

  it('sin nada nuevo ni más barato, esas secciones no aparecen', () => {
    apiFalsa(() => undefined);
    render(
      <PerfilDeTienda
        perfil={perfilDe({ nuevas: [], mejores_precios: [] })}
        pestanaInicial="productos"
      />,
    );
    expect(screen.queryByRole('region', { name: 'Lo nuevo de esta semana' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Sus mejores precios' })).toBeNull();
  });

  it('las categorías marcadas se suman y «Ordenar ▾» pide el orden', async () => {
    const { pedidos } = apiFalsa(({ ruta }) =>
      ruta.startsWith('/tiendas/t1/publicaciones')
        ? {
            cuerpo: {
              productos: [producto('c', 'teclados')],
              total: 1,
              pagina: 1,
              hay_mas: false,
            },
          }
        : undefined,
    );
    const usuario = userEvent.setup();
    render(<PerfilDeTienda perfil={perfilDe()} pestanaInicial="productos" />);
    await usuario.click(screen.getByRole('button', { name: 'Memoria RAM · 2' }));
    await usuario.click(screen.getByRole('button', { name: 'Teclados · 1' }));
    await usuario.click(screen.getByRole('button', { name: /Ordenar: Recién publicados/ }));
    await usuario.click(screen.getByRole('menuitemradio', { name: 'Precio: menor a mayor' }));
    const pedidas = pedidos
      .filter((p) => p.ruta.startsWith('/tiendas/t1/publicaciones'))
      .map((p) => new URLSearchParams(p.ruta.split('?')[1]));
    expect(pedidas.map((q) => q.get('categoria'))).toEqual(['ram', 'ram,teclados', 'ram,teclados']);
    expect(pedidas.at(-1)?.get('orden')).toBe('precio_asc');
    expect(
      screen.getByRole('button', { name: 'Memoria RAM · 2' }).getAttribute('aria-pressed'),
    ).toBe('true');
  });
});

describe('Perfil público, privado u oculto (doc 20, punto 5)', () => {
  it('un privado que no sigues: borroso, sin «Escribir», y «Solicitar seguir» que se cancela', async () => {
    const { pedidos } = apiFalsa(({ metodo, ruta }) =>
      ruta === '/tiendas/t1/solicitud'
        ? { cuerpo: { solicitud_enviada: metodo === 'POST' } }
        : undefined,
    );
    const usuario = userEvent.setup();
    const { container } = render(
      <PerfilDeTienda
        perfil={perfilDe({
          privada: true,
          stand: null,
          productos: [],
          nuevas: [],
          mejores_precios: [],
          categorias: [],
          total_productos: 0,
          puede_escribir: false,
          logo_borroso: 'data:image/webp;base64,AAAA',
          portada_borrosa: 'data:image/webp;base64,BBBB',
        })}
        pestanaInicial="productos"
      />,
    );
    expect(screen.getByText('Esta cuenta es privada')).toBeTruthy();
    expect(screen.getByText('Cyberplaza · 48 seguidores')).toBeTruthy();
    expect(screen.queryByText('Escribir')).toBeNull();
    const fotos = [...container.querySelectorAll('img')].map((img) => img.getAttribute('src'));
    expect(fotos).toEqual(['data:image/webp;base64,BBBB', 'data:image/webp;base64,AAAA']);

    await usuario.click(screen.getByRole('button', { name: 'Solicitar seguir' }));
    expect(await screen.findByText('Solicitud enviada')).toBeTruthy();
    await usuario.click(screen.getByRole('button', { name: 'Cancelar solicitud' }));
    expect(await screen.findByRole('button', { name: 'Solicitar seguir' })).toBeTruthy();
    expect(pedidos.filter((p) => p.ruta === '/tiendas/t1/solicitud').map((p) => p.metodo)).toEqual([
      'POST',
      'DELETE',
    ]);
  });

  it('tu perfil: «Perfil: Público ▾» con sus tres opciones y «Cómo me ven»', async () => {
    const { pedidos } = apiFalsa(({ ruta, cuerpo }) =>
      ruta === '/cuenta/visibilidad' ? { cuerpo } : undefined,
    );
    const usuario = userEvent.setup();
    render(
      <PerfilDeTienda
        perfil={perfilDe({ propia: true, puede_seguir: false, visibilidad: 'PUBLICO' })}
        pestanaInicial="productos"
      />,
    );
    expect(screen.getByRole('link', { name: /Cómo me ven/ }).getAttribute('href')).toBe(
      '/tiendas/t1?como=otra',
    );
    await usuario.click(screen.getByRole('button', { name: /Perfil: Público/ }));
    const menu = screen.getByRole('menu', { name: '¿Quién ve tu perfil?' });
    expect(
      within(menu)
        .getAllByRole('menuitemradio')
        .map((o) => o.textContent),
    ).toEqual([
      expect.stringMatching(/^Público/),
      expect.stringMatching(/^Privado/),
      expect.stringMatching(/^Oculto/),
    ]);
    await usuario.click(within(menu).getByRole('menuitemradio', { name: /^Privado/ }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Perfil: Privado/ })).toBeTruthy(),
    );
    expect(pedidos.find((p) => p.ruta === '/cuenta/visibilidad')).toMatchObject({
      metodo: 'PUT',
      cuerpo: { visibilidad: 'PRIVADO' },
    });
  });

  it('«Cómo me ven» de un perfil oculto dice que nadie lo encuentra', () => {
    apiFalsa(() => undefined);
    render(
      <PerfilDeTienda
        perfil={perfilDe({ oculta: true, como_me_ven: true, puede_seguir: false })}
        pestanaInicial="productos"
      />,
    );
    expect(screen.getByText('Así ven tu perfil las otras tiendas.')).toBeTruthy();
    expect(screen.getByText('Tu perfil está oculto')).toBeTruthy();
  });

  it('la solicitud llega a la campana con «Aceptar» / «Rechazar»', async () => {
    const { pedidos } = apiFalsa(({ ruta }) =>
      ruta === '/solicitudes-seguir/s1/aceptar'
        ? { cuerpo: { mensaje: 'Ahora Tecno Wilson te sigue.' } }
        : { cuerpo: {} },
    );
    const aviso: AvisoCampanita = {
      id: 'a1',
      tipo: 'SOLICITUD_SEGUIR',
      categoria: 'CUENTA',
      titulo: 'Tecno Wilson quiere seguir tu tienda.',
      extracto: null,
      enlace: '/tiendas/t2',
      accion: { tipo: 'SOLICITUD_SEGUIR', solicitud_id: 's1', enlace: '/tiendas/t2' },
      foto: null,
      leido: false,
      actualizado_en: new Date().toISOString(),
    };
    const usuario = userEvent.setup();
    render(<ListaAvisos avisos={[aviso]} />);
    expect(screen.getByRole('button', { name: 'Rechazar' })).toBeTruthy();
    await usuario.click(screen.getByRole('button', { name: 'Aceptar' }));
    expect(await screen.findByText('Ahora Tecno Wilson te sigue.')).toBeTruthy();
    expect(pedidos.map((p) => `${p.metodo} ${p.ruta}`)).toContain(
      'POST /solicitudes-seguir/s1/aceptar',
    );
  });
});
