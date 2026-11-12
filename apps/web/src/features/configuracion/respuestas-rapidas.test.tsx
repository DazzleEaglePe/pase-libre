import type { RespuestaRapida } from '@paselibre/contracts';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { apiFalsa } from '@/test/api-falsa';

import { RespuestasRapidas } from './respuestas-rapidas';

const INICIALES: RespuestaRapida[] = [
  { id: '1', texto: 'Hola, {tienda}, ¿qué tal? 👋', papel: 'vendedor' },
  { id: '2', texto: 'Te lo separo', papel: 'vendedor' },
  { id: '3', texto: '¿Sigue disponible?', papel: 'comprador' },
];

function conApi() {
  let lista = [...INICIALES];
  return apiFalsa(({ metodo, ruta, cuerpo }) => {
    if (ruta !== '/cuenta/respuestas-rapidas') return undefined;
    if (metodo === 'PUT') {
      const { papel, textos } = cuerpo as { papel: 'vendedor' | 'comprador'; textos: string[] };
      lista = [
        ...lista.filter((r) => r.papel !== papel),
        ...textos.map((texto, i) => ({ id: `${papel}-${i}`, texto, papel })),
      ];
    }
    return { cuerpo: lista };
  });
}

describe('Respuestas rápidas por papel (N11)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('muestra las dos columnas con su «N de 6» y la ficha «Nombre de la tienda»', async () => {
    conApi();
    render(<RespuestasRapidas alAvisar={() => undefined} />);
    expect(await screen.findByRole('region', { name: 'Cuando te escriben' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Cuando tú preguntas' })).toBeTruthy();
    expect(screen.getByText('2 de 6')).toBeTruthy();
    expect(screen.getByText('1 de 6')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Quitar: Hola, Nombre de la tienda, ¿qué tal? 👋' }),
    ).toBeTruthy();
  });

  it('una sugerencia se agrega solo a la lista de su papel', async () => {
    const { pedidos } = conApi();
    const avisos: string[] = [];
    render(<RespuestasRapidas alAvisar={(mensaje) => avisos.push(mensaje)} />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Agregar: ¿Tienes más de una unidad?' }),
    );
    await waitFor(() => expect(avisos).toEqual(['Respuesta rápida agregada.']));
    expect(pedidos.find((p) => p.metodo === 'PUT')?.cuerpo).toEqual({
      papel: 'comprador',
      textos: ['¿Sigue disponible?', '¿Tienes más de una unidad?'],
    });
    // Las dos columnas quedan en «2 de 6».
    expect(screen.getAllByText('2 de 6')).toHaveLength(2);
  });

  it('«+ Nombre de la tienda» pone la ficha en la nueva y se guarda con {tienda}', async () => {
    const { pedidos } = conApi();
    render(<RespuestasRapidas alAvisar={() => undefined} />);
    const campo = await screen.findByLabelText('Nueva respuesta rápida');
    fireEvent.change(campo, { target: { value: 'En breve te confirmo,' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Nombre de la tienda' }));
    expect(
      (screen.getByRole('button', { name: '+ Nombre de la tienda' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Agregar' }));
    await waitFor(() =>
      expect(pedidos.find((p) => p.metodo === 'PUT')?.cuerpo).toEqual({
        papel: 'vendedor',
        textos: ['Hola, {tienda}, ¿qué tal? 👋', 'Te lo separo', 'En breve te confirmo, {tienda}'],
      }),
    );
  });
});
