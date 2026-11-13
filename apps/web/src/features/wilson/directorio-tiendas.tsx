'use client';

import {
  ORDENES_DIRECTORIO,
  type OrdenDirectorio,
  type RespuestaDirectorioTiendas,
  type TiendaDelDirectorio,
} from '@paselibre/contracts';
import { IconLock } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';

import { llamarApi, type ErrorApi } from '@/shared/api/cliente';
import { lugarDeTienda, reputacionParaLeer, textoPiso, textoReputacion } from '@/shared/tiendas';
import { AvatarBorroso } from '@/shared/ui/avatar-borroso';
import { AvatarTienda } from '@/shared/ui/avatar-tienda';

import {
  hrefDirectorio,
  ORDEN_POR_DEFECTO,
  parametrosDirectorio,
  SIN_FILTROS,
  TEXTO_ORDEN,
  type ConsultaDirectorio,
} from './consulta-directorio';

/**
 * Un filtro en píldora del lienzo («Todas las galerías ▾»): se ve el texto y encima va un
 * `<select>` de verdad, transparente, que abre la lista del sistema (cómoda en el celular).
 */
function Filtro({
  etiqueta,
  texto,
  textoCorto,
  activo,
  valor,
  opciones,
  alCambiar,
}: {
  /** Para los lectores de pantalla: «Galería». */
  etiqueta: string;
  texto: string;
  /** En el celular, más corto: «Todas ▾». */
  textoCorto?: string;
  activo: boolean;
  valor: string;
  opciones: Array<{ valor: string; texto: string }>;
  alCambiar: (valor: string) => void;
}) {
  return (
    <span
      className={`relative inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-full px-3.5 text-nota sm:h-[38px] sm:text-apoyo ${
        activo
          ? 'bg-tinta font-bold text-white'
          : 'border-[1.5px] border-borde bg-white font-semibold text-tinta'
      } focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-pase`}
    >
      <span aria-hidden="true" className={textoCorto ? 'max-sm:hidden' : ''}>
        {texto} ▾
      </span>
      {textoCorto && (
        <span aria-hidden="true" className="sm:hidden">
          {textoCorto} ▾
        </span>
      )}
      <select
        aria-label={etiqueta}
        value={valor}
        onChange={(evento) => alCambiar(evento.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full opacity-0"
      >
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.texto}
          </option>
        ))}
      </select>
    </span>
  );
}

/**
 * Un perfil privado buscado con su nombre exacto (doc 20, punto 5): el nombre, el logo borroso y
 * «Tienda · Cuenta privada». Nada más.
 */
function TarjetaPrivada({ tienda }: { tienda: TiendaDelDirectorio }) {
  return (
    <li className="flex flex-col gap-2.5 rounded-[18px] border-[1.5px] border-borde bg-white p-4">
      <div className="flex items-center gap-2.5">
        <AvatarBorroso nombre={tienda.nombre} logo={tienda.logo_borroso} tamano={48} />
        <span className="flex min-w-0 flex-col">
          <b className="truncate text-[16px] font-bold leading-[22px]">{tienda.nombre}</b>
          <span className="flex items-center gap-1 text-nota text-detalle">
            Tienda · Cuenta privada
            <IconLock size={12} stroke={2} aria-hidden="true" />
          </span>
        </span>
      </div>
      <div className="mt-auto flex items-center">
        <Link
          href={`/tiendas/${tienda.id}`}
          aria-label={`Ver la tienda ${tienda.nombre}`}
          className="ml-auto inline-flex h-9 shrink-0 items-center rounded-full border-[1.5px] border-tinta bg-white px-5 text-nota font-bold text-tinta no-underline hover:bg-superficie"
        >
          Ver tienda
        </Link>
      </div>
    </li>
  );
}

function TarjetaTienda({ tienda }: { tienda: TiendaDelDirectorio }) {
  const reputacion = textoReputacion(tienda.reputacion);
  if (tienda.privada) return <TarjetaPrivada tienda={tienda} />;
  return (
    <li className="flex flex-col gap-2.5 rounded-[18px] border-[1.5px] border-borde bg-white p-4">
      <div className="flex items-center gap-2.5">
        <AvatarTienda
          nombre={tienda.nombre}
          logo={tienda.logo}
          enLinea={tienda.en_linea}
          tamano={48}
          letra={17}
        />
        <span className="flex min-w-0 flex-col">
          <b className="truncate text-[16px] font-bold leading-[22px]">{tienda.nombre}</b>
          <span className="truncate text-nota text-detalle">
            {lugarDeTienda(tienda)}
            {tienda.piso ? ` · ${textoPiso(tienda.piso)}` : ''}
          </span>
        </span>
      </div>
      <span className="text-nota text-secundario">
        {tienda.vende.length > 0 ? tienda.vende.join(' · ') : 'Aún no publica productos'}
      </span>
      <div className="mt-auto flex items-center gap-2">
        <b className="text-apoyo font-bold" aria-label={reputacionParaLeer(tienda.reputacion)}>
          <span aria-hidden="true" className="sm:hidden">
            {textoReputacion(tienda.reputacion, true)}
          </span>
          <span aria-hidden="true" className="max-sm:hidden">
            {reputacion}
          </span>
        </b>
        <Link
          href={`/tiendas/${tienda.id}`}
          aria-label={tienda.propia ? 'Ver tu tienda' : `Ver la tienda ${tienda.nombre}`}
          className="ml-auto inline-flex h-9 shrink-0 items-center rounded-full border-[1.5px] border-tinta bg-white px-5 text-nota font-bold text-tinta no-underline hover:bg-superficie"
        >
          {tienda.propia ? 'Ver tu tienda' : 'Ver tienda'}
        </Link>
      </div>
    </li>
  );
}

function Vacio({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[18px] border-[1.5px] border-borde bg-white px-5 py-10 text-center text-secundario">
      {children}
    </div>
  );
}

/**
 * La pestaña «Tiendas» de Wilson en vivo (N13, B): el directorio con «Todas las galerías ▾»,
 * «Piso ▾», «Vende: … ▾» y «Ordenar: Mejor reputación ▾». Los filtros van en la dirección (la
 * página vuelve a pedir la primera tanda); «Ver más tiendas» trae las siguientes aquí mismo.
 */
export function DirectorioTiendas({
  inicial,
  consulta,
}: {
  inicial: RespuestaDirectorioTiendas;
  consulta: ConsultaDirectorio;
}) {
  const router = useRouter();
  const [tiendas, setTiendas] = useState(inicial.tiendas);
  const [pagina, setPagina] = useState(inicial.pagina);
  const [hayMas, setHayMas] = useState(inicial.hay_mas);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { filtros } = inicial;

  const cambiar = (cambios: Partial<ConsultaDirectorio>) =>
    router.push(hrefDirectorio(consulta, cambios), { scroll: false });

  async function verMas() {
    setCargando(true);
    setError(null);
    try {
      const siguiente = await llamarApi<RespuestaDirectorioTiendas>(
        `/wilson/tiendas?${parametrosDirectorio(consulta, pagina + 1).toString()}`,
      );
      // Sin repetir alguna que se movió de lugar mientras mirabas.
      setTiendas((antes) => {
        const ya = new Set(antes.map((tienda) => tienda.id));
        return [...antes, ...siguiente.tiendas.filter((tienda) => !ya.has(tienda.id))];
      });
      setPagina(siguiente.pagina);
      setHayMas(siguiente.hay_mas);
    } catch (problema) {
      setError((problema as ErrorApi).message);
    } finally {
      setCargando(false);
    }
  }

  const galeria = filtros.galerias.find((opcion) => opcion.slug === consulta.galeria);
  const categoria = filtros.categorias.find((opcion) => opcion.slug === consulta.vende);
  const conFiltros =
    Boolean(consulta.q || consulta.galeria || consulta.piso || consulta.vende) ||
    consulta.orden !== ORDEN_POR_DEFECTO;
  const faltan = inicial.total - tiendas.length;

  return (
    <section aria-label="Tiendas de Wilson" className="flex flex-col gap-3.5">
      <div className="-mx-4 flex items-center gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0">
        <Filtro
          etiqueta="Galería"
          texto={galeria?.nombre ?? 'Todas las galerías'}
          textoCorto={galeria?.nombre ?? 'Todas'}
          activo={Boolean(galeria)}
          valor={consulta.galeria}
          opciones={[
            { valor: '', texto: 'Todas las galerías' },
            ...filtros.galerias.map((opcion) => ({ valor: opcion.slug, texto: opcion.nombre })),
          ]}
          alCambiar={(valor) => cambiar({ galeria: valor })}
        />
        {filtros.pisos.length > 0 && (
          <Filtro
            etiqueta="Piso"
            texto={consulta.piso ? textoPiso(consulta.piso) : 'Piso'}
            activo={Boolean(consulta.piso)}
            valor={consulta.piso}
            opciones={[
              { valor: '', texto: 'Todos los pisos' },
              ...filtros.pisos.map((piso) => ({ valor: piso, texto: textoPiso(piso) })),
            ]}
            alCambiar={(valor) => cambiar({ piso: valor })}
          />
        )}
        <Filtro
          etiqueta="Vende"
          texto={categoria ? `Vende: ${categoria.nombre}` : 'Vende: todo'}
          textoCorto={categoria ? categoria.nombre : 'Vende'}
          activo={Boolean(categoria)}
          valor={consulta.vende}
          opciones={[
            { valor: '', texto: 'Vende: todo' },
            ...filtros.categorias.map((opcion) => ({ valor: opcion.slug, texto: opcion.nombre })),
          ]}
          alCambiar={(valor) => cambiar({ vende: valor })}
        />
        <Filtro
          etiqueta="Ordenar"
          texto={`Ordenar: ${TEXTO_ORDEN[consulta.orden]}`}
          textoCorto="Ordenar"
          activo={consulta.orden !== ORDEN_POR_DEFECTO}
          valor={consulta.orden}
          opciones={ORDENES_DIRECTORIO.map((orden: OrdenDirectorio) => ({
            valor: orden,
            texto: TEXTO_ORDEN[orden],
          }))}
          alCambiar={(valor) => cambiar({ orden: valor as OrdenDirectorio })}
        />
        {consulta.q && (
          <Link
            href={hrefDirectorio(consulta, { q: '' })}
            scroll={false}
            aria-label={`Quitar «${consulta.q}»`}
            className="inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-full bg-pase-medio px-3.5 text-nota font-semibold text-tinta no-underline sm:h-[38px] sm:text-apoyo"
          >
            «{consulta.q}»<span aria-hidden="true">×</span>
          </Link>
        )}
      </div>

      {tiendas.length === 0 ? (
        <Vacio>
          <p className="m-0">
            {conFiltros ? 'No hay tiendas con estos filtros.' : 'Aún no hay tiendas para mostrar.'}
          </p>
          {conFiltros && (
            <Link
              href={hrefDirectorio(SIN_FILTROS)}
              scroll={false}
              className="font-bold text-pase-texto"
            >
              Ver todas las tiendas
            </Link>
          )}
        </Vacio>
      ) : (
        <ul className="m-0 grid list-none gap-3.5 p-0 sm:grid-cols-2 lg:grid-cols-3">
          {tiendas.map((tienda) => (
            <TarjetaTienda key={tienda.id} tienda={tienda} />
          ))}
        </ul>
      )}

      {hayMas && faltan > 0 && (
        <button
          type="button"
          onClick={() => void verMas()}
          disabled={cargando}
          className="self-center rounded-full border-[1.5px] border-tinta bg-white px-6 py-2.5 text-apoyo font-bold text-tinta hover:bg-superficie disabled:opacity-60"
        >
          {cargando ? 'Cargando…' : 'Ver más tiendas'}
        </button>
      )}
      {error && (
        <p role="alert" className="m-0 text-center text-apoyo text-error">
          {error}
        </p>
      )}
    </section>
  );
}
