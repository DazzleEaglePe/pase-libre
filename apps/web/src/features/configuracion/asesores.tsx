'use client';

import {
  MAX_ASESORES,
  PERMISOS_ASESOR,
  PERMISOS_INICIALES,
  type Asesor,
  type PermisoAsesor,
  type RespuestaAsesores,
  type RespuestaClaveAsesor,
} from '@paselibre/contracts';
import {
  IconBrandWhatsapp,
  IconCopy,
  IconEye,
  IconEyeOff,
  IconInfoCircle,
  IconLock,
  IconTrash,
} from '@tabler/icons-react';
import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { iniciales } from '@/shared/iniciales';
import { conPlural } from '@/shared/plural';
import { botonPrincipal, botonSecundario, campo, etiqueta } from '@/shared/ui/estilos';
import { Interruptor } from '@/shared/ui/interruptor';
import { Ventana } from '@/shared/ui/ventana';

const tarjeta =
  'flex flex-col gap-3.5 rounded-[18px] border-[1.5px] border-linea bg-white p-4 sm:p-5';

const PERMISOS: Record<PermisoAsesor, string> = {
  COMPRAR_VENDER: 'Comprar y vender a nombre de la tienda',
  MARCAR_VENDIDO: 'Marcar vendido',
  EN_VIVO: 'Publicar en vivo',
  PUBLICAR: 'Publicar productos y cambiar precios',
  DATOS_TIENDA: 'Cambiar logo, banner o datos de la tienda',
  HISTORIAL: 'Ver el historial de ventas',
};

const COLORES = ['bg-[#0B5394]', 'bg-[#9A3412]', 'bg-[#5B21B6]'];

/** Una contraseña para dictar: sin letras que se confundan y con números. */
function claveSugerida(base: string): string {
  const letras = 'abcdefghjkmnpqrstuvwxyz';
  const numeros = '23456789';
  const azar = new Uint32Array(6);
  crypto.getRandomValues(azar);
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = azar;
  const prefijo = base.replace(/[^a-z0-9]/g, '').slice(0, 8) || 'asesor';
  return `${prefijo}-${letras[a % letras.length]}${letras[b % letras.length]}${letras[c % letras.length]}${letras[d % letras.length]}${numeros[e % numeros.length]}${numeros[f % numeros.length]}`;
}

function Avatar({ nombre, indice }: { nombre: string; indice: number }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-apoyo font-extrabold text-white ${COLORES[indice % COLORES.length]}`}
    >
      {iniciales(nombre)}
    </span>
  );
}

/**
 * Configuración · Asesores (N12, mejoras 43 y 47): hasta 3 personas que atienden la tienda sin
 * administrarla. Cada una con sus permisos (nada cambia hasta «Guardar permisos»), activa o
 * pausada, y una contraseña que se ve solo al crearla. Solo la ve el dueño.
 */
export function SeccionAsesores({
  tienda,
  alAvisar,
}: {
  tienda: string;
  alAvisar: (mensaje: string) => void;
}) {
  const [datos, setDatos] = useState<RespuestaAsesores | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<
    | { tipo: 'permisos'; asesor: Asesor }
    | { tipo: 'nuevo' }
    | { tipo: 'clave'; asesor: Asesor }
    | { tipo: 'creado'; respuesta: RespuestaClaveAsesor }
    | null
  >(null);
  const [quitando, setQuitando] = useState<Asesor | null>(null);

  const cargar = useCallback(async () => {
    try {
      setDatos(await llamarApi<RespuestaAsesores>('/cuenta/asesores'));
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos cargar tus asesores.');
    }
  }, []);
  useEffect(() => {
    void cargar();
  }, [cargar]);

  async function activar(asesor: Asesor, activo: boolean) {
    try {
      await llamarApi(`/cuenta/asesores/${asesor.id}`, { metodo: 'PATCH', cuerpo: { activo } });
      alAvisar(activo ? `${asesor.nombre} está activo.` : `Pausaste a ${asesor.nombre}.`);
      await cargar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos cambiarlo.');
    }
  }

  async function quitar(asesor: Asesor) {
    setQuitando(null);
    try {
      await llamarApi(`/cuenta/asesores/${asesor.id}`, { metodo: 'DELETE' });
      alAvisar(`Quitaste a ${asesor.nombre}. Sus chats pasaron a tu cuenta.`);
      setPanel(null);
      await cargar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos quitarlo.');
    }
  }

  const asesores = datos?.asesores ?? [];
  const activos = asesores.filter((a) => a.activo).length;
  const lleno = asesores.length >= (datos?.maximo ?? MAX_ASESORES);
  const elegido = panel && 'asesor' in panel ? panel.asesor.id : null;

  return (
    <>
      <div className={tarjeta}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <span className="flex flex-col">
            <h3 className="text-[18px] font-bold leading-6">Asesores</h3>
            <span className="text-apoyo text-secundario">
              Atienden tu tienda, pero no la administran.
            </span>
          </span>
          {datos && (
            <span className="rounded-full bg-pase-suave px-2.5 text-nota font-bold leading-6 text-pase-texto">
              {asesores.length} de {datos.maximo} · {conPlural(activos, 'activo', 'activos')}
            </span>
          )}
        </div>
        {error && (
          <p
            role="alert"
            className="m-0 rounded-xl bg-error-fondo px-3.5 py-3 text-apoyo text-error"
          >
            {error}
          </p>
        )}
        {!datos && !error && <p className="m-0 text-secundario">Cargando…</p>}
        {datos && asesores.length === 0 && (
          <p className="m-0 text-apoyo text-secundario">
            Todavía no tienes asesores. Añade a quien te ayuda a atender el stand.
          </p>
        )}
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {asesores.map((asesor, indice) => (
            <li
              key={asesor.id}
              className={`flex flex-col gap-3 rounded-2xl border-[1.5px] p-3.5 ${
                elegido === asesor.id ? 'border-pase bg-pase-suave' : 'border-linea'
              }`}
            >
              <div className="flex items-center gap-3">
                <Avatar nombre={asesor.nombre} indice={indice} />
                <span className="flex min-w-0 flex-col">
                  <span className="flex flex-wrap items-center gap-2">
                    <b className="text-cuerpo font-bold">{asesor.nombre}</b>
                    <span
                      className={`rounded-full px-2 text-[12px] font-bold leading-[22px] ${
                        asesor.activo ? 'bg-pase-medio text-ok' : 'bg-superficie text-secundario'
                      }`}
                    >
                      {asesor.activo ? 'Activo' : 'Pausado'}
                    </span>
                  </span>
                  <span className="truncate font-mono text-nota text-secundario">
                    {asesor.usuario}
                  </span>
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Interruptor
                  activo={asesor.activo}
                  etiqueta={`${asesor.nombre} activo`}
                  alCambiar={(activo) => void activar(asesor, activo)}
                />
                <button
                  type="button"
                  aria-pressed={panel?.tipo === 'permisos' && elegido === asesor.id}
                  onClick={() => setPanel({ tipo: 'permisos', asesor })}
                  className={`inline-flex h-10 items-center rounded-full px-4 text-apoyo font-bold ${
                    panel?.tipo === 'permisos' && elegido === asesor.id
                      ? 'bg-pase text-white'
                      : 'border-[1.5px] border-tinta bg-white'
                  }`}
                >
                  Permisos
                </button>
                <button
                  type="button"
                  onClick={() => setPanel({ tipo: 'clave', asesor })}
                  className="inline-flex h-10 items-center gap-1.5 rounded-full border-[1.5px] border-tinta bg-white px-4 text-apoyo font-bold"
                >
                  <IconLock size={16} stroke={1.8} aria-hidden="true" />
                  Contraseña
                </button>
                <button
                  type="button"
                  aria-label={`Quitar a ${asesor.nombre}`}
                  onClick={() => setQuitando(asesor)}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-error-fondo text-error"
                >
                  <IconTrash size={17} stroke={1.8} aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
        {datos && !lleno && (
          <button
            type="button"
            onClick={() => setPanel({ tipo: 'nuevo' })}
            className={`${botonPrincipal} self-start font-bold`}
          >
            + Añadir asesor
          </button>
        )}
        {datos && lleno && (
          <p className="m-0 text-nota text-secundario">
            Ya tienes {datos.maximo} asesores. Quita uno para añadir otro.
          </p>
        )}
      </div>

      {panel?.tipo === 'permisos' && (
        <Permisos
          key={panel.asesor.id}
          asesor={panel.asesor}
          indice={asesores.findIndex((a) => a.id === panel.asesor.id)}
          alCancelar={() => setPanel(null)}
          alGuardar={async () => {
            alAvisar(`Guardaste los permisos de ${panel.asesor.nombre}.`);
            setPanel(null);
            await cargar();
          }}
        />
      )}
      {panel?.tipo === 'nuevo' && datos && (
        <NuevoAsesor
          prefijo={datos.prefijo}
          alCancelar={() => setPanel(null)}
          alCrear={async (respuesta) => {
            setPanel({ tipo: 'creado', respuesta });
            await cargar();
          }}
        />
      )}
      {panel?.tipo === 'clave' && (
        <NuevaClave
          key={panel.asesor.id}
          asesor={panel.asesor}
          alCancelar={() => setPanel(null)}
          alGuardar={(respuesta) => setPanel({ tipo: 'creado', respuesta })}
        />
      )}
      {panel?.tipo === 'creado' && (
        <ClaveCreada respuesta={panel.respuesta} alTerminar={() => setPanel(null)} />
      )}

      <div className={tarjeta}>
        <h3 className="text-cuerpo font-bold">Así lo ven las otras tiendas</h3>
        <div className="flex items-center gap-3">
          <Avatar nombre={asesores[0]?.nombre ?? 'Asesor'} indice={0} />
          <span className="flex flex-col">
            <b className="font-bold">{asesores[0]?.nombre ?? 'Tu asesor'}</b>
            <span className="text-apoyo font-bold text-pase-texto">Asesor de {tienda}</span>
          </span>
        </div>
        <p className="m-0 text-nota text-secundario">
          Cada mensaje dice quién lo escribió. Las calificaciones van a la tienda, no al asesor.
        </p>
      </div>

      <Ventana
        titulo={quitando ? `¿Quitar a ${quitando.nombre}?` : 'Quitar asesor'}
        abierta={quitando !== null}
        alCerrar={() => setQuitando(null)}
      >
        {quitando && (
          <div className="flex flex-col gap-4">
            <p className="m-0 text-secundario">
              Ya no podrá entrar. Sus chats y publicaciones pasan a tu cuenta, para que no se pierda
              nada.
            </p>
            <div className="flex justify-end gap-3">
              <button type="button" onClick={() => setQuitando(null)} className={botonSecundario}>
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void quitar(quitando)}
                className="inline-flex h-11 items-center justify-center rounded-full bg-error px-5 text-cuerpo font-semibold text-white"
              >
                Quitar
              </button>
            </div>
          </div>
        )}
      </Ventana>
    </>
  );
}

function Permisos({
  asesor,
  indice,
  alCancelar,
  alGuardar,
}: {
  asesor: Asesor;
  indice: number;
  alCancelar: () => void;
  alGuardar: () => Promise<void>;
}) {
  const [marcados, setMarcados] = useState<PermisoAsesor[]>(asesor.permisos);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    setGuardando(true);
    setError(null);
    try {
      await llamarApi(`/cuenta/asesores/${asesor.id}`, {
        metodo: 'PATCH',
        cuerpo: { permisos: marcados },
      });
      await alGuardar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos guardar los permisos.');
      setGuardando(false);
    }
  }

  const fila = 'flex min-h-11 items-center gap-3 border-b border-linea py-2.5 text-cuerpo';
  const soloDueno = (texto: string) => (
    <li className={`${fila} text-secundario`}>
      <IconLock size={18} stroke={1.7} className="w-5 shrink-0" aria-hidden="true" />
      <span className="flex-1">{texto}</span>
      <span className="rounded-full bg-superficie px-2.5 text-nota font-bold leading-6 text-tinta">
        Solo el dueño
      </span>
    </li>
  );

  return (
    <section aria-label={`Permisos de ${asesor.nombre}`} className={tarjeta}>
      <div className="flex items-center gap-3">
        <Avatar nombre={asesor.nombre} indice={Math.max(0, indice)} />
        <span className="flex flex-col">
          <h3 className="text-[18px] font-bold leading-6">Permisos de {asesor.nombre}</h3>
          <span className="text-apoyo text-secundario">Cada asesor tiene los suyos</span>
        </span>
      </div>
      <ul className="m-0 flex list-none flex-col p-0">
        <li className={fila}>
          <input type="checkbox" checked disabled className="h-5 w-5 accent-pase" id="chatear" />
          <label htmlFor="chatear" className="flex-1">
            Chatear y responder
          </label>
          <span className="rounded-full bg-superficie px-2.5 text-nota font-bold leading-6">
            Lo mínimo: siempre activo
          </span>
        </li>
        {PERMISOS_ASESOR.map((permiso) => (
          <li key={permiso} className={fila}>
            <input
              type="checkbox"
              id={`permiso-${permiso}`}
              checked={marcados.includes(permiso)}
              onChange={(evento) =>
                setMarcados((actuales) =>
                  evento.target.checked
                    ? [...actuales, permiso]
                    : actuales.filter((p) => p !== permiso),
                )
              }
              className="h-5 w-5 accent-pase"
            />
            <label htmlFor={`permiso-${permiso}`} className="flex-1">
              {PERMISOS[permiso]}
            </label>
          </li>
        ))}
        {soloDueno('Agregar, pausar o quitar asesores')}
        {soloDueno('Seguridad y contraseña de la tienda')}
      </ul>
      {error && (
        <p role="alert" className="m-0 rounded-xl bg-error-fondo px-3.5 py-3 text-apoyo text-error">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          disabled={guardando}
          onClick={() => void guardar()}
          className={`${botonPrincipal} font-bold`}
        >
          {guardando ? 'Guardando…' : 'Guardar permisos'}
        </button>
        <button
          type="button"
          onClick={alCancelar}
          className="inline-flex h-11 items-center rounded-full border-[1.5px] border-tinta bg-white px-5 text-cuerpo font-bold"
        >
          Cancelar
        </button>
      </div>
      <p className="m-0 text-nota text-secundario">
        Vienen marcados: comprar y vender, marcar vendido y publicar en vivo. Lo demás lo activas
        tú. Hasta que tocas «Guardar permisos» no cambia nada.
      </p>
    </section>
  );
}

function CampoClave({
  id,
  clave,
  alCambiar,
}: {
  id: string;
  clave: string;
  alCambiar: (clave: string) => void;
}) {
  const [ver, setVer] = useState(true);
  return (
    <div className="flex h-12 items-center overflow-hidden rounded-xl border-[1.5px] border-pase bg-white focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-tinta">
      <input
        id={id}
        type={ver ? 'text' : 'password'}
        autoComplete="new-password"
        spellCheck={false}
        value={clave}
        onChange={(evento) => alCambiar(evento.target.value)}
        className="h-full min-w-0 flex-1 bg-transparent px-3.5 font-mono text-cuerpo outline-none"
      />
      <button
        type="button"
        aria-label={ver ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
        aria-pressed={ver}
        onClick={() => setVer(!ver)}
        className="flex h-full w-11 items-center justify-center text-pase"
      >
        {ver ? (
          <IconEye size={20} stroke={1.7} aria-hidden="true" />
        ) : (
          <IconEyeOff size={20} stroke={1.7} aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

function NuevoAsesor({
  prefijo,
  alCancelar,
  alCrear,
}: {
  prefijo: string;
  alCancelar: () => void;
  alCrear: (respuesta: RespuestaClaveAsesor) => Promise<void>;
}) {
  const id = useId();
  const [nombre, setNombre] = useState('');
  const [sufijo, setSufijo] = useState('');
  const [clave, setClave] = useState(() => claveSugerida(''));
  const [tocoClave, setTocoClave] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);

  async function crear(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setCreando(true);
    setError(null);
    try {
      await alCrear(
        await llamarApi<RespuestaClaveAsesor>('/cuenta/asesores', {
          metodo: 'POST',
          cuerpo: { nombre, sufijo, clave, permisos: [...PERMISOS_INICIALES] },
        }),
      );
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos crear al asesor.');
      setCreando(false);
    }
  }

  return (
    <form onSubmit={crear} className={`${tarjeta} shadow-[0_20px_50px_rgba(15,20,18,0.10)]`}>
      <h3 className="text-[20px] font-bold leading-7">Añadir asesor</h3>
      <label htmlFor={`${id}-nombre`} className={etiqueta}>
        <b className="font-bold">Nombre</b>
        <input
          id={`${id}-nombre`}
          required
          minLength={2}
          maxLength={120}
          autoComplete="off"
          value={nombre}
          onChange={(evento) => {
            setNombre(evento.target.value);
            const primero = evento.target.value
              .trim()
              .split(' ')[0]
              ?.normalize('NFD')
              .replace(/[̀-ͯ]/g, '')
              .toLowerCase()
              .replace(/[^a-z0-9]/g, '');
            if (!sufijo || sufijo === sufijoDe(nombre)) setSufijo(primero ?? '');
            if (!tocoClave) setClave(claveSugerida(primero ?? ''));
          }}
          className={campo}
        />
      </label>
      <label htmlFor={`${id}-sufijo`} className={etiqueta}>
        <b className="font-bold">Usuario</b>
        <span className="flex h-12 items-center overflow-hidden rounded-xl border border-borde bg-white focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-tinta">
          <span className="flex h-full items-center bg-superficie px-3 font-mono text-cuerpo text-secundario">
            {prefijo}.
          </span>
          <input
            id={`${id}-sufijo`}
            required
            pattern="[a-z0-9_\-]{2,20}"
            title="De 2 a 20 letras sin tildes o números"
            autoCapitalize="none"
            spellCheck={false}
            value={sufijo}
            onChange={(evento) => setSufijo(evento.target.value.toLowerCase())}
            className="h-full min-w-0 flex-1 bg-transparent px-3 font-mono text-cuerpo outline-none"
          />
        </span>
      </label>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-clave`} className="text-apoyo font-bold">
          Contraseña
        </label>
        <CampoClave
          id={`${id}-clave`}
          clave={clave}
          alCambiar={(nueva) => {
            setTocoClave(true);
            setClave(nueva);
          }}
        />
      </div>
      <NotaSoloAhora />
      {error && (
        <p role="alert" className="m-0 rounded-xl bg-error-fondo px-3.5 py-3 text-apoyo text-error">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2.5">
        <button type="submit" disabled={creando} className={`${botonPrincipal} flex-1 font-bold`}>
          {creando ? 'Creando…' : 'Crear asesor'}
        </button>
        <button type="button" onClick={alCancelar} className={botonSecundario}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

function sufijoDe(nombre: string): string {
  return (
    nombre
      .trim()
      .split(' ')[0]
      ?.normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '') ?? ''
  );
}

function NotaSoloAhora() {
  return (
    <p className="m-0 flex gap-2 rounded-xl border border-[#F3E2A0] bg-ambar px-3.5 py-3 text-nota text-secundario">
      <IconInfoCircle
        size={16}
        stroke={1.8}
        className="mt-0.5 shrink-0 text-ambar-texto"
        aria-hidden="true"
      />
      <span>
        La contraseña se ve <b className="font-bold text-tinta">solo ahora</b>. Después no se puede
        mirar (se guarda cifrada), pero puedes ponerle una nueva cuando quieras. El asesor no puede
        cambiarla: solo tú.
      </span>
    </p>
  );
}

function NuevaClave({
  asesor,
  alCancelar,
  alGuardar,
}: {
  asesor: Asesor;
  alCancelar: () => void;
  alGuardar: (respuesta: RespuestaClaveAsesor) => void;
}) {
  const id = useId();
  const [clave, setClave] = useState(() => claveSugerida(asesor.usuario.split('.').at(-1) ?? ''));
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  async function guardar(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      alGuardar(
        await llamarApi<RespuestaClaveAsesor>(`/cuenta/asesores/${asesor.id}/clave`, {
          metodo: 'POST',
          cuerpo: { clave },
        }),
      );
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos cambiar la contraseña.');
      setGuardando(false);
    }
  }

  return (
    <form onSubmit={guardar} className={tarjeta}>
      <h3 className="text-[18px] font-bold leading-6">Contraseña nueva para {asesor.nombre}</h3>
      <p className="m-0 text-apoyo text-secundario">
        La de ahora deja de servir y se cierran sus sesiones. Dásela tú: él no puede cambiarla.
      </p>
      <label htmlFor={`${id}-clave`} className="text-apoyo font-bold">
        Contraseña
      </label>
      <CampoClave id={`${id}-clave`} clave={clave} alCambiar={setClave} />
      {error && (
        <p role="alert" className="m-0 rounded-xl bg-error-fondo px-3.5 py-3 text-apoyo text-error">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2.5">
        <button type="submit" disabled={guardando} className={`${botonPrincipal} font-bold`}>
          {guardando ? 'Guardando…' : 'Poner contraseña nueva'}
        </button>
        <button type="button" onClick={alCancelar} className={botonSecundario}>
          Cancelar
        </button>
      </div>
    </form>
  );
}

/** Lo único que muestra la contraseña: «Copiar» y «Enviar por WhatsApp», y no se vuelve a ver. */
function ClaveCreada({
  respuesta,
  alTerminar,
}: {
  respuesta: RespuestaClaveAsesor;
  alTerminar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  return (
    <section aria-label="Contraseña del asesor" className={tarjeta}>
      <h3 className="text-[18px] font-bold leading-6">{respuesta.asesor.nombre} ya puede entrar</h3>
      <dl className="m-0 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-cuerpo">
        <dt className="text-secundario">Usuario</dt>
        <dd className="m-0 font-mono font-bold">{respuesta.asesor.usuario}</dd>
        <dt className="text-secundario">Contraseña</dt>
        <dd className="m-0 font-mono font-bold">{respuesta.clave}</dd>
      </dl>
      <div className="flex flex-wrap gap-2.5">
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(respuesta.mensaje);
              setCopiado(true);
            } catch {
              setCopiado(false);
            }
          }}
          className="inline-flex h-11 items-center gap-2 rounded-full border-[1.5px] border-tinta bg-white px-4 text-apoyo font-bold"
        >
          <IconCopy size={17} stroke={1.8} aria-hidden="true" />
          {copiado ? 'Copiado' : 'Copiar'}
        </button>
        <a
          href={`https://wa.me/?text=${encodeURIComponent(respuesta.mensaje)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-11 items-center gap-2 rounded-full bg-[#25D366] px-4 text-apoyo font-bold text-white no-underline"
        >
          <IconBrandWhatsapp size={18} stroke={1.8} aria-hidden="true" />
          Enviar por WhatsApp
        </a>
      </div>
      <NotaSoloAhora />
      <button
        type="button"
        onClick={alTerminar}
        className={`${botonPrincipal} self-start font-bold`}
      >
        Listo
      </button>
    </section>
  );
}
