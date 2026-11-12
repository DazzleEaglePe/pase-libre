import { CABECERA_PASELIBRE, type RevisionImportacion } from '@paselibre/contracts';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { SubirArchivo } from './catalogo';

/** Un `XMLHttpRequest` de mentira: la prueba decide cuánto sube y cuándo responde. */
class XhrFalso {
  static ultimo: XhrFalso | null = null;
  metodo = '';
  ruta = '';
  cabeceras: Record<string, string> = {};
  withCredentials = false;
  status = 0;
  responseText = '';
  abortado = false;
  upload: {
    onprogress: ((e: { lengthComputable: boolean; loaded: number; total: number }) => void) | null;
    onload: (() => void) | null;
  } = { onprogress: null, onload: null };
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onabort: (() => void) | null = null;

  constructor() {
    XhrFalso.ultimo = this;
  }
  open(metodo: string, ruta: string) {
    this.metodo = metodo;
    this.ruta = ruta;
  }
  setRequestHeader(nombre: string, valor: string) {
    this.cabeceras[nombre] = valor;
  }
  send() {}
  abort() {
    this.abortado = true;
    this.onabort?.();
  }
  avanzar(loaded: number, total: number) {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total });
  }
  responder(status: number, cuerpo: unknown) {
    this.upload.onload?.();
    this.status = status;
    this.responseText = JSON.stringify(cuerpo);
    this.onload?.();
  }
}

const REVISION: RevisionImportacion = {
  id: '6f1c2c1e-1111-4a3b-9f00-000000000001',
  nombre: 'catalogo_parte1.zip',
  filas_leidas: 70,
  fotos_encontradas: 40,
  crear: 34,
  existentes: 5,
  incompletas: [
    {
      fila: 12,
      lugar: null,
      producto: 'Corsair 4000D',
      motivo: 'FOTO_NO_ESTA',
      texto: 'No está la foto en la carpeta',
      foto_buscada: 'corsair-4000d.webp',
    },
    ...Array.from({ length: 30 }, (_, i) => ({
      fila: 20 + i,
      lugar: null,
      producto: `Producto ${i}`,
      motivo: 'SIN_FOTO' as const,
      texto: 'Falta la foto',
      foto_buscada: null,
    })),
  ],
  motivos: { sin_foto: 31, sin_categoria: 0, sin_marca: 0, sin_modelo: 0, repetida: 0 },
  ya_estan: [],
  parecidos: [],
};

function archivo(nombre: string, bytes: number): File {
  const f = new File(['x'], nombre, { type: 'application/zip' });
  Object.defineProperty(f, 'size', { value: bytes });
  return f;
}

async function elegir(f: File) {
  const entrada = document.querySelector<HTMLInputElement>('input[type="file"]')!;
  await userEvent.upload(entrada, f, { applyAccept: false });
}

describe('Subir el archivo del catálogo: avance y motivos (docs/18 §7 y §8)', () => {
  beforeEach(() => {
    XhrFalso.ultimo = null;
    vi.stubGlobal('XMLHttpRequest', XhrFalso);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('un ZIP de más de 40 MB se avisa y no se sube', async () => {
    render(<SubirArchivo alCrear={() => undefined} />);
    await elegir(archivo('grande.zip', 52 * 1024 * 1024 - 100));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Este ZIP pesa 52 MB, el máximo es 40 MB. Pártelo en dos.',
    );
    expect(XhrFalso.ultimo).toBeNull();
  });

  it('muestra el porcentaje, después «Revisando…» y al final los motivos', async () => {
    render(<SubirArchivo alCrear={() => undefined} />);
    await elegir(archivo('catalogo_parte1.zip', 35 * 1024 * 1024));
    const xhr = XhrFalso.ultimo!;
    expect(xhr.metodo).toBe('POST');
    expect(xhr.ruta).toBe('/v1/equipo/catalogo/importar');
    expect(xhr.cabeceras[CABECERA_PASELIBRE]).toBe('1');
    expect(xhr.withCredentials).toBe(true);
    expect(screen.getByText('catalogo_parte1.zip · 35 MB')).toBeInTheDocument();

    act(() => xhr.avanzar(62, 100));
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '62');
    expect(screen.getByText('62%')).toBeInTheDocument();
    expect(screen.getByText('Subir')).toBeInTheDocument();
    expect(screen.getByText('Revisar filas')).toBeInTheDocument();
    // Mientras sube no se puede elegir otro.
    expect(screen.queryByRole('button', { name: 'elige un archivo' })).not.toBeInTheDocument();
    expect(document.querySelector('input[type="file"]')).toBeDisabled();

    act(() => xhr.upload.onload?.());
    expect(screen.getByText('Revisando filas y fotos…')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).not.toHaveAttribute('aria-valuenow');

    await act(async () => xhr.responder(201, REVISION));
    expect(screen.getByText('se crean')).toBeInTheDocument();
    expect(screen.getByTestId('no-se-crean')).toHaveTextContent('31no se crean31 sin foto');
    expect(
      screen.getByText(/Estas 31 filas no se van a crear\. Corrígelas en tu Excel/),
    ).toHaveTextContent(
      'Estas 31 filas no se van a crear. Corrígelas en tu Excel y vuelve a subir el ZIP: las que ya se crearon no se duplican.',
    );
    expect(screen.getByRole('columnheader', { name: 'Qué pasa' })).toBeInTheDocument();
    expect(screen.getByText('corsair-4000d.webp')).toBeInTheDocument();
    expect(screen.getByText('21 filas más')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Descargar la lista en Excel' })).toHaveAttribute(
      'href',
      `/v1/equipo/catalogo/importar/${REVISION.id}/errores`,
    );
  });

  it('«Cancelar» corta la subida', async () => {
    render(<SubirArchivo alCrear={() => undefined} />);
    await elegir(archivo('catalogo.zip', 1024 * 1024));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(XhrFalso.ultimo!.abortado).toBe(true);
    expect(await screen.findByText('Arrastra tu archivo aquí')).toBeInTheDocument();
  });

  it('si se corta, lo dice y deja volver a intentar', async () => {
    render(<SubirArchivo alCrear={() => undefined} />);
    await elegir(archivo('catalogo.zip', 1024 * 1024));
    const primero = XhrFalso.ultimo!;
    act(() => primero.avanzar(48, 100));
    await act(async () => primero.onerror?.());
    expect(screen.getByRole('alert')).toHaveTextContent('Se cortó la subida. No se creó nada.');
    await userEvent.click(screen.getByRole('button', { name: 'Volver a intentar' }));
    expect(XhrFalso.ultimo).not.toBe(primero);
    expect(screen.getByText('Subiendo…', { exact: false })).toBeInTheDocument();
  });

  it('1 fila mala: «1 no se crea» en singular', async () => {
    render(<SubirArchivo alCrear={() => undefined} />);
    await elegir(archivo('catalogo.csv', 2048));
    await act(async () =>
      XhrFalso.ultimo!.responder(201, {
        ...REVISION,
        nombre: 'catalogo.csv',
        incompletas: [
          {
            fila: 4,
            lugar: 'Tarjetas de video · fila 5',
            producto: 'RTX 5060',
            motivo: 'SIN_MARCA',
            texto: 'Falta la marca',
            foto_buscada: null,
          },
        ],
        motivos: { sin_foto: 0, sin_categoria: 0, sin_marca: 1, sin_modelo: 0, repetida: 0 },
      }),
    );
    expect(screen.getByTestId('no-se-crean')).toHaveTextContent('1no se crea1 sin marca');
    expect(screen.getByText(/Esta fila no se va a crear/)).toHaveTextContent(
      'vuelve a subir el archivo',
    );
    expect(screen.getByText('Tarjetas de video · fila 5')).toBeInTheDocument();
    expect(screen.queryByText('Descargar la lista en Excel')).not.toBeInTheDocument();
  });
});
