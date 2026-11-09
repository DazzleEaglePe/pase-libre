import '@testing-library/jest-dom/vitest';

import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Sin `globals`, Testing Library no limpia sola entre pruebas.
afterEach(() => cleanup());

// jsdom no trae lo que el navegador sí: lo justo para que los componentes funcionen.
if (!window.matchMedia) {
  window.matchMedia = (consulta: string) =>
    ({
      matches: false,
      media: consulta,
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false,
    }) as MediaQueryList;
}
window.scrollTo = () => undefined;
Element.prototype.scrollIntoView = () => undefined;
class SinObservar {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= SinObservar as unknown as typeof ResizeObserver;
