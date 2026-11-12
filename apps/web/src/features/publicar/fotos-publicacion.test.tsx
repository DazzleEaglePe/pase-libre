import type { ArchivoSubido } from '@paselibre/contracts';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { FotosPublicacion, portadaElegida, portadaQueSeVe } from './fotos-publicacion';

const CATALOGO = '2026/11/catalogo.webp';
const tuya = (n: number): ArchivoSubido => ({
  ruta: `2026/11/tuya-${n}.webp`,
  ancho: 10,
  alto: 10,
});

/** El paso de fotos con su estado, como lo usa el formulario de publicar. */
function Paso({
  catalogo = CATALOGO,
  inicial = [tuya(1), tuya(2)],
  portadaInicial = null,
  alElegir = () => undefined,
}: {
  catalogo?: string | null;
  inicial?: ArchivoSubido[];
  portadaInicial?: string | null;
  alElegir?: (portada: string | null) => void;
}) {
  const [fotos, setFotos] = useState(inicial);
  const [portada, setPortada] = useState<string | null>(portadaInicial);
  return (
    <FotosPublicacion
      catalogo={catalogo}
      categoria="graficas"
      fotos={fotos}
      alCambiar={setFotos}
      alCargar={() => undefined}
      portada={portada}
      alElegirPortada={(nueva) => {
        alElegir(nueva);
        setPortada(nueva);
      }}
    />
  );
}

const elegidas = () =>
  screen.getAllByRole('button', { pressed: true }).map((boton) => boton.getAttribute('aria-label'));

describe('Fotos de tu publicación (docs/17 §5)', () => {
  it('junta la del catálogo y las tuyas; por defecto la portada es la del catálogo', () => {
    render(<Paso />);
    expect(screen.getByText('Del catálogo')).toBeInTheDocument();
    expect(screen.getAllByText('Tuya')).toHaveLength(2);
    expect(elegidas()).toEqual(['Usar la foto del catálogo de portada']);
    expect(screen.getAllByText('★ Portada')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Agregar tus fotos' })).toBeInTheDocument();
    expect(
      screen.getByText('Una foto con fondo claro y el producto completo se ve mejor en el inicio.'),
    ).toBeInTheDocument();
  });

  it('sin foto del catálogo, la portada es la primera tuya', () => {
    render(<Paso catalogo={null} />);
    expect(screen.queryByText('Del catálogo')).not.toBeInTheDocument();
    expect(elegidas()).toEqual(['Usar tu foto 1 de portada']);
  });

  it('al tocar una tuya la elige, y la del catálogo vuelve a nulo', async () => {
    const alElegir = vi.fn();
    render(<Paso alElegir={alElegir} />);
    await userEvent.click(screen.getByRole('button', { name: 'Usar tu foto 2 de portada' }));
    expect(alElegir).toHaveBeenLastCalledWith(tuya(2).ruta);
    expect(elegidas()).toEqual(['Usar tu foto 2 de portada']);

    await userEvent.click(
      screen.getByRole('button', { name: 'Usar la foto del catálogo de portada' }),
    );
    expect(alElegir).toHaveBeenLastCalledWith(null);
    expect(elegidas()).toEqual(['Usar la foto del catálogo de portada']);
  });

  it('quitar la foto que era portada vuelve a la de siempre', async () => {
    const alElegir = vi.fn();
    render(<Paso portadaInicial={tuya(2).ruta} alElegir={alElegir} />);
    expect(elegidas()).toEqual(['Usar tu foto 2 de portada']);
    await userEvent.click(screen.getByRole('button', { name: 'Quitar tu foto 2' }));
    expect(alElegir).toHaveBeenLastCalledWith(null);
    expect(elegidas()).toEqual(['Usar la foto del catálogo de portada']);
  });

  it('a la API solo va una de tus fotos; la que se ve sigue la misma regla que la API', () => {
    const fotos = [tuya(1)];
    expect(portadaElegida(tuya(1).ruta, fotos)).toBe(tuya(1).ruta);
    expect(portadaElegida(tuya(9).ruta, fotos)).toBeNull();
    expect(portadaQueSeVe(null, CATALOGO, fotos)).toBe(CATALOGO);
    expect(portadaQueSeVe(null, null, fotos)).toBe(tuya(1).ruta);
    expect(portadaQueSeVe(tuya(1).ruta, CATALOGO, fotos)).toBe(tuya(1).ruta);
    expect(portadaQueSeVe(null, null, [])).toBeNull();
  });
});
