import type { RespuestaYo } from '@paselibre/contracts';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFalsa } from '@/test/api-falsa';

import { FormularioAcceso } from './formulario-acceso';

const replace = vi.fn();
const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace, refresh, push: vi.fn() }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...resto }: { href: string; children: ReactNode }) => (
    <a href={href} {...resto}>
      {children}
    </a>
  ),
}));

function yo(sobre: Partial<RespuestaYo['usuario']> = {}): RespuestaYo {
  return {
    usuario: {
      id: 'u1',
      usuario: 'tiendab',
      nombre: 'Tienda B',
      correo: null,
      rol: 'DUENO',
      debe_cambiar_clave: false,
      version_vista: null,
      ver_bienvenida: true,
      tema_oscuro: false,
      invitar_secciones_cerrado: false,
      permisos: [],
      ...sobre,
    },
    tienda: null,
    soporte: null,
  };
}

async function crearClave(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.type(screen.getByLabelText('Contraseña nueva'), 'clave1234');
  await usuario.type(screen.getByLabelText('Repite la contraseña'), 'clave1234');
  await usuario.click(screen.getByRole('button', { name: 'Guardar y seguir' }));
}

beforeEach(() => {
  replace.mockClear();
  refresh.mockClear();
  window.sessionStorage.clear();
});
afterEach(() => vi.unstubAllGlobals());

/** Doc 19, punto 11 y A4: «Crea tu contraseña» es el paso 1 de 3 y ya no hay «Listo, ya entraste». */
describe('Primer ingreso: «Crea tu contraseña» (doc 19, punto 11)', () => {
  it('«Guardar y seguir» lleva directo al inicio, con refresh, y deja el aviso para la bienvenida', async () => {
    const usuario = userEvent.setup();
    const { pedidos } = apiFalsa(({ metodo, ruta }) =>
      metodo === 'POST' && ruta === '/sesion/clave' ? { cuerpo: yo() } : undefined,
    );
    render(
      <FormularioAcceso primerIngreso="tiendab" bienvenidaPendiente pestanaInicial="ingresar" />,
    );
    expect(screen.getByText('Paso 1 de 3')).toBeInTheDocument();
    expect(screen.getByText('Primer ingreso · tiendab')).toBeInTheDocument();

    await crearClave(usuario);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'));
    // Sin el refresh la cabecera seguía diciendo «Iniciar sesión» (A4).
    expect(refresh).toHaveBeenCalled();
    expect(pedidos).toContainEqual({
      metodo: 'POST',
      ruta: '/sesion/clave',
      cuerpo: { clave_nueva: 'clave1234' },
    });
    expect(screen.queryByText('Listo, ya entraste')).not.toBeInTheDocument();
    expect(window.sessionStorage.getItem('paselibre:primer-ingreso')).toBe('clave-guardada');
  });

  it('con el enlace de una tienda vuelve ahí', async () => {
    const usuario = userEvent.setup();
    apiFalsa(({ metodo, ruta }) =>
      metodo === 'POST' && ruta === '/sesion/clave' ? { cuerpo: yo() } : undefined,
    );
    render(
      <FormularioAcceso
        primerIngreso="tiendab"
        bienvenidaPendiente
        pestanaInicial="ingresar"
        volver="/tiendas/123"
      />,
    );
    await crearClave(usuario);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/tiendas/123'));
    expect(refresh).toHaveBeenCalled();
  });

  it('sin bienvenida pendiente (el equipo) no cuenta pasos ni deja el aviso', async () => {
    const usuario = userEvent.setup();
    apiFalsa(({ metodo, ruta }) =>
      metodo === 'POST' && ruta === '/sesion/clave'
        ? { cuerpo: yo({ rol: 'EQUIPO', ver_bienvenida: false }) }
        : undefined,
    );
    render(<FormularioAcceso primerIngreso="fabrizio" pestanaInicial="ingresar" />);
    expect(screen.queryByText('Paso 1 de 3')).not.toBeInTheDocument();

    await crearClave(usuario);
    await waitFor(() => expect(replace).toHaveBeenCalledWith('/equipo/cuentas'));
    expect(refresh).toHaveBeenCalled();
    expect(window.sessionStorage.getItem('paselibre:primer-ingreso')).toBeNull();
  });

  it('al ingresar con la contraseña temporal pasa a «Crea tu contraseña», paso 1 de 3', async () => {
    const usuario = userEvent.setup();
    apiFalsa(({ metodo, ruta }) =>
      metodo === 'POST' && ruta === '/sesion'
        ? { cuerpo: yo({ debe_cambiar_clave: true }) }
        : undefined,
    );
    render(<FormularioAcceso primerIngreso={null} pestanaInicial="ingresar" />);
    await usuario.type(screen.getByLabelText('Correo o usuario'), 'tiendab');
    await usuario.type(screen.getByLabelText('Contraseña'), 'temporal1');
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Paso 1 de 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Guardar y seguir' })).toBeInTheDocument();
    expect(replace).not.toHaveBeenCalled();
  });
});
