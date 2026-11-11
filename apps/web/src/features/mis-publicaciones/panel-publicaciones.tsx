'use client';

import {
  centimosDeMonto,
  EVENTOS,
  formatearPrecio,
  RAZONES_PAUSA,
  TEXTO_MODO_VENTA,
  type EditarOfertaEntrada,
  type OfertaPropia,
  type Precio,
  type RespuestaConfirmar,
  type RespuestaHistorial,
  type RespuestaMisOfertas,
  textoEstadoDetalle,
} from '@paselibre/contracts';
import {
  IconCheck,
  IconEye,
  IconInfoCircle,
  IconPencil,
  IconPlayerPauseFilled,
  IconPlus,
  IconSearch,
  IconStar,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { cuandoFue, haceCuanto } from '@/shared/fechas';
import { conPlural } from '@/shared/plural';
import { useEvento } from '@/shared/tiempo-real';
import { CabeceraMovil } from '@/shared/ui/cabecera-movil';
import { Contador } from '@/shared/ui/contador';
import { botonPeligro, botonSecundario } from '@/shared/ui/estilos';
import { Miniatura } from '@/shared/ui/miniatura';
import { Ventana } from '@/shared/ui/ventana';

type Pestana = 'activas' | 'pausadas' | 'vendidos';

const PESTANAS: Array<[Pestana, string]> = [
  ['activas', 'Activas'],
  ['pausadas', 'Pausadas'],
  ['vendidos', 'Vendidos'],
];

const pildora =
  'flex h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px] font-bold';

/** El precio que se ve en la fila: el facturado si solo vende facturado. */
function precioDeFila(oferta: OfertaPropia): Precio | null {
  return oferta.modo_venta === 'FACTURADO' ? oferta.precio_facturado : oferta.precio;
}

/** «Usado · como nuevo · Pase»: el estado del lienzo (o nuevo/usado) y cómo se vende. */
function lineaDeEstado(oferta: OfertaPropia): string {
  const estado = oferta.detalle
    ? textoEstadoDetalle(oferta.detalle)
    : oferta.condicion === 'NUEVO'
      ? 'Nuevo'
      : 'Usado';
  return `${estado} · ${TEXTO_MODO_VENTA[oferta.modo_venta]}`;
}

/** «Lleva 9 días sin cambios». */
function diasSinCambios(iso: string): string {
  const texto = haceCuanto(iso);
  return texto.startsWith('Hace ')
    ? `lleva ${texto.slice(5)} sin cambios`
    : 'lleva días sin cambios';
}

/** «Nuevo precio −5 [455] +5 Guardar Cancelar» (MP_CelPrecio): en la misma fila. */
function EditarPrecio({
  precio,
  alGuardar,
  alCancelar,
}: {
  precio: Precio;
  alGuardar: (monto: string) => void;
  alCancelar: () => void;
}) {
  const [texto, setTexto] = useState((precio.centimos / 100).toString());
  const valor = Number.parseFloat(texto.replace(',', '.'));
  const mover = (cuanto: number) =>
    setTexto(
      String(Math.max(1, Math.round(((Number.isNaN(valor) ? 0 : valor) + cuanto) * 100) / 100)),
    );
  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-tinta bg-white p-4">
      <b className="text-apoyo font-bold">Nuevo precio</b>
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => mover(-5)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-borde text-apoyo font-bold"
        >
          −5
        </button>
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-xl border border-borde px-3 sm:max-w-[200px]">
          <span className="text-cuerpo font-bold text-detalle">
            {precio.moneda === 'USD' ? 'US$' : 'S/'}
          </span>
          <span className="sr-only">Nuevo precio</span>
          <input
            inputMode="decimal"
            value={texto}
            onChange={(evento) => setTexto(evento.target.value)}
            onKeyDown={(evento) => {
              if (evento.key === 'Enter') alGuardar(texto);
              if (evento.key === 'Escape') alCancelar();
            }}
            autoFocus
            className="h-full min-w-0 flex-1 bg-transparent text-[18px] font-bold focus-visible:outline-none"
          />
        </label>
        <button
          type="button"
          onClick={() => mover(5)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-borde text-apoyo font-bold"
        >
          +5
        </button>
        <span className="flex gap-2 max-sm:w-full">
          <button
            type="button"
            onClick={() => alGuardar(texto)}
            className="h-11 flex-1 rounded-full bg-pase px-5 font-bold text-white sm:flex-none"
          >
            Guardar
          </button>
          <button
            type="button"
            onClick={alCancelar}
            className="h-11 flex-1 rounded-full border border-borde bg-white px-5 font-bold sm:flex-none"
          >
            Cancelar
          </button>
        </span>
      </div>
      <span className="text-nota text-secundario">
        Las tiendas ven el precio nuevo al instante. No hace falta volver a publicar.
      </span>
    </div>
  );
}

/** Una publicación activa (MP_Web, MP_Cel): precio, stock y pausa en la misma fila. */
function Fila({
  oferta,
  usuarioId,
  editando,
  pausando,
  ok,
  alEditar,
  alPausar,
  alCambiar,
  alConfirmar,
}: {
  oferta: OfertaPropia;
  usuarioId: string;
  editando: boolean;
  pausando: boolean;
  ok: string | undefined;
  alEditar: (abrir: boolean) => void;
  alPausar: (abrir: boolean) => void;
  alCambiar: (cambios: EditarOfertaEntrada, aviso?: string) => void;
  alConfirmar: () => void;
}) {
  const titulo = oferta.producto.titulo;
  const precio = precioDeFila(oferta);
  const campoPrecio = oferta.modo_venta === 'FACTURADO' ? 'precio_facturado' : 'precio';

  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-linea bg-white p-4 lg:rounded-none lg:border-0 lg:border-b lg:px-5 lg:py-5 lg:last:border-b-0">
      {oferta.revisar && !editando && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-xl bg-aviso-fondo px-3.5 py-3 text-apoyo text-aviso">
          <span className="min-w-0 flex-[1_1_260px]">
            <b className="font-bold">Revísala:</b> {diasSinCambios(oferta.actualizada_en)}. ¿Sigue
            igual?
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              onClick={alConfirmar}
              className={`${pildora} bg-tinta text-white`}
            >
              Sigue igual
            </button>
            <button
              type="button"
              onClick={() => alEditar(true)}
              className={`${pildora} border border-borde bg-white text-tinta`}
            >
              Cambiar precio
            </button>
          </span>
        </div>
      )}

      <div className="grid grid-cols-[72px_minmax(0,1fr)] items-start gap-x-4 gap-y-3 lg:grid-cols-[64px_minmax(0,1fr)_200px_220px_104px] lg:items-center lg:gap-x-6">
        <Miniatura
          ruta={oferta.fotos[0]?.ruta ?? oferta.producto.foto}
          categoria={oferta.producto.categoria.slug}
          className="h-[72px] w-[72px] rounded-xl lg:h-16 lg:w-16"
          glifo={44}
        />
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link
            href={`/p/${oferta.producto.slug}?oferta=${oferta.id}`}
            className="text-[15px] font-bold leading-5 text-tinta no-underline hover:underline"
          >
            {titulo}
          </Link>
          <span className="text-apoyo text-secundario">{lineaDeEstado(oferta)}</span>
          {oferta.impulsada_hasta && (
            <span className="mt-0.5 inline-flex items-center gap-1.5 self-start rounded-full bg-pase-medio px-2.5 py-0.5 text-nota font-bold text-marca">
              <span aria-hidden="true">🤫</span>
              Impulsada por el equipo · hasta las{' '}
              {new Intl.DateTimeFormat('es-PE', {
                timeZone: 'America/Lima',
                hour: 'numeric',
                minute: '2-digit',
                hour12: true,
              }).format(new Date(oferta.impulsada_hasta))}
            </span>
          )}
          {oferta.responsable.id !== usuarioId && (
            <span className="text-nota text-detalle">Mensajes a {oferta.responsable.nombre}</span>
          )}
          <span className="mt-0.5 hidden items-center gap-1.5 text-nota text-secundario lg:flex">
            <IconEye size={15} stroke={1.8} aria-hidden="true" />
            {conPlural(oferta.vistas_semana, 'vista', 'vistas')} ·{' '}
            {conPlural(oferta.chats_semana, 'chat', 'chats')} esta semana
          </span>
          {/* En el celular el precio va debajo del nombre (MP_Cel). */}
          <span className="mt-1.5 flex flex-wrap items-center gap-2 lg:hidden">
            <b className="text-[22px] font-bold leading-7">
              {precio ? formatearPrecio(precio) : 'Sin precio'}
            </b>
            {!editando && precio && (
              <button
                type="button"
                onClick={() => alEditar(true)}
                className="flex h-8 items-center gap-1.5 rounded-full border border-borde px-3 text-nota font-bold"
              >
                <IconPencil size={14} stroke={1.8} aria-hidden="true" />
                Editar precio
              </button>
            )}
          </span>
        </div>

        <span className="hidden items-center gap-3 lg:flex">
          <b className="text-[18px] font-bold">{precio ? formatearPrecio(precio) : 'Sin precio'}</b>
          {!precio && (
            <Link
              href={`/publicar?editar=${oferta.id}`}
              className="text-apoyo font-bold text-pase-texto"
            >
              Ponerle precio
            </Link>
          )}
          {!editando && precio && (
            <button
              type="button"
              aria-label={`Editar el precio de ${titulo}`}
              onClick={() => alEditar(true)}
              className="flex h-[34px] w-[34px] items-center justify-center rounded-full border border-borde hover:bg-superficie"
            >
              <IconPencil size={15} stroke={1.8} aria-hidden="true" />
            </button>
          )}
        </span>

        <span className="col-span-2 flex items-center justify-between gap-3 lg:col-span-1 lg:contents">
          <span className="flex items-center gap-2.5">
            <Contador
              valor={oferta.stock}
              nombre={titulo}
              alCambiar={(stock) =>
                alCambiar({ stock }, stock === 0 ? undefined : `Stock: ${stock}`)
              }
            />
            <span className="text-apoyo text-secundario">
              {oferta.stock === 1 ? 'disponible' : 'disponibles'}
            </span>
          </span>
          {!pausando && (
            <button
              type="button"
              onClick={() => alPausar(true)}
              className="flex h-10 shrink-0 items-center gap-1.5 justify-self-end rounded-full border border-borde bg-white px-4 text-apoyo font-bold hover:bg-superficie"
            >
              <IconPlayerPauseFilled size={12} aria-hidden="true" />
              Pausar
            </button>
          )}
        </span>
        <span className="col-span-2 flex items-center gap-1.5 text-nota text-secundario lg:hidden">
          <IconEye size={15} stroke={1.8} aria-hidden="true" />
          {conPlural(oferta.vistas_semana, 'vista', 'vistas')} ·{' '}
          {conPlural(oferta.chats_semana, 'chat', 'chats')} esta semana
        </span>
      </div>

      {editando && precio && (
        <EditarPrecio
          precio={precio}
          alCancelar={() => alEditar(false)}
          alGuardar={(monto) => {
            const centimos = centimosDeMonto(monto) ?? 0;
            alCambiar(
              { [campoPrecio]: monto },
              `Precio actualizado a ${formatearPrecio({ ...precio, centimos })} · lo ven al instante`,
            );
          }}
        />
      )}

      {pausando && (
        <div className="flex flex-col gap-3 rounded-2xl border border-borde bg-superficie p-4">
          <b className="text-cuerpo font-bold">¿Por qué la pausas?</b>
          <span className="text-apoyo text-secundario">
            Mientras esté pausada no sale en búsquedas y nadie te escribe por ella. La reactivas con
            un toque.
          </span>
          <span className="flex flex-wrap gap-2">
            {RAZONES_PAUSA.map((razon) => (
              <button
                key={razon}
                type="button"
                onClick={() => alCambiar({ estado: 'PAUSADA', razon_pausa: razon })}
                className={`${pildora} border border-borde bg-white text-tinta`}
              >
                {razon}
              </button>
            ))}
            <button
              type="button"
              onClick={() => alPausar(false)}
              className={`${pildora} text-secundario underline`}
            >
              Mejor no
            </button>
          </span>
        </div>
      )}

      {ok && (
        <span role="status" className="flex items-center gap-1.5 text-apoyo font-bold text-ok">
          <IconCheck size={16} stroke={2.2} aria-hidden="true" />
          {ok}
        </span>
      )}
      {oferta.stock === 0 && (
        <span className="flex max-w-[560px] items-center gap-2 rounded-xl bg-error-fondo px-3.5 py-2.5 text-apoyo text-error">
          <IconInfoCircle size={16} stroke={1.8} aria-hidden="true" />
          Sin stock: no sale en búsquedas hasta que subas al menos 1.
        </span>
      )}
    </li>
  );
}

/** Una pausada: con su razón, «Reactivar» y, si ya no va, «Eliminar». */
function FilaPausada({
  oferta,
  alReactivar,
  alEliminar,
}: {
  oferta: OfertaPropia;
  alReactivar: () => void;
  alEliminar: () => void;
}) {
  const precio = precioDeFila(oferta);
  return (
    <li className="flex flex-wrap items-center gap-4 rounded-2xl border border-linea bg-white p-4 lg:rounded-none lg:border-0 lg:border-b lg:px-5 lg:last:border-b-0">
      <Miniatura
        ruta={oferta.fotos[0]?.ruta ?? oferta.producto.foto}
        categoria={oferta.producto.categoria.slug}
        className="h-16 w-16 rounded-xl opacity-70"
        glifo={40}
      />
      <span className="flex min-w-0 flex-[1_1_240px] flex-col gap-0.5">
        <b className="text-[15px] font-bold leading-5">{oferta.producto.titulo}</b>
        <span className="text-apoyo text-secundario">
          {precio ? formatearPrecio(precio) : 'Sin precio'} · {oferta.stock}{' '}
          {oferta.stock === 1 ? 'disponible' : 'disponibles'}
        </span>
        <span className="text-nota font-bold text-aviso">
          Pausada{oferta.razon_pausa ? `: ${oferta.razon_pausa}` : ''}
        </span>
      </span>
      <span className="flex gap-2">
        <button
          type="button"
          onClick={alEliminar}
          className="h-10 rounded-full px-3 text-apoyo font-medium text-error underline"
        >
          Eliminar
        </button>
        <button
          type="button"
          onClick={alReactivar}
          className="h-10 rounded-full bg-pase px-5 text-apoyo font-bold text-white"
        >
          Reactivar
        </button>
      </span>
    </li>
  );
}

/** «Vendidos» (MP_CelVendidos): lo marcado con «Vendido» este mes, con su calificación. */
function Vendidos({ historial }: { historial: RespuestaHistorial | null }) {
  if (!historial) return <p className="py-8 text-secundario">Cargando…</p>;
  const totales = new Map<string, number>();
  for (const venta of historial.lista) {
    if (venta.precio) {
      totales.set(
        venta.precio.moneda,
        (totales.get(venta.precio.moneda) ?? 0) + venta.precio.centimos,
      );
    }
  }
  const montos = (['USD', 'PEN'] as const)
    .filter((moneda) => totales.has(moneda))
    .map((moneda) => formatearPrecio({ moneda, centimos: totales.get(moneda) ?? 0, monto: '' }));
  const mes = historial.meses.find((m) => m.mes === historial.mes)?.etiqueta ?? '';
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5 rounded-2xl bg-tinta px-5 py-4 text-white">
        <span className="text-apoyo text-white/80">{mes} por PaseLibre</span>
        <b className="text-[22px] font-bold leading-7">
          {conPlural(historial.lista.length, 'venta', 'ventas')}
          {montos.length > 0 ? ` · ${montos.join(' + ')}` : ''}
        </b>
      </div>
      {historial.lista.length === 0 ? (
        <p className="m-0 rounded-2xl border border-linea px-5 py-8 text-center text-secundario">
          Aún no marcaste ventas este mes.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0 lg:grid lg:grid-cols-2">
          {historial.lista.map((venta) => (
            <li
              key={venta.id}
              className="flex flex-col gap-1 rounded-2xl border border-linea bg-white px-4 py-3.5"
            >
              <span className="flex items-start justify-between gap-3">
                <b className="min-w-0 text-[15px] font-bold leading-5">{venta.producto.titulo}</b>
                <b className="shrink-0 text-[15px] font-bold">
                  {venta.precio ? formatearPrecio(venta.precio) : ''}
                </b>
              </span>
              <span className="text-apoyo text-secundario">
                A {venta.otra_tienda.nombre} · {cuandoFue(venta.fecha)}
              </span>
              <span className="mt-1 flex items-center gap-1.5 text-apoyo font-bold">
                <IconStar size={15} stroke={1.8} className="text-[#D49B00]" aria-hidden="true" />
                {venta.calificacion
                  ? `${venta.calificacion} ★ de ${venta.otra_tienda.nombre}`
                  : 'Aún no te califica'}
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="m-0 text-apoyo text-secundario">
        Salen aquí las ventas que marcaste con «Vendido» en el chat. El historial completo con
        descarga en Excel va aparte:{' '}
        <Link href="/historial" className="font-bold text-pase-texto">
          Mis ventas y compras
        </Link>
        .
      </p>
    </div>
  );
}

/**
 * Mis publicaciones (MP_Web, MP_Cel, sección 12 del lienzo final): las activas con precio,
 * stock y pausa en la misma fila; las pausadas con su razón; y lo vendido este mes.
 */
export function PanelPublicaciones({ usuarioId }: { usuarioId: string }) {
  const [pestana, setPestana] = useState<Pestana>('activas');
  const [busca, setBusca] = useState('');
  const [q, setQ] = useState('');
  const [datos, setDatos] = useState<RespuestaMisOfertas | null>(null);
  const [ofertas, setOfertas] = useState<OfertaPropia[]>([]);
  const [historial, setHistorial] = useState<RespuestaHistorial | null>(null);
  const [pagina, setPagina] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [editando, setEditando] = useState<string | null>(null);
  const [pausando, setPausando] = useState<string | null>(null);
  const [oks, setOks] = useState<Record<string, string>>({});
  const [aviso, setAviso] = useState<string | null>(null);
  const [borrar, setBorrar] = useState<OfertaPropia | null>(null);
  const ultima = useRef(0);

  useEffect(() => {
    const espera = setTimeout(() => setQ(busca.trim()), 300);
    return () => clearTimeout(espera);
  }, [busca]);

  const cargar = useCallback(
    async (hasta = 1) => {
      if (pestana === 'vendidos') return;
      const numero = ++ultima.current;
      const estado = pestana === 'activas' ? 'vigentes' : 'pausadas';
      try {
        const paginas = await Promise.all(
          Array.from({ length: hasta }, (_, i) =>
            llamarApi<RespuestaMisOfertas>(
              `/mis-ofertas?estado=${estado}&q=${encodeURIComponent(q)}&pagina=${i + 1}`,
            ),
          ),
        );
        if (numero !== ultima.current) return;
        setDatos(paginas[paginas.length - 1] ?? null);
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

  const cargarVendidos = useCallback(() => {
    llamarApi<RespuestaHistorial>('/historial?lado=ventas').then(setHistorial, () => undefined);
  }, []);

  useEffect(() => {
    void cargar(1);
  }, [cargar]);
  useEffect(cargarVendidos, [cargarVendidos]);
  // Un «Vendido» en un chat baja el stock: la lista se pone al día sola (docs/05 §6.3).
  useEvento(EVENTOS.ofertaStock, () => {
    void cargar(pagina);
    cargarVendidos();
  });

  async function cambiar(oferta: OfertaPropia, cambios: EditarOfertaEntrada, ok?: string) {
    setEditando(null);
    setPausando(null);
    // Se ve al instante; si la API no acepta el cambio, vuelve a como estaba.
    setOfertas((lista) =>
      lista.map((o) =>
        o.id === oferta.id
          ? { ...o, stock: cambios.stock ?? o.stock, estado: cambios.estado ?? o.estado }
          : o,
      ),
    );
    try {
      const nueva = await llamarApi<OfertaPropia>(`/ofertas/${oferta.id}`, {
        metodo: 'PATCH',
        cuerpo: cambios,
      });
      // Las vistas y los chats de la semana solo llegan con la lista.
      setOfertas((lista) =>
        lista.map((o) =>
          o.id === nueva.id
            ? { ...nueva, vistas_semana: o.vistas_semana, chats_semana: o.chats_semana }
            : o,
        ),
      );
      setOks((antes) => ({ ...antes, [oferta.id]: ok ?? '' }));
      if (cambios.estado === 'PAUSADA') setAviso('Pausada. La encuentras en «Pausadas».');
      if (cambios.estado === 'ACTIVA') setAviso('Activa de nuevo. Ya sale en las búsquedas.');
      setError(null);
    } catch (e) {
      setOfertas((lista) => lista.map((o) => (o.id === oferta.id ? oferta : o)));
      setError(e instanceof ErrorApi ? e.message : 'No pudimos guardar el cambio.');
    }
    // Pausar o reactivar la saca de esta pestaña; los conteos cambian.
    if (cambios.estado) void cargar(pagina);
  }

  async function confirmar(oferta: OfertaPropia) {
    try {
      await llamarApi<RespuestaConfirmar>('/ofertas/confirmar', {
        metodo: 'POST',
        cuerpo: { ids: [oferta.id] },
      });
      setOfertas((lista) =>
        lista.map((o) =>
          o.id === oferta.id
            ? { ...o, revisar: false, actualizada_en: new Date().toISOString() }
            : o,
        ),
      );
      setOks((antes) => ({
        ...antes,
        [oferta.id]: 'Confirmada: vuelve a salir arriba en las búsquedas',
      }));
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos confirmarla.');
    }
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

  const tienda = datos?.tienda;
  const activas = datos?.conteos.vigentes ?? 0;
  const resumen = datos
    ? `${conPlural(activas, 'activa', 'activas')} · ${conPlural(datos.vistas_semana, 'vista', 'vistas')} esta semana`
    : '';
  const lugar = tienda
    ? [tienda.nombre, tienda.galeria, tienda.stand && `Stand ${tienda.stand}`, resumen]
        .filter(Boolean)
        .join(' · ')
    : '';
  const conteo: Record<Pestana, number | undefined> = {
    activas: datos?.conteos.vigentes,
    pausadas: datos?.conteos.pausadas,
    vendidos: historial?.conteos.ventas,
  };
  const sinNada = datos?.conteos.todas === 0;

  return (
    <div className="flex flex-col gap-5">
      <CabeceraMovil
        centro={
          <span className="flex min-w-0 flex-1 flex-col pl-1">
            <b className="truncate text-[20px] font-bold leading-6">Mis publicaciones</b>
            <span className="truncate text-nota text-white/85">{resumen}</span>
          </span>
        }
      >
        <Link
          href="/publicar"
          className="mr-1 flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-apoyo font-bold text-tinta no-underline"
        >
          <IconPlus size={16} stroke={2.2} aria-hidden="true" />
          Publicar
        </Link>
      </CabeceraMovil>

      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 max-md:hidden">
        <div className="flex flex-col gap-1">
          <h1 className="text-titulo">Mis publicaciones</h1>
          <span className="text-apoyo text-secundario">{lugar}</span>
        </div>
        <Link
          href="/publicar"
          className="flex h-11 items-center gap-2 rounded-full bg-pase px-5 font-bold text-white no-underline"
        >
          <IconPlus size={18} stroke={2.2} aria-hidden="true" />
          Publicar
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 lg:rounded-full lg:bg-superficie lg:p-1">
        <div
          role="tablist"
          aria-label="Mis publicaciones"
          className="flex rounded-full bg-superficie p-1 lg:p-0"
        >
          {PESTANAS.map(([valor, texto]) => (
            <button
              key={valor}
              type="button"
              role="tab"
              aria-selected={pestana === valor}
              onClick={() => {
                setPestana(valor);
                setEditando(null);
                setPausando(null);
                setAviso(null);
              }}
              className={`h-[38px] whitespace-nowrap rounded-full px-3 text-apoyo sm:px-4 ${
                pestana === valor
                  ? 'bg-tinta font-bold text-white'
                  : 'font-medium text-secundario hover:text-tinta'
              }`}
            >
              {texto}
              {conteo[valor] !== undefined ? ` · ${conteo[valor]}` : ''}
            </button>
          ))}
        </div>
        {pestana !== 'vendidos' && !sinNada && (
          <label className="flex h-10 w-[280px] max-w-full items-center gap-2 rounded-full border border-borde bg-white px-3 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-tinta max-lg:w-full">
            <IconSearch size={16} stroke={1.8} aria-hidden="true" />
            <span className="sr-only">Buscar en mis publicaciones</span>
            <input
              type="search"
              value={busca}
              onChange={(evento) => setBusca(evento.target.value)}
              placeholder="Buscar en mis publicaciones"
              className="h-full min-w-0 flex-1 bg-transparent text-apoyo placeholder:text-detalle focus-visible:outline-none"
            />
          </label>
        )}
      </div>

      {error && (
        <p role="alert" className="m-0 rounded-xl bg-error-fondo px-3.5 py-3 text-apoyo text-error">
          {error}
        </p>
      )}

      {pestana === 'vendidos' ? (
        <Vendidos historial={historial} />
      ) : datos === null && !error ? (
        <p className="py-8 text-secundario">Cargando…</p>
      ) : sinNada ? (
        // EV_WebProd: la vitrina vacía.
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-linea px-6 py-12 text-center">
          <h2 className="text-[24px] font-bold leading-8">Tu vitrina está vacía</h2>
          <p className="m-0 max-w-[480px] text-cuerpo text-secundario">
            Publica tu primer producto. Si ya está en el catálogo, solo pones el estado, el precio y
            el stock: menos de un minuto.
          </p>
          <div className="flex flex-wrap justify-center gap-2.5">
            <Link
              href="/publicar"
              className="flex h-12 items-center rounded-full bg-pase px-5 font-bold text-white no-underline"
            >
              Publicar mi primer producto
            </Link>
            <Link
              href="/pedidos-en-vivo/publicar"
              className="flex h-12 items-center gap-2 rounded-full border border-borde px-5 font-bold text-tinta no-underline"
            >
              <span aria-hidden="true" className="h-2 w-2 rounded-full bg-vivo" />O pide algo en
              vivo
            </Link>
          </div>
          <p className="m-0 max-w-[480px] text-nota text-secundario">
            Las demás tiendas te encuentran por lo que publicas. Mientras tu vitrina esté vacía,
            solo te ven por tus pedidos en vivo.
          </p>
        </div>
      ) : ofertas.length === 0 ? (
        <p className="m-0 rounded-2xl border border-linea px-5 py-8 text-center text-secundario">
          {q
            ? `Ninguna publicación coincide con «${q}».`
            : pestana === 'pausadas'
              ? 'No tienes publicaciones pausadas.'
              : 'No tienes publicaciones activas.'}
        </p>
      ) : (
        <ul
          aria-label="Publicaciones"
          className="m-0 flex list-none flex-col gap-3 p-0 lg:gap-0 lg:overflow-hidden lg:rounded-[20px] lg:border lg:border-linea"
        >
          {ofertas.map((oferta) =>
            pestana === 'pausadas' ? (
              <FilaPausada
                key={oferta.id}
                oferta={oferta}
                alReactivar={() => void cambiar(oferta, { estado: 'ACTIVA' })}
                alEliminar={() => setBorrar(oferta)}
              />
            ) : (
              <Fila
                key={oferta.id}
                oferta={oferta}
                usuarioId={usuarioId}
                editando={editando === oferta.id}
                pausando={pausando === oferta.id}
                ok={oks[oferta.id] || undefined}
                alEditar={(abrir) => {
                  setPausando(null);
                  setEditando(abrir ? oferta.id : null);
                }}
                alPausar={(abrir) => {
                  setEditando(null);
                  setPausando(abrir ? oferta.id : null);
                }}
                alCambiar={(cambios, ok) => void cambiar(oferta, cambios, ok)}
                alConfirmar={() => void confirmar(oferta)}
              />
            ),
          )}
        </ul>
      )}
      {pestana !== 'vendidos' && datos && pagina < datos.paginas && (
        <button
          type="button"
          onClick={() => void cargar(pagina + 1)}
          className={`${botonSecundario} self-center`}
        >
          Ver más
        </button>
      )}

      {pestana === 'activas' && ofertas.length > 0 && (
        <p className="m-0 text-nota text-detalle">
          Cuando marcas «Vendido» en un chat, el stock baja solo. Si vendiste por otro lado,
          ajústalo aquí con − y +.
        </p>
      )}

      {aviso && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-24 z-40 mx-auto flex max-w-[460px] items-center justify-between gap-4 rounded-2xl bg-tinta px-4 py-3 text-apoyo text-white shadow-[0_12px_28px_rgba(20,22,26,0.24)] md:bottom-8"
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

      <Ventana
        titulo="¿Eliminar esta publicación?"
        abierta={borrar !== null}
        alCerrar={() => setBorrar(null)}
      >
        <p className="text-secundario">
          «{borrar?.producto.titulo}» se quita del catálogo. Las conversaciones sobre este producto
          se conservan.
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
