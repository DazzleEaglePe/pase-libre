'use client';

import { MOTIVOS_SUSPENSION, type FichaTienda } from '@paselibre/contracts';
import { IconClock, IconEye, IconEyeOff } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { useId, useState, type FormEvent } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { hora } from '@/shared/fechas';

import { botonBorde, campoFicha, ruta } from './comun';

const OTRO = 'Otro…';
const DIA_LIMA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' });

const botonRojo =
  'inline-flex h-11 items-center justify-center rounded-full bg-error px-5 text-apoyo font-bold text-white disabled:opacity-60';

/** «Suspendida hace 3 h», «… hace 2 días» (doc 19 §9). */
export function suspendidaHace(iso: string, ahora = new Date()): string {
  const minutos = Math.max(0, Math.floor((ahora.getTime() - Date.parse(iso)) / 60_000));
  if (minutos < 60) return `Suspendida hace ${Math.max(1, minutos)} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `Suspendida hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  return `Suspendida hace ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

/** «21 h (mañana 19:04)»: cuánto falta para poder eliminarla, con la hora de Lima. */
export function faltaParaEliminar(desdeIso: string, ahora = new Date()): string {
  const desde = new Date(desdeIso);
  const horas = Math.max(1, Math.ceil((desde.getTime() - ahora.getTime()) / 3_600_000));
  const dia = DIA_LIMA.format(desde) === DIA_LIMA.format(ahora) ? 'hoy' : 'mañana';
  return `${horas} h (${dia} ${hora(desdeIso)})`;
}

/** «Motivo (opcional)»: la lista del doc 19 §9 y «Otro…» para escribirlo. */
export function MotivoSuspension({
  valor,
  alCambiar,
}: {
  valor: string;
  alCambiar: (motivo: string) => void;
}) {
  const id = useId();
  const deLaLista = (MOTIVOS_SUSPENSION as readonly string[]).includes(valor);
  const [elegido, setElegido] = useState(valor === '' ? '' : deLaLista ? valor : OTRO);
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={`${id}-motivo`} className="flex flex-col gap-1.5 text-apoyo font-bold">
        <span>
          Motivo <span className="font-normal text-secundario">(opcional)</span>
        </span>
        <select
          id={`${id}-motivo`}
          value={elegido}
          onChange={(evento) => {
            const nuevo = evento.target.value;
            setElegido(nuevo);
            alCambiar(nuevo === OTRO ? '' : nuevo);
          }}
          className={`${campoFicha} font-normal`}
        >
          <option value="">Sin motivo</option>
          {MOTIVOS_SUSPENSION.map((motivo) => (
            <option key={motivo} value={motivo}>
              {motivo}
            </option>
          ))}
          <option value={OTRO}>{OTRO}</option>
        </select>
      </label>
      {elegido === OTRO && (
        <input
          aria-label="Escribe el motivo"
          value={valor}
          maxLength={200}
          placeholder="Escribe el motivo"
          onChange={(evento) => alCambiar(evento.target.value)}
          className={campoFicha}
        />
      )}
    </div>
  );
}

/**
 * «¿Suspender a …?» (doc 19 §9): al instante, sin contraseña, con motivo opcional. «Reactivar»
 * la vuelve a dejar como estaba.
 */
export function SuspenderTienda({
  tiendaId,
  suspendida,
  alCancelar,
  alTerminar,
}: {
  tiendaId: string;
  suspendida: boolean;
  alCancelar: () => void;
  alTerminar: () => Promise<void>;
}) {
  const [motivo, setMotivo] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  async function confirmar() {
    setGuardando(true);
    setError(null);
    try {
      await llamarApi(ruta(tiendaId, '/suspension'), {
        metodo: 'POST',
        cuerpo: { suspender: !suspendida, ...(motivo.trim() ? { motivo: motivo.trim() } : {}) },
      });
      await alTerminar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos guardarlo.');
    } finally {
      setGuardando(false);
    }
  }
  return (
    <div className="flex flex-col gap-3.5">
      {suspendida ? (
        <p className="m-0 text-secundario">
          Vuelve a entrar y sus publicaciones se ven otra vez. No se pierde nada.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1 text-cuerpo">
            <span className="text-secundario">En cuanto confirmes:</span>
            <span>· Se cierran todas sus sesiones.</span>
            <span>· Sus publicaciones dejan de verse.</span>
            <span>· No puede volver a entrar hasta que la reactives.</span>
          </div>
          <MotivoSuspension valor={motivo} alCambiar={setMotivo} />
        </>
      )}
      {error && (
        <p role="alert" className="m-0 text-apoyo text-error">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          disabled={guardando}
          onClick={() => void confirmar()}
          className={
            suspendida
              ? 'inline-flex h-11 items-center justify-center rounded-full border-[1.5px] border-pase px-5 text-apoyo font-bold text-pase-texto disabled:opacity-60'
              : botonRojo
          }
        >
          {suspendida ? 'Reactivar' : 'Suspender ahora'}
        </button>
        <button type="button" onClick={alCancelar} className={botonBorde}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

/**
 * Debajo del nombre de una tienda suspendida: «Por Fabrizio · Spam…», «Reactivar» y «Eliminar
 * definitivamente», apagado las primeras 24 h y rojo después (solo para administradores).
 */
export function EstadoSuspension({
  ficha,
  alReactivar,
  alEliminar,
  ahora = new Date(),
}: {
  ficha: FichaTienda;
  alReactivar: () => void;
  alEliminar: () => void;
  ahora?: Date;
}) {
  const { suspension } = ficha;
  if (!suspension) return null;
  const habilitado = Date.parse(suspension.eliminable_desde) <= ahora.getTime();
  return (
    <div className="flex w-full flex-col gap-2.5">
      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={alReactivar}
          className="inline-flex h-11 items-center justify-center rounded-full border-[1.5px] border-pase px-5 text-apoyo font-bold text-pase-texto"
        >
          Reactivar
        </button>
        {ficha.puede_eliminar &&
          (habilitado ? (
            <button type="button" onClick={alEliminar} className={botonRojo}>
              Eliminar definitivamente
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex h-11 cursor-not-allowed items-center justify-center rounded-full border border-dashed border-borde-control px-5 text-apoyo font-bold text-borde-control"
            >
              Eliminar definitivamente
            </button>
          ))}
      </div>
      {ficha.puede_eliminar && !habilitado && (
        <span className="flex items-start gap-1.5 text-nota text-secundario">
          <IconClock size={16} stroke={1.8} aria-hidden="true" className="mt-px shrink-0" />
          Podrás eliminarla en {faltaParaEliminar(suspension.eliminable_desde, ahora)}. Mientras
          tanto se puede reactivar sin perder nada.
        </span>
      )}
    </div>
  );
}

/** «Por Fabrizio · Spam o publicaciones falsas». */
export function quienSuspendio(ficha: FichaTienda): string | null {
  const { suspension } = ficha;
  if (!suspension) return null;
  const partes = [suspension.por && `Por ${suspension.por}`, suspension.motivo].filter(Boolean);
  return partes.length > 0 ? partes.join(' · ') : null;
}

/**
 * «¿Eliminar a … para siempre?» y «Último paso» con **tu** contraseña (doc 19 §9). Con 3 errores
 * espera 15 min (lo cuenta el servidor). Al terminar vuelve a la lista de tiendas.
 */
export function EliminarTienda({
  ficha,
  paso,
  alSeguir,
  alCancelar,
}: {
  ficha: FichaTienda;
  paso: 'aviso' | 'clave';
  alSeguir: () => void;
  alCancelar: () => void;
}) {
  const id = useId();
  const router = useRouter();
  const [clave, setClave] = useState('');
  const [ver, setVer] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const publicaciones = ficha.suspension?.publicaciones ?? { activas: 0, antiguas: 0 };

  async function eliminar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEliminando(true);
    setError(null);
    try {
      await llamarApi(ruta(ficha.id), { metodo: 'DELETE', cuerpo: { clave } });
      router.replace('/equipo/tiendas');
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos eliminarla.');
      setEliminando(false);
    }
  }

  if (paso === 'aviso') {
    return (
      <div className="flex flex-col gap-2.5 text-cuerpo">
        <b className="font-bold text-error">No se puede deshacer. Se borra todo:</b>
        <span>· La cuenta, sus asesores y sus sesiones.</span>
        <span>
          · Todas sus publicaciones y fotos ({publicaciones.activas}{' '}
          {publicaciones.activas === 1 ? 'activa' : 'activas'}, {publicaciones.antiguas}{' '}
          {publicaciones.antiguas === 1 ? 'antigua' : 'antiguas'}).
        </span>
        <span>· Su perfil: logo, portada, horario.</span>
        <span>· Sus pedidos en vivo y avisos.</span>
        <span className="text-secundario">
          En los chats, la otra tienda conserva sus propios mensajes y ve «Tienda eliminada».
        </span>
        <div className="mt-1 flex flex-wrap gap-2.5">
          <button type="button" onClick={alCancelar} className={botonBorde}>
            Cancelar
          </button>
          <button type="button" onClick={alSeguir} className={botonRojo}>
            Sí, eliminar
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={(evento) => void eliminar(evento)} className="flex flex-col gap-3">
      <label htmlFor={`${id}-clave`} className="flex flex-col gap-2 text-cuerpo">
        <span>
          Escribe <b className="font-bold">tu</b> contraseña de PaseLibre para eliminar a{' '}
          {ficha.nombre}.
        </span>
        <span className="relative">
          <input
            id={`${id}-clave`}
            type={ver ? 'text' : 'password'}
            autoComplete="current-password"
            required
            autoFocus
            value={clave}
            onChange={(evento) => setClave(evento.target.value)}
            className={`${campoFicha} pr-12`}
          />
          <button
            type="button"
            aria-label={ver ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
            onClick={() => setVer(!ver)}
            className="absolute right-1 top-1 flex h-10 w-10 items-center justify-center text-secundario"
          >
            {ver ? (
              <IconEye size={19} stroke={1.7} aria-hidden="true" />
            ) : (
              <IconEyeOff size={19} stroke={1.7} aria-hidden="true" />
            )}
          </button>
        </span>
      </label>
      <span className="text-nota text-secundario">
        Es la tuya, no la de la tienda. Si la escribes mal 3 veces, se bloquea por 15 min.
      </span>
      {error && (
        <p role="alert" className="m-0 rounded-xl bg-error-fondo px-3.5 py-3 text-apoyo text-error">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2.5">
        <button type="button" onClick={alCancelar} className={botonBorde}>
          Cancelar
        </button>
        <button type="submit" disabled={eliminando || !clave} className={botonRojo}>
          {eliminando ? 'Eliminando…' : 'Eliminar para siempre'}
        </button>
      </div>
    </form>
  );
}
