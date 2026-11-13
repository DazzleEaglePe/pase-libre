'use client';

import { MAX_FOTOS_EN_VIVO, urlFoto } from '@paselibre/contracts';
import { IconCamera, IconPlus, IconX } from '@tabler/icons-react';
import { useEffect, useId, useRef, useState, type DragEvent } from 'react';

import { TIPOS_FOTO } from '@/features/publicar/selector-fotos';
import { ErrorApi, subirFoto } from '@/shared/api/cliente';

const MAX_BYTES = 8 * 1024 * 1024;

/** Una foto del busco: la del catálogo (se puede quitar) o una que subió la tienda. */
export interface FotoBusco {
  ruta: string;
  delCatalogo: boolean;
}

/**
 * Fotos del busco (doc 19, punto 21), opcionales y hasta 3. Elegido del catálogo, la primera es
 * la del catálogo con «Del catálogo» y una X, y al lado las casillas «+ Agregar». Escrito a mano y
 * sin fotos, el recuadro grande para tocar o arrastrar. La primera es la que ven las tiendas.
 * Cada foto se sube al elegirla (`POST /archivos`), una tras otra para conservar el orden.
 */
export function FotosBusco({
  fotos,
  alCambiar,
  alCargar,
  aMano,
}: {
  fotos: FotoBusco[];
  alCambiar: (cambiar: (anteriores: FotoBusco[]) => FotoBusco[]) => void;
  /** Avisa si hay fotos subiendo, para no pedir a medias. */
  alCargar: (cargando: boolean) => void;
  /** Escrito a mano: sin fotos, el recuadro grande. */
  aMano: boolean;
}) {
  const id = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(0);
  const [errores, setErrores] = useState<string[]>([]);
  const [encima, setEncima] = useState(false);
  const libres = MAX_FOTOS_EN_VIVO - fotos.length - subiendo;

  useEffect(() => alCargar(subiendo > 0), [subiendo, alCargar]);

  async function agregar(lista: FileList | null) {
    if (!lista) return;
    const nuevosErrores: string[] = [];
    const validos = Array.from(lista).filter((archivo) => {
      if (!TIPOS_FOTO.includes(archivo.type)) {
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
      nuevosErrores.push(`Puedes poner hasta ${MAX_FOTOS_EN_VIVO} fotos.`);
    }
    const aSubir = validos.slice(0, Math.max(0, libres));
    setErrores(nuevosErrores);
    setSubiendo((n) => n + aSubir.length);
    for (const archivo of aSubir) {
      try {
        const { ruta } = await subirFoto(archivo);
        alCambiar((anteriores) => [...anteriores, { ruta, delCatalogo: false }]);
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
  const recuadroGrande = aMano && fotos.length === 0 && subiendo === 0;

  return (
    <div className="flex flex-col gap-2">
      <span id={`${id}-titulo`} className="text-apoyo font-bold">
        Fotos{' '}
        <span className="font-normal text-detalle">(opcional · hasta {MAX_FOTOS_EN_VIVO})</span>
      </span>
      <input
        ref={entrada}
        type="file"
        accept={TIPOS_FOTO.join(',')}
        multiple
        hidden
        aria-labelledby={`${id}-titulo`}
        onChange={(evento) => {
          void agregar(evento.target.files);
          evento.target.value = '';
        }}
      />

      {recuadroGrande ? (
        <button
          type="button"
          onClick={abrir}
          {...arrastre}
          className={`flex items-center gap-4 rounded-2xl border-[1.5px] border-dashed p-[22px] text-left ${
            encima ? 'border-tinta bg-pase-suave' : 'border-[#B5C0BA] bg-[#FAFBFA]'
          }`}
        >
          <span className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[14px] border border-linea bg-white">
            <IconCamera size={24} stroke={1.7} aria-hidden="true" />
          </span>
          <span className="flex flex-col text-apoyo leading-snug">
            <b className="font-bold">Agrega una foto</b>
            <span className="text-nota text-detalle">
              La caja, la etiqueta o la que te mandó tu cliente. Toca o arrastra aquí.
            </span>
          </span>
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-2.5" {...arrastre}>
          {fotos.map((foto, indice) => (
            <span
              key={foto.ruta}
              className={`relative flex h-[92px] w-[92px] items-center justify-center rounded-[14px] bg-foto-fondo ${
                indice === 0 ? 'border-2 border-tinta' : 'border border-linea'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={urlFoto(foto.ruta)}
                alt={foto.delCatalogo ? 'Foto del catálogo' : `Tu foto ${indice + 1}`}
                className="h-[84%] w-[84%] object-contain mix-blend-multiply"
              />
              {foto.delCatalogo && (
                <span className="absolute bottom-1.5 left-1.5 rounded-md bg-tinta/80 px-1.5 text-[10.5px] font-bold leading-[18px] text-white">
                  Del catálogo
                </span>
              )}
              <button
                type="button"
                aria-label={
                  foto.delCatalogo ? 'Quitar la foto del catálogo' : `Quitar la foto ${indice + 1}`
                }
                onClick={() =>
                  alCambiar((anteriores) => anteriores.filter((f) => f.ruta !== foto.ruta))
                }
                className="absolute -right-[7px] -top-[7px] flex h-[22px] w-[22px] items-center justify-center rounded-full border border-borde bg-white text-tinta"
              >
                <IconX size={12} stroke={2.2} aria-hidden="true" />
              </button>
            </span>
          ))}
          {Array.from({ length: subiendo }, (_, indice) => (
            <span
              key={`subiendo-${indice}`}
              className="flex h-[92px] w-[92px] items-center justify-center rounded-[14px] bg-superficie text-nota text-detalle"
            >
              Subiendo…
            </span>
          ))}
          {Array.from({ length: Math.max(0, libres) }, (_, indice) => (
            <button
              key={`agregar-${indice}`}
              type="button"
              onClick={abrir}
              className={`flex h-[92px] w-[92px] flex-col items-center justify-center gap-1 rounded-[14px] border-[1.5px] border-dashed text-[12px] font-semibold text-detalle ${
                encima ? 'border-tinta bg-pase-suave' : 'border-[#B5C0BA]'
              }`}
            >
              <IconPlus size={20} stroke={2} aria-hidden="true" />
              Agregar
            </button>
          ))}
        </div>
      )}

      {!recuadroGrande && (
        <span className="text-nota text-detalle">
          {fotos.some((foto) => foto.delCatalogo)
            ? 'La primera es la que ven las tiendas. Puedes quitar la del catálogo y subir la tuya (la caja, la etiqueta o la que te mandó tu cliente).'
            : 'La primera es la que ven las tiendas.'}
        </span>
      )}
      {errores.map((error) => (
        <p key={error} role="alert" className="m-0 text-nota text-error">
          {error}
        </p>
      ))}
    </div>
  );
}
