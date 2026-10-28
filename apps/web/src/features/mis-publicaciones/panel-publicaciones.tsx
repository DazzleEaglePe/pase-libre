'use client';

import {
  EVENTOS,
  formatearPrecio,
  type EditarOfertaEntrada,
  type OfertaPropia,
  type PestanaMisOfertas,
  type RespuestaConfirmar,
  type RespuestaMisOfertas,
} from '@paselibre/contracts';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { haceCuanto } from '@/shared/fechas';
import { useEvento } from '@/shared/tiempo-real';
import { Contador } from '@/shared/ui/contador';
import { botonPeligro, botonPrincipal, botonSecundario } from '@/shared/ui/estilos';
import { Miniatura } from '@/shared/ui/miniatura';
import { Ventana } from '@/shared/ui/ventana';

const PESTANAS: Array<[PestanaMisOfertas, string]> = [
  ['activas', 'Activas'],
  ['sin_stock', 'Sin stock'],
  ['pausadas', 'Pausadas'],
  ['todas', 'Todas'],
];

const CONDICION = { NUEVO: 'Nuevo', USADO: 'Usado' } as const;
const COLUMNAS = 'lg:grid-cols-[56px_minmax(0,1fr)_140px_160px_150px_132px_40px]';
const botonFila =
  'flex h-10 w-full items-center justify-center rounded-full text-apoyo font-medium no-underline lg:w-[132px]';

function fichaDe(oferta: OfertaPropia): string {
  return `/p/${oferta.producto.slug}?oferta=${oferta.id}`;
}

/** Una publicación: fila de tabla en pantallas grandes y tarjeta en el celular. */
function Fila({
  oferta,
  usuarioId,
  menuAbierto,
  alAbrirMenu,
  alCambiar,
  alEliminar,
}: {
  oferta: OfertaPropia;
  usuarioId: string;
  menuAbierto: boolean;
  alAbrirMenu: (abierto: boolean) => void;
  alCambiar: (cambios: EditarOfertaEntrada) => void;
  alEliminar: () => void;
}) {
  const titulo = oferta.producto.titulo;
  const pausada = oferta.estado === 'PAUSADA';
  const agotada = !pausada && oferta.stock === 0;
  const meta = [
    CONDICION[oferta.condicion],
    oferta.producto.categoria.nombre,
    pausada && 'Pausada',
    oferta.responsable.id !== usuarioId && `Mensajes a ${oferta.responsable.nombre}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <li
      className={`relative grid grid-cols-[56px_minmax(0,1fr)_40px] items-center gap-x-4 gap-y-3 border-b border-linea py-4 lg:min-h-[76px] lg:py-2 ${COLUMNAS} ${
        pausada ? 'opacity-[0.72]' : ''
      } ${menuAbierto ? 'z-20' : ''}`}
    >
      <Miniatura
        ruta={oferta.fotos[0]?.ruta ?? oferta.producto.foto}
        categoria={oferta.producto.categoria.slug}
        className="h-[42px] w-14 rounded-lg"
      />
      <span className="flex min-w-0 flex-col">
        <Link
          href={fichaDe(oferta)}
          className="truncate font-medium no-underline hover:underline"
          title={titulo}
        >
          {titulo}
        </Link>
        <span className="text-nota text-detalle">{meta}</span>
      </span>

      <span className="col-start-1 col-end-3 row-start-2 flex flex-wrap items-center gap-x-5 gap-y-3 lg:contents">
        <span className="lg:col-start-3 lg:row-start-1">
          {agotada ? (
            <span className="text-apoyo font-semibold text-error">Sin stock</span>
          ) : (
            <Contador
              chico
              valor={oferta.stock}
              nombre={titulo}
              alCambiar={(stock) => alCambiar({ stock })}
            />
          )}
        </span>

        <span className="flex flex-col items-start gap-0.5 lg:col-start-4 lg:row-start-1">
          <span className="font-semibold">
            {oferta.precio ? formatearPrecio(oferta.precio) : 'Sin monto'}
          </span>
          {oferta.precio ? (
            <button
              type="button"
              aria-pressed={oferta.precio_visible}
              aria-label={`Mostrar el precio de ${titulo} a vendedores con sesión`}
              title="Cambiar quién ve el precio"
              onClick={() => alCambiar({ precio_visible: !oferta.precio_visible })}
              className={`flex h-6 items-center rounded-full px-2 text-[12px] font-medium ${
                oferta.precio_visible ? 'bg-ok-fondo text-ok' : 'bg-superficie text-secundario'
              }`}
            >
              {oferta.precio_visible ? 'Visible' : 'Oculto · al interno'}
            </button>
          ) : (
            <span className="text-[12px] font-medium text-secundario">Al interno</span>
          )}
        </span>

        <span className="flex flex-col items-start gap-0.5 lg:col-start-5 lg:row-start-1">
          <span className="text-apoyo text-secundario">{haceCuanto(oferta.actualizada_en)}</span>
          {oferta.revisar && (
            <span className="rounded-full bg-aviso-fondo px-2 text-[12px] font-medium leading-5 text-aviso">
              Revísala
            </span>
          )}
        </span>
      </span>

      <span className="col-span-3 lg:col-span-1 lg:col-start-6 lg:row-start-1">
        {pausada ? (
          <button
            type="button"
            onClick={() => alCambiar({ estado: 'ACTIVA' })}
            className={`${botonFila} border border-borde bg-white`}
          >
            Reactivar
          </button>
        ) : agotada ? (
          <button
            type="button"
            onClick={() => alCambiar({ stock: 1 })}
            className={`${botonFila} bg-pase text-white`}
          >
            Reponer stock
          </button>
        ) : (
          <Link
            href={`/publicar?editar=${oferta.id}`}
            className={`${botonFila} border border-borde bg-white`}
          >
            Editar
          </Link>
        )}
      </span>

      <span className="relative col-start-3 row-start-1 lg:col-start-7">
        <button
          type="button"
          aria-label={`Más acciones para ${titulo}`}
          aria-expanded={menuAbierto}
          onClick={() => alAbrirMenu(!menuAbierto)}
          className={`flex h-10 w-10 items-center justify-center rounded-full ${menuAbierto ? 'bg-superficie' : ''}`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <circle cx="5" cy="12" r="1.8" />
            <circle cx="12" cy="12" r="1.8" />
            <circle cx="19" cy="12" r="1.8" />
          </svg>
        </button>
        {menuAbierto && (
          <span
            role="menu"
            className="absolute right-0 top-11 z-20 flex w-[200px] flex-col rounded-[14px] border border-linea bg-white p-1.5 shadow-[0_12px_28px_rgba(20,22,26,0.16)]"
          >
            <button
              type="button"
              role="menuitem"
              onClick={() => alCambiar({ estado: pausada ? 'ACTIVA' : 'PAUSADA' })}
              className="flex min-h-10 items-center rounded-[10px] px-2.5 text-left text-apoyo hover:bg-superficie"
            >
              {pausada ? 'Reactivar' : 'Pausar'}
            </button>
            <Link
              role="menuitem"
              href={fichaDe(oferta)}
              className="flex min-h-10 items-center rounded-[10px] px-2.5 text-apoyo no-underline hover:bg-superficie"
            >
              Ver en la ficha
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={alEliminar}
              className="flex min-h-10 items-center rounded-[10px] px-2.5 text-left text-apoyo text-error hover:bg-superficie"
            >
              Eliminar
            </button>
          </span>
        )}
      </span>
    </li>
  );
}

/**
 * Mis publicaciones (F_MisPublicaciones, RF-08 a RF-10): las ofertas de la tienda por
 * pestaña, con stock, precio y visibilidad que se cambian en la misma fila.
 */
export function PanelPublicaciones({ usuarioId }: { usuarioId: string }) {
  const [pestana, setPestana] = useState<PestanaMisOfertas>('activas');
  const [busca, setBusca] = useState('');
  const [q, setQ] = useState('');
  const [datos, setDatos] = useState<RespuestaMisOfertas | null>(null);
  const [ofertas, setOfertas] = useState<OfertaPropia[]>([]);
  const [pagina, setPagina] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [menu, setMenu] = useState<string | null>(null);
  const [borrar, setBorrar] = useState<OfertaPropia | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const ultima = useRef(0);

  // El texto se busca medio segundo después de dejar de escribir.
  useEffect(() => {
    const espera = setTimeout(() => setQ(busca.trim()), 300);
    return () => clearTimeout(espera);
  }, [busca]);

  const cargar = useCallback(
    async (hasta = 1) => {
      const numero = ++ultima.current;
      try {
        const paginas = await Promise.all(
          Array.from({ length: hasta }, (_, i) =>
            llamarApi<RespuestaMisOfertas>(
              `/mis-ofertas?estado=${pestana}&q=${encodeURIComponent(q)}&pagina=${i + 1}`,
            ),
          ),
        );
        if (numero !== ultima.current) return;
        const ultimaPagina = paginas[paginas.length - 1] ?? null;
        setDatos(ultimaPagina);
        setOfertas(paginas.flatMap((p) => p.ofertas));
        setPagina(hasta);
        setError(null);
      } catch (e) {
        if (numero === ultima.current) {
          setError(e instanceof ErrorApi ? e.message : 'No pudimos cargar tus publicaciones.');
        }
      }
    },
    [pestana, q],
  );

  useEffect(() => {
    void cargar(1);
  }, [cargar]);
  // Un «Vendido» en un chat baja el stock: la lista se pone al día sola (docs/05 §6.3).
  useEvento(EVENTOS.ofertaStock, () => void cargar(pagina));

  async function cambiar(oferta: OfertaPropia, cambios: EditarOfertaEntrada) {
    setMenu(null);
    // Se ve al instante; si la API no acepta el cambio, vuelve a como estaba.
    setOfertas((lista) =>
      lista.map((o) =>
        o.id === oferta.id
          ? {
              ...o,
              stock: cambios.stock ?? o.stock,
              precio_visible: cambios.precio_visible ?? o.precio_visible,
              estado: cambios.estado ?? o.estado,
            }
          : o,
      ),
    );
    try {
      const nueva = await llamarApi<OfertaPropia>(`/ofertas/${oferta.id}`, {
        metodo: 'PATCH',
        cuerpo: cambios,
      });
      setOfertas((lista) => lista.map((o) => (o.id === nueva.id ? nueva : o)));
      setError(null);
    } catch (e) {
      setOfertas((lista) => lista.map((o) => (o.id === oferta.id ? oferta : o)));
      setError(e instanceof ErrorApi ? e.message : 'No pudimos guardar el cambio.');
    }
    // Los conteos de las pestañas y el aviso de revisión cambian con cada ajuste.
    void cargar(pagina);
  }

  async function eliminar() {
    if (!borrar) return;
    try {
      await llamarApi(`/ofertas/${borrar.id}`, { metodo: 'DELETE' });
      setBorrar(null);
      void cargar(pagina);
    } catch (e) {
      setBorrar(null);
      setError(e instanceof ErrorApi ? e.message : 'No pudimos eliminar la publicación.');
    }
  }

  async function confirmarTodas() {
    setConfirmando(true);
    try {
      await llamarApi<RespuestaConfirmar>('/ofertas/confirmar', { metodo: 'POST', cuerpo: {} });
      await cargar(pagina);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos confirmarlas.');
    } finally {
      setConfirmando(false);
    }
  }

  const tienda = datos?.tienda;
  const lugar = tienda
    ? [tienda.nombre, tienda.galeria ?? 'Independiente', tienda.stand && `Stand ${tienda.stand}`]
        .filter(Boolean)
        .join(' · ')
    : '';
  const porRevisar = datos?.por_revisar ?? 0;
  const sinNada = datos?.conteos.todas === 0;

  return (
    <div className="flex flex-col gap-5">
      {menu && (
        <button
          type="button"
          aria-label="Cerrar menú"
          tabIndex={-1}
          onClick={() => setMenu(null)}
          className="fixed inset-0 z-10 cursor-default"
        />
      )}

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-titulo">Mis publicaciones</h1>
          <span className="text-apoyo text-secundario">{lugar}</span>
        </div>
        <Link href="/publicar" className={`${botonPrincipal} no-underline`}>
          Publicar
        </Link>
      </div>

      {porRevisar > 0 && (
        <section
          aria-label="Publicaciones por revisar"
          className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl bg-aviso-fondo px-[18px] py-3.5 text-[#5C2A00]"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          <span className="flex-[1_1_360px]">
            <b className="font-semibold">
              {porRevisar === 1
                ? '1 publicación lleva más de 7 días sin actualizarse.'
                : `${porRevisar} publicaciones llevan más de 7 días sin actualizarse.`}
            </b>{' '}
            Confírmalas para que sigan arriba en las búsquedas.
          </span>
          <button
            type="button"
            disabled={confirmando}
            onClick={confirmarTodas}
            className="h-10 rounded-full border border-[#5C2A00] px-4 text-apoyo font-medium"
          >
            {confirmando ? 'Confirmando…' : 'Siguen igual'}
          </button>
        </section>
      )}

      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-linea">
        <div
          role="tablist"
          aria-label="Estado de las publicaciones"
          className="flex flex-wrap gap-x-6"
        >
          {PESTANAS.map(([valor, texto]) => {
            const activa = valor === pestana;
            return (
              <button
                key={valor}
                type="button"
                role="tab"
                aria-selected={activa}
                onClick={() => {
                  setPestana(valor);
                  setMenu(null);
                }}
                className={`-mb-px h-11 border-b-2 text-apoyo ${
                  activa
                    ? 'border-tinta font-semibold'
                    : 'border-transparent font-medium text-secundario'
                }`}
              >
                {texto}
                <span className="ml-1.5 font-normal text-detalle">
                  {datos?.conteos[valor] ?? ''}
                </span>
              </button>
            );
          })}
        </div>
        <label className="mb-2 flex h-10 w-[300px] max-w-full items-center gap-2 rounded-full border border-borde px-3 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-tinta">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#2E3A5A"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <span className="sr-only">Buscar en mis publicaciones</span>
          <input
            type="search"
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Buscar en mis publicaciones"
            className="h-full min-w-0 flex-1 bg-transparent text-apoyo placeholder:text-detalle focus-visible:outline-none"
          />
        </label>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-error-fondo px-3.5 py-3 text-apoyo text-error">
          {error}
        </p>
      )}

      <div className="-mt-2 flex flex-col">
        <div
          aria-hidden="true"
          className={`hidden min-h-10 items-center gap-x-4 border-b border-linea text-nota font-semibold text-detalle lg:grid ${COLUMNAS}`}
        >
          <span />
          <span>Producto</span>
          <span>Stock</span>
          <span>Precio</span>
          <span>Actualizado</span>
          <span />
          <span />
        </div>
        {datos === null && !error ? (
          <p className="py-8 text-secundario">Cargando…</p>
        ) : ofertas.length === 0 ? (
          <div className="flex flex-col items-start gap-3 py-8">
            <p className="text-secundario">
              {sinNada
                ? 'Todavía no publicas nada. Busca tu producto en el catálogo y publícalo en un par de minutos.'
                : q
                  ? `Ninguna publicación coincide con «${q}».`
                  : 'No tienes publicaciones en esta pestaña.'}
            </p>
            {sinNada && (
              <Link href="/publicar" className={`${botonSecundario} no-underline`}>
                Publicar mi primer producto
              </Link>
            )}
          </div>
        ) : (
          <ul aria-label="Publicaciones">
            {ofertas.map((oferta) => (
              <Fila
                key={oferta.id}
                oferta={oferta}
                usuarioId={usuarioId}
                menuAbierto={menu === oferta.id}
                alAbrirMenu={(abierto) => setMenu(abierto ? oferta.id : null)}
                alCambiar={(cambios) => void cambiar(oferta, cambios)}
                alEliminar={() => {
                  setMenu(null);
                  setBorrar(oferta);
                }}
              />
            ))}
          </ul>
        )}
        {datos && pagina < datos.paginas && (
          <button
            type="button"
            onClick={() => void cargar(pagina + 1)}
            className={`${botonSecundario} mt-4 self-center`}
          >
            Ver más
          </button>
        )}
      </div>

      <p className="text-nota text-detalle">
        Cuando marcas «Vendido» en un chat, el stock baja solo. Si vendiste por otro lado, ajústalo
        aquí con − y +.
      </p>

      <Ventana
        titulo="¿Eliminar esta publicación?"
        abierta={borrar !== null}
        alCerrar={() => setBorrar(null)}
      >
        <p className="text-secundario">
          «{borrar?.producto.titulo}» se quita del catálogo. Las conversaciones sobre este producto
          se conservan. Si solo quieres esconderla un tiempo, mejor páusala.
        </p>
        <div className="mt-2 flex justify-end gap-3">
          <button type="button" onClick={() => setBorrar(null)} className={botonSecundario}>
            Cancelar
          </button>
          <button type="button" onClick={eliminar} className={botonPeligro}>
            Eliminar
          </button>
        </div>
      </Ventana>
    </div>
  );
}
