import { describe, expect, it } from 'vitest';

import {
  esSeMeAcabo,
  misOfertasSchema,
  RAZONES_PAUSA,
  razonDePausa,
} from './ofertas/ofertas.schemas';

/** «Pausar» pasa a «No disponible ▾» (doc 20, punto 16). */
describe('«No disponible»: motivos y pestaña', () => {
  it('los tres motivos nuevos', () => {
    expect(RAZONES_PAUSA).toEqual(['Se me acabó', 'La separé para un cliente', 'Otro motivo']);
  });

  it('la razón vieja se lee como «Se me acabó»', () => {
    expect(razonDePausa('Se me acabó, espero mercadería')).toBe('Se me acabó');
    expect(razonDePausa('La separé para un cliente')).toBe('La separé para un cliente');
    expect(razonDePausa(null)).toBeNull();
    expect(esSeMeAcabo('Se me acabó, espero mercadería')).toBe(true);
    expect(esSeMeAcabo('Se me acabó')).toBe(true);
    expect(esSeMeAcabo('Otro motivo')).toBe(false);
    expect(esSeMeAcabo(undefined)).toBe(false);
  });

  it('«no_disponibles» es la pestaña nueva y «pausadas» sigue valiendo', () => {
    expect(misOfertasSchema.parse({ estado: 'no_disponibles' }).estado).toBe('no_disponibles');
    expect(misOfertasSchema.parse({ estado: 'pausadas' }).estado).toBe('pausadas');
    expect(misOfertasSchema.safeParse({ estado: 'ocultas' }).success).toBe(false);
  });
});
