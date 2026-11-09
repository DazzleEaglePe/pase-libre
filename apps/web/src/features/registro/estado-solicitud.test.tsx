import type { RespuestaSolicitud } from '@paselibre/contracts';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiFalsa } from '@/test/api-falsa';

import { EstadoSolicitud } from './estado-solicitud';

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('next/link', () => ({
  default: ({ href, children, ...resto }: { href: string; children: ReactNode }) => (
    <a href={href} {...resto}>
      {children}
    </a>
  ),
}));

const OPCIONES = { activo: true, galerias: [], categorias: [] };
const CONSULTA = 'codigo-de-consulta-de-prueba-123';

function solicitud(cambios: Partial<RespuestaSolicitud>): RespuestaSolicitud {
  return {
    consulta: null,
    estado: 'PENDIENTE',
    aprobada_sola: false,
    vence_en: null,
    mensaje_equipo: null,
    usuario: null,
    datos: {
      metodo: 'SIN_RUC_DNI',
      ruc: null,
      recomienda_tienda: null,
      nombre_comercial: 'Importaciones Lucho',
      categorias: ['Gráficas'],
      galeria: 'cyberplaza',
      galeria_otra: null,
      piso: '1',
      stand: '12',
      referencia: null,
      horario: { dias: ['lun'], desde: '10:00', hasta: '20:00' },
      encargado: 'Lucho Pérez',
      celular: '987123457',
    },
    ...cambios,
  };
}

const conRespuesta = (cuerpo: unknown, estado = 200) =>
  apiFalsa(({ ruta }) =>
    ruta === `/registro/solicitudes/${CONSULTA}` ? { estado, cuerpo } : undefined,
  );

describe('EstadoSolicitud', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('en revisión dice hasta qué hora y lo que ya se recibió', async () => {
    const vence = new Date(Date.now() + (2 * 60 + 30) * 60_000).toISOString();
    conRespuesta(solicitud({ vence_en: vence }));
    render(<EstadoSolicitud consulta={CONSULTA} opciones={OPCIONES} whatsappEquipo={null} />);
    expect(
      await screen.findByRole('heading', { name: 'Estamos revisando tu solicitud' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Te respondemos antes de las .* · quedan 2 h 30 min\./),
    ).toBeInTheDocument();
    expect(screen.getByText('Sin RUC: DNI del encargado')).toBeInTheDocument();
  });

  it('aprobada: el sello, cómo entrar y los primeros pasos', async () => {
    conRespuesta(solicitud({ estado: 'APROBADA', aprobada_sola: true, usuario: '987123457' }));
    render(<EstadoSolicitud consulta={CONSULTA} opciones={OPCIONES} whatsappEquipo={null} />);
    expect(await screen.findByText('Cuenta verificada por PaseLibre')).toBeInTheDocument();
    expect(screen.getByText(/Verificamos tu RUC con SUNAT/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Iniciar sesión' })).toHaveAttribute(
      'href',
      '/ingresar',
    );
    expect(screen.getByRole('link', { name: /Publica tu primer producto/ })).toBeInTheDocument();
  });

  it('con cambios pedidos muestra el mensaje del equipo y deja corregir', async () => {
    conRespuesta(
      solicitud({ estado: 'REQUIERE_CAMBIOS', mensaje_equipo: 'Falta el número de stand.' }),
    );
    render(<EstadoSolicitud consulta={CONSULTA} opciones={OPCIONES} whatsappEquipo={null} />);
    expect(await screen.findByText(/Falta el número de stand\./)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Corregir mi solicitud' })).toBeInTheDocument();
  });

  it('un código que no existe no rompe la página', async () => {
    conRespuesta({ error: { codigo: 'NO_ENCONTRADO', mensaje: 'Esa solicitud no existe.' } }, 404);
    render(<EstadoSolicitud consulta={CONSULTA} opciones={OPCIONES} whatsappEquipo={null} />);
    expect(await screen.findByText('No encontramos esa solicitud')).toBeInTheDocument();
  });
});
