import { describe, expect, it } from 'vitest';

import { claveEscribiendo, queAvisar } from './escribiendo';

/** «Escribiendo…» (doc 19, punto 19): cuándo se le avisa al otro. */
describe('queAvisar', () => {
  it('con texto, avisa como mucho cada 3 s', () => {
    expect(queAvisar('h', 0, 10_000)).toBe('escribiendo');
    expect(queAvisar('ho', 10_000, 11_000)).toBeNull();
    expect(queAvisar('hola', 10_000, 12_999)).toBeNull();
    expect(queAvisar('hola', 10_000, 13_000)).toBe('escribiendo');
  });

  it('solo espacios es como no tener nada', () => {
    expect(queAvisar('   ', 0, 10_000)).toBeNull();
  });

  it('al borrar todo avisa «borró» si había avisado hace menos de 5 s', () => {
    expect(queAvisar('', 10_000, 12_000)).toBe('borro');
    expect(queAvisar('', 10_000, 15_000)).toBeNull();
    expect(queAvisar('', 0, 15_000)).toBeNull();
  });
});

describe('claveEscribiendo', () => {
  it('separa los chats entre tiendas de los hilos con el Equipo', () => {
    expect(claveEscribiendo({ conversacion_id: 'a' })).toBe('c:a');
    expect(claveEscribiendo({ equipo: true, tienda_id: 'b' })).toBe('e:b');
  });
});
