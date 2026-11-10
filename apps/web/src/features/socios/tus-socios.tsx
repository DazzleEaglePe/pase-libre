'use client';

import {
  formatearPrecio,
  type Precio,
  type RespuestaSocios,
  type TiendaBreve,
} from '@paselibre/contracts';
import { IconCheck, IconSearch, IconUsers, IconX } from '@tabler/icons-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';
import { Interruptor } from '@/shared/ui/interruptor';

const MES = new Intl.DateTimeFormat('es-PE', {
  timeZone: 'America/Lima',
  month: 'short',
  year: 'numeric',
});
const desde = (iso: string) => `Socio desde ${MES.format(new Date(iso)).replace('.', '')}`;

/** «S/ 10 · US$ 3 menos». */
function textoDescuento(descuento: { PEN: Precio | null; USD: Precio | null }): string | null {
  const partes = [descuento.PEN, descuento.USD]
    .filter((precio): precio is Precio => precio !== null)
    .map(formatearPrecio);
  return partes.length > 0 ? `${partes.join(' · ')} menos` : null;
}

const OPCIONES: Record<'PEN' | 'USD', number[]> = { PEN: [5, 10, 20], USD: [1, 3, 5] };

function Avatar({ iniciales, oscuro = false }: { iniciales: string; oscuro?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-nota font-bold ${
        oscuro ? 'bg-white/15 text-white' : 'bg-tinta text-white'
      }`}
    >
      {iniciales}
    </span>
  );
}

/**
 * Tus socios (PS_SociosWeb): tiendas amigas, familia o de confianza que ven tu precio socio.
 * Agregar con el buscador (y avisarle o no), quitar sin que se entere, el descuento por defecto
 * por moneda y las tiendas que te tienen a ti como socia.
 */
export function TusSocios() {
  const [datos, setDatos] = useState<RespuestaSocios | null>(null);
  const [q, setQ] = useState('');
  const [encontradas, setEncontradas] = useState<TiendaBreve[]>([]);
  const [avisar, setAvisar] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    llamarApi<RespuestaSocios>('/socios').then(setDatos, () =>
      setError('No pudimos cargar tus socios.'),
    );
  }, []);

  useEffect(() => {
    const texto = q.trim();
    if (texto.length < 2) {
      setEncontradas([]);
      return;
    }
    const espera = setTimeout(() => {
      llamarApi<TiendaBreve[]>(`/tiendas/buscar?q=${encodeURIComponent(texto)}`).then(
        setEncontradas,
        () => setEncontradas([]),
      );
    }, 250);
    return () => clearTimeout(espera);
  }, [q]);

  async function cambiar(promesa: Promise<RespuestaSocios>) {
    setError(null);
    try {
      setDatos(await promesa);
    } catch (falla) {
      setError(falla instanceof ErrorApi ? falla.message : 'No pudimos guardar el cambio.');
    }
  }

  const agregar = (tienda: TiendaBreve) =>
    cambiar(
      llamarApi<RespuestaSocios>('/socios', {
        metodo: 'POST',
        cuerpo: { tienda_id: tienda.id, avisar },
      }),
    );
  const quitar = (tienda: TiendaBreve) =>
    cambiar(llamarApi<RespuestaSocios>(`/socios/${tienda.id}`, { metodo: 'DELETE' }));
  const guardarDescuento = (moneda: 'PEN' | 'USD', centimos: number | null) => {
    if (!datos) return;
    const actual = datos.descuento_defecto;
    const valor = (precio: Precio | null) => (precio ? String(precio.centimos / 100) : '');
    const cuerpo = {
      PEN: moneda === 'PEN' ? (centimos === null ? '' : String(centimos / 100)) : valor(actual.PEN),
      USD: moneda === 'USD' ? (centimos === null ? '' : String(centimos / 100)) : valor(actual.USD),
    };
    void cambiar(llamarApi<RespuestaSocios>('/socios/descuento', { metodo: 'PUT', cuerpo }));
  };

  const misIds = new Set(datos?.mis_socios.map((socio) => socio.id) ?? []);
  const sugeridas = encontradas.filter((tienda) => !misIds.has(tienda.id));
  const defecto = datos ? textoDescuento(datos.descuento_defecto) : null;

  return (
    <div className="flex flex-col gap-5">
      <nav aria-label="Ruta" className="flex gap-2 text-nota text-detalle">
        <Link href="/cuenta/configuracion" className="text-secundario">
          Tu cuenta
        </Link>
        <span aria-hidden="true">›</span>
        <span>Socios</span>
      </nav>
      <div className="flex flex-col gap-1">
        <h1 className="text-titulo">Tus socios</h1>
        <p className="m-0 text-secundario">
          Tiendas amigas, familia o de confianza. Ven tu{' '}
          <b className="font-bold text-tinta">precio socio</b>: un poco menos que el de pase.
        </p>
      </div>
      <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-2 rounded-2xl border border-linea px-4 py-3 text-apoyo">
        {[
          'Solo tus socios ven su precio especial',
          'Las demás tiendas no ven esta lista',
          'Puedes quitar a alguien cuando quieras; no se le avisa',
        ].map((texto) => (
          <li key={texto} className="flex items-center gap-2">
            <IconCheck size={16} stroke={2.2} aria-hidden="true" className="text-pase" />
            {texto}
          </li>
        ))}
      </ul>
      {error && (
        <p role="alert" className="m-0 text-apoyo text-error">
          {error}
        </p>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
        <section className="flex flex-col rounded-[20px] border border-linea p-5">
          <div className="flex items-center justify-between gap-3 border-b border-linea pb-3">
            <h2 className="text-tarjeta font-bold">
              Tus socios · {datos?.mis_socios.length ?? 0}{' '}
              {(datos?.mis_socios.length ?? 0) === 1 ? 'socio' : 'socios'}
            </h2>
            <span className="flex items-center gap-1 rounded-full bg-marca px-2.5 text-nota font-bold leading-6 text-white">
              <IconUsers size={14} stroke={2} aria-hidden="true" />
              Socio
            </span>
          </div>
          {datos === null ? (
            <p className="py-4 text-secundario">Cargando…</p>
          ) : datos.mis_socios.length === 0 ? (
            <p className="py-6 text-secundario">
              Todavía no agregas a nadie. Búscala a la derecha por su nombre o su stand.
            </p>
          ) : (
            <ul className="m-0 list-none p-0">
              {datos.mis_socios.map((socio) => (
                <li
                  key={socio.id}
                  className="flex items-center gap-3 border-b border-linea py-3.5 last:border-0"
                >
                  <Avatar iniciales={socio.iniciales} />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b className="font-bold">{socio.nombre}</b>
                    <span className="text-nota text-secundario">
                      {[socio.galeria, socio.stand && `Stand ${socio.stand}`, desde(socio.desde)]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                  </span>
                  {defecto && (
                    <span className="rounded-full bg-pase-suave px-2.5 text-nota font-bold leading-6 text-marca max-sm:hidden">
                      {defecto}
                    </span>
                  )}
                  <button
                    type="button"
                    aria-label={`Quitar a ${socio.nombre} de tus socios`}
                    onClick={() => void quitar(socio)}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-borde"
                  >
                    <IconX size={16} stroke={2} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-3 rounded-[20px] border border-linea p-5">
            <h2 className="text-tarjeta font-bold">Agregar socio</h2>
            <label className="flex h-12 items-center gap-2 rounded-full border border-borde px-4 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-tinta">
              <IconSearch size={18} stroke={1.8} aria-hidden="true" />
              <span className="sr-only">Buscar tienda</span>
              <input
                value={q}
                onChange={(evento) => setQ(evento.target.value)}
                placeholder="Busca por nombre de tienda o stand"
                className="h-full min-w-0 flex-1 bg-transparent outline-none"
              />
            </label>
            {sugeridas.map((tienda) => (
              <div key={tienda.id} className="flex items-center gap-3">
                <Avatar iniciales={tienda.iniciales} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <b className="font-bold">{tienda.nombre}</b>
                  <span className="text-nota text-secundario">
                    {[tienda.galeria, tienda.stand && `Stand ${tienda.stand}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => void agregar(tienda)}
                  className="h-10 shrink-0 rounded-full bg-tinta px-4 text-apoyo font-bold text-white"
                >
                  + Agregar
                </button>
              </div>
            ))}
            <div className="flex items-center justify-between gap-3 pt-1">
              <span className="flex flex-col">
                <b className="text-apoyo font-bold">Avisarle que lo agregaste</b>
                <span className="text-nota text-secundario">
                  Le llega: «Tu tienda te agregó como socio»
                </span>
              </span>
              <Interruptor
                etiqueta="Avisarle que lo agregaste"
                activo={avisar}
                alCambiar={setAvisar}
              />
            </div>
          </section>

          {datos && (
            <section className="flex flex-col gap-3 rounded-[20px] border border-linea p-5">
              <h2 className="text-tarjeta font-bold">Descuento por defecto</h2>
              <p className="m-0 text-nota text-secundario">
                Se pone solo al publicar. Puedes cambiarlo en cada publicación con «Otro monto».
              </p>
              {(['PEN', 'USD'] as const).map((moneda) => {
                const actual = datos.descuento_defecto[moneda]?.centimos ?? null;
                const simbolo = moneda === 'PEN' ? 'S/' : 'US$';
                return (
                  <div key={moneda} className="flex flex-col gap-2">
                    <b className="text-apoyo font-bold">
                      {moneda === 'PEN' ? 'Si el precio está en soles' : 'Si está en dólares'}
                    </b>
                    <div className="flex flex-wrap gap-2">
                      {OPCIONES[moneda].map((unidades) => {
                        const elegido = actual === unidades * 100;
                        return (
                          <button
                            key={unidades}
                            type="button"
                            aria-pressed={elegido}
                            onClick={() =>
                              guardarDescuento(moneda, elegido ? null : unidades * 100)
                            }
                            className={`h-10 rounded-full border px-4 text-apoyo ${
                              elegido
                                ? 'border-tinta bg-tinta font-bold text-white'
                                : 'border-borde bg-white font-medium'
                            }`}
                          >
                            {simbolo} {unidades} menos
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </section>
          )}

          {datos && datos.me_tienen.length > 0 && (
            <section className="flex flex-col gap-3 rounded-[20px] bg-tinta p-5 text-white">
              <div className="flex flex-col">
                <h2 className="text-tarjeta font-bold">Te tienen como socio</h2>
                <span className="text-nota text-white/80">
                  En sus productos ves su precio socio.
                </span>
              </div>
              {datos.me_tienen.map((tienda) => (
                <div
                  key={tienda.id}
                  className="flex items-center gap-3 border-t border-white/15 pt-3"
                >
                  <Avatar iniciales={tienda.iniciales} oscuro />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <b className="font-bold">{tienda.nombre}</b>
                    <span className="text-nota text-white/80">
                      {textoDescuento(tienda.descuento)
                        ? `Te da ${textoDescuento(tienda.descuento)}`
                        : 'Te muestra lo que publica solo para socios'}
                    </span>
                  </span>
                  <Link href={`/tiendas/${tienda.id}`} className="text-nota font-bold text-acento">
                    Ver productos ›
                  </Link>
                </div>
              ))}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
