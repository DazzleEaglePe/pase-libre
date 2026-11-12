'use client';

import {
  textoHorario,
  urlFoto,
  type AvisosSeguimiento,
  type PerfilTienda,
  type RespuestaOpiniones,
  type RespuestaSeguir,
} from '@paselibre/contracts';
import {
  IconAdjustmentsHorizontal,
  IconBell,
  IconBrandWhatsapp,
  IconCalendar,
  IconCheck,
  IconClock,
  IconHome,
  IconMapPin,
  IconMessage,
  IconPencil,
  IconShieldCheck,
  IconUserPlus,
} from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, type ReactNode } from 'react';

import { textoEstado } from '@/features/catalogo/textos';
import { MenuOpciones } from '@/features/reportes/menu-opciones';
import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { conPlural } from '@/shared/plural';
import { CabeceraMovil } from '@/shared/ui/cabecera-movil';
import { Hoja } from '@/shared/ui/hoja';
import { TarjetaProducto } from '@/shared/ui/tarjeta-producto';

import { ListaOpiniones } from './opiniones';
import { MenuPortada, Portada } from './portada';
import { decimal, Estrellas, Reputacion } from './reputacion';
import { FranjaTuMes } from './tu-mes';

// Antes vivían aquí; otras pantallas las siguen pidiendo desde este archivo.
export { decimal, Estrellas };

const OPCIONES_AVISOS: Array<[AvisosSeguimiento, string, string]> = [
  ['TODO', 'Todo lo que publique', 'Cada producto nuevo y cada pedido en vivo'],
  [
    'IMPORTANTE',
    'Solo lo importante',
    'Productos nuevos y sus pedidos en vivo, máximo 1 aviso al día',
  ],
  ['NINGUNO', 'Sin avisos', 'Igual te salen primero en tu inicio'],
];

export type PestanaPerfil = 'productos' | 'opiniones' | 'detalles';

const MES_Y_ANIO = new Intl.DateTimeFormat('es-PE', {
  month: 'short',
  year: 'numeric',
  timeZone: 'America/Lima',
});

/** «nov 2026». */
const mesYAnio = (iso: string) =>
  MES_Y_ANIO.format(new Date(iso)).replace('.', '').replace(' de ', ' ');

/** «Tarjetas de video, monitores y procesadores»: lo que más publica. */
function queVende(categorias: string[]): string {
  const nombres = categorias.map((nombre, i) => (i === 0 ? nombre : nombre.toLowerCase()));
  if (nombres.length <= 1) return nombres[0] ?? '';
  return `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
}

/** El logo de la tienda, o sus iniciales, con el aro blanco que lo separa de la portada. */
function Logo({ perfil }: { perfil: PerfilTienda }) {
  return (
    <span className="relative flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-full bg-marca text-[32px] font-extrabold text-white shadow-[0_0_0_5px_#FFFFFF,0_6px_18px_rgba(15,20,18,0.18)] sm:h-[120px] sm:w-[120px] sm:text-[40px]">
      {perfil.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={urlFoto(perfil.logo)}
          alt={`Logo de ${perfil.nombre}`}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">{perfil.iniciales}</span>
      )}
    </span>
  );
}

function Dato({ valor, texto }: { valor: ReactNode; texto: string }) {
  return (
    <span className="flex flex-col">
      <b className="text-[20px] font-bold leading-6 sm:text-[22px]">{valor}</b>
      <span className="text-[12px] leading-4 text-detalle">{texto}</span>
    </span>
  );
}

function Linea({ icono, children }: { icono: ReactNode; children: ReactNode }) {
  return (
    <span className="flex items-start gap-2.5 text-apoyo">
      <span aria-hidden="true" className="mt-0.5 shrink-0 text-secundario">
        {icono}
      </span>
      <span>{children}</span>
    </span>
  );
}

/** «Sobre la tienda» con la reputación abajo (N04_PerfilA_Web). */
function SobreLaTienda({
  perfil,
  alVerDetalle,
}: {
  perfil: PerfilTienda;
  alVerDetalle: () => void;
}) {
  const horario = perfil.horario_tramos
    ? textoHorario(perfil.horario_tramos, 'corto')
    : perfil.horario;
  return (
    <section
      aria-label="Sobre la tienda"
      className="flex flex-col gap-2.5 rounded-[14px] border-[1.5px] border-borde bg-white p-[18px]"
    >
      <h2 className="text-[17px] font-bold leading-6">Sobre la tienda</h2>
      {perfil.descripcion ? (
        <p className="m-0 whitespace-pre-line text-apoyo text-secundario">{perfil.descripcion}</p>
      ) : (
        <p className="m-0 text-apoyo text-detalle">
          {perfil.propia
            ? 'Cuéntales qué vendes y con qué marcas trabajas desde «Editar perfil».'
            : 'Todavía no contó nada de su tienda.'}
        </p>
      )}
      <span className="flex flex-col gap-2.5">
        {perfil.indicaciones && (
          <Linea icono={<IconMapPin size={17} stroke={1.8} />}>
            Cómo llegar: {perfil.indicaciones}
          </Linea>
        )}
        {horario && <Linea icono={<IconClock size={17} stroke={1.8} />}>{horario}</Linea>}
        <Linea icono={<IconBrandWhatsapp size={17} stroke={1.8} />}>
          WhatsApp: pídelo por chat
        </Linea>
        <Linea icono={<IconCalendar size={17} stroke={1.8} />}>
          En PaseLibre desde {mesYAnio(perfil.desde)}
        </Linea>
      </span>
      <span aria-hidden="true" className="h-px bg-[#E2E7E4]" />
      <Reputacion
        reputacion={perfil.reputacion}
        propia={perfil.propia}
        variante="lateral"
        verDetalle={alVerDetalle}
      />
    </section>
  );
}

/**
 * El perfil de una tienda (N04_PerfilA_Web, N04_PerfilB_Web, N04_Celulares): la cabecera A
 * (estilo Pinterest, con la portada que se desvanece), el logo, qué vende, dónde está, su horario
 * y «Cuenta verificada»; sus números (estrellas, pases cerrados, cuánto tarda en responder);
 * «Escribir», «Siguiendo» y ⋯; las pestañas Productos · Opiniones · Detalles y, al costado,
 * «Sobre la tienda» con la reputación que se ilumina hasta su nivel.
 *
 * Tu propio perfil se ve igual que lo ven los demás: solo cambian los botones («Editar perfil» y
 * «Cambiar portada») y aparece la franja «Tu mes», que solo ves tú.
 */
export function PerfilDeTienda({
  perfil: inicial,
  pestanaInicial,
}: {
  perfil: PerfilTienda;
  pestanaInicial: PestanaPerfil;
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
  const [acomodando, setAcomodando] = useState(false);

  // La portada y el resto cambian desde «Cambiar portada»: se toma lo nuevo del servidor.
  useEffect(() => setPerfil(inicial), [inicial]);

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

  function verOpiniones() {
    setPestana('opiniones');
    document.getElementById('pestanas-perfil')?.scrollIntoView({ behavior: 'smooth' });
  }

  const { reputacion } = perfil;
  const totalOpiniones = opiniones?.reputacion.opiniones ?? reputacion.opiniones;
  const lugar = [perfil.galeria ?? 'Independiente', perfil.stand && `Stand ${perfil.stand}`]
    .filter(Boolean)
    .join(' · ');
  const horario = perfil.horario_tramos
    ? textoHorario(perfil.horario_tramos, 'cabecera')
    : perfil.horario;
  const vende = queVende(perfil.categorias_principales);
  const boton =
    'flex h-[46px] items-center justify-center gap-2 rounded-full px-5 text-cuerpo font-bold no-underline';
  const sobre = <SobreLaTienda perfil={perfil} alVerDetalle={verOpiniones} />;

  return (
    <div className="flex flex-col gap-4 sm:gap-[18px]">
      <CabeceraMovil titulo={perfil.propia ? 'Tu perfil' : perfil.nombre} />

      <section
        aria-label={perfil.nombre}
        className="relative rounded-[24px] border-[1.5px] border-borde bg-white"
      >
        <Portada
          perfil={perfil}
          pinterest
          acomodando={acomodando}
          alTerminarAcomodo={() => setAcomodando(false)}
        />
        <div className="relative -mt-[90px] flex flex-col gap-4 px-[18px] pb-[18px] sm:-mt-[140px] sm:px-8 sm:pb-[26px] lg:flex-row lg:items-end lg:justify-between">
          <div className="flex min-w-0 flex-col gap-2.5">
            <Logo perfil={perfil} />
            <span className="flex flex-col gap-0.5">
              {/* Como en N04: el nombre en Inter y como lo escribió la tienda, no en mayúsculas. */}
              <h1 className="font-sans text-[24px] font-bold normal-case leading-8 tracking-normal sm:text-[30px] sm:leading-9">
                {perfil.nombre}
              </h1>
              {vende && <span className="text-cuerpo text-secundario">{vende}</span>}
            </span>
            <span className="flex flex-col gap-1.5 text-apoyo text-secundario sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4">
              <span className="flex items-center gap-1.5">
                <IconMapPin size={16} stroke={1.8} aria-hidden="true" />
                {lugar}
              </span>
              {horario && (
                <span className="flex items-center gap-1.5">
                  <IconClock size={16} stroke={1.8} aria-hidden="true" />
                  {horario}
                </span>
              )}
              <span className="flex items-center gap-1.5">
                <IconShieldCheck size={16} stroke={1.8} aria-hidden="true" />
                Cuenta verificada
              </span>
            </span>
          </div>

          <div className="flex flex-col gap-4 lg:items-end">
            <div className="flex items-stretch gap-[18px]">
              {reputacion.nivel !== null && reputacion.promedio !== null ? (
                <Dato
                  valor={`${decimal(reputacion.promedio)} ★`}
                  texto={conPlural(reputacion.opiniones, 'opinión', 'opiniones')}
                />
              ) : (
                <Dato valor="🌱 Nueva" texto={`${reputacion.opiniones} de 5 opiniones`} />
              )}
              <span aria-hidden="true" className="w-[1.5px] bg-[#D8DFDB]" />
              <Dato
                valor={reputacion.pases_60}
                texto={reputacion.pases_60 === 1 ? 'pase cerrado' : 'pases cerrados'}
              />
              {reputacion.responde_en !== null && (
                <>
                  <span aria-hidden="true" className="w-[1.5px] bg-[#D8DFDB]" />
                  <Dato valor={`~${reputacion.responde_en} min`} texto="responde" />
                </>
              )}
            </div>

            {perfil.propia ? (
              <div className="grid grid-cols-2 gap-2 sm:flex">
                <Link
                  href="/cuenta/configuracion?seccion=datos"
                  className={`${boton} bg-tinta text-white`}
                >
                  <IconPencil size={18} stroke={1.8} aria-hidden="true" />
                  Editar perfil
                </Link>
                <MenuPortada perfil={perfil} alAcomodar={() => setAcomodando(true)} />
              </div>
            ) : (
              perfil.puede_seguir && (
                <div className="flex items-center gap-2">
                  <Link
                    href={`/mensajes?tienda=${perfil.id}`}
                    className={`${boton} bg-tinta text-white hover:bg-black`}
                  >
                    <IconMessage size={18} stroke={1.8} aria-hidden="true" />
                    Escribir
                  </Link>
                  {perfil.siguiendo ? (
                    <button
                      type="button"
                      aria-haspopup="dialog"
                      onClick={() => {
                        setAvisos(perfil.siguiendo?.avisos ?? 'IMPORTANTE');
                        setHoja('opciones');
                      }}
                      className={`${boton} border-[1.5px] border-borde bg-white px-4 text-apoyo text-tinta`}
                    >
                      <IconCheck size={17} stroke={2} aria-hidden="true" />
                      Siguiendo
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={enviando}
                      onClick={seguir}
                      className={`${boton} border-[1.5px] border-pase bg-white px-4 text-apoyo text-pase-texto disabled:opacity-60`}
                    >
                      <IconUserPlus size={17} stroke={1.8} aria-hidden="true" />
                      Seguir
                    </button>
                  )}
                  <MenuOpciones
                    objeto="TIENDA"
                    objetoId={perfil.id}
                    sobre={`Tienda · ${perfil.nombre}`}
                    tienda={perfil.bloqueada ? null : { id: perfil.id, nombre: perfil.nombre }}
                  />
                </div>
              )
            )}
          </div>
        </div>
      </section>

      {perfil.propia && <FranjaTuMes />}

      {perfil.bloqueada && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-error-fondo px-4 py-3">
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

      {/* En el celular, «Sobre la tienda» va antes de las pestañas (N04_Celulares). */}
      {!perfil.propia && <div className="lg:hidden">{sobre}</div>}

      <div
        id="pestanas-perfil"
        role="tablist"
        aria-label="Perfil"
        className="flex scroll-mt-20 gap-6 overflow-x-auto border-b-[1.5px] border-borde [scrollbar-width:none]"
      >
        {(
          [
            ['productos', `Productos · ${perfil.total_productos}`],
            ['opiniones', `Opiniones · ${totalOpiniones}`],
            ['detalles', 'Detalles'],
          ] as const
        ).map(([clave, texto]) => (
          <button
            key={clave}
            type="button"
            role="tab"
            aria-selected={pestana === clave}
            onClick={() => setPestana(clave)}
            className={`-mb-[1.5px] flex h-11 shrink-0 items-center border-b-[3px] px-1 text-cuerpo ${
              pestana === clave
                ? 'border-pase font-extrabold text-marca'
                : 'border-transparent text-secundario hover:text-tinta'
            }`}
          >
            {texto}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="max-lg:hidden">{sobre}</aside>

        <div role="tabpanel" className="flex min-w-0 flex-col gap-4 pb-6">
          {pestana === 'productos' &&
            (perfil.productos.length === 0 ? (
              <p className="py-6 text-secundario">
                {perfil.propia
                  ? 'Todavía no publicas nada con tu nombre a la vista.'
                  : 'Por ahora no tiene productos publicados.'}
              </p>
            ) : (
              <ul className="m-0 grid list-none grid-cols-2 items-start gap-3 p-0 md:grid-cols-3 md:gap-3.5">
                {perfil.productos.map((producto) => (
                  <li key={producto.oferta_id} className="min-w-0">
                    {/* La tarjeta de todo el sitio: borde de 2 px y precio con su burbujita (N04, N06). */}
                    <TarjetaProducto
                      href={`/p/${producto.producto.slug}?oferta=${producto.oferta_id}`}
                      titulo={producto.producto.titulo}
                      foto={producto.producto.foto}
                      categoria={producto.producto.categoria.slug}
                      precio={producto.precio}
                      socio={producto.precio_socio}
                      negociable={producto.negociable}
                      linea={[textoEstado(producto.condicion), perfil.galeria]
                        .filter(Boolean)
                        .join(' · ')}
                    />
                  </li>
                ))}
              </ul>
            ))}

          {pestana === 'opiniones' &&
            (opiniones ? (
              <ListaOpiniones
                datos={opiniones}
                tienda={perfil.nombre}
                alFiltrar={(filtro) => void cargarOpiniones(filtro)}
              />
            ) : (
              <p className="py-6 text-detalle">Cargando opiniones…</p>
            ))}

          {pestana === 'detalles' && (
            <>
              {perfil.propia && <div className="lg:hidden">{sobre}</div>}
              <section className="rounded-[14px] border-[1.5px] border-borde bg-white p-[18px]">
                <Reputacion
                  reputacion={reputacion}
                  propia={perfil.propia}
                  variante="completa"
                  verDetalle={verOpiniones}
                />
              </section>
              <section
                aria-label="Dónde está"
                className="flex flex-col gap-2.5 rounded-[14px] border-[1.5px] border-borde bg-white p-[18px]"
              >
                <h2 className="text-[16px] font-bold leading-6">Dónde está y cuándo atiende</h2>
                <Linea icono={<IconMapPin size={17} stroke={1.8} />}>{lugar}</Linea>
                {perfil.indicaciones && (
                  <Linea icono={<IconHome size={17} stroke={1.8} />}>
                    Cómo llegar: {perfil.indicaciones}
                  </Linea>
                )}
                <Linea icono={<IconClock size={17} stroke={1.8} />}>
                  {perfil.horario_tramos
                    ? textoHorario(perfil.horario_tramos, 'largo')
                    : (perfil.horario ?? 'Todavía no puso su horario.')}
                </Linea>
                <Linea icono={<IconCheck size={17} stroke={1.8} />}>
                  {perfil.seguidores === 1
                    ? perfil.propia
                      ? '1 tienda te sigue'
                      : '1 tienda la sigue'
                    : perfil.propia
                      ? `${perfil.seguidores} tiendas te siguen`
                      : `${perfil.seguidores} tiendas la siguen`}
                </Linea>
              </section>
            </>
          )}
        </div>
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
