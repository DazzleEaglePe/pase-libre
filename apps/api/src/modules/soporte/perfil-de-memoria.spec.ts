import { describe, expect, it } from 'vitest';

import { perfilDeTexto } from './catalogo-equipo.service';

/** La columna «Perfil de memoria» de la plantilla (docs/19 §13), como la escriban. */
describe('perfilDeTexto', () => {
  it('lee las opciones de la lista y lo que se escribe a mano', () => {
    expect(perfilDeTexto('Intel XMP')).toBe('XMP');
    expect(perfilDeTexto('xmp 3.0')).toBe('XMP');
    expect(perfilDeTexto('EXPO Ryzen')).toBe('EXPO');
    expect(perfilDeTexto('AMD')).toBe('EXPO');
    expect(perfilDeTexto('Los dos')).toBe('AMBOS');
    expect(perfilDeTexto('ambos')).toBe('AMBOS');
    expect(perfilDeTexto('XMP y EXPO')).toBe('AMBOS');
  });

  it('vacío o algo que no se entiende queda sin perfil', () => {
    expect(perfilDeTexto('')).toBeNull();
    expect(perfilDeTexto(undefined)).toBeNull();
    expect(perfilDeTexto('DDR5')).toBeNull();
  });
});
