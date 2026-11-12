'use client';

import {
  conNombreDeTienda,
  FICHA_TIENDA,
  MAX_RESPUESTAS_RAPIDAS,
  SUGERENCIAS_RESPUESTAS,
  type PapelRespuesta,
  type RespuestaRapida,
} from '@paselibre/contracts';
import { IconBuildingStore, IconGripVertical, IconSearch, IconX } from '@tabler/icons-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import { FichaTienda, TextoConFicha, textoParaLeer } from '@/features/mensajes/ficha-tienda';
import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { Segmentado } from '@/shared/ui/segmentado';

/** El nombre con que se muestra cómo queda en el chat. */
const EJEMPLO = 'Tienda Ejemplo';

const PAPELES: Record<
  PapelRespuesta,
  { titulo: string; resumen: string; preguntan: string; icono: typeof IconSearch }
> = {
  vendedor: {
    titulo: 'Cuando te escriben',
    resumen: 'Vendes: otra tienda te pregunta por algo tuyo',
    preguntan: 'Hola, ¿tienes la RTX 5070 TUF?',
    icono: IconBuildingStore,
  },
  comprador: {
    titulo: 'Cuando tú preguntas',
    resumen: 'Compras o buscas: le escribes a otra tienda',
    preguntan: 'Hola, sí la tengo a 3,886.',
    icono: IconSearch,
  },
};

type Listas = Record<PapelRespuesta, string[]>;

/**
 * «ASÍ SE VE EN EL CHAT» (N11): lo que te escriben, tus respuestas con el nombre ya puesto y la
 * primera escrita en la caja, sin enviar.
 */
function Vista({ papel, textos }: { papel: PapelRespuesta; textos: string[] }) {
  const [primera] = textos;
  return (
    <div aria-hidden="true" className="flex flex-col gap-2.5 rounded-2xl bg-superficie p-3">
      <span className="text-etiqueta uppercase text-secundario">Así se ve en el chat</span>
      <span className="flex max-w-[85%] flex-col gap-0.5 self-start rounded-[18px_18px_18px_6px] bg-white px-3.5 py-2.5">
        {PAPELES[papel].preguntan}
        <span className="text-right text-[11px] text-detalle">16:58</span>
      </span>
      {textos.length > 0 && (
        <span className="flex flex-wrap gap-1.5">
          {textos.slice(0, 3).map((texto, indice) => (
            <span
              key={texto}
              className={`max-w-full truncate rounded-full border-[1.5px] px-3 py-1 text-[12px] font-bold ${
                indice === 0 ? 'border-tinta bg-tinta text-white' : 'border-borde bg-white'
              }`}
            >
              {conNombreDeTienda(texto, EJEMPLO)}
            </span>
          ))}
        </span>
      )}
      <span className="flex min-h-11 items-center justify-between gap-3 rounded-full border-[1.5px] border-pase bg-white px-4 py-2">
        <span className="min-w-0 break-words">
          {primera ? conNombreDeTienda(primera, EJEMPLO) : 'Escribe un mensaje'}
        </span>
        {primera && <span className="shrink-0 text-nota text-detalle">Enter para enviar</span>}
      </span>
    </div>
  );
}

/** Una columna: «Cuando te escriben» o «Cuando tú preguntas», con su «4 de 6». */
function Columna({
  papel,
  textos,
  alGuardar,
}: {
  papel: PapelRespuesta;
  textos: string[];
  alGuardar: (textos: string[], mensaje: string) => void;
}) {
  const { titulo, resumen, icono: Icono } = PAPELES[papel];
  const arrastrado = useRef<number | null>(null);
  const lleno = textos.length >= MAX_RESPUESTAS_RAPIDAS;
  const sugerencias = SUGERENCIAS_RESPUESTAS[papel].filter(
    (sugerencia) => !textos.some((texto) => texto.toLowerCase() === sugerencia.toLowerCase()),
  );

  function mover(desde: number, hasta: number) {
    if (desde === hasta) return;
    const nuevos = [...textos];
    const [movido] = nuevos.splice(desde, 1);
    if (movido === undefined) return;
    nuevos.splice(hasta, 0, movido);
    alGuardar(nuevos, 'Cambiaste el orden.');
  }

  return (
    <section
      aria-label={titulo}
      className="flex min-w-0 flex-col gap-3.5 rounded-[20px] border-[1.5px] border-linea bg-white p-4"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pase-suave text-pase-texto"
        >
          <Icono size={20} stroke={1.8} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <b className="text-tarjeta">{titulo}</b>
          <span className="text-apoyo text-secundario">{resumen}</span>
        </span>
        <span className="shrink-0 whitespace-nowrap text-apoyo text-secundario">
          {textos.length} de {MAX_RESPUESTAS_RAPIDAS}
        </span>
      </div>

      {textos.length === 0 ? (
        <p className="text-apoyo text-secundario">
          Todavía no tienes. Toca una sugerencia o escribe la tuya abajo.
        </p>
      ) : (
        <ul className="flex flex-col items-start gap-2">
          {textos.map((texto, indice) => (
            <li
              key={texto}
              draggable
              onDragStart={() => {
                arrastrado.current = indice;
              }}
              onDragOver={(evento) => evento.preventDefault()}
              onDrop={(evento) => {
                evento.preventDefault();
                if (arrastrado.current !== null) mover(arrastrado.current, indice);
                arrastrado.current = null;
              }}
              className="flex min-h-10 max-w-full items-center gap-1.5 rounded-[20px] border-[1.5px] border-borde bg-white py-0.5 pl-2 pr-1 text-apoyo font-semibold"
            >
              <IconGripVertical
                size={16}
                stroke={1.8}
                className="shrink-0 cursor-grab text-detalle"
                aria-hidden="true"
              />
              <span className="min-w-0 py-1 leading-6">
                <TextoConFicha texto={texto} chica />
              </span>
              <button
                type="button"
                aria-label={`Quitar: ${textoParaLeer(texto)}`}
                onClick={() =>
                  alGuardar(
                    textos.filter((otro) => otro !== texto),
                    'Respuesta rápida quitada.',
                  )
                }
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-secundario hover:bg-superficie"
              >
                <IconX size={14} stroke={2} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Vista papel={papel} textos={textos} />

      {sugerencias.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-etiqueta uppercase text-secundario">
            Sugerencias · toca para agregar
          </span>
          <div className="flex flex-col items-start gap-2">
            {sugerencias.map((sugerencia) => (
              <button
                key={sugerencia}
                type="button"
                disabled={lleno}
                aria-label={`Agregar: ${textoParaLeer(sugerencia)}`}
                onClick={() => alGuardar([...textos, sugerencia], 'Respuesta rápida agregada.')}
                className="min-h-10 max-w-full rounded-[20px] border-[1.5px] border-dashed border-pase bg-white px-3 py-1.5 text-left text-apoyo leading-6 disabled:border-borde disabled:text-detalle"
              >
                <span aria-hidden="true">+ </span>
                <TextoConFicha texto={sugerencia} chica />
              </button>
            ))}
          </div>
          {lleno && (
            <span className="text-nota text-detalle">
              Ya tienes {MAX_RESPUESTAS_RAPIDAS}: quita una para agregar otra.
            </span>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * El campo de «Nueva respuesta rápida» con la ficha «Nombre de la tienda» (N11): lo escrito
 * antes, la ficha (una sola, con su ×) y lo escrito después.
 */
function CampoConFicha({
  id,
  antes,
  despues,
  conFicha,
  alCambiar,
}: {
  id: string;
  antes: string;
  despues: string;
  conFicha: boolean;
  alCambiar: (cambios: { antes: string; despues: string; conFicha: boolean }) => void;
}) {
  const primero = useRef<HTMLInputElement>(null);
  const ancho = (texto: string) => Math.max(2, texto.length + 1);
  return (
    <div className="flex min-h-12 min-w-0 flex-[1_1_280px] flex-wrap items-center gap-1 rounded-xl border border-borde bg-white px-3.5 py-1.5 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-tinta">
      <input
        id={id}
        ref={primero}
        value={antes}
        maxLength={120}
        size={conFicha ? ancho(antes) : undefined}
        onChange={(evento) => alCambiar({ antes: evento.target.value, despues, conFicha })}
        placeholder={conFicha ? '' : 'Ej.: En breve te confirmo, Nombre de la tienda'}
        className={`h-9 min-w-0 bg-transparent text-cuerpo placeholder:text-detalle focus-visible:outline-none ${
          conFicha ? '' : 'flex-1'
        }`}
      />
      {conFicha && (
        <>
          <span className="flex items-center">
            <FichaTienda />
            <button
              type="button"
              aria-label="Quitar «Nombre de la tienda»"
              onClick={() => {
                alCambiar({ antes: `${antes}${despues}`, despues: '', conFicha: false });
                primero.current?.focus();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-full text-secundario hover:bg-superficie"
            >
              <IconX size={14} stroke={2} aria-hidden="true" />
            </button>
          </span>
          <input
            aria-label="Lo que va después del nombre"
            value={despues}
            maxLength={120}
            onChange={(evento) => alCambiar({ antes, despues: evento.target.value, conFicha })}
            className="h-9 min-w-[60px] flex-1 bg-transparent text-cuerpo focus-visible:outline-none"
          />
        </>
      )}
    </div>
  );
}

/**
 * Configuración › Preferencias › Respuestas rápidas (N11, mejora 46): «Cuando te escriben» y
 * «Cuando tú preguntas», hasta 6 de cada una. En cada chat salen las del papel que tienes ahí.
 * Al tocar una en el chat se escribe en la caja con el nombre de la otra tienda; no se envía sola.
 */
export function RespuestasRapidas({ alAvisar }: { alAvisar: (mensaje: string) => void }) {
  const id = useId();
  const [listas, setListas] = useState<Listas | null>(null);
  const [papel, setPapel] = useState<PapelRespuesta>('vendedor');
  const [nueva, setNueva] = useState({ antes: '', despues: '', conFicha: false });
  const [error, setError] = useState<string | null>(null);
  const entradaNueva = `${id}-nueva`;

  useEffect(() => {
    llamarApi<RespuestaRapida[]>('/cuenta/respuestas-rapidas').then(
      (lista) => setListas(enListas(lista)),
      () => setListas({ vendedor: [], comprador: [] }),
    );
  }, []);

  async function guardar(deEste: PapelRespuesta, textos: string[], mensaje: string) {
    setError(null);
    try {
      const lista = await llamarApi<RespuestaRapida[]>('/cuenta/respuestas-rapidas', {
        metodo: 'PUT',
        cuerpo: { papel: deEste, textos },
      });
      setListas(enListas(lista));
      alAvisar(mensaje);
      return true;
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos guardar las respuestas rápidas.');
      return false;
    }
  }

  const textoNuevo = `${nueva.antes}${nueva.conFicha ? FICHA_TIENDA : ''}${nueva.despues}`
    .replace(/\s+/g, ' ')
    .trim();

  async function agregar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!listas || !textoNuevo || textoNuevo === FICHA_TIENDA) return;
    if (await guardar(papel, [...listas[papel], textoNuevo], 'Respuesta rápida agregada.')) {
      setNueva({ antes: '', despues: '', conFicha: false });
    }
  }

  function ponerFicha() {
    const campo = document.getElementById(entradaNueva) as HTMLInputElement | null;
    const donde = campo?.selectionStart ?? nueva.antes.length;
    const antes = nueva.antes.slice(0, donde);
    const despues = nueva.antes.slice(donde);
    setNueva({
      antes: antes && !/\s$/.test(antes) ? `${antes} ` : antes,
      despues: despues && !/^[\s,.!?]/.test(despues) ? ` ${despues}` : despues,
      conFicha: true,
    });
  }

  if (!listas) return <p className="text-secundario">Cargando…</p>;
  const lleno = listas[papel].length >= MAX_RESPUESTAS_RAPIDAS;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 xl:grid-cols-2">
        {(['vendedor', 'comprador'] as const).map((deEste) => (
          <Columna
            key={deEste}
            papel={deEste}
            textos={listas[deEste]}
            alGuardar={(textos, mensaje) => void guardar(deEste, textos, mensaje)}
          />
        ))}
      </div>

      <form
        onSubmit={agregar}
        className="flex flex-col gap-3 rounded-[20px] border-[1.5px] border-linea bg-white p-4"
      >
        <label htmlFor={entradaNueva} className="text-tarjeta">
          Nueva respuesta rápida
        </label>
        <Segmentado
          etiqueta="Cuándo sale"
          valor={papel}
          alCambiar={setPapel}
          opciones={[
            ['vendedor', 'Cuando te escriben'],
            ['comprador', 'Cuando tú preguntas'],
          ]}
        />
        <div className="flex flex-wrap items-center gap-2.5">
          <CampoConFicha
            id={entradaNueva}
            antes={nueva.antes}
            despues={nueva.despues}
            conFicha={nueva.conFicha}
            alCambiar={setNueva}
          />
          <button
            type="button"
            disabled={nueva.conFicha}
            onClick={ponerFicha}
            className="h-11 shrink-0 rounded-full border-[1.5px] border-tinta bg-white px-4 text-apoyo font-bold disabled:border-borde disabled:text-detalle"
          >
            + Nombre de la tienda
          </button>
          <button
            type="submit"
            disabled={
              !textoNuevo || textoNuevo === FICHA_TIENDA || lleno || textoNuevo.length > 120
            }
            className="h-11 shrink-0 rounded-full bg-pase px-5 font-bold text-white disabled:bg-borde-control"
          >
            Agregar
          </button>
        </div>
        {lleno && (
          <span className="text-nota text-detalle">
            Ya tienes {MAX_RESPUESTAS_RAPIDAS} en «{PAPELES[papel].titulo}»: quita una para agregar
            otra.
          </span>
        )}
        <span className="text-nota text-secundario">
          Al tocar una en el chat <b className="font-bold">no se envía sola</b>: se escribe en la
          caja con el nombre ya puesto y tú la mandas con Enter.
        </span>
      </form>
      {error && (
        <p role="alert" className="text-apoyo text-error">
          {error}
        </p>
      )}
    </div>
  );
}

function enListas(lista: RespuestaRapida[]): Listas {
  return {
    vendedor: lista.filter((r) => r.papel === 'vendedor').map((r) => r.texto),
    comprador: lista.filter((r) => r.papel === 'comprador').map((r) => r.texto),
  };
}
