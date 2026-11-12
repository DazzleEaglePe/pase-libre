import { describe, expect, it } from 'vitest';

import { alternarEnTexto, tieneEnTexto } from './detalles';

describe('«Detalles (opcional)» que se escriben en el texto (N06)', () => {
  it('agrega la frase al final, con su punto', () => {
    expect(alternarEnTexto('', 'Entrega inmediata')).toBe('Entrega inmediata.');
    expect(alternarEnTexto('Probada en el stand', 'Entrega inmediata')).toBe(
      'Probada en el stand. Entrega inmediata.',
    );
    expect(alternarEnTexto('Sin minería.', 'Accesorios completos')).toBe(
      'Sin minería. Accesorios completos.',
    );
  });

  it('la quita si ya estaba, sin tocar lo demás', () => {
    expect(alternarEnTexto('Sin minería. Accesorios completos.', 'Accesorios completos')).toBe(
      'Sin minería.',
    );
    expect(alternarEnTexto('Entrega inmediata. Sin minería.', 'Entrega inmediata')).toBe(
      'Sin minería.',
    );
  });

  it('sabe si ya está, sin confundirse con otra palabra', () => {
    expect(tieneEnTexto('viene con accesorios completos', 'Accesorios completos')).toBe(true);
    expect(tieneEnTexto('Accesorios completosx', 'Accesorios completos')).toBe(false);
    expect(tieneEnTexto('', 'Entrega inmediata')).toBe(false);
  });
});
