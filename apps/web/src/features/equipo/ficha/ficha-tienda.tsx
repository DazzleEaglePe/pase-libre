'use client';

import {
  MAX_ADVERTENCIAS,
  MINUTOS_SOPORTE,
  urlFoto,
  type CambioDelEquipo,
  type DatosTiendaEquipo,
  type FichaTienda,
  type GaleriaResumen,
  type PublicacionDeTienda,
  type ReportesDeTienda,
} from '@paselibre/contracts';
import { IconChevronLeft, IconUser } from '@tabler/icons-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { cuandoFue, hora } from '@/shared/fechas';
import { iniciales } from '@/shared/iniciales';
import { conPlural } from '@/shared/plural';
import { Ventana } from '@/shared/ui/ventana';

import { Historial, PestanaAcceso } from './acceso';
import {
  botonBorde,
  botonVerde,
  campoFicha,
  PESTANAS,
  ruta,
  tarjetaFicha,
  whatsappLegible,
  type Pestana,
} from './comun';
import { PestanaActividad, PestanaConversaciones } from './conversaciones';

const MOTIVOS_ADVERTENCIA = [
  'Un producto no era como se describió',
  'Pidió adelanto antes de ver el producto',
  'Mal trato con otra tienda',
  'Precio distinto al publicado',
];

/**
 * La ficha completa de una tienda en el panel del equipo (N14, mejoras 39 y 41, error 40). La
 * cabecera con su estado, «1 advertencia de 3», «Ayudar como la tienda» y «Suspender»; abajo las
 * pestañas. Todo se edita desde aquí y a la tienda le llega un aviso de cada cambio. Nunca se ve
 * su contraseña.
 */
export function FichaDeTienda({
  tiendaId,
  pestanaInicial,
  chatInicial,
}: {
  tiendaId: string;
  pestanaInicial: Pestana;
  chatInicial: string | null;
}) {
  const router = useRouter();
  const [ficha, setFicha] = useState<FichaTienda | null>(null);
  const [pestana, setPestana] = useState<Pestana>(pestanaInicial);
  const [error, setError] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<'soporte' | 'suspender' | null>(null);
  const pestanas = useRef<HTMLDivElement>(null);

  const cargar = useCallback(async () => {
    try {
      setFicha(await llamarApi<FichaTienda>(ruta(tiendaId, '/ficha')));
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos abrir la ficha.');
    }
  }, [tiendaId]);
  useEffect(() => {
    void cargar();
  }, [cargar]);
  // En el celular las pestañas se deslizan: la elegida queda a la vista.
  useEffect(() => {
    pestanas.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [pestana, ficha]);

  function elegir(nueva: Pestana) {
    setPestana(nueva);
    router.replace(`/equipo/tiendas/${tiendaId}?pestana=${nueva}`, { scroll: false });
  }

  if (!ficha) {
    return (
      <p role={error ? 'alert' : undefined} className="text-secundario">
        {error ?? 'Cargando…'}
      </p>
    );
  }

  const titulos: Record<Pestana, string> = {
    datos: 'Datos',
    imagen: 'Imagen',
    publicaciones: `Publicaciones · ${ficha.publicaciones}`,
    conversaciones: 'Conversaciones',
    actividad: 'Actividad',
    reportes: `Reportes y advertencias · ${ficha.reportes + ficha.advertencias}`,
    acceso: 'Acceso',
    historial: 'Historial de cambios',
  };

  return (
    <div className="flex flex-col gap-4">
      <Link
        href="/equipo/tiendas"
        className="flex items-center gap-1 self-start text-apoyo font-semibold text-secundario no-underline"
      >
        <IconChevronLeft size={18} stroke={1.8} aria-hidden="true" />
        Tiendas
      </Link>

      <section
        aria-label={`Ficha de ${ficha.nombre}`}
        className="flex flex-wrap items-center gap-4 rounded-[22px] border-[1.5px] border-linea bg-white p-4 sm:p-5"
      >
        {ficha.logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- fotos de /media, ya en WebP
          <img
            src={urlFoto(ficha.logo)}
            alt=""
            className="h-16 w-16 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-marca text-[20px] font-extrabold text-white"
          >
            {iniciales(ficha.nombre)}
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="flex flex-wrap items-center gap-2">
            <h1 className="text-[24px] font-bold leading-7">{ficha.nombre}</h1>
            <span
              className={`rounded-full px-2.5 text-nota font-bold leading-6 ${
                ficha.suspendida ? 'bg-error-fondo text-error' : 'bg-pase-suave text-pase-texto'
              }`}
            >
              {ficha.suspendida ? 'Suspendida' : 'Activa'}
            </span>
            {ficha.advertencias > 0 && (
              <span className="rounded-full bg-aviso-fondo px-2.5 text-nota font-bold leading-6 text-aviso">
                {ficha.advertencias} {ficha.advertencias === 1 ? 'advertencia' : 'advertencias'} de{' '}
                {MAX_ADVERTENCIAS}
              </span>
            )}
            {ficha.soporte.pedido_en && !ficha.soporte.activo && (
              <span className="rounded-full bg-pase-suave px-2.5 text-nota font-bold leading-6 text-pase-texto">
                Pidió ayuda al Equipo
              </span>
            )}
          </span>
          <span className="text-apoyo text-secundario">
            {[ficha.galeria ?? 'Independiente', ficha.stand && `Stand ${ficha.stand}`]
              .filter(Boolean)
              .join(' · ')}
            {ficha.usuario && (
              <>
                {' · usuario '}
                <span className="font-mono text-tinta">{ficha.usuario}</span>
              </>
            )}
            {` · WhatsApp ${whatsappLegible(ficha.whatsapp)} · ${conPlural(ficha.asesores, 'asesor', 'asesores')}`}
          </span>
          {ficha.soporte.activo && (
            <span className="text-nota font-bold text-aviso">
              {ficha.soporte.activo.equipo} está ayudando como la tienda hasta las{' '}
              {hora(ficha.soporte.activo.vence_en)}.
            </span>
          )}
        </span>
        <span className="flex w-full flex-wrap gap-2.5 sm:w-auto">
          <button
            type="button"
            disabled={ficha.suspendida}
            onClick={() => setConfirmar('soporte')}
            className={`${botonVerde} max-sm:flex-1`}
          >
            <IconUser size={18} stroke={1.8} aria-hidden="true" />
            Ayudar como la tienda
          </button>
          <button
            type="button"
            onClick={() => setConfirmar('suspender')}
            className={`inline-flex h-11 items-center justify-center rounded-full border-[1.5px] px-5 text-apoyo font-bold ${
              ficha.suspendida ? 'border-pase text-pase-texto' : 'border-error text-error'
            }`}
          >
            {ficha.suspendida ? 'Reactivar' : 'Suspender'}
          </button>
        </span>
      </section>

      <div
        ref={pestanas}
        role="tablist"
        aria-label="Pestañas de la ficha"
        className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none]"
      >
        {PESTANAS.map((clave) => (
          <button
            key={clave}
            type="button"
            role="tab"
            aria-selected={pestana === clave}
            onClick={() => elegir(clave)}
            className={`h-10 shrink-0 rounded-full px-4 text-apoyo font-bold ${
              pestana === clave ? 'bg-tinta text-white' : 'bg-white'
            }`}
          >
            {titulos[clave]}
          </button>
        ))}
      </div>

      <div role="tabpanel" aria-label={titulos[pestana]}>
        {pestana === 'datos' && <PestanaDatos ficha={ficha} alCambiar={setFicha} />}
        {pestana === 'imagen' && <PestanaImagen ficha={ficha} alCambiar={setFicha} />}
        {pestana === 'publicaciones' && <PestanaPublicaciones tiendaId={ficha.id} />}
        {pestana === 'conversaciones' && (
          <PestanaConversaciones tiendaId={ficha.id} chatInicial={chatInicial} />
        )}
        {pestana === 'actividad' && <PestanaActividad tiendaId={ficha.id} />}
        {pestana === 'reportes' && <PestanaReportes ficha={ficha} alCambiar={cargar} />}
        {pestana === 'acceso' && <PestanaAcceso ficha={ficha} alCambiar={setFicha} />}
        {pestana === 'historial' && <PestanaHistorial tiendaId={ficha.id} />}
      </div>

      <Ventana
        titulo={
          confirmar === 'soporte'
            ? `¿Ayudar como ${ficha.nombre}?`
            : ficha.suspendida
              ? `¿Reactivar a ${ficha.nombre}?`
              : `¿Suspender a ${ficha.nombre}?`
        }
        abierta={confirmar !== null}
        alCerrar={() => setConfirmar(null)}
      >
        {confirmar === 'soporte' && (
          <EntrarComoLaTienda ficha={ficha} alCancelar={() => setConfirmar(null)} />
        )}
        {confirmar === 'suspender' && (
          <Suspender
            ficha={ficha}
            alCancelar={() => setConfirmar(null)}
            alTerminar={async () => {
              setConfirmar(null);
              await cargar();
            }}
          />
        )}
      </Ventana>
    </div>
  );
}

function EntrarComoLaTienda({ ficha, alCancelar }: { ficha: FichaTienda; alCancelar: () => void }) {
  const [entrando, setEntrando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function entrar() {
    setEntrando(true);
    setError(null);
    try {
      await llamarApi(ruta(ficha.id, '/soporte'), { metodo: 'POST' });
      // Toda la web cambia de cuenta: se carga de nuevo.
      window.location.assign('/');
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos entrar.');
      setEntrando(false);
    }
  }
  return (
    <div className="flex flex-col gap-3.5">
      <p className="m-0 text-secundario">
        Vas a ver PaseLibre como el dueño durante {MINUTOS_SOPORTE} minutos para acomodar su portada
        o sus datos. No puedes chatear ni cerrar ventas. Todo queda registrado y la tienda recibe
        aviso de cada cambio.
      </p>
      <p
        className={`m-0 rounded-xl px-3.5 py-3 text-apoyo font-semibold ${
          ficha.soporte.pedido_en ? 'bg-pase-suave text-pase-texto' : 'bg-aviso-fondo text-aviso'
        }`}
      >
        {ficha.soporte.pedido_en
          ? `La tienda lo autorizó (${cuandoFue(ficha.soporte.pedido_en)}).`
          : 'La tienda no lo pidió: úsalo si te llamó por teléfono. Le llega el aviso igual.'}
      </p>
      {error && (
        <p role="alert" className="m-0 text-apoyo text-error">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2.5">
        <button type="button" onClick={alCancelar} className={botonBorde}>
          Cancelar
        </button>
        <button
          type="button"
          disabled={entrando}
          onClick={() => void entrar()}
          className={botonVerde}
        >
          {entrando ? 'Entrando…' : 'Entrar como la tienda'}
        </button>
      </div>
    </div>
  );
}

function Suspender({
  ficha,
  alCancelar,
  alTerminar,
}: {
  ficha: FichaTienda;
  alCancelar: () => void;
  alTerminar: () => Promise<void>;
}) {
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);
  async function confirmar() {
    try {
      await llamarApi(`/equipo/panel/tiendas/${ficha.id}/suspension`, {
        metodo: 'POST',
        cuerpo: { suspender: !ficha.suspendida, ...(motivo.trim() ? { motivo } : {}) },
      });
      await alTerminar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos guardarlo.');
    }
  }
  return (
    <div className="flex flex-col gap-3.5">
      <p className="m-0 text-secundario">
        {ficha.suspendida
          ? 'Vuelve a entrar y sus publicaciones se ven otra vez.'
          : 'No puede entrar y sus publicaciones dejan de verse. Solo con estafa comprobada, suplantación o 3 advertencias.'}
      </p>
      <input
        value={motivo}
        maxLength={200}
        aria-label="Motivo"
        placeholder="Motivo (queda anotado)"
        onChange={(evento) => setMotivo(evento.target.value)}
        className={campoFicha}
      />
      {error && (
        <p role="alert" className="m-0 text-apoyo text-error">
          {error}
        </p>
      )}
      <div className="flex justify-end gap-2.5">
        <button type="button" onClick={alCancelar} className={botonBorde}>
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => void confirmar()}
          className={
            ficha.suspendida
              ? botonVerde
              : 'inline-flex h-11 items-center rounded-full bg-error px-5 text-apoyo font-bold text-white'
          }
        >
          {ficha.suspendida ? 'Reactivar' : 'Confirmar suspensión'}
        </button>
      </div>
    </div>
  );
}

const CAMPOS: Array<{ clave: keyof FichaTienda['datos']; etiqueta: string; largo: number }> = [
  { clave: 'nombre', etiqueta: 'Nombre de la tienda', largo: 120 },
  { clave: 'whatsapp', etiqueta: 'WhatsApp de la tienda', largo: 15 },
  { clave: 'piso', etiqueta: 'Piso', largo: 20 },
  { clave: 'stand', etiqueta: 'Stand', largo: 20 },
  { clave: 'horario', etiqueta: 'Horario', largo: 120 },
  { clave: 'indicaciones', etiqueta: 'Cómo llegar', largo: 240 },
  { clave: 'descripcion', etiqueta: 'Sobre la tienda', largo: 500 },
];

function PestanaDatos({
  ficha,
  alCambiar,
}: {
  ficha: FichaTienda;
  alCambiar: (ficha: FichaTienda) => void;
}) {
  const id = useId();
  const [datos, setDatos] = useState(ficha.datos);
  const [galerias, setGalerias] = useState<GaleriaResumen[]>([]);
  const [estado, setEstado] = useState<{ ok: boolean; texto: string } | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    void llamarApi<GaleriaResumen[]>('/galerias').then(
      (lista) => setGalerias(lista.filter((g) => g.slug !== 'independientes')),
      () => undefined,
    );
  }, []);

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const cambios = Object.fromEntries(
      (Object.keys(datos) as Array<keyof FichaTienda['datos']>)
        .filter((clave) => (datos[clave] ?? '') !== (ficha.datos[clave] ?? ''))
        .map((clave) => [clave, datos[clave] ?? '']),
    ) as Partial<DatosTiendaEquipo>;
    if (cambios.galeria === '') cambios.galeria = null;
    if (Object.keys(cambios).length === 0) {
      setEstado({ ok: true, texto: 'No hay cambios.' });
      return;
    }
    setGuardando(true);
    setEstado(null);
    try {
      const nueva = await llamarApi<FichaTienda>(ruta(ficha.id, '/datos'), {
        metodo: 'PATCH',
        cuerpo: cambios,
      });
      alCambiar(nueva);
      setDatos(nueva.datos);
      setEstado({ ok: true, texto: 'Guardado. A la tienda le llegó un aviso.' });
    } catch (e) {
      setEstado({ ok: false, texto: e instanceof ErrorApi ? e.message : 'No pudimos guardar.' });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={(evento) => void guardar(evento)} className={`${tarjetaFicha} max-w-[760px]`}>
      <h2 className="text-[18px] font-bold">Datos de la tienda</h2>
      <div className="grid gap-3.5 sm:grid-cols-2">
        {CAMPOS.map(({ clave, etiqueta, largo }) => (
          <label
            key={clave}
            htmlFor={`${id}-${clave}`}
            className={`flex flex-col gap-1.5 text-apoyo font-bold ${
              largo > 120 ? 'sm:col-span-2' : ''
            }`}
          >
            {etiqueta}
            {largo > 200 ? (
              <textarea
                id={`${id}-${clave}`}
                rows={3}
                maxLength={largo}
                value={datos[clave] ?? ''}
                onChange={(evento) => setDatos({ ...datos, [clave]: evento.target.value })}
                className="rounded-xl border-[1.5px] border-linea bg-white px-3.5 py-3 text-cuerpo font-normal"
              />
            ) : (
              <input
                id={`${id}-${clave}`}
                maxLength={largo}
                value={datos[clave] ?? ''}
                onChange={(evento) => setDatos({ ...datos, [clave]: evento.target.value })}
                className={`${campoFicha} font-normal`}
              />
            )}
          </label>
        ))}
        <label htmlFor={`${id}-galeria`} className="flex flex-col gap-1.5 text-apoyo font-bold">
          Galería
          <select
            id={`${id}-galeria`}
            value={datos.galeria ?? ''}
            onChange={(evento) => setDatos({ ...datos, galeria: evento.target.value || null })}
            className={`${campoFicha} font-normal`}
          >
            <option value="">Independiente (sin galería)</option>
            {galerias.map((galeria) => (
              <option key={galeria.slug} value={galeria.slug}>
                {galeria.nombre}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="m-0 text-nota text-secundario">
        La tienda recibe un aviso de cada cambio. El usuario y la contraseña se cambian en Acceso.
      </p>
      {estado && (
        <p
          role={estado.ok ? 'status' : 'alert'}
          className={`m-0 rounded-xl px-3.5 py-3 text-apoyo ${
            estado.ok ? 'bg-pase-suave text-pase-texto' : 'bg-error-fondo text-error'
          }`}
        >
          {estado.texto}
        </p>
      )}
      <button type="submit" disabled={guardando} className={`${botonVerde} self-start`}>
        {guardando ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  );
}

function PestanaImagen({
  ficha,
  alCambiar,
}: {
  ficha: FichaTienda;
  alCambiar: (ficha: FichaTienda) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  async function quitar(cual: 'logo' | 'portada') {
    try {
      alCambiar(
        await llamarApi<FichaTienda>(ruta(ficha.id, `/imagen/${cual}`), { metodo: 'DELETE' }),
      );
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos quitarla.');
    }
  }
  return (
    <div className="grid items-start gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
      <section aria-label="Logo" className={tarjetaFicha}>
        <h2 className="text-[18px] font-bold">Logo</h2>
        {ficha.logo ? (
          // eslint-disable-next-line @next/next/no-img-element -- fotos de /media, ya en WebP
          <img src={urlFoto(ficha.logo)} alt="" className="h-32 w-32 rounded-full object-cover" />
        ) : (
          <p className="m-0 text-apoyo text-secundario">Sin logo: se ven sus iniciales.</p>
        )}
        {ficha.logo && (
          <button type="button" onClick={() => void quitar('logo')} className={botonBorde}>
            Quitar logo
          </button>
        )}
      </section>
      <section aria-label="Portada" className={tarjetaFicha}>
        <h2 className="text-[18px] font-bold">Portada</h2>
        {ficha.portada ? (
          // eslint-disable-next-line @next/next/no-img-element -- fotos de /media, ya en WebP
          <img
            src={urlFoto(ficha.portada.ruta)}
            alt=""
            className="h-44 w-full rounded-2xl object-cover"
            style={{ objectPosition: `50% ${ficha.portada.posicion}%` }}
          />
        ) : (
          <p className="m-0 text-apoyo text-secundario">Usa la portada automática.</p>
        )}
        {ficha.portada && (
          <button
            type="button"
            onClick={() => void quitar('portada')}
            className={`${botonBorde} self-start`}
          >
            Quitar portada
          </button>
        )}
        <p className="m-0 text-nota text-secundario">
          Para subirle una foto nueva o acomodarla, usa «Ayudar como la tienda»: la subes como lo
          haría el dueño y le llega el aviso.
        </p>
      </section>
      {error && (
        <p role="alert" className="m-0 text-apoyo text-error">
          {error}
        </p>
      )}
    </div>
  );
}

function PestanaPublicaciones({ tiendaId }: { tiendaId: string }) {
  const [lista, setLista] = useState<PublicacionDeTienda[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    llamarApi<PublicacionDeTienda[]>(ruta(tiendaId, '/publicaciones')).then(setLista, () =>
      setError('No pudimos cargar sus publicaciones.'),
    );
  }, [tiendaId]);
  async function cambiar(publicacion: PublicacionDeTienda) {
    try {
      setLista(
        await llamarApi<PublicacionDeTienda[]>(
          ruta(tiendaId, `/publicaciones/${publicacion.id}/estado`),
          {
            metodo: 'POST',
            cuerpo: { estado: publicacion.estado === 'ACTIVA' ? 'PAUSADA' : 'ACTIVA' },
          },
        ),
      );
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos cambiarla.');
    }
  }
  return (
    <section aria-label="Publicaciones" className={tarjetaFicha}>
      {error && (
        <p role="alert" className="m-0 text-apoyo text-error">
          {error}
        </p>
      )}
      {!lista && !error && <p className="m-0 text-secundario">Cargando…</p>}
      {lista?.length === 0 && (
        <p className="m-0 text-apoyo text-secundario">No tiene publicaciones.</p>
      )}
      <ul className="m-0 flex list-none flex-col p-0">
        {lista?.map((publicacion) => (
          <li
            key={publicacion.id}
            className="flex flex-wrap items-center gap-3 border-b-[1.5px] border-linea py-3 last:border-0"
          >
            <span className="flex min-w-0 flex-1 flex-col">
              <b className="truncate font-bold">{publicacion.titulo}</b>
              <span className="text-nota text-secundario">
                {publicacion.precio ?? 'Sin precio'} · stock {publicacion.stock} ·{' '}
                {cuandoFue(publicacion.actualizada_en)}
              </span>
            </span>
            <span
              className={`rounded-full px-2.5 text-nota font-bold leading-6 ${
                publicacion.estado === 'ACTIVA'
                  ? 'bg-pase-suave text-pase-texto'
                  : 'bg-superficie text-secundario'
              }`}
            >
              {publicacion.estado === 'ACTIVA' ? 'Activa' : 'Pausada'}
            </span>
            <button type="button" onClick={() => void cambiar(publicacion)} className={botonBorde}>
              {publicacion.estado === 'ACTIVA' ? 'Pausar' : 'Reactivar'}
            </button>
          </li>
        ))}
      </ul>
      <p className="m-0 text-nota text-secundario">
        Al pausar o reactivar una publicación, a la tienda le llega un aviso.
      </p>
    </section>
  );
}

const ESTADO_REPORTE = {
  ABIERTA: 'Pendiente de revisar',
  EN_REVISION: 'En revisión',
  REVISADA: 'Resuelto',
  DESCARTADA: 'Cerrado sin cambios',
};

function PestanaReportes({ ficha, alCambiar }: { ficha: FichaTienda; alCambiar: () => void }) {
  const [datos, setDatos] = useState<ReportesDeTienda | null>(null);
  const [motivo, setMotivo] = useState('');
  const [estado, setEstado] = useState<{ ok: boolean; texto: string } | null>(null);
  const cargar = useCallback(() => {
    llamarApi<ReportesDeTienda>(ruta(ficha.id, '/reportes')).then(setDatos, () =>
      setDatos({ advertencias: [], reportes: [] }),
    );
  }, [ficha.id]);
  useEffect(cargar, [cargar]);

  async function advertir() {
    try {
      await llamarApi(`/equipo/panel/tiendas/${ficha.id}/advertencia`, {
        metodo: 'POST',
        cuerpo: { motivo },
      });
      setMotivo('');
      setEstado({ ok: true, texto: 'Advertencia enviada. Le llegó al chat oficial y al aviso.' });
      cargar();
      alCambiar();
    } catch (e) {
      setEstado({ ok: false, texto: e instanceof ErrorApi ? e.message : 'No pudimos enviarla.' });
    }
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-2">
      <section aria-label="Advertencias" className={tarjetaFicha}>
        <h2 className="text-[18px] font-bold">
          Advertencias · {datos?.advertencias.length ?? ficha.advertencias} de {MAX_ADVERTENCIAS}
        </h2>
        <p className="m-0 text-nota text-secundario">
          «1 de 3» cuenta advertencias que dio el Equipo después de revisar, no reportes recibidos.
        </p>
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {datos?.advertencias.map((fila) => (
            <li key={fila.id} className="flex justify-between gap-3 text-apoyo">
              <span>
                {fila.motivo}
                {fila.caso && !fila.motivo.includes(fila.caso) ? ` (caso ${fila.caso})` : ''} ·{' '}
                {fila.por}
              </span>
              <span className="shrink-0 text-nota text-secundario">{cuandoFue(fila.fecha)}</span>
            </li>
          ))}
        </ul>
        {!ficha.suspendida && (
          <div className="flex flex-col gap-2.5 rounded-2xl bg-superficie p-3.5">
            <b className="text-apoyo font-bold">Dar advertencia</b>
            <div className="flex flex-wrap gap-2">
              {MOTIVOS_ADVERTENCIA.map((opcion) => (
                <button
                  key={opcion}
                  type="button"
                  aria-pressed={motivo === opcion}
                  onClick={() => setMotivo(opcion)}
                  className={`h-9 rounded-full border-[1.5px] px-3.5 text-nota font-semibold ${
                    motivo === opcion ? 'border-tinta bg-tinta text-white' : 'border-linea bg-white'
                  }`}
                >
                  {opcion}
                </button>
              ))}
            </div>
            <input
              value={motivo}
              maxLength={200}
              aria-label="Motivo de la advertencia"
              placeholder="O escribe el motivo"
              onChange={(evento) => setMotivo(evento.target.value)}
              className={campoFicha}
            />
            <button
              type="button"
              disabled={motivo.trim().length < 3}
              onClick={() => void advertir()}
              className={`${botonVerde} self-start`}
            >
              Dar advertencia
            </button>
          </div>
        )}
        {estado && (
          <p
            role={estado.ok ? 'status' : 'alert'}
            className={`m-0 text-apoyo ${estado.ok ? 'text-pase-texto' : 'text-error'}`}
          >
            {estado.texto}
          </p>
        )}
      </section>
      <section aria-label="Reportes recibidos" className={tarjetaFicha}>
        <h2 className="text-[18px] font-bold">
          Reportes recibidos · {datos?.reportes.length ?? 0}
        </h2>
        {datos?.reportes.length === 0 && (
          <p className="m-0 text-apoyo text-secundario">Nadie reportó a esta tienda.</p>
        )}
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {datos?.reportes.map((fila) => (
            <li key={fila.id} className="flex flex-col text-apoyo">
              <span className="flex justify-between gap-3">
                <b className="font-bold">
                  Caso {fila.codigo} · {fila.motivo}
                </b>
                <span className="shrink-0 text-nota text-secundario">{cuandoFue(fila.fecha)}</span>
              </span>
              <span className="text-nota text-secundario">
                {fila.de ? `Reporte de ${fila.de} · ` : ''}
                {ESTADO_REPORTE[fila.estado]}
              </span>
            </li>
          ))}
        </ul>
        <Link href="/equipo/reportes" className="text-apoyo font-bold text-pase-texto">
          Ir a Reportes ›
        </Link>
      </section>
    </div>
  );
}

function PestanaHistorial({ tiendaId }: { tiendaId: string }) {
  const [cambios, setCambios] = useState<CambioDelEquipo[] | null>(null);
  useEffect(() => {
    llamarApi<CambioDelEquipo[]>(ruta(tiendaId, '/historial')).then(setCambios, () =>
      setCambios([]),
    );
  }, [tiendaId]);
  return (
    <section
      aria-label="Historial de cambios del Equipo"
      className={`${tarjetaFicha} max-w-[760px]`}
    >
      <h2 className="text-[18px] font-bold">Historial de cambios del Equipo</h2>
      <p className="m-0 text-nota text-secundario">
        Todo lo que el Equipo cambió o miró en esta tienda: quién y cuándo.
      </p>
      <Historial cambios={cambios} />
    </section>
  );
}
