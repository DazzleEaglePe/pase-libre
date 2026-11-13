'use client';

import {
  OPCIONES_VISIBILIDAD,
  type PerfilTienda,
  type RespuestaSeguidores,
  type RespuestaSolicitudSeguir,
  type RespuestaVisibilidad,
  type VisibilidadPerfil,
} from '@paselibre/contracts';
import { IconChevronDown, IconEye, IconEyeOff, IconLock, IconWorld } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { conPlural } from '@/shared/plural';
import { AvatarBorroso } from '@/shared/ui/avatar-borroso';
import { CabeceraMovil } from '@/shared/ui/cabecera-movil';

/** El ícono de cada opción del selector. */
function IconoVisibilidad({ valor, tamano = 16 }: { valor: VisibilidadPerfil; tamano?: number }) {
  const props = { size: tamano, stroke: 1.9, 'aria-hidden': true } as const;
  if (valor === 'PRIVADO') return <IconLock {...props} />;
  if (valor === 'OCULTO') return <IconEyeOff {...props} />;
  return <IconWorld {...props} />;
}

const TITULO: Record<VisibilidadPerfil, string> = {
  PUBLICO: 'Público',
  PRIVADO: 'Privado',
  OCULTO: 'Oculto',
};

/**
 * «Perfil: Público ▾» (doc 20, punto 5), al lado de «Editar perfil»: el menú «¿QUIÉN VE TU
 * PERFIL?» con Público, Privado y Oculto. Al pasar a Privado, las que ya te seguían se quedan.
 */
export function SelectorVisibilidad({
  inicial,
  alCambiar,
}: {
  inicial: VisibilidadPerfil;
  alCambiar: (mensaje: string) => void;
}) {
  const router = useRouter();
  const [valor, setValor] = useState(inicial);
  const [abierto, setAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const caja = useRef<HTMLDivElement>(null);

  useEffect(() => setValor(inicial), [inicial]);

  useEffect(() => {
    if (!abierto) return;
    const cerrar = (evento: MouseEvent) => {
      if (!caja.current?.contains(evento.target as Node)) setAbierto(false);
    };
    const conEscape = (evento: KeyboardEvent) => evento.key === 'Escape' && setAbierto(false);
    document.addEventListener('mousedown', cerrar);
    document.addEventListener('keydown', conEscape);
    return () => {
      document.removeEventListener('mousedown', cerrar);
      document.removeEventListener('keydown', conEscape);
    };
  }, [abierto]);

  async function elegir(nuevo: VisibilidadPerfil) {
    if (nuevo === valor) {
      setAbierto(false);
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      const respuesta = await llamarApi<RespuestaVisibilidad>('/cuenta/visibilidad', {
        metodo: 'PUT',
        cuerpo: { visibilidad: nuevo },
      });
      setValor(respuesta.visibilidad);
      setAbierto(false);
      alCambiar(
        respuesta.visibilidad === 'PRIVADO'
          ? 'Tu perfil ahora es privado. Las que ya te seguían se quedan.'
          : respuesta.visibilidad === 'OCULTO'
            ? 'Tu perfil ahora está oculto: nadie lo encuentra.'
            : 'Tu perfil ahora es público.',
      );
      router.refresh();
    } catch (falla) {
      setError(falla instanceof ErrorApi ? falla.message : 'No pudimos guardar el cambio.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div ref={caja} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={abierto}
        disabled={guardando}
        onClick={() => setAbierto(!abierto)}
        className="flex h-[46px] w-full items-center justify-center gap-2 whitespace-nowrap rounded-full border-[1.5px] border-pase bg-white px-4 text-[13px] font-bold text-pase-texto disabled:opacity-60 sm:text-apoyo"
      >
        <IconoVisibilidad valor={valor} />
        {guardando ? 'Guardando…' : `Perfil: ${TITULO[valor]}`}
        <IconChevronDown size={16} stroke={2} aria-hidden="true" />
      </button>
      {abierto && (
        <div
          role="menu"
          aria-label="¿Quién ve tu perfil?"
          className="absolute right-0 top-[calc(100%+8px)] z-30 flex w-[min(380px,calc(100vw-32px))] flex-col gap-1 rounded-[16px] border border-linea bg-white p-2 shadow-[0_18px_40px_rgba(15,20,18,0.16)]"
        >
          <span className="px-3 pb-1 pt-2 text-etiqueta font-extrabold uppercase tracking-wide text-detalle">
            ¿Quién ve tu perfil?
          </span>
          {OPCIONES_VISIBILIDAD.map((opcion) => {
            const elegida = opcion.valor === valor;
            return (
              <button
                key={opcion.valor}
                type="button"
                role="menuitemradio"
                aria-checked={elegida}
                disabled={guardando}
                onClick={() => void elegir(opcion.valor)}
                className={`flex items-start gap-3 rounded-[12px] px-3 py-2.5 text-left ${
                  elegida ? 'bg-pase-suave' : 'hover:bg-superficie'
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                    elegida ? 'border-pase' : 'border-borde-control'
                  }`}
                >
                  {elegida && <span className="h-2.5 w-2.5 rounded-full bg-pase" />}
                </span>
                <span className="flex flex-col gap-0.5">
                  <b className="flex items-center gap-1.5 text-apoyo font-bold text-tinta">
                    <IconoVisibilidad valor={opcion.valor} tamano={15} />
                    {opcion.titulo}
                  </b>
                  <span className="text-nota text-secundario">{opcion.detalle}</span>
                </span>
              </button>
            );
          })}
        </div>
      )}
      {error && (
        <p role="alert" className="absolute right-0 top-full mt-1 text-nota text-error">
          {error}
        </p>
      )}
    </div>
  );
}

/** «Cómo me ven»: abre tu perfil tal como lo ve otra tienda. */
export function BotonComoMeVen({ tiendaId }: { tiendaId: string }) {
  return (
    <Link
      href={`/tiendas/${tiendaId}?como=otra`}
      className="flex h-[46px] items-center justify-center gap-2 whitespace-nowrap rounded-full border-[1.5px] border-borde bg-white px-4 text-[13px] font-bold text-tinta no-underline hover:border-borde-control sm:text-apoyo"
    >
      <IconEye size={18} stroke={1.8} aria-hidden="true" />
      Cómo me ven
    </Link>
  );
}

/** Arriba de «Cómo me ven»: de quién es la vista y cómo volver. */
export function FranjaComoMeVen({ tiendaId }: { tiendaId: string }) {
  return (
    <div
      role="status"
      className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-tinta px-4 py-3 text-apoyo text-white"
    >
      <span className="flex items-center gap-2">
        <IconEye size={18} stroke={1.8} aria-hidden="true" />
        Así ven tu perfil las otras tiendas.
      </span>
      <Link
        href={`/tiendas/${tiendaId}`}
        className="h-9 rounded-full bg-white px-4 py-2 text-apoyo font-bold text-tinta no-underline"
      >
        Volver a mi perfil
      </Link>
    </div>
  );
}

/**
 * Un perfil privado que no sigues (doc 20, punto 5): el nombre, la galería y cuántas la siguen;
 * logo y portada borrosos (versiones chicas que manda la API), «Esta cuenta es privada» y
 * «Solicitar seguir», que después dice «Solicitud enviada» y se puede cancelar. Con «Cómo me ven»
 * de un perfil oculto: que nadie lo encuentra.
 */
export function PerfilRestringido({ perfil }: { perfil: PerfilTienda }) {
  const router = useRouter();
  const [enviada, setEnviada] = useState(perfil.solicitud_enviada);
  const [trabajando, setTrabajando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cambiar(metodo: 'POST' | 'DELETE') {
    setTrabajando(true);
    setError(null);
    try {
      const respuesta = await llamarApi<RespuestaSolicitudSeguir>(
        `/tiendas/${perfil.id}/solicitud`,
        { metodo, ...(metodo === 'POST' ? { cuerpo: {} } : {}) },
      );
      setEnviada(respuesta.solicitud_enviada);
      router.refresh();
    } catch (falla) {
      setError(falla instanceof ErrorApi ? falla.message : 'No pudimos enviar tu solicitud.');
    } finally {
      setTrabajando(false);
    }
  }

  const lugar = [perfil.galeria, conPlural(perfil.seguidores, 'seguidor', 'seguidores')]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="flex flex-col gap-4 sm:gap-[18px]">
      <CabeceraMovil titulo={perfil.nombre} />
      {perfil.como_me_ven && <FranjaComoMeVen tiendaId={perfil.id} />}
      <section
        aria-label={perfil.nombre}
        className="relative overflow-hidden rounded-[24px] border-[1.5px] border-borde bg-white"
      >
        <div
          aria-hidden="true"
          className="relative h-[160px] overflow-hidden bg-tinta sm:h-[220px]"
          style={{
            maskImage: 'linear-gradient(180deg, #000 35%, transparent 100%)',
            WebkitMaskImage: 'linear-gradient(180deg, #000 35%, transparent 100%)',
          }}
        >
          {perfil.portada_borrosa ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={perfil.portada_borrosa}
              alt=""
              className="h-full w-full scale-110 object-cover blur-[14px]"
            />
          ) : (
            <span className="block h-full w-full bg-gradient-to-br from-tinta to-marca" />
          )}
        </div>
        <div className="relative -mt-[70px] flex flex-col gap-2 px-[18px] pb-[18px] sm:-mt-[90px] sm:px-8 sm:pb-[26px]">
          <AvatarBorroso
            nombre={perfil.nombre}
            logo={perfil.logo_borroso}
            tamano={104}
            desenfoque={14}
            className="shadow-[0_0_0_5px_#FFFFFF,0_6px_18px_rgba(15,20,18,0.18)]"
          />
          <h1 className="font-sans text-[24px] font-bold normal-case leading-8 tracking-normal sm:text-[30px] sm:leading-9">
            {perfil.nombre}
          </h1>
          {!perfil.oculta && <span className="text-apoyo text-secundario">{lugar}</span>}
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-[560px] flex-col items-center gap-3 rounded-[18px] border-[1.5px] border-dashed border-borde bg-white px-6 py-8 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-superficie text-tinta">
          {perfil.oculta ? (
            <IconEyeOff size={22} stroke={1.8} aria-hidden="true" />
          ) : (
            <IconLock size={22} stroke={1.8} aria-hidden="true" />
          )}
        </span>
        {perfil.oculta ? (
          <>
            <h2 className="text-[18px] font-bold leading-6">Tu perfil está oculto</h2>
            <p className="m-0 text-apoyo text-secundario">
              Ninguna tienda lo encuentra, ni con tu nombre exacto. Tus publicaciones tampoco salen
              en el Inicio ni en el buscador.
            </p>
          </>
        ) : (
          <>
            <h2 className="text-[18px] font-bold leading-6">Esta cuenta es privada</h2>
            <p className="m-0 text-apoyo text-secundario">
              Pide seguirla para ver sus publicaciones, su stand y sus datos. La tienda decide si te
              acepta.
            </p>
            {perfil.como_me_ven ? (
              <span className="text-nota text-detalle">
                Las otras tiendas ven aquí «Solicitar seguir».
              </span>
            ) : enviada ? (
              <div className="flex flex-col items-center gap-1.5">
                <span className="flex h-11 items-center rounded-full bg-superficie px-5 text-cuerpo font-bold text-secundario">
                  Solicitud enviada
                </span>
                <button
                  type="button"
                  disabled={trabajando}
                  onClick={() => void cambiar('DELETE')}
                  className="text-apoyo font-bold text-error disabled:opacity-60"
                >
                  Cancelar solicitud
                </button>
              </div>
            ) : (
              perfil.puede_seguir && (
                <button
                  type="button"
                  disabled={trabajando}
                  onClick={() => void cambiar('POST')}
                  className="h-11 rounded-full bg-pase px-6 text-cuerpo font-bold text-white disabled:opacity-60"
                >
                  Solicitar seguir
                </button>
              )
            )}
            {error && (
              <p role="alert" className="m-0 text-apoyo text-error">
                {error}
              </p>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/**
 * «Tus seguidores (N)» (doc 20, punto 5), en Detalles de tu perfil: las tiendas que te siguen,
 * con «Quitar». Al pasar a Privado, las que ya te seguían se quedan.
 */
export function TusSeguidores({ esPrivado }: { esPrivado: boolean }) {
  const [datos, setDatos] = useState<RespuestaSeguidores | null>(null);
  const [quitando, setQuitando] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(
    () =>
      llamarApi<RespuestaSeguidores>('/cuenta/seguidores').then(setDatos, () =>
        setError('No pudimos cargar tus seguidores.'),
      ),
    [],
  );
  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function quitar(tiendaId: string) {
    setQuitando(tiendaId);
    setError(null);
    try {
      setDatos(
        await llamarApi<RespuestaSeguidores>(`/cuenta/seguidores/${tiendaId}`, {
          metodo: 'DELETE',
        }),
      );
    } catch (falla) {
      setError(falla instanceof ErrorApi ? falla.message : 'No pudimos quitarla.');
    } finally {
      setQuitando(null);
    }
  }

  return (
    <section
      aria-label="Tus seguidores"
      className="flex flex-col rounded-[14px] border-[1.5px] border-borde bg-white"
    >
      <header className="flex flex-wrap items-center justify-between gap-2 px-[18px] py-3.5">
        <h2 className="text-[16px] font-bold leading-6">
          Tus seguidores{datos ? ` (${datos.total})` : ''}
        </h2>
        {esPrivado && (
          <span className="text-nota text-detalle">Los que ya te seguían se quedan</span>
        )}
      </header>
      {error && (
        <p role="alert" className="px-[18px] pb-3 text-apoyo text-error">
          {error}
        </p>
      )}
      {datos === null ? (
        <p className="border-t border-linea px-[18px] py-3.5 text-apoyo text-detalle">Cargando…</p>
      ) : datos.seguidoras.length === 0 ? (
        <p className="border-t border-linea px-[18px] py-3.5 text-apoyo text-detalle">
          Todavía no te sigue ninguna tienda.
        </p>
      ) : (
        <ul className="m-0 list-none p-0">
          {datos.seguidoras.map((seguidora) => (
            <Fila key={seguidora.id} iniciales={seguidora.iniciales}>
              <span className="flex min-w-0 flex-1 flex-col">
                <Link
                  href={`/tiendas/${seguidora.id}`}
                  className="truncate text-apoyo font-bold text-tinta no-underline hover:underline"
                >
                  {seguidora.nombre}
                </Link>
                <span className="truncate text-nota text-detalle">
                  {seguidora.galeria ?? 'Independiente'}
                </span>
              </span>
              <button
                type="button"
                disabled={quitando === seguidora.id}
                onClick={() => void quitar(seguidora.id)}
                aria-label={`Quitar a ${seguidora.nombre} de tus seguidores`}
                className="h-9 shrink-0 rounded-full border-[1.5px] border-[#F2B8B1] bg-white px-3.5 text-nota font-bold text-[#B42318] disabled:opacity-60"
              >
                Quitar
              </button>
            </Fila>
          ))}
        </ul>
      )}
    </section>
  );
}

function Fila({ iniciales, children }: { iniciales: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3 border-t border-linea px-[18px] py-3">
      <span
        aria-hidden="true"
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-superficie text-nota font-extrabold text-tinta"
      >
        {iniciales}
      </span>
      {children}
    </li>
  );
}
