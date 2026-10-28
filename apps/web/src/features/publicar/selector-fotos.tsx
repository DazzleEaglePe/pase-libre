'use client';

import { MAX_FOTOS, urlFoto, type ArchivoSubido } from '@paselibre/contracts';
import {
  useEffect,
  useId,
  useRef,
  useState,
  type Dispatch,
  type DragEvent,
  type SetStateAction,
} from 'react';

import { ErrorApi, subirFoto } from '@/shared/api/cliente';

const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_BYTES = 8 * 1024 * 1024;

function IconoCamara({ tamano }: { tamano: number }) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 8h3l2-3h6l2 3h3v11H4z" />
      <circle cx="12" cy="13" r="3.5" />
    </svg>
  );
}

/**
 * Fotos del producto («zona», con arrastrar y soltar) o fotos propias de la oferta
 * («mosaico», con el recuadro «Agregar»). Cada foto se sube al elegirla, una tras otra
 * para conservar el orden; la primera es la portada.
 */
export function SelectorFotos({
  fotos,
  alCambiar,
  alCargar,
  variante,
  titulo,
  ayuda,
}: {
  fotos: ArchivoSubido[];
  alCambiar: Dispatch<SetStateAction<ArchivoSubido[]>>;
  /** Avisa si hay fotos subiendo, para no publicar a medias. */
  alCargar: (cargando: boolean) => void;
  variante: 'zona' | 'mosaico';
  titulo: string;
  ayuda: string;
}) {
  const id = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(0);
  const [errores, setErrores] = useState<string[]>([]);
  const [encima, setEncima] = useState(false);
  const libres = MAX_FOTOS - fotos.length - subiendo;

  useEffect(() => alCargar(subiendo > 0), [subiendo, alCargar]);

  async function agregar(lista: FileList | null) {
    if (!lista) return;
    const archivos = Array.from(lista);
    const nuevosErrores: string[] = [];
    const validos = archivos.filter((archivo) => {
      if (!TIPOS.includes(archivo.type)) {
        nuevosErrores.push(`«${archivo.name}» no es una foto JPEG, PNG o WebP.`);
        return false;
      }
      if (archivo.size > MAX_BYTES) {
        nuevosErrores.push(`«${archivo.name}» pesa más de 8 MB.`);
        return false;
      }
      return true;
    });
    if (validos.length > libres) {
      nuevosErrores.push(
        `Puedes subir hasta ${MAX_FOTOS} fotos; quedaron fuera ${validos.length - libres}.`,
      );
    }
    const aSubir = validos.slice(0, Math.max(0, libres));
    setErrores(nuevosErrores);
    setSubiendo((n) => n + aSubir.length);
    for (const archivo of aSubir) {
      try {
        const foto = await subirFoto(archivo);
        alCambiar((anteriores) => [...anteriores, foto]);
      } catch (error) {
        const mensaje = error instanceof ErrorApi ? error.message : 'No pudimos subir la foto.';
        setErrores((anteriores) => [...anteriores, `«${archivo.name}»: ${mensaje}`]);
      } finally {
        setSubiendo((n) => n - 1);
      }
    }
  }

  const arrastre = {
    onDragOver: (evento: DragEvent) => {
      evento.preventDefault();
      setEncima(true);
    },
    onDragLeave: () => setEncima(false),
    onDrop: (evento: DragEvent) => {
      evento.preventDefault();
      setEncima(false);
      void agregar(evento.dataTransfer.files);
    },
  };

  const abrir = () => entrada.current?.click();
  const miniaturas = (
    <>
      {fotos.map((foto, indice) => (
        <span
          key={foto.ruta}
          className="relative h-[88px] w-[104px] overflow-hidden rounded-xl bg-superficie"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={urlFoto(foto.ruta)}
            alt={`Foto ${indice + 1}`}
            className="h-full w-full object-cover"
          />
          {indice === 0 && variante === 'zona' && (
            <span className="absolute bottom-1.5 left-1.5 rounded-full bg-white px-2 text-etiqueta normal-case leading-5 tracking-normal">
              Portada
            </span>
          )}
          <button
            type="button"
            aria-label={`Quitar la foto ${indice + 1}`}
            onClick={() =>
              alCambiar((anteriores) => anteriores.filter((f) => f.ruta !== foto.ruta))
            }
            className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-white text-[17px] leading-none shadow-sm"
          >
            ×
          </button>
        </span>
      ))}
      {Array.from({ length: subiendo }, (_, indice) => (
        <span
          key={`subiendo-${indice}`}
          className="flex h-[88px] w-[104px] items-center justify-center rounded-xl bg-superficie text-nota text-detalle"
        >
          Subiendo…
        </span>
      ))}
    </>
  );

  return (
    <div className="flex flex-col gap-1.5">
      <span id={`${id}-titulo`} className="text-apoyo font-medium">
        {titulo}
      </span>
      <input
        ref={entrada}
        id={`${id}-archivo`}
        type="file"
        accept={TIPOS.join(',')}
        multiple
        hidden
        aria-labelledby={`${id}-titulo`}
        onChange={(evento) => {
          void agregar(evento.target.files);
          evento.target.value = '';
        }}
      />

      {variante === 'zona' ? (
        <>
          {(fotos.length > 0 || subiendo > 0) && (
            <div className="flex flex-wrap gap-3">{miniaturas}</div>
          )}
          {libres > 0 && (
            <div
              {...arrastre}
              className={`flex h-[132px] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed text-center ${
                encima ? 'border-tinta bg-lima-suave' : 'border-borde-control'
              }`}
            >
              <span className="text-secundario">
                <IconoCamara tamano={24} />
              </span>
              <span className="text-apoyo">
                <button type="button" onClick={abrir} className="font-medium underline">
                  Elige fotos
                </button>{' '}
                o arrástralas aquí
              </span>
              <span className="text-nota text-detalle">{ayuda}</span>
            </div>
          )}
        </>
      ) : (
        <div {...arrastre} className="flex flex-wrap items-center gap-3.5">
          {miniaturas}
          {libres > 0 && (
            <button
              type="button"
              onClick={abrir}
              className={`flex h-[88px] w-[104px] flex-col items-center justify-center gap-1 rounded-xl border border-dashed text-nota font-medium ${
                encima ? 'border-tinta bg-lima-suave' : 'border-borde-control bg-white'
              }`}
            >
              <IconoCamara tamano={22} />
              Agregar
            </button>
          )}
          {fotos.length === 0 && subiendo === 0 && (
            <span className="min-w-[200px] flex-1 text-apoyo text-secundario">{ayuda}</span>
          )}
        </div>
      )}

      {errores.length > 0 && (
        <ul role="alert" className="flex flex-col gap-0.5 text-nota text-error">
          {errores.map((error) => (
            <li key={error}>{error}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
