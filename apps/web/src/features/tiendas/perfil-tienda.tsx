'use client';

import {
  formatearPrecio,
  type AvisosSeguimiento,
  type PerfilTienda,
  type RespuestaOpiniones,
  type RespuestaSeguir,
} from '@paselibre/contracts';
import {
  IconAdjustmentsHorizontal,
  IconBell,
  IconCheck,
  IconHome,
  IconMessage,
  IconStar,
  IconStarFilled,
  IconUserPlus,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { Hoja } from '@/shared/ui/hoja';
import { Miniatura } from '@/shared/ui/miniatura';

import { MenuOpciones } from '@/features/reportes/menu-opciones';

import { ListaOpiniones } from './opiniones';
import { Portada } from './portada';

const OPCIONES_AVISOS: Array<[AvisosSeguimiento, string, string]> = [
  ['TODO', 'Todo lo que publique', 'Cada producto nuevo y cada pedido en vivo'],
  [
    'IMPORTANTE',
    'Solo lo importante',
    'Productos nuevos y sus pedidos en vivo, máximo 1 aviso al día',
  ],
  ['NINGUNO', 'Sin avisos', 'Igual te salen primero en tu inicio'],
];

/** «4,8» con coma, como se escribe en Perú. */
export const decimal = (valor: number) => valor.toFixed(1).replace('.', ',');

export function Estrellas({ valor, tamano = 18 }: { valor: number; tamano?: number }) {
  return (
    <span
      className="flex text-[#F59E0B]"
      aria-label={`${decimal(valor)} de 5 estrellas`}
      role="img"
    >
      {[1, 2, 3, 4, 5].map((n) =>
        n <= Math.round(valor) ? (
          <IconStarFilled key={n} size={tamano} aria-hidden="true" />
        ) : (
          <IconStar key={n} size={tamano} stroke={1.6} aria-hidden="true" />
        ),
      )}
    </span>
  );
}

function Iniciales({ texto, grande = false }: { texto: string; grande?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full bg-pase-medio font-bold text-marca ${
        grande ? 'h-[92px] w-[92px] border-4 border-white text-[30px]' : 'h-10 w-10 text-apoyo'
      }`}
    >
      {texto}
    </span>
  );
}

/**
 * El perfil de otra tienda (SG_Web, SG_Cel): la portada verde con sus iniciales, la
 * reputación, cuántas la siguen, «Seguir» (la primera vez explica qué pasa al seguir) o
 * «Siguiendo» con los avisos, «Escribir», y sus productos u opiniones.
 */
export function PerfilDeTienda({
  perfil: inicial,
  pestanaInicial,
}: {
  perfil: PerfilTienda;
  pestanaInicial: 'productos' | 'opiniones';
}) {
  const router = useRouter();
  const [perfil, setPerfil] = useState(inicial);
  const [pestana, setPestana] = useState(pestanaInicial);
  const [hoja, setHoja] = useState<'confirmar' | 'opciones' | null>(null);
  const [avisos, setAvisos] = useState<AvisosSeguimiento>(
    inicial.siguiendo?.avisos ?? 'IMPORTANTE',
  );
  const [aviso, setAviso] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opiniones, setOpiniones] = useState<RespuestaOpiniones | null>(null);
  const [enviando, setEnviando] = useState(false);

  const cargarOpiniones = useCallback(
    (filtro = 'todas') =>
      llamarApi<RespuestaOpiniones>(`/tiendas/${perfil.id}/opiniones?filtro=${filtro}`).then(
        setOpiniones,
        () => undefined,
      ),
    [perfil.id],
  );

  useEffect(() => {
    void cargarOpiniones();
  }, [cargarOpiniones]);

  async function cambiar(metodo: 'POST' | 'PATCH' | 'DELETE', mensaje: string) {
    setEnviando(true);
    setError(null);
    try {
      const respuesta = await llamarApi<RespuestaSeguir>(`/tiendas/${perfil.id}/seguir`, {
        metodo,
        ...(metodo === 'DELETE' ? {} : { cuerpo: { avisos } }),
      });
      setPerfil((actual) => ({
        ...actual,
        siguiendo: respuesta.siguiendo,
        seguidores: respuesta.seguidores,
        explicar_seguir: false,
      }));
      setHoja(null);
      setAviso(mensaje);
      router.refresh();
    } catch (falla) {
      setError(falla instanceof ErrorApi ? falla.message : 'No pudimos guardar el cambio.');
    } finally {
      setEnviando(false);
    }
  }

  function seguir() {
    if (perfil.explicar_seguir) setHoja('confirmar');
    else void cambiar('POST', `Ahora sigues a ${perfil.nombre}`);
  }

  const lugar = [perfil.stand && `Stand ${perfil.stand}`, perfil.galeria]
    .filter(Boolean)
    .join(' · ');
  const { reputacion } = perfil;
  const totalOpiniones = opiniones?.reputacion.opiniones ?? reputacion.opiniones;

  return (
    <div className="-mx-4 -mt-5 flex flex-col sm:mx-0 sm:mt-0">
      <Portada perfil={perfil}>
        <button
          type="button"
          aria-label="Volver"
          onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))}
          className="absolute left-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-tinta/30 text-white md:hidden"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
      </Portada>

      <div className="flex flex-col gap-4 px-4 sm:px-8">
        <div className="relative z-10 -mt-[46px]">
          <Iniciales texto={perfil.iniciales} grande />
        </div>
        <div className="flex flex-col gap-1">
          <h1 className="text-[24px] font-bold leading-8">{perfil.nombre}</h1>
          {lugar && <span className="text-apoyo text-secundario">{lugar}</span>}
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-apoyo text-secundario">
            <span className="flex items-center gap-1.5">
              <IconStar size={16} stroke={1.8} aria-hidden="true" className="text-[#F59E0B]" />
              {reputacion.promedio !== null ? (
                <>
                  <b className="font-bold text-tinta">{decimal(reputacion.promedio)}</b>(
                  {reputacion.ventas === 1 ? '1 venta' : `${reputacion.ventas} ventas`})
                </>
              ) : reputacion.ventas > 0 ? (
                `Sin opiniones · ${reputacion.ventas === 1 ? '1 venta' : `${reputacion.ventas} ventas`}`
              ) : (
                'Sin opiniones todavía'
              )}
            </span>
            <span>
              {perfil.seguidores === 1
                ? '1 tienda la sigue'
                : `${perfil.seguidores} tiendas la siguen`}
            </span>
          </span>
        </div>

        {(perfil.puede_seguir || perfil.propia) && (
          <div className="grid max-w-[420px] grid-cols-2 gap-2.5">
            {perfil.propia ? (
              <Link
                href="/cuenta/configuracion"
                className="col-span-2 flex h-12 items-center justify-center rounded-full border border-borde font-semibold text-tinta no-underline"
              >
                Así ven tu perfil las demás tiendas · Editar
              </Link>
            ) : (
              <>
                {perfil.siguiendo ? (
                  <button
                    type="button"
                    aria-haspopup="dialog"
                    onClick={() => {
                      setAvisos(perfil.siguiendo?.avisos ?? 'IMPORTANTE');
                      setHoja('opciones');
                    }}
                    className="flex h-12 items-center justify-center gap-2 rounded-full border border-pase bg-pase-suave font-bold text-marca"
                  >
                    <IconCheck size={18} stroke={2} aria-hidden="true" />
                    Siguiendo
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={enviando}
                    onClick={seguir}
                    className="flex h-12 items-center justify-center gap-2 rounded-full bg-pase font-bold text-white disabled:opacity-60"
                  >
                    <IconUserPlus size={18} stroke={1.8} aria-hidden="true" />
                    Seguir
                  </button>
                )}
                <Link
                  href={`/mensajes?tienda=${perfil.id}`}
                  className="flex h-12 items-center justify-center gap-2 rounded-full border border-borde font-bold text-tinta no-underline hover:border-borde-control"
                >
                  <IconMessage size={18} stroke={1.8} aria-hidden="true" />
                  Escribir
                </Link>
              </>
            )}
          </div>
        )}
        {perfil.puede_seguir && (
          <div className="-mt-2 flex items-center gap-2">
            <MenuOpciones
              objeto="TIENDA"
              objetoId={perfil.id}
              sobre={`Tienda · ${perfil.nombre}`}
              tienda={perfil.bloqueada ? null : { id: perfil.id, nombre: perfil.nombre }}
            />
            <span className="text-nota text-secundario">Reportar o bloquear</span>
          </div>
        )}
        {perfil.bloqueada && (
          <div className="flex max-w-[560px] flex-wrap items-center justify-between gap-3 rounded-2xl bg-error-fondo px-4 py-3">
            <span className="flex flex-col">
              <b className="text-apoyo font-bold">Bloqueaste a {perfil.nombre}</b>
              <span className="text-nota text-secundario">Ya no verás sus publicaciones.</span>
            </span>
            <button
              type="button"
              onClick={() =>
                void llamarApi(`/cuenta/bloqueados/${perfil.id}`, { metodo: 'DELETE' }).then(() => {
                  setPerfil((actual) => ({ ...actual, bloqueada: false }));
                  router.refresh();
                })
              }
              className="h-10 rounded-full border border-borde bg-white px-4 text-apoyo font-bold"
            >
              Desbloquear
            </button>
          </div>
        )}
        {error && (
          <p role="alert" className="text-apoyo text-error">
            {error}
          </p>
        )}

        <div
          role="tablist"
          aria-label="Perfil"
          className="grid max-w-[420px] grid-cols-2 gap-1 rounded-full bg-superficie p-1"
        >
          {(
            [
              ['productos', `Productos · ${perfil.total_productos}`],
              ['opiniones', `Opiniones · ${totalOpiniones}`],
            ] as const
          ).map(([clave, texto]) => (
            <button
              key={clave}
              type="button"
              role="tab"
              aria-selected={pestana === clave}
              onClick={() => setPestana(clave)}
              className={`h-[38px] rounded-full text-apoyo ${
                pestana === clave ? 'bg-tinta font-bold text-white' : 'font-medium text-secundario'
              }`}
            >
              {texto}
            </button>
          ))}
        </div>

        {pestana === 'productos' ? (
          perfil.productos.length === 0 ? (
            <p className="py-6 text-secundario">Por ahora no tiene productos publicados.</p>
          ) : (
            <ul className="grid list-none grid-cols-2 gap-x-3 gap-y-5 p-0 pb-6 md:grid-cols-4 md:gap-x-4">
              {perfil.productos.map((producto) => (
                <li key={producto.oferta_id}>
                  <Link
                    href={`/p/${producto.producto.slug}`}
                    className="flex flex-col gap-2 text-tinta no-underline"
                  >
                    <Miniatura
                      ruta={producto.producto.foto}
                      categoria={producto.producto.categoria.slug}
                      className="aspect-[17/12] w-full rounded-2xl"
                      glifo={80}
                      grosor={3}
                    />
                    <b className="line-clamp-2 text-apoyo font-bold">{producto.producto.titulo}</b>
                    <span className="self-start rounded-full bg-tinta px-2.5 text-apoyo font-bold leading-7 text-white">
                      {producto.precio ? formatearPrecio(producto.precio) : 'Al interno'}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )
        ) : opiniones ? (
          <ListaOpiniones
            datos={opiniones}
            tienda={perfil.nombre}
            alFiltrar={(filtro) => void cargarOpiniones(filtro)}
          />
        ) : (
          <p className="py-6 text-detalle">Cargando opiniones…</p>
        )}
      </div>

      <Hoja
        titulo={
          perfil.siguiendo ? `Sigues a ${perfil.nombre}` : `¿Quieres seguir a ${perfil.nombre}?`
        }
        abierta={hoja !== null}
        alCerrar={() => setHoja(null)}
        pie={
          hoja === 'confirmar' ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => setHoja(null)}
                  className="h-12 rounded-full border border-borde font-bold text-tinta"
                >
                  Ahora no
                </button>
                <button
                  type="button"
                  disabled={enviando}
                  onClick={() => void cambiar('POST', `¡Listo! Ahora sigues a ${perfil.nombre}`)}
                  className="h-12 rounded-full bg-pase font-bold text-white disabled:opacity-60"
                >
                  Sí, seguir
                </button>
              </div>
              <span className="text-center text-nota text-secundario">
                Este mensaje solo te sale la primera vez que sigues a una tienda.
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <button
                type="button"
                disabled={enviando}
                onClick={() =>
                  void cambiar(
                    'PATCH',
                    `Listo: ${OPCIONES_AVISOS.find(([clave]) => clave === avisos)?.[1].toLowerCase()} de ${perfil.nombre}`,
                  )
                }
                className="h-12 rounded-full bg-tinta font-bold text-white disabled:opacity-60"
              >
                Guardar
              </button>
              <button
                type="button"
                disabled={enviando}
                onClick={() =>
                  void cambiar(
                    'DELETE',
                    `Dejaste de seguir a ${perfil.nombre}. Puedes volver cuando quieras.`,
                  )
                }
                className="h-11 font-bold text-error"
              >
                Dejar de seguir
              </button>
            </div>
          )
        }
      >
        {hoja === 'confirmar' ? (
          <div className="flex flex-col gap-4">
            <span className="text-cuerpo">Así no te pierdes nada de lo que publica:</span>
            <Punto icono={<IconHome size={18} stroke={1.8} aria-hidden="true" />}>
              Sus productos nuevos te salen <b className="font-bold">primero en tu inicio</b>.
            </Punto>
            <Punto icono={<IconBell size={18} stroke={1.8} aria-hidden="true" />}>
              Te avisamos de lo más importante: productos nuevos y sus pedidos en vivo.{' '}
              <b className="font-bold">Sin llenarte de mensajes.</b>
            </Punto>
            <Punto icono={<IconAdjustmentsHorizontal size={18} stroke={1.8} aria-hidden="true" />}>
              Puedes cambiar los avisos o dejar de seguirla cuando quieras, desde su perfil.
            </Punto>
          </div>
        ) : (
          <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
            <legend className="pb-2 text-cuerpo font-bold">¿De qué quieres que te avisemos?</legend>
            {OPCIONES_AVISOS.map(([clave, titulo, detalle]) => (
              <label
                key={clave}
                className={`flex cursor-pointer items-start gap-3 rounded-[14px] border-2 px-3.5 py-3 ${
                  avisos === clave ? 'border-tinta bg-superficie' : 'border-linea bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="avisos"
                  value={clave}
                  checked={avisos === clave}
                  onChange={() => setAvisos(clave)}
                  className="mt-0.5 h-5 w-5 shrink-0 accent-tinta"
                />
                <span className="flex flex-col">
                  <b className="text-cuerpo font-bold">{titulo}</b>
                  <span className="text-nota text-secundario">{detalle}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}
      </Hoja>

      {aviso && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-[480px] items-center justify-between gap-3 rounded-2xl bg-tinta px-4 py-3 text-apoyo text-white shadow-lg md:bottom-8"
        >
          {aviso}
          <button
            type="button"
            onClick={() => setAviso(null)}
            className="h-9 rounded-full px-3 font-bold text-acento"
          >
            OK
          </button>
        </div>
      )}
    </div>
  );
}

function Punto({ icono, children }: { icono: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-start gap-3 text-cuerpo">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pase-suave text-marca">
        {icono}
      </span>
      <span className="pt-1.5">{children}</span>
    </span>
  );
}
