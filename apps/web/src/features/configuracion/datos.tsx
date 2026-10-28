'use client';

import { urlFoto, type RespuestaCuenta } from '@paselibre/contracts';
import { useId, useRef, useState, type FormEvent } from 'react';

import { ErrorApi, llamarApi, subirFoto } from '@/shared/api/cliente';
import { botonPrincipal, campo, etiqueta } from '@/shared/ui/estilos';

const SOLO_EQUIPO = 'Lo cambia el equipo de PaseLibre.';

/**
 * Configuración · Datos de la cuenta (RF-58): lo de la tienda y lo de la persona. El
 * usuario, la galería y el stand se ven pero no se editan.
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
  const [logo, setLogo] = useState(tienda?.logo ?? null);
  const [nombreTienda, setNombreTienda] = useState(tienda?.nombre ?? '');
  const [whatsappTienda, setWhatsappTienda] = useState(tienda?.whatsapp ?? '');
  const [horario, setHorario] = useState(tienda?.horario ?? '');
  const [descripcion, setDescripcion] = useState(tienda?.descripcion ?? '');
  const [nombre, setNombre] = useState(cuenta.usuario.nombre);
  const [correo, setCorreo] = useState(cuenta.usuario.correo ?? '');
  const [whatsapp, setWhatsapp] = useState(cuenta.usuario.whatsapp ?? '');
  const [subiendo, setSubiendo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const entradaLogo = useRef<HTMLInputElement>(null);

  async function cambiarLogo(archivo: File | undefined) {
    if (!archivo) return;
    setSubiendo(true);
    setError(null);
    try {
      setLogo((await subirFoto(archivo)).ruta);
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos subir el logo.');
    } finally {
      setSubiendo(false);
    }
  }

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const nueva = await llamarApi<RespuestaCuenta>('/cuenta', {
        metodo: 'PATCH',
        cuerpo: {
          nombre,
          correo,
          whatsapp,
          ...(tienda
            ? {
                tienda: {
                  nombre: nombreTienda,
                  whatsapp: whatsappTienda,
                  horario,
                  descripcion,
                  logo,
                },
              }
            : {}),
        },
      });
      alGuardar(nueva, 'Cambios guardados.');
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos guardar los cambios.');
    } finally {
      setGuardando(false);
    }
  }

  const inicial = (nombreTienda.replace(/^tienda\s+/i, '')[0] ?? '?').toUpperCase();
  const lugar = tienda
    ? [tienda.galeria ?? 'Independiente', tienda.stand && `Stand ${tienda.stand}`]
        .filter(Boolean)
        .join(' · ')
    : '';

  return (
    <form onSubmit={guardar} className="flex flex-col gap-5">
      {tienda && (
        <>
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-tinta text-[28px] font-semibold text-white">
              {logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={urlFoto(logo)}
                  alt="Logo de la tienda"
                  className="h-full w-full object-cover"
                />
              ) : (
                inicial
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
              className="h-10 rounded-full border border-borde bg-white px-4 text-apoyo font-medium"
            >
              {subiendo ? 'Subiendo…' : logo ? 'Cambiar logo' : 'Subir logo de la tienda'}
            </button>
            {logo && (
              <button
                type="button"
                onClick={() => setLogo(null)}
                className="h-10 text-apoyo font-medium underline"
              >
                Quitar
              </button>
            )}
          </div>

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
            <label htmlFor={`${id}-horario`} className={`${etiqueta} sm:col-span-2`}>
              Horario de atención
              <input
                id={`${id}-horario`}
                maxLength={120}
                value={horario}
                onChange={(evento) => setHorario(evento.target.value)}
                placeholder="Lunes a sábado, 10:00 a 19:00"
                className={campo}
              />
            </label>
            <label htmlFor={`${id}-descripcion`} className={`${etiqueta} sm:col-span-2`}>
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
          </div>
        </>
      )}

      <div className="grid gap-4 border-t border-linea pt-5 sm:grid-cols-2">
        <label htmlFor={`${id}-nombre`} className={etiqueta}>
          Persona a cargo
          <input
            id={`${id}-nombre`}
            required
            maxLength={120}
            value={nombre}
            onChange={(evento) => setNombre(evento.target.value)}
            className={campo}
          />
        </label>
        <label htmlFor={`${id}-correo`} className={etiqueta}>
          <span>
            Correo <span className="font-normal text-detalle">(opcional)</span>
          </span>
          <input
            id={`${id}-correo`}
            type="email"
            value={correo}
            onChange={(evento) => setCorreo(evento.target.value)}
            placeholder="Para entrar con tu correo"
            className={campo}
          />
        </label>
        <label htmlFor={`${id}-wa`} className={etiqueta}>
          <span>
            Tu WhatsApp <span className="font-normal text-detalle">(opcional)</span>
          </span>
          <input
            id={`${id}-wa`}
            type="tel"
            inputMode="tel"
            value={whatsapp}
            onChange={(evento) => setWhatsapp(evento.target.value)}
            placeholder="987 654 321"
            className={campo}
          />
          <span className="text-nota font-normal text-detalle">
            Si lo dejas vacío, por tus publicaciones te escriben al de la tienda.
          </span>
        </label>
        <label htmlFor={`${id}-usuario`} className={etiqueta}>
          Usuario
          <input
            id={`${id}-usuario`}
            readOnly
            value={cuenta.usuario.usuario}
            className={`${campo} bg-superficie text-secundario`}
          />
          <span className="text-nota font-normal text-detalle">{SOLO_EQUIPO}</span>
        </label>
        {tienda && (
          <label htmlFor={`${id}-lugar`} className={etiqueta}>
            Galería y stand
            <input
              id={`${id}-lugar`}
              readOnly
              value={lugar}
              className={`${campo} bg-superficie text-secundario`}
            />
            <span className="text-nota font-normal text-detalle">{SOLO_EQUIPO}</span>
          </label>
        )}
      </div>

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
