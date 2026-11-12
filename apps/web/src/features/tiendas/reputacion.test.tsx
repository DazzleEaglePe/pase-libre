import type { ReputacionDetallada } from '@paselibre/contracts';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BarraReputacion, Reputacion } from './reputacion';

const base: ReputacionDetallada = {
  promedio: 4.8,
  opiniones: 23,
  ventas: 40,
  nivel: 'MUY_BUENA',
  pases_60: 18,
  responde_en: 10,
  respondidos: 96,
};

describe('Reputacion (N03, N04)', () => {
  it('con menos de 5 opiniones dice «Nueva en PaseLibre» y no pone nivel ni «Excelente»', () => {
    render(
      <Reputacion
        reputacion={{ ...base, promedio: 5, opiniones: 1, nivel: null }}
        variante="lateral"
      />,
    );
    expect(screen.getByText('🌱 Nueva en PaseLibre')).toBeInTheDocument();
    expect(screen.getByText('1 de 5')).toBeInTheDocument();
    expect(screen.queryByText(/Excelente/)).not.toBeInTheDocument();
    expect(screen.queryByRole('img', { name: /Reputación/ })).not.toBeInTheDocument();
  });

  it('la tarjeta completa muestra el nivel y los tres datos', () => {
    render(<Reputacion reputacion={base} propia variante="completa" />);
    expect(screen.getByText('Muy buena · las tiendas confían en ti')).toBeInTheDocument();
    expect(screen.getByText('18')).toBeInTheDocument();
    expect(screen.getByText('pases cerrados en 60 días')).toBeInTheDocument();
    expect(screen.getByText('~10 min')).toBeInTheDocument();
    expect(screen.getByText('96 %')).toBeInTheDocument();
  });

  it('en el perfil de otra tienda dice «en ella»', () => {
    render(<Reputacion reputacion={base} variante="lateral" />);
    expect(screen.getByText('Muy buena · las tiendas confían en ella')).toBeInTheDocument();
  });

  it('la barra se enciende hasta el nivel y el resto queda gris', () => {
    const { container } = render(<BarraReputacion nivel="BUENA" />);
    const tramos = [...container.querySelectorAll('span > span')] as HTMLElement[];
    expect(tramos).toHaveLength(5);
    expect(tramos.filter((tramo) => tramo.style.background !== 'rgb(230, 235, 232)')).toHaveLength(
      3,
    );
    expect(screen.getByRole('img', { name: 'Reputación buena: 3 de 5' })).toBeInTheDocument();
  });
});
