import type { RespuestaOpcionesRegistro } from '@paselibre/contracts';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiFalsa } from '@/test/api-falsa';

import { FormularioRegistro } from './formulario-registro';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...resto }: { href: string; children: ReactNode }) => (
    <a href={href} {...resto}>
      {children}
    </a>
  ),
}));

const OPCIONES: RespuestaOpcionesRegistro = {
  activo: true,
  galerias: [
    { slug: 'cyberplaza', nombre: 'Cyberplaza' },
    { slug: 'maxiplaza', nombre: 'Maxiplaza' },
  ],
  categorias: ['Gráficas', 'RAM'],
};

const CONSULTA = 'codigo-de-consulta-de-prueba-123';

function apiDelRegistro(sobre: { solicitud?: { estado: number; cuerpo: unknown } } = {}) {
  return apiFalsa(({ metodo, ruta }) => {
    if (metodo === 'POST' && ruta === '/registro/celular')
      return { cuerpo: { enviado: true, reenviar_en_s: 60, codigo_prueba: '123456' } };
    if (metodo === 'POST' && ruta === '/registro/celular/verificar')
      return { cuerpo: { token_celular: 't'.repeat(43), expira_en: '2026-11-09T20:00:00Z' } };
    if (metodo === 'POST' && ruta === '/registro/ruc')
      return {
        cuerpo: {
          encontrado: true,
          apto: true,
          datos: {
            razon_social: 'TIENDA B COMPUTER S.A.C.',
            estado: 'ACTIVO',
            condicion: 'HABIDO',
            domicilio: 'Cercado de Lima',
          },
        },
      };
    if (metodo === 'POST' && ruta === '/registro/solicitudes')
      return sobre.solicitud ?? { estado: 201, cuerpo: { consulta: CONSULTA, estado: 'APROBADA' } };
    return undefined;
  });
}

async function confirmarCelular(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.type(screen.getByLabelText('Celular del encargado'), '987 123 456');
  await usuario.click(screen.getByRole('button', { name: 'Enviarme el código' }));
  expect(await screen.findByText(/Tu código es/)).toHaveTextContent('123456');
  await usuario.type(screen.getByLabelText('Código que te llegó por SMS'), '123456');
  await usuario.click(screen.getByRole('button', { name: 'Usar el código' }));
  expect(await screen.findByText(/Celular confirmado/)).toBeInTheDocument();
}

async function llenarElResto(
  usuario: ReturnType<typeof userEvent.setup>,
  clave = 'clave-segura-1',
) {
  await usuario.type(screen.getByLabelText('RUC'), '20512345671');
  await usuario.click(screen.getByRole('button', { name: 'Verificar' }));
  expect(await screen.findByText('TIENDA B COMPUTER S.A.C.')).toBeInTheDocument();
  await usuario.type(screen.getByLabelText(/Cómo te conocen en la galería/), 'Tienda Verde');
  await usuario.click(screen.getByRole('button', { name: 'Gráficas' }));
  await usuario.click(screen.getByRole('button', { name: 'Cyberplaza' }));
  await usuario.type(screen.getByLabelText('Número de stand'), '205');
  await usuario.type(screen.getByLabelText('Nombre del encargado'), 'Rosa Mendoza');
  await usuario.type(screen.getByLabelText('Crea tu contraseña'), clave);
  await usuario.click(screen.getByRole('checkbox'));
}

describe('FormularioRegistro', () => {
  beforeEach(() => push.mockReset());
  afterEach(() => vi.unstubAllGlobals());

  it('no envía nada si falta lo esencial, y dice qué falta', async () => {
    const { pedidos } = apiDelRegistro();
    const usuario = userEvent.setup();
    render(<FormularioRegistro opciones={OPCIONES} />);
    await usuario.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
    expect(screen.getByText('Confirma tu celular con el código que te llega.')).toBeInTheDocument();
    expect(screen.getByText('Escribe cómo te conocen en la galería.')).toBeInTheDocument();
    expect(screen.getByText('Elige tu galería.')).toBeInTheDocument();
    expect(pedidos.some((p) => p.ruta === '/registro/solicitudes')).toBe(false);
    // El error queda atado a su campo, para el lector de pantalla.
    const nombre = screen.getByLabelText(/Cómo te conocen en la galería/);
    expect(nombre).toHaveAttribute('aria-invalid', 'true');
    expect(nombre).toHaveAttribute('aria-describedby', 'nombre-error');
  });

  it('con todo bien, manda la solicitud con el token del celular y va a su página', async () => {
    const { pedidos } = apiDelRegistro();
    const usuario = userEvent.setup();
    render(<FormularioRegistro opciones={OPCIONES} />);
    await confirmarCelular(usuario);
    await llenarElResto(usuario);
    await usuario.click(screen.getByRole('button', { name: 'Enviar solicitud' }));

    await waitFor(() => expect(push).toHaveBeenCalledWith(`/registro/solicitud/${CONSULTA}`));
    const enviada = pedidos.find((p) => p.ruta === '/registro/solicitudes');
    expect(enviada?.cuerpo).toMatchObject({
      token_celular: 't'.repeat(43),
      metodo: 'RUC',
      ruc: '20512345671',
      nombre_comercial: 'Tienda Verde',
      categorias: ['Gráficas'],
      galeria: 'cyberplaza',
      galeria_otra: null,
      stand: '205',
      horario: { dias: ['lun', 'mar', 'mie', 'jue', 'vie', 'sab'], desde: '10:00', hasta: '20:00' },
      encargado: 'Rosa Mendoza',
      clave: 'clave-segura-1',
      acepta_terminos: true,
    });
    // Ni el DNI ni la recomendación viajan si se eligió RUC.
    expect(enviada?.cuerpo).not.toHaveProperty('dni');
  });

  it('pide un número en la contraseña', async () => {
    apiDelRegistro();
    const usuario = userEvent.setup();
    render(<FormularioRegistro opciones={OPCIONES} />);
    await confirmarCelular(usuario);
    await llenarElResto(usuario, 'solo-letras');
    await usuario.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
    expect(
      screen.getByText('La contraseña lleva al menos 8 caracteres y un número.'),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
  });

  it('si el código del celular ya no vale, vuelve a pedir uno', async () => {
    apiDelRegistro({
      solicitud: {
        estado: 400,
        cuerpo: {
          error: {
            codigo: 'DATOS_INVALIDOS',
            mensaje: 'Confirma tu celular otra vez: el código ya no vale.',
          },
        },
      },
    });
    const usuario = userEvent.setup();
    render(<FormularioRegistro opciones={OPCIONES} />);
    await confirmarCelular(usuario);
    await llenarElResto(usuario);
    await usuario.click(screen.getByRole('button', { name: 'Enviar solicitud' }));
    // Vuelve al celular; la espera de un minuto entre códigos sigue corriendo.
    expect(
      await screen.findByRole('button', { name: /Pedir otro código en \d+ s/ }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Celular del encargado')).toBeInTheDocument();
    expect(screen.getByText(/Confirma tu celular otra vez/)).toBeInTheDocument();
  });

  it('sin RUC, pide el DNI y explica que lo revisa una persona', async () => {
    apiDelRegistro();
    const usuario = userEvent.setup();
    render(<FormularioRegistro opciones={OPCIONES} />);
    await usuario.click(screen.getByRole('button', { name: /^Sin RUC/ }));
    expect(
      screen.getByText(/una persona de nuestro equipo revisará tu cuenta/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('DNI del encargado')).toBeInTheDocument();
    expect(screen.queryByLabelText('RUC')).not.toBeInTheDocument();
  });
});
