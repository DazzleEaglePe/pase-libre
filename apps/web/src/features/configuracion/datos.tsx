'use client';

import {
  DIAS_DE_ATENCION,
  MAX_TRAMOS_HORARIO,
  textoHorario,
  urlFoto,
  type DiaDeAtencion,
  type AjusteLogo,
  type GaleriaParaElegir,
  type RespuestaCuenta,
  type RespuestaLogo,
  type TramoHorario,
} from '@paselibre/contracts';
import { IconBuildingStore, IconClock, IconStar } from '@tabler/icons-react';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';

import { ErrorApi, llamarApi, subirFoto } from '@/shared/api/cliente';
import { botonPrincipal, campo, etiqueta } from '@/shared/ui/estilos';

import { AjustarLogo, leerImagen, medirImagen, type ImagenLogo } from './ajustar-logo';

const LETRA: Record<DiaDeAtencion, [string, string]> = {
  lun: ['L', 'Lunes'],
  mar: ['M', 'Martes'],
  mie: ['M', 'Miércoles'],
  jue: ['J', 'Jueves'],
  vie: ['V', 'Viernes'],
  sab: ['S', 'Sábado'],
  dom: ['D', 'Domingo'],
};

const PISOS = ['Sótano', '1', '2', '3', '4', '5'];

/** De 06:00 a 23:30, cada media hora. */
const HORAS = Array.from({ length: 36 }, (_, i) => {
  const minutos = 6 * 60 + i * 30;
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${minutos % 60 ? '30' : '00'}`;
});

const NUEVO_TRAMO: TramoHorario = { dias: [], desde: '10:00', hasta: '19:00' };

const tarjeta = 'flex flex-col gap-4 rounded-2xl border-[1.5px] border-linea bg-white p-5';
const titulo = 'flex items-center gap-2 text-[17px] font-bold';
const selector = `${campo} appearance-none bg-[length:12px] bg-[right_14px_center] bg-no-repeat pr-9`;
const flechita = {
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M2 4l4 4 4-4' fill='none' stroke='%230F1412' stroke-width='1.8' stroke-linecap='round'/%3E%3C/svg%3E\")",
};

/** Una hora ▾ con su reloj (N09). */
function Hora({
  valor,
  alCambiar,
  etiqueta: nombre,
}: {
  valor: string;
  alCambiar: (hora: string) => void;
  etiqueta: string;
}) {
  const opciones = HORAS.includes(valor) ? HORAS : [...HORAS, valor].sort();
  return (
    <span className="relative inline-flex">
      <IconClock
        size={16}
        stroke={1.8}
        aria-hidden="true"
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-secundario"
      />
      <select
        aria-label={nombre}
        value={valor}
        onChange={(evento) => alCambiar(evento.target.value)}
        className={`${selector} h-11 w-[124px] pl-9 font-bold`}
        style={flechita}
      >
        {opciones.map((hora) => (
          <option key={hora} value={hora}>
            {hora}
          </option>
        ))}
      </select>
    </span>
  );
}

/**
 * Configuración · Datos de la tienda (N09_ConfigWebTodo, A): «Lo esencial» (logo, nombre,
 * WhatsApp, galería, piso y stand) y «Para que te encuentren mejor» (horario por días, cómo
 * llegar y sobre la tienda), con cuánto le falta al perfil. Galería, piso y stand no cambian al
 * toque: quedan «Pendiente de aprobación» hasta que el Equipo los confirma. Lo de aquí es lo que
 * sale en el perfil.
 */
export function SeccionDatos({
  cuenta,
  alGuardar,
}: {
  cuenta: RespuestaCuenta;
  alGuardar: (cuenta: RespuestaCuenta, mensaje: string) => void;
}) {
  const id = useId();
  const tienda = cuenta.tienda;
  const pendiente = tienda?.lugar_pendiente ?? null;
  const [logo, setLogo] = useState(tienda?.logo ?? null);
  /** «Ajustar logo» (docs/19 §20): la original guardada y cómo se acomodó. */
  const [logoOriginal, setLogoOriginal] = useState(tienda?.logo_original ?? null);
  const [logoAjuste, setLogoAjuste] = useState<AjusteLogo | null>(tienda?.logo_ajuste ?? null);
  /** La ventana «Ajustar logo» abierta: con una imagen recién elegida (`archivo`) o la original. */
  const [ajustando, setAjustando] = useState<{
    imagen: ImagenLogo;
    archivo: File | null;
    ajuste: AjusteLogo | null;
  } | null>(null);
  const [errorLogo, setErrorLogo] = useState<string | null>(null);
  const [nombreTienda, setNombreTienda] = useState(tienda?.nombre ?? '');
  const [whatsappTienda, setWhatsappTienda] = useState(tienda?.whatsapp ?? '');
  // Si hay un cambio esperando al Equipo, se ve lo que se pidió.
  const [galeriaId, setGaleriaId] = useState(pendiente?.galeria_id ?? tienda?.galeria_id ?? '');
  const [piso, setPiso] = useState((pendiente ? pendiente.piso : tienda?.piso) ?? '');
  const [stand, setStand] = useState((pendiente ? pendiente.stand : tienda?.stand) ?? '');
  const [tramos, setTramos] = useState<TramoHorario[]>(
    tienda?.horario_tramos?.length ? tienda.horario_tramos : [NUEVO_TRAMO],
  );
  const [horarioTocado, setHorarioTocado] = useState(false);
  const [indicaciones, setIndicaciones] = useState(tienda?.indicaciones ?? '');
  const [descripcion, setDescripcion] = useState(tienda?.descripcion ?? '');
  const [galerias, setGalerias] = useState<GaleriaParaElegir[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entradaLogo = useRef<HTMLInputElement>(null);
  const conGaleria = tienda?.tipo === 'TIENDA';

  useEffect(() => {
    if (!conGaleria) return;
    llamarApi<GaleriaParaElegir[]>('/cuenta/galerias').then(setGalerias, () => undefined);
  }, [conGaleria]);

  if (!tienda) return null;

  const pedido = {
    galeria_id: pendiente?.galeria_id ?? tienda.galeria_id ?? '',
    piso: (pendiente ? pendiente.piso : tienda.piso) ?? '',
    stand: (pendiente ? pendiente.stand : tienda.stand) ?? '',
  };
  const lugarCambio =
    conGaleria &&
    (galeriaId !== pedido.galeria_id || piso !== pedido.piso || stand.trim() !== pedido.stand);
  const tramosConDias = tramos.filter((tramo) => tramo.dias.length > 0);
  const usados = new Set(tramos.flatMap((tramo) => tramo.dias));
  const vistaPrevia = tramosConDias.length > 0 ? textoHorario(tramosConDias, 'largo') : null;

  // «Perfil al N %»: logo, portada, horario, cómo llegar y sobre la tienda, 20 % cada uno.
  const completos = [
    Boolean(logo),
    Boolean(tienda.portada),
    tramosConDias.length > 0 || (!horarioTocado && Boolean(tienda.horario)),
    indicaciones.trim().length > 0,
    descripcion.trim().length > 0,
  ].filter(Boolean).length;
  const porcentaje = completos * 20;

  function cambiarTramo(indice: number, cambio: Partial<TramoHorario>) {
    setHorarioTocado(true);
    setTramos((actuales) =>
      actuales.map((tramo, i) => (i === indice ? { ...tramo, ...cambio } : tramo)),
    );
  }

  function alternarDia(indice: number, dia: DiaDeAtencion) {
    const tramo = tramos[indice];
    if (!tramo) return;
    cambiarTramo(indice, {
      dias: tramo.dias.includes(dia) ? tramo.dias.filter((d) => d !== dia) : [...tramo.dias, dia],
    });
  }

  /** Al elegir la imagen se abre «Ajustar logo» (docs/19 §20); se sube recién al guardar. */
  async function cambiarLogo(archivo: File | undefined) {
    if (!archivo) return;
    setError(null);
    setErrorLogo(null);
    try {
      cerrarAjuste();
      setAjustando({ imagen: await leerImagen(archivo), archivo, ajuste: null });
    } catch {
      setError('No pudimos abrir esa imagen. Sube una JPG, PNG o WebP.');
    }
  }

  /** «Ajustar»: reacomodar el logo sin volver a subirlo, desde la original. */
  async function ajustarLogo() {
    const original = logoOriginal ?? logo;
    if (!original) return;
    setError(null);
    setErrorLogo(null);
    try {
      setAjustando({
        imagen: await medirImagen(urlFoto(original)),
        archivo: null,
        ajuste: logoAjuste,
      });
    } catch {
      setError('No pudimos abrir tu logo. Súbelo de nuevo.');
    }
  }

  function cerrarAjuste() {
    if (ajustando?.imagen.src.startsWith('blob:')) URL.revokeObjectURL(ajustando.imagen.src);
    setAjustando(null);
  }

  /** «Guardar»: sube la imagen nueva (si la hay) y la API arma el logo de 512 × 512. */
  async function guardarLogo(ajuste: AjusteLogo) {
    if (!ajustando || !tienda) return;
    setSubiendo(true);
    setErrorLogo(null);
    try {
      const ruta = ajustando.archivo ? (await subirFoto(ajustando.archivo)).ruta : undefined;
      const nuevo = await llamarApi<RespuestaLogo>('/cuenta/logo', {
        metodo: 'PUT',
        cuerpo: { ...(ruta ? { ruta } : {}), ajuste },
      });
      setLogo(nuevo.logo);
      setLogoOriginal(nuevo.original);
      setLogoAjuste(nuevo.ajuste);
      cerrarAjuste();
      alGuardar(
        {
          ...cuenta,
          tienda: {
            ...tienda,
            logo: nuevo.logo,
            logo_original: nuevo.original,
            logo_ajuste: nuevo.ajuste,
          },
        },
        'Listo: tu logo quedó ajustado.',
      );
    } catch (e) {
      setErrorLogo(e instanceof ErrorApi ? e.message : 'No pudimos guardar el logo.');
    } finally {
      setSubiendo(false);
    }
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (tramosConDias.some((tramo) => tramo.desde >= tramo.hasta)) {
      setError('En cada horario, la hora de cierre va después de la de apertura.');
      return;
    }
    setGuardando(true);
    setError(null);
    try {
      let nueva = await llamarApi<RespuestaCuenta>('/cuenta', {
        metodo: 'PATCH',
        cuerpo: {
          tienda: {
            nombre: nombreTienda,
            whatsapp: whatsappTienda,
            logo,
            indicaciones,
            descripcion,
            ...(horarioTocado || tienda?.horario_tramos
              ? tramosConDias.length > 0
                ? { horario_tramos: tramosConDias }
                : { horario_tramos: null, horario: null }
              : {}),
          },
        },
      });
      if (lugarCambio) {
        nueva = await llamarApi<RespuestaCuenta>('/cuenta/lugar', {
          metodo: 'PUT',
          cuerpo: { galeria_id: galeriaId, piso: piso || null, stand: stand.trim() },
        });
      }
      alGuardar(
        nueva,
        lugarCambio && nueva.tienda?.lugar_pendiente
          ? 'Guardado. Tu nuevo lugar queda pendiente de aprobación.'
          : 'Cambios guardados.',
      );
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos guardar los cambios.');
    } finally {
      setGuardando(false);
    }
  }

  async function dejarComoEstaba() {
    setError(null);
    try {
      const nueva = await llamarApi<RespuestaCuenta>('/cuenta/lugar', { metodo: 'DELETE' });
      setGaleriaId(tienda?.galeria_id ?? '');
      setPiso(tienda?.piso ?? '');
      setStand(tienda?.stand ?? '');
      alGuardar(nueva, 'Listo: sigues con tu lugar de siempre.');
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos quitar el cambio.');
    }
  }

  const inicial = (nombreTienda.replace(/^tienda\s+/i, '')[0] ?? '?').toUpperCase();
  const pisos = piso && !PISOS.includes(piso) ? [...PISOS, piso] : PISOS;

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4">
      <section aria-labelledby={`${id}-esencial`} className={tarjeta}>
        <h2 id={`${id}-esencial`} className={titulo}>
          <IconBuildingStore size={20} stroke={1.8} aria-hidden="true" className="text-marca" />
          Lo esencial
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <span className="flex h-[60px] w-[60px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-marca text-[24px] font-bold text-white">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={urlFoto(logo)}
                alt="Logo de la tienda"
                className="h-full w-full object-cover"
              />
            ) : (
              <span aria-hidden="true">{inicial}</span>
            )}
          </span>
          <input
            ref={entradaLogo}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            aria-label="Elegir el logo"
            onChange={(evento) => {
              void cambiarLogo(evento.target.files?.[0]);
              evento.target.value = '';
            }}
          />
          <button
            type="button"
            disabled={subiendo}
            onClick={() => entradaLogo.current?.click()}
            className="h-10 rounded-full border-[1.5px] border-tinta bg-white px-4 text-apoyo font-bold"
          >
            {subiendo ? 'Subiendo…' : logo ? 'Cambiar logo' : 'Subir logo'}
          </button>
          {logo && (
            <button
              type="button"
              disabled={subiendo}
              onClick={() => void ajustarLogo()}
              className="h-10 rounded-full border-[1.5px] border-borde bg-white px-4 text-apoyo font-bold"
            >
              Ajustar
            </button>
          )}
          {logo && (
            <button
              type="button"
              onClick={() => {
                setLogo(null);
                setLogoOriginal(null);
                setLogoAjuste(null);
              }}
              className="h-10 text-apoyo font-medium underline"
            >
              Quitar
            </button>
          )}
        </div>
        {ajustando && (
          <AjustarLogo
            key={ajustando.imagen.src}
            imagen={ajustando.imagen}
            ajusteInicial={ajustando.ajuste}
            nombre={nombreTienda || tienda.nombre}
            lugar={[tienda.galeria ?? 'Independiente', tienda.stand && `Stand ${tienda.stand}`]
              .filter(Boolean)
              .join(' · ')}
            guardando={subiendo}
            error={errorLogo}
            alGuardar={(ajuste) => void guardarLogo(ajuste)}
            alElegirOtra={() => entradaLogo.current?.click()}
            alCerrar={cerrarAjuste}
          />
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <label htmlFor={`${id}-tienda`} className={etiqueta}>
            {tienda.tipo === 'INDEPENDIENTE'
              ? 'Nombre que ven los vendedores'
              : 'Nombre de la tienda'}
            <input
              id={`${id}-tienda`}
              required
              maxLength={120}
              value={nombreTienda}
              onChange={(evento) => setNombreTienda(evento.target.value)}
              className={campo}
            />
          </label>
          <label htmlFor={`${id}-wa-tienda`} className={etiqueta}>
            WhatsApp de la tienda
            <input
              id={`${id}-wa-tienda`}
              required
              type="tel"
              inputMode="tel"
              value={whatsappTienda}
              onChange={(evento) => setWhatsappTienda(evento.target.value)}
              placeholder="987 654 321"
              className={campo}
            />
          </label>
        </div>

        {conGaleria && (
          <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
            <legend className="pb-2 text-apoyo font-bold">Galería y stand</legend>
            <div className="grid grid-cols-[minmax(0,1.6fr)_minmax(0,0.8fr)_minmax(0,1fr)] gap-2.5 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)] sm:gap-3">
              <label htmlFor={`${id}-galeria`} className={etiqueta}>
                Galería
                <select
                  id={`${id}-galeria`}
                  value={galeriaId}
                  onChange={(evento) => setGaleriaId(evento.target.value)}
                  className={selector}
                  style={flechita}
                >
                  {!galerias.some((galeria) => galeria.id === galeriaId) && (
                    <option value={galeriaId}>
                      {galeriaId === pendiente?.galeria_id ? pendiente.galeria : tienda.galeria}
                    </option>
                  )}
                  {galerias.map((galeria) => (
                    <option key={galeria.id} value={galeria.id}>
                      {galeria.nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor={`${id}-piso`} className={etiqueta}>
                Piso
                <select
                  id={`${id}-piso`}
                  value={piso}
                  onChange={(evento) => setPiso(evento.target.value)}
                  className={selector}
                  style={flechita}
                >
                  <option value="">—</option>
                  {pisos.map((opcion) => (
                    <option key={opcion} value={opcion}>
                      {opcion}
                    </option>
                  ))}
                </select>
              </label>
              <label htmlFor={`${id}-stand`} className={etiqueta}>
                Stand
                <input
                  id={`${id}-stand`}
                  required
                  maxLength={20}
                  value={stand}
                  onChange={(evento) => setStand(evento.target.value)}
                  className={campo}
                />
              </label>
            </div>
            <p
              role="note"
              className="m-0 flex items-start gap-2 rounded-xl bg-aviso-fondo px-3 py-2.5 text-nota text-aviso"
            >
              <IconClock size={16} stroke={1.8} aria-hidden="true" className="mt-px shrink-0" />
              {pendiente ? (
                <span>
                  <b className="font-bold">«Pendiente de aprobación»:</b>{' '}
                  {[
                    pendiente.galeria,
                    pendiente.piso && `piso ${pendiente.piso}`,
                    `stand ${pendiente.stand}`,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                  . Hasta que el Equipo lo confirme, tu perfil sigue con{' '}
                  {[tienda.galeria, tienda.stand && `stand ${tienda.stand}`]
                    .filter(Boolean)
                    .join(', ')}
                  .{' '}
                  <button
                    type="button"
                    onClick={() => void dejarComoEstaba()}
                    className="font-bold underline"
                  >
                    Dejar como estaba
                  </button>
                </span>
              ) : (
                <span>
                  Si lo cambias, queda <b className="font-bold">«Pendiente de aprobación»</b> hasta
                  que el Equipo lo confirme.
                </span>
              )}
            </p>
          </fieldset>
        )}
      </section>

      <section aria-labelledby={`${id}-mejor`} className={tarjeta}>
        <div className="flex flex-col gap-2.5">
          <span className="flex items-start justify-between gap-3">
            <h2 id={`${id}-mejor`} className={`${titulo} flex-wrap`}>
              <IconStar size={20} stroke={1.8} aria-hidden="true" className="text-marca" />
              Para que te encuentren mejor{' '}
              <span className="text-nota font-normal text-detalle">(opcional)</span>
            </h2>
            <b className="shrink-0 text-nota font-extrabold text-marca">Perfil al {porcentaje} %</b>
          </span>
          <span
            role="progressbar"
            aria-label="Qué tan completo está tu perfil"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={porcentaje}
            className="h-1.5 overflow-hidden rounded-full bg-[#E2E7E4]"
          >
            <span
              className="block h-full rounded-full bg-pase"
              style={{ width: `${porcentaje}%` }}
            />
          </span>
        </div>

        <fieldset className="m-0 flex flex-col gap-3 border-0 p-0">
          <legend className="pb-2 text-apoyo font-bold">Horario de atención</legend>
          {!horarioTocado && !tienda.horario_tramos && tienda.horario && (
            <span className="text-nota text-detalle">
              Hoy dice «{tienda.horario}». Elige los días para cambiarlo.
            </span>
          )}
          {tramos.map((tramo, indice) => (
            <div key={indice} className="flex flex-col gap-2.5">
              <span
                role="group"
                aria-label={indice === 0 ? 'Días de atención' : `Días del horario ${indice + 1}`}
                className="flex flex-wrap gap-2"
              >
                {DIAS_DE_ATENCION.map((dia) => {
                  const elegido = tramo.dias.includes(dia);
                  const enOtro = !elegido && usados.has(dia);
                  return (
                    <button
                      key={dia}
                      type="button"
                      aria-pressed={elegido}
                      aria-label={LETRA[dia][1]}
                      title={enOtro ? `${LETRA[dia][1]} ya está en otro horario` : LETRA[dia][1]}
                      disabled={enOtro}
                      onClick={() => alternarDia(indice, dia)}
                      className={`flex h-9 w-9 items-center justify-center rounded-full text-apoyo font-bold sm:h-10 sm:w-10 ${
                        elegido
                          ? 'bg-pase text-white'
                          : 'border-[1.5px] border-borde bg-white text-secundario disabled:opacity-40'
                      }`}
                    >
                      {LETRA[dia][0]}
                    </button>
                  );
                })}
              </span>
              <span className="flex flex-wrap items-center gap-2 text-apoyo">
                <Hora
                  etiqueta="Abre"
                  valor={tramo.desde}
                  alCambiar={(hora) => cambiarTramo(indice, { desde: hora })}
                />
                a
                <Hora
                  etiqueta="Cierra"
                  valor={tramo.hasta}
                  alCambiar={(hora) => cambiarTramo(indice, { hasta: hora })}
                />
                {indice > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setHorarioTocado(true);
                      setTramos((actuales) => actuales.filter((_, i) => i !== indice));
                    }}
                    className="h-10 px-2 text-nota font-medium underline"
                  >
                    Quitar
                  </button>
                )}
              </span>
            </div>
          ))}
          {tramos.length < MAX_TRAMOS_HORARIO && usados.size < DIAS_DE_ATENCION.length && (
            <button
              type="button"
              onClick={() => {
                setHorarioTocado(true);
                setTramos((actuales) => [
                  ...actuales,
                  { ...NUEVO_TRAMO, desde: '11:00', hasta: '16:00' },
                ]);
              }}
              className="self-start text-apoyo font-bold text-pase-texto"
            >
              + Otro horario (ej. domingo 11:00 a 16:00)
            </button>
          )}
          <span className="rounded-xl bg-superficie px-3 py-2.5 text-nota" aria-live="polite">
            Se verá:{' '}
            <b className="font-bold">
              {vistaPrevia ?? (horarioTocado ? 'Sin horario' : (tienda.horario ?? 'Sin horario'))}
            </b>
          </span>
        </fieldset>

        <label htmlFor={`${id}-indicaciones`} className={etiqueta}>
          Cómo llegar a tu stand
          <input
            id={`${id}-indicaciones`}
            maxLength={240}
            value={indicaciones}
            onChange={(evento) => setIndicaciones(evento.target.value)}
            placeholder="Subes por la escalera central y es el segundo pasillo a la derecha"
            className={campo}
          />
          <span className="text-nota font-normal text-detalle">
            Sale en el chat cuando otra tienda toca «Cómo llegar».
          </span>
        </label>
        <label htmlFor={`${id}-descripcion`} className={etiqueta}>
          Sobre la tienda
          <textarea
            id={`${id}-descripcion`}
            rows={3}
            maxLength={500}
            value={descripcion}
            onChange={(evento) => setDescripcion(evento.target.value)}
            placeholder="Qué vendes, marcas con las que trabajas, garantía…"
            className={`${campo} h-auto resize-y py-3`}
          />
          <span className="self-end text-nota font-normal text-detalle">
            {descripcion.length} / 500
          </span>
        </label>
      </section>

      {error && (
        <p role="alert" className="rounded-xl bg-error-fondo px-3.5 py-3 text-apoyo text-error">
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={guardando || subiendo}
        className={`${botonPrincipal} self-start`}
      >
        {guardando ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  );
}
