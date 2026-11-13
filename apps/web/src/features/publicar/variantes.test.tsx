import type { VariantesOferta } from '@paselibre/contracts';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { PreguntasVariantes } from './variantes';

const NADA: VariantesOferta = { perfil_memoria: null, empaque: null, oc: null };

function Preguntas({
  categoria,
  inicial = NADA,
  delCatalogo = null,
  alCambiar = () => undefined,
}: {
  categoria: string;
  inicial?: VariantesOferta;
  delCatalogo?: VariantesOferta['perfil_memoria'];
  alCambiar?: (variantes: VariantesOferta) => void;
}) {
  const [variantes, setVariantes] = useState(inicial);
  return (
    <PreguntasVariantes
      categoria={categoria}
      titulo="Kingston FURY Beast 8GB DDR4 3200"
      variantes={variantes}
      delCatalogo={delCatalogo}
      alCambiar={(nuevas) => {
        alCambiar(nuevas);
        setVariantes(nuevas);
      }}
    />
  );
}

describe('Al publicar: para qué procesador es y el empaque (docs/19 §13)', () => {
  it('en Memoria RAM pregunta el procesador (IMPORTANTE) y el empaque, con el recuadro naranja', () => {
    render(<Preguntas categoria="ram" />);
    expect(screen.getByText('¿Para qué procesador es?')).toBeInTheDocument();
    expect(screen.getByText('IMPORTANTE')).toBeInTheDocument();
    expect(screen.getAllByText('(opcional)')).toHaveLength(2);
    expect(screen.getByRole('radio', { name: 'Intel XMP · para Intel' })).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'EXPO Ryzen · para AMD' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Sirve para los dos' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Con caja' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'OEM · sin caja' })).toBeInTheDocument();
    expect(screen.getByText(/Las tiendas buscan «RAM para Ryzen»/)).toBeInTheDocument();
    // Una RAM no pregunta OC.
    expect(screen.queryByRole('radiogroup', { name: 'OC o normal' })).toBeNull();
  });

  it('viene marcado si el catálogo lo sabe, y se puede cambiar o desmarcar', async () => {
    const alCambiar = vi.fn();
    render(
      <Preguntas
        categoria="ram"
        inicial={{ ...NADA, perfil_memoria: 'XMP' }}
        delCatalogo="XMP"
        alCambiar={alCambiar}
      />,
    );
    expect(screen.getByRole('radio', { name: '✓ Intel XMP · para Intel' })).toBeChecked();
    expect(
      screen.getByText(/✦ Ya viene marcado: el catálogo dice que esta memoria es Intel XMP/),
    ).toBeInTheDocument();
    // El título lleva su pastilla.
    expect(screen.getByText('Intel XMP')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'EXPO Ryzen · para AMD' }));
    expect(alCambiar).toHaveBeenLastCalledWith({ ...NADA, perfil_memoria: 'EXPO' });
    expect(screen.queryByText(/Ya viene marcado/)).toBeNull();
    expect(screen.getByText('EXPO Ryzen')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: '✓ EXPO Ryzen · para AMD' }));
    expect(alCambiar).toHaveBeenLastCalledWith(NADA);
  });

  it('tarjetas de video: OC o normal; procesadores: Box o Tray; otras categorías, nada', async () => {
    const alCambiar = vi.fn();
    const { unmount } = render(<Preguntas categoria="graficas" alCambiar={alCambiar} />);
    expect(screen.queryByText('¿Para qué procesador es?')).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: 'OC' }));
    expect(alCambiar).toHaveBeenLastCalledWith({ ...NADA, oc: true });
    unmount();

    const procesador = render(<Preguntas categoria="procesadores" />);
    expect(screen.getByRole('radio', { name: 'Box (con caja)' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Tray (OEM)' })).toBeInTheDocument();
    procesador.unmount();

    const { container } = render(<Preguntas categoria="monitores" />);
    expect(container).toBeEmptyDOMElement();
  });
});
