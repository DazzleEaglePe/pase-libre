'use client';

import {
  normalizarTexto,
  type GaleriaResumen,
  type RespuestaAcceso,
  type TiendaParaEquipo,
} from '@paselibre/contracts';
import { useEffect, useId, useState, type FormEvent } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';

import { botonPrincipal, botonSecundario, campo, etiqueta } from './estilos';

type Tipo = 'DUENO' | 'ASESOR' | 'INDEPENDIENTE';

const TIPOS: Array<[Tipo, string]> = [
  ['DUENO', 'Dueño de tienda'],
  ['ASESOR', 'Asesor'],
  ['INDEPENDIENTE', 'Independiente'],
];

/** «Tienda F» → «tiendaf»; para un asesor, «tiendaf.kevin». */
function sugerirUsuario(tipo: Tipo, tienda: string, persona: string): string {
  const compacto = (texto: string) => normalizarTexto(texto).replace(/ /g, '');
  if (tipo === 'ASESOR') {
    const primerNombre = normalizarTexto(persona).split(' ')[0] ?? '';
    return [compacto(tienda), primerNombre].filter(Boolean).join('.');
  }
  return compacto(tienda);
}

/**
 * Crear cuenta (RF-35, D-42), como el panel lateral del lienzo. El dueño y el
 * independiente crean su tienda; el asesor se suma a una que ya existe.
 */
export function FormularioCuenta({
  alCrear,
  alCancelar,
}: {
  alCrear: (acceso: RespuestaAcceso) => void;
  alCancelar: () => void;
}) {
  const id = useId();
  const [tipo, setTipo] = useState<Tipo>('DUENO');
  const [tiendaNombre, setTiendaNombre] = useState('');
  const [tiendaId, setTiendaId] = useState('');
  const [galeria, setGaleria] = useState('');
  const [stand, setStand] = useState('');
  const [whatsappTienda, setWhatsappTienda] = useState('');
  const [nombre, setNombre] = useState('');
  const [usuario, setUsuario] = useState('');
  const [usuarioEditado, setUsuarioEditado] = useState(false);
  const [whatsappPersona, setWhatsappPersona] = useState('');
  const [correo, setCorreo] = useState('');
  const [galerias, setGalerias] = useState<GaleriaResumen[]>([]);
  const [tiendas, setTiendas] = useState<TiendaParaEquipo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sugerencia, setSugerencia] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    void llamarApi<GaleriaResumen[]>('/galerias').then((lista) =>
      setGalerias(lista.filter((g) => g.slug !== 'independientes')),
    );
    void llamarApi<TiendaParaEquipo[]>('/equipo/tiendas').then(setTiendas);
  }, []);

  const tiendaElegida = tiendas.find((t) => t.id === tiendaId);
  const usuarioSugerido = sugerirUsuario(
    tipo,
    tipo === 'ASESOR' ? (tiendaElegida?.nombre ?? '') : tiendaNombre,
    nombre,
  );
  const usuarioFinal = usuarioEditado ? usuario : usuarioSugerido;

  async function crear(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setEnviando(true);
    setError(null);
    setSugerencia(null);
    const cuerpo =
      tipo === 'ASESOR'
        ? {
            tipo,
            tienda_id: tiendaId || undefined,
            nombre,
            usuario: usuarioFinal,
            correo,
            whatsapp: whatsappPersona || undefined,
          }
        : {
            tipo,
            nombre,
            usuario: usuarioFinal,
            correo,
            tienda: {
              nombre: tiendaNombre,
              galeria: galeria || null,
              stand,
              whatsapp: whatsappTienda,
            },
          };
    try {
      alCrear(await llamarApi<RespuestaAcceso>('/equipo/cuentas', { metodo: 'POST', cuerpo }));
    } catch (e) {
      if (e instanceof ErrorApi) {
        setError(e.message);
        if (e.codigo === 'CONFLICTO' && typeof e.detalles?.sugerencia === 'string')
          setSugerencia(e.detalles.sugerencia);
      } else {
        setError('No pudimos crear la cuenta.');
      }
      setEnviando(false);
    }
  }

  return (
    <form onSubmit={crear} className="flex flex-col gap-4">
      {error && (
        <div
          role="alert"
          className="flex flex-col gap-2 rounded-xl bg-error-fondo px-3.5 py-3 text-apoyo text-error"
        >
          {error}
          {sugerencia && (
            <button
              type="button"
              className="self-start font-medium underline"
              onClick={() => {
                setUsuario(sugerencia);
                setUsuarioEditado(true);
                setError(null);
                setSugerencia(null);
              }}
            >
              Usar «{sugerencia}»
            </button>
          )}
        </div>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-apoyo font-medium">Tipo de cuenta</legend>
        <div
          role="radiogroup"
          aria-label="Tipo de cuenta"
          className="inline-flex self-start rounded-full bg-superficie p-1"
        >
          {TIPOS.map(([valor, texto]) => (
            <button
              key={valor}
              type="button"
              role="radio"
              aria-checked={tipo === valor}
              onClick={() => setTipo(valor)}
              className={`h-9 rounded-full border px-3.5 text-apoyo ${
                tipo === valor
                  ? 'border-borde bg-white font-semibold'
                  : 'border-transparent font-medium'
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
      </fieldset>

      {tipo === 'ASESOR' ? (
        <label htmlFor={`${id}-1`} className={etiqueta}>
          Tienda a la que pertenece
          <select
            id={`${id}-1`}
            required
            value={tiendaId}
            onChange={(e) => setTiendaId(e.target.value)}
            className={campo}
          >
            <option value="">Elige la tienda</option>
            {tiendas.map((t) => (
              <option key={t.id} value={t.id}>
                {[t.nombre, t.galeria, t.stand && `Stand ${t.stand}`].filter(Boolean).join(' · ')}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <>
          <label htmlFor={`${id}-2`} className={etiqueta}>
            {tipo === 'INDEPENDIENTE' ? 'Nombre que verán los vendedores' : 'Nombre de la tienda'}
            <input
              id={`${id}-2`}
              required
              value={tiendaNombre}
              onChange={(e) => setTiendaNombre(e.target.value)}
              className={campo}
            />
          </label>
          <div className="grid grid-cols-[minmax(0,1fr)_140px] gap-3">
            <label htmlFor={`${id}-3`} className={etiqueta}>
              Galería
              <select
                id={`${id}-3`}
                required={tipo === 'DUENO'}
                value={galeria}
                onChange={(e) => setGaleria(e.target.value)}
                className={campo}
              >
                <option value="">{tipo === 'DUENO' ? 'Elige la galería' : 'Sin galería'}</option>
                {galerias.map((g) => (
                  <option key={g.slug} value={g.slug}>
                    {g.nombre}
                  </option>
                ))}
              </select>
            </label>
            <label htmlFor={`${id}-4`} className={etiqueta}>
              Stand
              <input
                id={`${id}-4`}
                value={stand}
                onChange={(e) => setStand(e.target.value)}
                className={campo}
              />
            </label>
          </div>
          <label htmlFor={`${id}-5`} className={etiqueta}>
            WhatsApp de la tienda
            <input
              id={`${id}-5`}
              required
              type="tel"
              inputMode="tel"
              placeholder="987 654 321"
              value={whatsappTienda}
              onChange={(e) => setWhatsappTienda(e.target.value)}
              className={campo}
            />
          </label>
        </>
      )}

      <label htmlFor={`${id}-6`} className={etiqueta}>
        Persona a cargo
        <input
          id={`${id}-6`}
          required
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className={campo}
        />
      </label>
      <label htmlFor={`${id}-7`} className={etiqueta}>
        Usuario para ingresar
        <input
          id={`${id}-7`}
          required
          autoCapitalize="none"
          spellCheck={false}
          value={usuarioFinal}
          onChange={(e) => {
            setUsuario(e.target.value);
            setUsuarioEditado(true);
          }}
          className={`${campo} font-mono text-apoyo`}
        />
        <span className="text-nota font-normal text-detalle">
          Se arma solo con el nombre; puedes cambiarlo.
        </span>
      </label>
      {tipo === 'ASESOR' && (
        <label htmlFor={`${id}-8`} className={etiqueta}>
          <span>
            WhatsApp del asesor <span className="font-normal text-detalle">(opcional)</span>
          </span>
          <input
            id={`${id}-8`}
            type="tel"
            inputMode="tel"
            placeholder="987 654 321"
            value={whatsappPersona}
            onChange={(e) => setWhatsappPersona(e.target.value)}
            className={campo}
          />
        </label>
      )}
      <label htmlFor={`${id}-9`} className={etiqueta}>
        <span>
          Correo <span className="font-normal text-detalle">(opcional)</span>
        </span>
        <input
          id={`${id}-9`}
          type="email"
          placeholder="Para avisos por correo más adelante"
          value={correo}
          onChange={(e) => setCorreo(e.target.value)}
          className={campo}
        />
      </label>
      <p className="text-nota text-detalle">
        PaseLibre genera una contraseña temporal. Al entrar por primera vez, la persona crea la
        suya.
      </p>
      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={enviando} className={botonPrincipal}>
          {enviando ? 'Creando…' : 'Crear cuenta'}
        </button>
        <button type="button" onClick={alCancelar} className={botonSecundario}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
