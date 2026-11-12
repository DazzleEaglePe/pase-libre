'use client';

import type { RespuestaCuenta } from '@paselibre/contracts';
import { IconUser } from '@tabler/icons-react';
import { useId, useState, type FormEvent } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { botonPrincipal, campo, etiqueta } from '@/shared/ui/estilos';

/**
 * Configuración · Mi acceso (N09_ConfigWebTodo, B): lo de la persona que entra, no de la tienda.
 * Cada asesor ve y cambia lo suyo: el usuario (solo lo cambia el Equipo), su correo para entrar y
 * su WhatsApp. «Persona a cargo» ya no está.
 */
export function SeccionAcceso({
  cuenta,
  alGuardar,
}: {
  cuenta: RespuestaCuenta;
  alGuardar: (cuenta: RespuestaCuenta, mensaje: string) => void;
}) {
  const id = useId();
  const [correo, setCorreo] = useState(cuenta.usuario.correo ?? '');
  const [whatsapp, setWhatsapp] = useState(cuenta.usuario.whatsapp ?? '');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const nueva = await llamarApi<RespuestaCuenta>('/cuenta', {
        metodo: 'PATCH',
        cuerpo: { correo, whatsapp },
      });
      alGuardar(nueva, 'Guardamos tu acceso.');
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos guardar los cambios.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-4">
      <section className="flex flex-col gap-4 rounded-2xl border-[1.5px] border-linea bg-white p-5">
        <span className="flex flex-col gap-1">
          <h2 className="flex items-center gap-2 text-[17px] font-bold">
            <IconUser size={20} stroke={1.8} aria-hidden="true" className="text-marca" />
            Mi acceso
          </h2>
          <span className="text-nota text-detalle">
            Esto es de la persona que entra, no de la tienda. Cada asesor ve y cambia lo suyo.
          </span>
        </span>
        <div className="grid gap-4 sm:grid-cols-2">
          <label htmlFor={`${id}-usuario`} className={etiqueta}>
            Usuario
            <input
              id={`${id}-usuario`}
              readOnly
              aria-describedby={`${id}-usuario-nota`}
              value={cuenta.usuario.usuario}
              className={`${campo} bg-superficie text-secundario`}
            />
            <span id={`${id}-usuario-nota`} className="text-nota font-normal text-detalle">
              Lo cambia el Equipo PaseLibre.
            </span>
          </label>
          <label htmlFor={`${id}-correo`} className={etiqueta}>
            <span>
              Correo <span className="font-normal text-detalle">(opcional)</span>
            </span>
            <input
              id={`${id}-correo`}
              type="email"
              autoComplete="email"
              value={correo}
              onChange={(evento) => setCorreo(evento.target.value)}
              placeholder="Para entrar con tu correo"
              className={campo}
            />
          </label>
          <label htmlFor={`${id}-wa`} className={etiqueta}>
            <span>
              Mi WhatsApp <span className="font-normal text-detalle">(opcional)</span>
            </span>
            <input
              id={`${id}-wa`}
              type="tel"
              inputMode="tel"
              aria-describedby={`${id}-wa-nota`}
              value={whatsapp}
              onChange={(evento) => setWhatsapp(evento.target.value)}
              placeholder="987 654 321"
              className={campo}
            />
            <span id={`${id}-wa-nota`} className="text-nota font-normal text-detalle">
              Si lo dejas vacío, te escriben al de la tienda.
            </span>
          </label>
        </div>
      </section>
      {error && (
        <p role="alert" className="rounded-xl bg-error-fondo px-3.5 py-3 text-apoyo text-error">
          {error}
        </p>
      )}
      <button type="submit" disabled={guardando} className={`${botonPrincipal} self-start`}>
        {guardando ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </form>
  );
}
