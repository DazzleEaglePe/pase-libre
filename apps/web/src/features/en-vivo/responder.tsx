'use client';

import {
  formatearPrecio,
  type OpcionRespuestaEnVivo,
  type RespuestaOpcionesEnVivo,
  type RespuestaResponderEnVivo,
} from '@paselibre/contracts';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useId, useState, type FormEvent } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { botonPrincipal, botonSecundario } from '@/shared/ui/estilos';
import { Miniatura } from '@/shared/ui/miniatura';
import { Ventana } from '@/shared/ui/ventana';

import { conVendedor, textoAccion, type ItemEnVivo } from './textos';

function mensajeSugerido(opcion: OpcionRespuestaEnVivo | undefined): string {
  if (!opcion) return '';
  // Un precio al interno no sale en el mensaje: lo decide quien vende.
  const precio =
    opcion.precio && opcion.precio_visible ? ` a ${formatearPrecio(opcion.precio)}` : '';
  const estado = opcion.condicion === 'NUEVO' ? 'nueva' : 'usada';
  return `Lo tengo: ${opcion.titulo}, ${estado}${precio}. ¿Te la separo?`;
}

/**
 * El botón «¡Lo tengo!» o «¡Lo quiero!» de cada publicación en vivo (RF-26). Sin sesión
 * lleva a ingresar; si tu tienda ya respondió, al chat; si es tuya, no aparece.
 */
export function BotonResponder({ item, className }: { item: ItemEnVivo; className: string }) {
  const [abierta, setAbierta] = useState(false);
  const accion = textoAccion(item.tipo);

  if (!conVendedor(item)) {
    return (
      <Link
        href="/ingresar"
        className={className}
        aria-label={`${accion} Inicia sesión para responder`}
      >
        {accion}
      </Link>
    );
  }
  if (item.propio) return null;
  if (item.respondiste) {
    return item.conversacion_id ? (
      <Link href={`/mensajes/${item.conversacion_id}`} className={className}>
        Ver chat
      </Link>
    ) : (
      <span className="text-nota text-detalle">Ya respondió tu tienda</span>
    );
  }
  return (
    <>
      <button type="button" onClick={() => setAbierta(true)} className={className}>
        {accion}
      </button>
      {abierta && <VentanaResponder item={item} alCerrar={() => setAbierta(false)} />}
    </>
  );
}

/** La ventana de responder: en un busco, cuál de tus publicaciones ofreces; y el mensaje. */
function VentanaResponder({ item, alCerrar }: { item: ItemEnVivo; alCerrar: () => void }) {
  const id = useId();
  const router = useRouter();
  const busco = item.tipo === 'BUSCO';
  const [opciones, setOpciones] = useState<OpcionRespuestaEnVivo[] | null>(busco ? null : []);
  const [elegida, setElegida] = useState<string | null>(null);
  const [texto, setTexto] = useState(busco ? '' : '¡Lo quiero! ¿Me la separas?');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!busco) return;
    llamarApi<RespuestaOpcionesEnVivo>(`/en-vivo/${item.id}/opciones`).then(
      ({ ofertas }) => {
        setOpciones(ofertas);
        setElegida(ofertas[0]?.oferta_id ?? null);
        setTexto(mensajeSugerido(ofertas[0]));
      },
      (e: unknown) => {
        setOpciones([]);
        setError(e instanceof ErrorApi ? e.message : 'No pudimos cargar tus publicaciones.');
      },
    );
  }, [busco, item.id]);

  async function enviar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const { conversacion_id } = await llamarApi<RespuestaResponderEnVivo>(
        `/en-vivo/${item.id}/respuestas`,
        { metodo: 'POST', cuerpo: { texto, ...(busco && elegida ? { oferta: elegida } : {}) } },
      );
      router.push(`/mensajes/${conversacion_id}`);
    } catch (e) {
      const chat = e instanceof ErrorApi ? e.detalles?.conversacion_id : null;
      if (typeof chat === 'string') {
        router.push(`/mensajes/${chat}`);
        return;
      }
      setError(e instanceof ErrorApi ? e.message : 'No pudimos enviar tu respuesta.');
      setEnviando(false);
    }
  }

  const sinOpciones = busco && opciones !== null && opciones.length === 0;
  return (
    <Ventana
      titulo={busco ? 'Responder «¡Lo tengo!»' : 'Responder «¡Lo quiero!»'}
      abierta
      alCerrar={alCerrar}
    >
      <p className="-mt-2 text-apoyo text-secundario">
        {busco ? 'Busca' : 'Ofrece'}: <b className="font-semibold text-tinta">{item.titulo}</b>
      </p>
      <form onSubmit={(evento) => void enviar(evento)} className="flex flex-col gap-4">
        {busco && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1.5 text-apoyo font-medium">¿Cuál tienes?</legend>
            {opciones === null && <p className="text-apoyo text-secundario">Cargando…</p>}
            {sinOpciones && (
              <p className="rounded-xl bg-superficie p-3 text-apoyo text-secundario">
                No tienes una publicación activa y con stock que coincida.{' '}
                <Link
                  href={item.producto ? `/publicar?igual=${item.producto.slug}` : '/publicar'}
                  className="font-semibold"
                >
                  Publícala
                </Link>{' '}
                y vuelve a responder.
              </p>
            )}
            {opciones?.map((opcion) => (
              <label
                key={opcion.oferta_id}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border p-2.5 ${
                  elegida === opcion.oferta_id ? 'border-tinta' : 'border-linea'
                }`}
              >
                <input
                  type="radio"
                  name={`${id}-oferta`}
                  checked={elegida === opcion.oferta_id}
                  onChange={() => {
                    setElegida(opcion.oferta_id);
                    setTexto(mensajeSugerido(opcion));
                  }}
                  className="h-4 w-4 accent-pase"
                />
                <Miniatura
                  ruta={opcion.foto}
                  categoria={item.categoria.slug}
                  className="h-10 w-12 rounded-lg"
                  glifo={34}
                  grosor={4}
                />
                <span className="flex min-w-0 flex-col">
                  <b className="truncate text-apoyo font-semibold">{opcion.titulo}</b>
                  <span className="text-nota text-secundario">
                    {opcion.condicion === 'NUEVO' ? 'Nuevo' : 'Usado'} · {opcion.stock} en stock
                    {opcion.precio ? ` · ${formatearPrecio(opcion.precio)}` : ' · Al interno'}
                  </span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
        {!sinOpciones && (
          <label htmlFor={`${id}-texto`} className="flex flex-col gap-1.5 text-apoyo font-medium">
            Mensaje
            <textarea
              id={`${id}-texto`}
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              rows={3}
              maxLength={2000}
              className="rounded-xl border border-borde px-3.5 py-2.5 text-cuerpo font-normal"
            />
          </label>
        )}
        <p className="text-nota text-detalle">
          Le llega a su chat y a su campanita. Tu tienda responde una vez a cada publicación.
        </p>
        {error && (
          <p role="alert" className="text-apoyo text-error">
            {error}
          </p>
        )}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={alCerrar} className={botonSecundario}>
            Cancelar
          </button>
          {!sinOpciones && (
            <button
              type="submit"
              disabled={enviando || !texto.trim() || (busco && !elegida)}
              className={botonPrincipal}
            >
              {enviando ? 'Enviando…' : 'Enviar y abrir el chat'}
            </button>
          )}
        </div>
      </form>
    </Ventana>
  );
}
