import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { NombreComparado, compararNombres } from './diferencias';

const distintas = (palabras: ReturnType<typeof compararNombres>[number]) =>
  palabras.filter((p) => p.distinta).map((p) => p.texto);

describe('«Muy parecido»: la palabra que cambia, en negrita (doc 20, A9)', () => {
  it('marca en los dos nombres solo lo que está en uno y no en el otro', () => {
    const [a, b] = compararNombres(
      'Corsair Vengeance 32GB DDR5 6000 CL30',
      'Corsair Vengeance 32GB DDR5 6000 CL28',
    );
    expect(distintas(a)).toEqual(['CL30']);
    expect(distintas(b)).toEqual(['CL28']);
  });

  it('compara como el buscador: mayúsculas, tildes y guiones no cuentan', () => {
    const [a, b] = compararNombres('Kingston FURY Beast cl-36', 'kingston Fury Béast CL36 RGB');
    expect(distintas(a)).toEqual([]);
    expect(distintas(b)).toEqual(['RGB']);
  });

  it('una palabra repetida cuenta cada vez', () => {
    const [a, b] = compararNombres('RAM 16GB 16GB', 'RAM 16GB');
    expect(distintas(a)).toEqual(['16GB']);
    expect(distintas(b)).toEqual([]);
  });

  it('dibuja en negrita solo las que cambian', () => {
    const [a] = compararNombres('ASUS RTX 5060 OC', 'ASUS RTX 5060');
    const { container } = render(
      <p>
        <NombreComparado palabras={a} />
      </p>,
    );
    expect(container.textContent).toBe('ASUS RTX 5060 OC');
    expect([...container.querySelectorAll('b')].map((b) => b.textContent)).toEqual(['OC']);
  });
});
