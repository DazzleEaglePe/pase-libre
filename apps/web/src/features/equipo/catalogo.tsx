'use client';

import type {
  ArchivoSubido,
  CategoriaResumen,
  ModoExistentes,
  ProductoDelCatalogo,
  ProductoPorRevisar,
  ProductoQueYaEsta,
  RespuestaCatalogoEquipo,
  RespuestaEliminarCatalogo,
  RespuestaImportacion,
  RespuestaPorRevisar,
  ResumenEliminarCatalogo,
  RevisionImportacion,
} from '@paselibre/contracts';
import {
  IconArrowRight,
  IconCamera,
  IconCornerDownRight,
  IconFileSpreadsheet,
  IconPlus,
  IconSearch,
  IconTrash,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';

import { ErrorApi, llamarApi, subirConAvance, subirFoto } from '@/shared/api/cliente';
import { haceRato } from '@/shared/fechas';
import { conPlural } from '@/shared/plural';
import { campo, etiqueta } from '@/shared/ui/estilos';
import { Miniatura } from '@/shared/ui/miniatura';
import { Ventana } from '@/shared/ui/ventana';

import { avisoDePeso, faltanUnos, lineasDeMotivos, peso, porcentaje } from './subida-catalogo';

type Pestana = 'productos' | 'revisar' | 'excel' | 'agregar';

const botonVerde =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full bg-pase px-5 text-apoyo font-bold text-white no-underline disabled:bg-borde disabled:text-detalle';
const botonBorde =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full border border-tinta bg-white px-5 text-apoyo font-bold text-tinta no-underline';
const botonRojo =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full bg-error px-5 text-apoyo font-bold text-white no-underline disabled:bg-borde disabled:text-detalle';
const botonRojoBorde =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full border border-error bg-white px-5 text-apoyo font-bold text-error no-underline';

function useCategorias(): CategoriaResumen[] {
  const [categorias, setCategorias] = useState<CategoriaResumen[]>([]);
  useEffect(() => {
    void llamarApi<CategoriaResumen[]>('/categorias').then(setCategorias, () => undefined);
  }, []);
  return categorias;
}

function Mensaje({ tipo, children }: { tipo: 'ok' | 'error'; children: ReactNode }) {
  return (
    <p
      role={tipo === 'error' ? 'alert' : 'status'}
      className={`m-0 rounded-xl px-3.5 py-2.5 text-apoyo ${
        tipo === 'error' ? 'bg-error-fondo text-error' : 'bg-pase-suave font-semibold text-marca'
      }`}
    >
      {children}
    </p>
  );
}

/** La píldora de la versión: «OC» en negro, «Normal» con borde. */
function Version({ texto }: { texto: string }) {
  const normal = /^normal$/i.test(texto);
  return (
    <span
      className={`shrink-0 rounded-full px-2 text-[11px] font-bold leading-5 ${
        normal ? 'border border-borde text-tinta' : 'bg-tinta text-white'
      }`}
    >
      {texto}
    </span>
  );
}

// ── Editar ─────────────────────────────────────────────────────────────────

interface Editable {
  id: string;
  titulo: string;
  categoria: string;
  marca: string;
  modelo: string;
  version: string;
  codigo_parte: string;
  sinonimos: string;
  /** Sus fotos, la principal primero; nulo cuando no se editan (lo publicado a mano). */
  fotos: string[] | null;
  /** Publicaciones que lo usan: con alguna, «¿Estás seguro?» antes de guardar (docs/17 §2). */
  publicaciones: number;
  /** Desde «Por revisar», guardar también lo agrega al catálogo. */
  porRevisar: boolean;
}

/** Las fotos del producto: subir, quitar y elegir la principal (la portada). */
function FotosDelProducto({
  fotos,
  categoria,
  alCambiar,
  alError,
}: {
  fotos: string[];
  categoria: string;
  alCambiar: (fotos: string[]) => void;
  alError: (mensaje: string) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  return (
    <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
      <legend className="mb-1 p-0 text-apoyo font-bold">Fotos</legend>
      <span className="text-nota text-secundario">
        La principal es la portada: sale primero en el catálogo y en las publicaciones.
      </span>
      <div className="flex flex-wrap gap-3">
        {fotos.map((ruta, indice) => (
          <span key={ruta} className="flex w-[88px] flex-col items-center gap-1">
            <span className="relative">
              <Miniatura
                ruta={ruta}
                categoria={categoria}
                className={`h-[84px] w-[84px] rounded-[10px] border-2 ${
                  indice === 0 ? 'border-pase' : 'border-transparent'
                }`}
              />
              {indice === 0 && (
                <span className="absolute left-1 top-1 rounded-full bg-pase px-1.5 text-[10px] font-extrabold leading-4 text-white">
                  Principal
                </span>
              )}
            </span>
            {indice > 0 && (
              <button
                type="button"
                onClick={() => alCambiar([ruta, ...fotos.filter((f) => f !== ruta)])}
                className="text-[12px] font-bold text-pase-texto underline"
              >
                Hacer principal
              </button>
            )}
            <button
              type="button"
              aria-label={`Quitar la foto ${indice + 1}`}
              onClick={() => alCambiar(fotos.filter((f) => f !== ruta))}
              className="text-[12px] font-semibold text-error"
            >
              Quitar
            </button>
          </span>
        ))}
        {fotos.length < 8 && (
          <button
            type="button"
            disabled={subiendo}
            onClick={() => entrada.current?.click()}
            className="flex h-[84px] w-[84px] flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-borde-control text-[12px] text-secundario"
          >
            {subiendo ? (
              'Subiendo…'
            ) : (
              <>
                <IconPlus size={18} stroke={2} aria-hidden="true" />
                Subir foto
              </>
            )}
          </button>
        )}
      </div>
      <input
        ref={entrada}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        className="hidden"
        onChange={async (e) => {
          const foto = e.target.files?.[0];
          e.target.value = '';
          if (!foto) return;
          setSubiendo(true);
          try {
            const subida = await subirFoto(foto);
            alCambiar([...fotos, subida.ruta]);
          } catch (er) {
            alError(er instanceof ErrorApi ? er.message : 'No pudimos subir la foto.');
          } finally {
            setSubiendo(false);
          }
        }}
      />
    </fieldset>
  );
}

function VentanaEditar({
  producto,
  alCerrar,
  alGuardar,
}: {
  producto: Editable | null;
  alCerrar: () => void;
  alGuardar: () => void;
}) {
  const categorias = useCategorias();
  const [datos, setDatos] = useState<Editable | null>(producto);
  const [error, setError] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  useEffect(() => {
    setDatos(producto);
    setError(null);
    setConfirmando(false);
  }, [producto]);

  const fotosCambiaron =
    Boolean(datos?.fotos && producto?.fotos) &&
    datos!.fotos!.join('|') !== producto!.fotos!.join('|');

  async function guardar() {
    if (!datos) return;
    setGuardando(true);
    setError(null);
    try {
      await llamarApi(`/equipo/catalogo/${datos.id}`, {
        metodo: 'PATCH',
        cuerpo: {
          categoria: datos.categoria,
          marca: datos.marca,
          modelo: datos.modelo,
          version: datos.version,
          codigo_parte: datos.codigo_parte,
          sinonimos: datos.sinonimos
            .split(/[;,]/)
            .map((s) => s.trim())
            .filter(Boolean),
          ...(fotosCambiaron && datos.fotos ? { fotos: datos.fotos } : {}),
        },
      });
      alGuardar();
    } catch (e) {
      setConfirmando(false);
      setError(e instanceof ErrorApi ? e.message : 'No pudimos guardar el producto.');
    } finally {
      setGuardando(false);
    }
  }

  function enviar(evento: FormEvent) {
    evento.preventDefault();
    if (!datos) return;
    // Si alguna tienda lo usa, se pregunta antes (docs/17 §2).
    if (datos.publicaciones > 0 && !datos.porRevisar) setConfirmando(true);
    else void guardar();
  }

  const cambio = (clave: keyof Editable) => (evento: { target: { value: string } }) =>
    datos && setDatos({ ...datos, [clave]: evento.target.value });

  return (
    <Ventana titulo="Corregir el producto" abierta={Boolean(producto)} alCerrar={alCerrar}>
      {datos && confirmando ? (
        <div role="alertdialog" aria-labelledby="titulo-seguro" className="flex flex-col gap-3.5">
          <h2 id="titulo-seguro" className="m-0 text-seccion">
            ¿Estás seguro?
          </h2>
          <p className="m-0 text-apoyo text-secundario">
            Se van a actualizar{' '}
            <b className="text-tinta">
              {datos.publicaciones === 1
                ? 'la publicación que usa'
                : `las ${datos.publicaciones} publicaciones que usan`}
            </b>{' '}
            este producto. Las tiendas que eligieron su propia portada la conservan.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={() => setConfirmando(false)} className={botonBorde}>
              Cancelar
            </button>
            <button
              type="button"
              disabled={guardando}
              onClick={() => void guardar()}
              className={botonVerde}
            >
              {guardando ? 'Guardando…' : 'Sí, guardar'}
            </button>
          </div>
        </div>
      ) : (
        datos && (
          <form onSubmit={enviar} className="flex flex-col gap-3.5">
            <p className="m-0 text-apoyo text-secundario">«{datos.titulo}»</p>
            {error && <Mensaje tipo="error">{error}</Mensaje>}
            <label className={etiqueta}>
              Categoría
              <select value={datos.categoria} onChange={cambio('categoria')} className={campo}>
                {categorias.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={etiqueta}>
                Marca
                <input value={datos.marca} onChange={cambio('marca')} className={campo} required />
              </label>
              <label className={etiqueta}>
                Modelo (familia)
                <input
                  value={datos.modelo}
                  onChange={cambio('modelo')}
                  className={campo}
                  required
                />
              </label>
              <label className={etiqueta}>
                Versión
                <input
                  value={datos.version}
                  onChange={cambio('version')}
                  className={campo}
                  placeholder="OC, Normal…"
                />
              </label>
              <label className={etiqueta}>
                Código de parte
                <input
                  value={datos.codigo_parte}
                  onChange={cambio('codigo_parte')}
                  className={`${campo} font-mono`}
                />
              </label>
            </div>
            <label className={etiqueta}>
              Sinónimos (opcional)
              <input
                value={datos.sinonimos}
                onChange={cambio('sinonimos')}
                className={campo}
                placeholder="5070 tuf, tuf 5070"
              />
            </label>
            {datos.fotos && (
              <FotosDelProducto
                fotos={datos.fotos}
                categoria={datos.categoria}
                alCambiar={(fotos) => setDatos({ ...datos, fotos })}
                alError={setError}
              />
            )}
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={guardando} className={botonVerde}>
                {guardando ? 'Guardando…' : datos.porRevisar ? 'Guardar y agregar' : 'Guardar'}
              </button>
              <button type="button" onClick={alCerrar} className={botonBorde}>
                Cancelar
              </button>
            </div>
          </form>
        )
      )}
    </Ventana>
  );
}

// ── Productos ──────────────────────────────────────────────────────────────

function Productos({ alEditar, recargar }: { alEditar: (p: Editable) => void; recargar: number }) {
  const categorias = useCategorias();
  const [q, setQ] = useState('');
  const [consulta, setConsulta] = useState('');
  const [categoria, setCategoria] = useState('');
  const [pagina, setPagina] = useState(1);
  const [datos, setDatos] = useState<RespuestaCatalogoEquipo | null>(null);

  useEffect(() => {
    const reloj = setTimeout(() => setConsulta(q), 300);
    return () => clearTimeout(reloj);
  }, [q]);

  useEffect(() => {
    const parametros = new URLSearchParams({ q: consulta, categoria, pagina: String(pagina) });
    void llamarApi<RespuestaCatalogoEquipo>(`/equipo/catalogo?${parametros.toString()}`).then(
      setDatos,
      () => undefined,
    );
  }, [consulta, categoria, pagina, recargar]);

  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-linea bg-white p-3 sm:p-4">
      <div className="flex flex-wrap gap-2">
        <label className="flex h-11 min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-borde px-3">
          <IconSearch size={17} stroke={1.8} aria-hidden="true" className="text-secundario" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPagina(1);
            }}
            placeholder="Buscar en el catálogo (también con errores: «gigabte 4060»)"
            aria-label="Buscar en el catálogo"
            className="h-full min-w-0 flex-1 bg-transparent text-apoyo outline-none"
          />
        </label>
        <select
          aria-label="Categoría"
          value={categoria}
          onChange={(e) => {
            setCategoria(e.target.value);
            setPagina(1);
          }}
          className="h-11 rounded-xl border border-borde bg-white px-3 text-apoyo"
        >
          <option value="">Todas las categorías</option>
          {categorias.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.nombre}
            </option>
          ))}
        </select>
      </div>
      {/* Doc 20 §11: el mismo buscador de arriba, con lo que entendió o corrigió. */}
      {datos && datos.productos.length > 0 && datos.lo_mas_parecido && (
        <p className="m-0 font-semibold">No hay uno igual. Lo más parecido:</p>
      )}
      {datos && datos.productos.length > 0 && !datos.lo_mas_parecido && datos.correccion && (
        <p className="m-0 text-apoyo text-secundario">
          Mostramos resultados para «{datos.correccion.mostramos}»
          {datos.correccion.categoria &&
          datos.correccion.categoria.nombre !== datos.correccion.mostramos
            ? ` en ${datos.correccion.categoria.nombre}`
            : ''}
          .
        </p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left text-apoyo">
          <thead>
            <tr className="text-[11px] font-bold uppercase tracking-[0.06em] text-secundario">
              <th className="px-2 py-2.5">Producto</th>
              <th className="px-2 py-2.5">Categoría</th>
              <th className="px-2 py-2.5">Código de parte</th>
              <th className="px-2 py-2.5 text-right">Fotos</th>
              <th className="px-2 py-2.5 text-right">Tiendas</th>
              <th className="px-2 py-2.5">
                <span className="sr-only">Editar</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {!datos ? (
              <tr>
                <td colSpan={6} className="px-2 py-6 text-secundario">
                  Cargando…
                </td>
              </tr>
            ) : datos.productos.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-2 py-6 text-secundario">
                  No hay productos con eso. Prueba con otras palabras o agrégalo.
                </td>
              </tr>
            ) : (
              datos.productos.map((p: ProductoDelCatalogo) => (
                <tr key={p.id} className="border-t border-linea">
                  <td className="px-2 py-2">
                    <span className="flex items-center gap-3">
                      <Miniatura
                        ruta={p.foto}
                        categoria={p.categoria.slug}
                        className="h-9 w-10 shrink-0 rounded-lg border border-linea"
                        glifo={30}
                        grosor={4}
                      />
                      <Link
                        href={`/p/${p.slug}`}
                        className="font-bold text-tinta no-underline hover:underline"
                      >
                        {/* Sin expresión regular: «Box (con disipador)» trae paréntesis. */}
                        {p.version && p.titulo.endsWith(` ${p.version}`)
                          ? p.titulo.slice(0, -(p.version.length + 1))
                          : p.titulo}
                      </Link>
                      {p.version && <Version texto={p.version} />}
                    </span>
                  </td>
                  <td className="px-2 py-2">{p.categoria.nombre}</td>
                  <td className="px-2 py-2 font-mono text-nota">{p.codigo_parte ?? '—'}</td>
                  <td className="px-2 py-2 text-right">{p.fotos}</td>
                  <td className="px-2 py-2 text-right">{p.tiendas}</td>
                  <td className="px-2 py-2 text-right">
                    <button
                      type="button"
                      onClick={() =>
                        alEditar({
                          id: p.id,
                          titulo: p.titulo,
                          categoria: p.categoria.slug,
                          marca: p.marca ?? '',
                          modelo: p.modelo ?? '',
                          version: p.version ?? '',
                          codigo_parte: p.codigo_parte ?? '',
                          sinonimos: p.sinonimos.join(', '),
                          fotos: p.rutas_fotos,
                          publicaciones: p.publicaciones,
                          porRevisar: false,
                        })
                      }
                      className="font-bold text-pase-texto"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {datos && datos.paginas > 1 && (
        <div className="flex items-center justify-between gap-2 text-apoyo">
          <span className="text-secundario">
            Página {datos.pagina} de {datos.paginas}
          </span>
          <span className="flex gap-2">
            <button
              type="button"
              disabled={pagina <= 1}
              onClick={() => setPagina(pagina - 1)}
              className={botonBorde}
            >
              Anterior
            </button>
            <button
              type="button"
              disabled={pagina >= datos.paginas}
              onClick={() => setPagina(pagina + 1)}
              className={botonBorde}
            >
              Siguiente
            </button>
          </span>
        </div>
      )}
    </section>
  );
}

// ── Por revisar ────────────────────────────────────────────────────────────

function PorRevisar({
  alEditar,
  alCambiar,
  recargar,
}: {
  alEditar: (p: Editable) => void;
  alCambiar: () => void;
  recargar: number;
}) {
  const [datos, setDatos] = useState<RespuestaPorRevisar | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [trabajando, setTrabajando] = useState<string | null>(null);
  const cargar = useCallback(() => {
    void llamarApi<RespuestaPorRevisar>('/equipo/catalogo/por-revisar').then(
      setDatos,
      () => undefined,
    );
  }, []);
  useEffect(cargar, [cargar, recargar]);

  async function hacer(id: string, ruta: string, cuerpo?: object) {
    setTrabajando(id);
    setError(null);
    try {
      await llamarApi(ruta, { metodo: 'POST', ...(cuerpo ? { cuerpo } : {}) });
      cargar();
      alCambiar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos hacerlo. Vuelve a intentarlo.');
    } finally {
      setTrabajando(null);
    }
  }

  if (!datos) return <p className="text-secundario">Cargando…</p>;
  return (
    <div className="flex flex-col gap-3">
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {datos.productos.length === 0 && (
        <p className="m-0 rounded-[20px] border border-linea bg-white px-5 py-6 text-secundario">
          Nada por revisar: todo lo que publicaron a mano ya está en el catálogo.
        </p>
      )}
      {datos.productos.map((p: ProductoPorRevisar) => (
        <article
          key={p.id}
          className="flex flex-col gap-3 rounded-[20px] border border-linea bg-white p-4"
        >
          <span className="text-nota text-secundario">
            Publicado a mano por <b className="text-tinta">{p.tienda ?? 'una tienda'}</b> ·{' '}
            {haceRato(p.creado_en).toLowerCase()}
          </span>
          <div className="grid items-center gap-3 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
            <div className="flex flex-col gap-0.5 rounded-xl bg-superficie px-3.5 py-3">
              <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-secundario">
                Lo que escribió
              </span>
              <b className="text-cuerpo">«{p.titulo}»</b>
            </div>
            <IconArrowRight
              size={18}
              stroke={1.8}
              aria-hidden="true"
              className="justify-self-center text-secundario max-md:rotate-90"
            />
            {p.sugerido ? (
              <div className="flex flex-col gap-0.5 rounded-xl border border-[#A7E3C3] bg-pase-suave px-3.5 py-3">
                <span className="text-[11px] font-bold uppercase tracking-[0.06em] text-pase-texto">
                  ¿Es este? ·{' '}
                  {p.sugerido.razon === 'MISMO_CODIGO' ? 'mismo código' : 'muy parecido'}
                </span>
                <b className="text-cuerpo">{p.sugerido.titulo}</b>
                {p.sugerido.codigo_parte && (
                  <span className="font-mono text-nota text-secundario">
                    {p.sugerido.codigo_parte}
                  </span>
                )}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-borde px-3.5 py-3 text-apoyo text-secundario">
                No se parece a nada del catálogo: parece nuevo.
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {p.sugerido && (
              <button
                type="button"
                disabled={trabajando === p.id}
                onClick={() =>
                  p.sugerido &&
                  void hacer(p.id, `/equipo/catalogo/${p.id}/unir`, { con: p.sugerido.id })
                }
                className={botonVerde}
              >
                <IconCornerDownRight size={16} stroke={2} aria-hidden="true" />
                Unir con este
              </button>
            )}
            <button
              type="button"
              disabled={trabajando === p.id}
              onClick={() => void hacer(p.id, `/equipo/catalogo/${p.id}/aprobar`)}
              className={botonBorde}
            >
              Es nuevo: agregarlo
            </button>
            <button
              type="button"
              onClick={() =>
                alEditar({
                  id: p.id,
                  titulo: p.titulo,
                  categoria: p.categoria.slug,
                  marca: p.marca ?? '',
                  modelo: p.modelo ?? '',
                  version: p.version ?? '',
                  codigo_parte: p.codigo_parte ?? '',
                  sinonimos: '',
                  fotos: null,
                  publicaciones: 0,
                  porRevisar: true,
                })
              }
              className="h-11 px-3 text-apoyo font-bold text-secundario"
            >
              Corregir y agregar
            </button>
          </div>
        </article>
      ))}
      {datos.duplicados.length > 0 && (
        <section className="flex flex-col gap-3 rounded-[20px] border border-linea bg-white p-4">
          <span className="text-nota text-secundario">
            Posibles duplicados · el sistema nunca une productos con códigos distintos
          </span>
          {datos.duplicados.map((par) => (
            <div key={`${par.a.titulo}-${par.b.titulo}`} className="flex flex-col gap-2">
              <div className="grid items-center gap-2 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
                {[par.a, par.b].map((lado, i) => (
                  <div
                    key={i}
                    className={`flex flex-col rounded-xl bg-superficie px-3.5 py-2.5 ${i === 1 ? 'md:order-3' : ''}`}
                  >
                    <b className="text-apoyo">{lado.titulo}</b>
                    <span className="font-mono text-nota text-secundario">{lado.codigo_parte}</span>
                  </div>
                ))}
                <span aria-hidden="true" className="justify-self-center font-bold md:order-2">
                  ≠
                </span>
              </div>
              <span className="self-start rounded-full bg-ambar px-2.5 py-1 text-nota font-bold text-ambar-texto">
                Códigos distintos: son versiones distintas, se quedan separadas
              </span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

// ── Subir archivo ──────────────────────────────────────────────────────────

/** Las tres opciones para los que ya están (docs/17 §3). */
const OPCIONES_EXISTENTES: Array<{ modo: ModoExistentes; titulo: string; detalle: string }> = [
  { modo: 'DEJAR', titulo: 'Dejarlos como están', detalle: '' },
  {
    modo: 'SOLO_FOTOS',
    titulo: 'Reemplazar solo las fotos',
    detalle: 'Nombre, versión y código no cambian.',
  },
  {
    modo: 'FOTOS_Y_DATOS',
    titulo: 'Reemplazar fotos y datos',
    detalle: 'Todo lo del archivo: foto, nombre, versión (OC, Ti, Super…), categoría y sinónimos.',
  },
];

/** Lo que el modo elegido le haría a un producto que ya está. */
function loQueCambia(p: ProductoQueYaEsta, modo: ModoExistentes): boolean {
  if (modo === 'DEJAR') return false;
  if (modo === 'SOLO_FOTOS') return Boolean(p.foto_nueva);
  return Boolean(p.foto_nueva) || p.cambios.length > 0;
}

/** Una fila de «Lo que cambia»: la foto de antes → la nueva y los datos resaltados. */
function FilaQueCambia({
  producto,
  modo,
  marcada,
  alMarcar,
}: {
  producto: ProductoQueYaEsta;
  modo: ModoExistentes;
  marcada: boolean;
  alMarcar: (marcada: boolean) => void;
}) {
  return (
    <label className="grid cursor-pointer grid-cols-[20px_auto_minmax(0,1fr)] items-center gap-3 border-t border-linea px-3.5 py-2.5">
      <input
        type="checkbox"
        checked={marcada}
        onChange={(e) => alMarcar(e.target.checked)}
        className="h-[18px] w-[18px] accent-pase"
      />
      <span className="flex items-center gap-1.5">
        <Miniatura
          ruta={producto.foto_antes}
          categoria=""
          className="h-11 w-11 rounded-lg"
          glifo={26}
        />
        {producto.foto_nueva && (
          <>
            <IconArrowRight size={14} stroke={2.4} aria-hidden="true" className="text-detalle" />
            <Miniatura
              ruta={producto.foto_nueva}
              categoria=""
              className="h-11 w-11 rounded-lg"
              glifo={26}
            />
          </>
        )}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="flex flex-wrap items-baseline gap-x-2">
          <b className="text-apoyo">{producto.titulo}</b>
          <span className="font-mono text-[12px] text-detalle">
            {producto.codigo_parte ?? 'sin código'}
          </span>
        </span>
        <span className="flex flex-wrap gap-x-3 gap-y-1 text-nota text-secundario">
          {producto.foto_nueva && <span>Foto: nueva</span>}
          {modo === 'FOTOS_Y_DATOS' &&
            producto.cambios.map((c) => (
              <span key={c.campo}>
                {c.campo}: {c.antes} →{' '}
                <b className="rounded bg-ambar px-1 text-tinta">{c.despues}</b>
              </span>
            ))}
          {producto.publicaciones > 0 && (
            <span className="font-semibold text-aviso">
              {conPlural(producto.publicaciones, 'publicación', 'publicaciones')}
            </span>
          )}
        </span>
      </span>
    </label>
  );
}

/** Cómo va la subida del archivo (docs/18 §7). */
type Subida =
  | { fase: 'subiendo'; nombre: string; bytes: number; porcentaje: number; faltan: string | null }
  | { fase: 'revisando'; nombre: string; bytes: number }
  | { fase: 'cortada'; nombre: string; bytes: number; porcentaje: number };

/** La barra de 10 px: con `porcentaje`, el avance real; sin él, va y viene. */
function Barra({ porcentaje, color = '#22C47D' }: { porcentaje?: number; color?: string }) {
  const sabido = porcentaje !== undefined;
  return (
    <div
      role="progressbar"
      aria-label={sabido ? 'Avance de la subida' : 'Revisando el archivo'}
      aria-valuemin={sabido ? 0 : undefined}
      aria-valuemax={sabido ? 100 : undefined}
      aria-valuenow={sabido ? porcentaje : undefined}
      className="h-2.5 w-full overflow-hidden rounded-full bg-[#26302C]"
    >
      <div
        className={`h-full rounded-full ${sabido ? 'transition-[width] duration-200' : 'w-[35%] animate-ir-y-venir'}`}
        style={{ backgroundColor: color, ...(sabido ? { width: `${porcentaje}%` } : {}) }}
      />
    </div>
  );
}

/** «1 Subir · 2 Revisar filas»: el que va en naranja, el hecho con ✓. */
function PasosDeSubida({ fase }: { fase: 'subiendo' | 'revisando' }) {
  const circulo = (estado: 'activo' | 'hecho' | 'pendiente', numero: number) => (
    <span
      aria-hidden="true"
      className={`flex h-[18px] w-[18px] items-center justify-center rounded-full text-[11px] font-extrabold ${
        estado === 'activo'
          ? 'bg-[#F0A24A] text-[#1A1209]'
          : estado === 'hecho'
            ? 'bg-[#22C47D] text-[#08130E]'
            : 'bg-superficie text-detalle'
      }`}
    >
      {estado === 'hecho' ? '✓' : numero}
    </span>
  );
  return (
    <ol className="m-0 flex list-none items-center justify-center gap-2 p-0 text-nota">
      <li className="flex items-center gap-1.5">
        {circulo(fase === 'subiendo' ? 'activo' : 'hecho', 1)}
        Subir
      </li>
      <li
        className="flex items-center gap-1.5"
        aria-current={fase === 'revisando' ? 'step' : undefined}
      >
        {circulo(fase === 'revisando' ? 'activo' : 'pendiente', 2)}
        Revisar filas
      </li>
    </ol>
  );
}

/** Lo que se ve dentro del recuadro mientras sube, mientras se revisa y si se corta. */
function AvanceDeSubida({
  subida,
  alCancelar,
  alReintentar,
}: {
  subida: Subida;
  alCancelar: () => void;
  alReintentar: () => void;
}) {
  if (subida.fase === 'cortada') {
    return (
      <div className="flex w-full flex-col items-center gap-3">
        <b className="text-apoyo">{subida.nombre}</b>
        <Barra porcentaje={subida.porcentaje} color="#F0A24A" />
        <span role="alert" className="text-apoyo font-semibold text-aviso">
          Se cortó la subida. No se creó nada.
        </span>
        <button type="button" onClick={alReintentar} className={botonVerde}>
          Volver a intentar
        </button>
      </div>
    );
  }
  return (
    <div className="flex w-full flex-col items-center gap-3" aria-live="polite">
      <b className="text-apoyo">
        {subida.nombre} · {peso(subida.bytes)}
      </b>
      {subida.fase === 'subiendo' ? (
        <>
          <Barra porcentaje={subida.porcentaje} />
          <span className="text-apoyo">
            Subiendo… <b>{subida.porcentaje}%</b>
            {subida.faltan ? ` · ${subida.faltan}` : ''}
          </span>
          <PasosDeSubida fase="subiendo" />
          <button
            type="button"
            onClick={alCancelar}
            className="text-nota text-secundario underline"
          >
            Cancelar
          </button>
        </>
      ) : (
        <>
          <Barra />
          <span className="text-apoyo">Revisando filas y fotos…</span>
          <PasosDeSubida fase="revisando" />
          <span className="text-nota text-secundario">No cierres esta página</span>
        </>
      )}
    </div>
  );
}

/** Cuántas filas se muestran en «Qué pasa»; las demás, en el Excel. */
const FILAS_A_LA_VISTA = 10;

export function SubirArchivo({ alCrear }: { alCrear: () => void }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [revision, setRevision] = useState<RevisionImportacion | null>(null);
  const [subida, setSubida] = useState<Subida | null>(null);
  const [avisoPeso, setAvisoPeso] = useState<string | null>(null);
  const [creando, setCreando] = useState(false);
  const [encima, setEncima] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<RespuestaImportacion | null>(null);
  const [modo, setModo] = useState<ModoExistentes>('FOTOS_Y_DATOS');
  const [omitir, setOmitir] = useState<Set<number>>(new Set());
  const [verTodos, setVerTodos] = useState(false);
  /** El último archivo elegido: «Volver a intentar» lo sube de nuevo. */
  const ultimo = useRef<File | null>(null);
  const cancelarSubida = useRef<(() => void) | null>(null);
  // Mientras sube o se revisa, no se elige otro archivo ni se guarda nada.
  const ocupado = subida?.fase === 'subiendo' || subida?.fase === 'revisando';

  // Si se va de la página a media subida, se corta.
  useEffect(() => () => cancelarSubida.current?.(), []);

  async function leer(archivo: File) {
    if (ocupado) return;
    setError(null);
    setListo(null);
    // Antes de subir: más de 40 MB no pasa (docs/18 §7).
    const aviso = avisoDePeso(archivo.name, archivo.size);
    setAvisoPeso(aviso);
    if (aviso) {
      setSubida(null);
      return;
    }
    ultimo.current = archivo;
    setRevision(null);
    setModo('FOTOS_Y_DATOS');
    setOmitir(new Set());
    setVerTodos(false);
    const { name: nombre, size: bytes } = archivo;
    const inicio = Date.now();
    let alcanzado = 0;
    setSubida({ fase: 'subiendo', nombre, bytes, porcentaje: 0, faltan: null });
    const formulario = new FormData();
    formulario.append('archivo', archivo);
    const { promesa, cancelar } = subirConAvance<RevisionImportacion>(
      '/equipo/catalogo/importar',
      formulario,
      {
        alAvanzar: (cargado, total) => {
          alcanzado = porcentaje(cargado, total);
          const faltan = faltanUnos(cargado, total, Date.now() - inicio);
          setSubida((antes) =>
            antes?.fase === 'subiendo' ? { ...antes, porcentaje: alcanzado, faltan } : antes,
          );
        },
        alTerminarSubida: () => {
          alcanzado = 100;
          setSubida({ fase: 'revisando', nombre, bytes });
        },
      },
    );
    cancelarSubida.current = cancelar;
    try {
      const leida = await promesa;
      setSubida(null);
      setRevision(leida);
    } catch (e) {
      if (e instanceof ErrorApi && e.codigo === 'CANCELADA') {
        setSubida(null);
      } else if (e instanceof ErrorApi && e.codigo === 'SIN_CONEXION') {
        setSubida({ fase: 'cortada', nombre, bytes, porcentaje: alcanzado });
      } else {
        setSubida(null);
        setError(e instanceof ErrorApi ? e.message : 'No pudimos leer el archivo.');
      }
    } finally {
      cancelarSubida.current = null;
    }
  }

  const cambian = revision ? revision.ya_estan.filter((p) => loQueCambia(p, modo)) : [];
  const seActualizan = cambian.filter((p) => !omitir.has(p.fila));
  const conPublicaciones = seActualizan.filter((p) => p.publicaciones > 0).length;
  const visibles = verTodos ? cambian : cambian.slice(0, 3);
  const noSeCrean = revision?.incompletas.length ?? 0;

  async function crear() {
    if (!revision) return;
    setCreando(true);
    setError(null);
    try {
      const respuesta = await llamarApi<RespuestaImportacion>(
        `/equipo/catalogo/importar/${revision.id}/crear`,
        { metodo: 'POST', cuerpo: { existentes: modo, omitir: [...omitir] } },
      );
      setListo(respuesta);
      setRevision(null);
      alCrear();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos guardar los productos.');
    } finally {
      setCreando(false);
    }
  }

  const textoBoton = !revision
    ? ''
    : seActualizan.length === 0
      ? `Crear los ${revision.crear}`
      : revision.crear === 0
        ? `Guardar: actualizar ${seActualizan.length}`
        : `Guardar: crear ${revision.crear} y actualizar ${seActualizan.length}`;

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)]">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!ocupado) setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          const archivo = e.dataTransfer.files[0];
          if (archivo && !ocupado) void leer(archivo);
        }}
        aria-busy={ocupado}
        className={`flex flex-col items-center gap-2.5 rounded-[20px] border-2 border-dashed px-5 py-6 text-center ${
          subida?.fase === 'cortada'
            ? 'border-aviso bg-aviso-fondo'
            : encima
              ? 'border-pase bg-pase-suave'
              : 'border-borde bg-white'
        }`}
      >
        <input
          ref={entrada}
          type="file"
          accept=".xlsx,.csv,.zip,application/zip,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          disabled={ocupado}
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            e.target.value = '';
            if (archivo) void leer(archivo);
          }}
        />
        {subida ? (
          <AvanceDeSubida
            subida={subida}
            alCancelar={() => cancelarSubida.current?.()}
            alReintentar={() => {
              if (ultimo.current) void leer(ultimo.current);
            }}
          />
        ) : (
          <>
            <IconUpload size={30} stroke={1.8} aria-hidden="true" className="text-pase" />
            <b className="text-cuerpo">Arrastra tu archivo aquí</b>
            <span className="text-apoyo text-secundario">
              o{' '}
              <button type="button" onClick={() => entrada.current?.click()} className="underline">
                elige un archivo
              </button>
            </span>
            {avisoPeso && (
              <span
                role="alert"
                className="rounded-xl bg-aviso-fondo px-3 py-2 text-apoyo font-semibold text-aviso"
              >
                {avisoPeso}
              </span>
            )}
          </>
        )}
        <span className="flex gap-1.5">
          {['.xlsx', '.csv', '.zip'].map((tipo) => (
            <span
              key={tipo}
              className="rounded-full bg-superficie px-2.5 py-0.5 text-nota font-bold"
            >
              {tipo}
            </span>
          ))}
        </span>
        <span className="text-nota text-secundario">
          <b className="text-tinta">.zip</b> = tu Excel + una carpeta{' '}
          <b className="text-tinta">fotos/</b>. Cada foto se llama como dice la columna «Foto»; si
          está vacía, como el código de parte (ej. TUF-RTX5070-O12G-GAMING.jpg) o el producto (Antec
          CX300 ARGB.jpg). Puedes subir siempre el archivo completo: lo que ya está se actualiza.
          Hasta 40 MB.
        </span>
        <a
          href="/v1/equipo/catalogo/plantilla"
          download="plantilla_catalogo_paselibre.xlsx"
          className="inline-flex h-10 items-center gap-2 rounded-full border border-tinta px-4 text-nota font-bold text-tinta no-underline"
        >
          <IconFileSpreadsheet size={16} stroke={1.8} aria-hidden="true" />
          Descargar la plantilla
        </a>
      </div>

      <div className="flex flex-col gap-3">
        {error && <Mensaje tipo="error">{error}</Mensaje>}
        {listo !== null && (
          <Mensaje tipo="ok">
            Listo: {conPlural(listo.creados, 'producto nuevo', 'productos nuevos')}
            {listo.actualizados > 0
              ? ` y ${conPlural(listo.actualizados, 'actualizado', 'actualizados')}`
              : ''}{' '}
            en el catálogo.
          </Mensaje>
        )}
        {revision ? (
          <section className="flex flex-col gap-3.5 rounded-[20px] border border-linea bg-white p-4">
            <span className="flex flex-col">
              <b className="text-cuerpo">Revisión antes de guardar · {revision.nombre}</b>
              <span className="text-nota text-secundario">
                Nada se guarda hasta que tú lo confirmes. {revision.filas_leidas} filas leídas
                {revision.fotos_encontradas > 0
                  ? ` · ${revision.fotos_encontradas} fotos encontradas en fotos/`
                  : ''}
              </span>
            </span>
            <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1.3fr]">
              <span className="flex flex-col rounded-xl bg-pase-suave px-3.5 py-2.5 text-marca">
                <b className="text-[24px] leading-8">{revision.crear}</b>
                <span className="text-nota">{revision.crear === 1 ? 'se crea' : 'se crean'}</span>
              </span>
              <span className="flex flex-col rounded-xl bg-superficie px-3.5 py-2.5 text-tinta">
                <b className="text-[24px] leading-8">{revision.existentes}</b>
                <span className="text-nota">
                  {revision.existentes === 1 ? 'ya existe' : 'ya existen'}
                </span>
              </span>
              <span
                data-testid="no-se-crean"
                className="flex flex-col rounded-xl bg-aviso-fondo px-3.5 py-2.5 text-aviso"
              >
                <b className="text-[24px] leading-8">{noSeCrean}</b>
                <span className="text-nota">{noSeCrean === 1 ? 'no se crea' : 'no se crean'}</span>
                {lineasDeMotivos(revision.motivos).length > 0 && (
                  <ul className="m-0 mt-1 flex list-none flex-col p-0 text-nota leading-[1.55]">
                    {lineasDeMotivos(revision.motivos).map((linea) => (
                      <li key={linea}>{linea}</li>
                    ))}
                  </ul>
                )}
              </span>
            </div>
            {noSeCrean > 0 && (
              <p className="m-0 rounded-xl bg-aviso-fondo px-3.5 py-2.5 text-apoyo text-aviso">
                {noSeCrean === 1
                  ? 'Esta fila no se va a crear. Corrígela'
                  : `Estas ${noSeCrean} filas no se van a crear. Corrígelas`}{' '}
                en tu Excel y vuelve a subir{' '}
                {/\.zip$/i.test(revision.nombre) ? 'el ZIP' : 'el archivo'}: las que ya se crearon
                no se duplican.
              </p>
            )}

            {revision.existentes > 0 && (
              <fieldset className="m-0 flex flex-col gap-2 border-0 p-0">
                <legend className="mb-2 p-0 text-apoyo font-bold">
                  ¿Qué hacemos con{' '}
                  {revision.existentes === 1
                    ? 'el que ya existe'
                    : `los ${revision.existentes} que ya existen`}
                  ?
                </legend>
                {OPCIONES_EXISTENTES.map((opcion) => (
                  <label
                    key={opcion.modo}
                    className={`flex cursor-pointer gap-2.5 rounded-xl px-3.5 py-3 ${
                      modo === opcion.modo
                        ? 'border-[2.5px] border-pase bg-pase-suave'
                        : 'border border-borde bg-white'
                    }`}
                  >
                    <input
                      type="radio"
                      name="existentes"
                      checked={modo === opcion.modo}
                      disabled={ocupado || creando}
                      onChange={() => setModo(opcion.modo)}
                      className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-pase"
                    />
                    <span className="flex flex-col">
                      <b className="text-apoyo">{opcion.titulo}</b>
                      <span className="text-nota text-secundario">
                        {opcion.modo === 'DEJAR'
                          ? `Solo se crean ${revision.crear === 1 ? 'el nuevo' : `los ${revision.crear} nuevos`}.`
                          : opcion.detalle}
                      </span>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}

            {modo !== 'DEJAR' && cambian.length > 0 && (
              <div className="flex flex-col overflow-hidden rounded-xl border border-borde">
                <span className="flex flex-wrap items-baseline justify-between gap-2 px-3.5 py-2.5">
                  <b className="text-apoyo">Lo que cambia · {cambian.length}</b>
                  <span className="text-nota text-secundario">
                    Desmarca los que no quieras tocar
                  </span>
                </span>
                {visibles.map((p) => (
                  <FilaQueCambia
                    key={p.fila}
                    producto={p}
                    modo={modo}
                    marcada={!omitir.has(p.fila)}
                    alMarcar={(marcada) =>
                      setOmitir((antes) => {
                        const nuevo = new Set(antes);
                        if (marcada) nuevo.delete(p.fila);
                        else nuevo.add(p.fila);
                        return nuevo;
                      })
                    }
                  />
                ))}
                {cambian.length > visibles.length && (
                  <button
                    type="button"
                    onClick={() => setVerTodos(true)}
                    className="border-t border-linea px-3.5 py-2.5 text-left text-apoyo font-bold text-pase-texto"
                  >
                    Ver{' '}
                    {cambian.length - visibles.length === 1
                      ? 'el que falta'
                      : `los ${cambian.length - visibles.length} restantes`}{' '}
                    ›
                  </button>
                )}
              </div>
            )}
            {modo !== 'DEJAR' && conPublicaciones > 0 && (
              <p className="m-0 rounded-xl bg-aviso-fondo px-3.5 py-2.5 text-apoyo text-aviso">
                {conPublicaciones === 1
                  ? '1 de estos tiene publicaciones: se van a actualizar.'
                  : `${conPublicaciones} de estos tienen publicaciones: se van a actualizar.`}{' '}
                Las tiendas que eligieron su propia portada la conservan.
              </p>
            )}

            {revision.parecidos.length > 0 && (
              <div className="flex flex-col gap-2 rounded-xl bg-ambar px-3.5 py-2.5 text-apoyo text-ambar-texto">
                <span>
                  <b>
                    {revision.parecidos.length === 1
                      ? '1 parecido con código distinto'
                      : `${revision.parecidos.length} parecidos con código distinto`}
                  </b>
                  : mismo nombre que uno del catálogo, pero otro código. No se crean: revísalos
                  antes, para que no se dupliquen.
                </span>
                <ul className="m-0 flex list-none flex-col gap-1 p-0 text-nota">
                  {revision.parecidos.slice(0, 20).map((p) => (
                    <li key={p.fila}>
                      {p.lugar ?? `Fila ${p.fila}`}: <b>{p.producto}</b>{' '}
                      <span className="font-mono">{p.codigo_parte}</span> · en el catálogo:{' '}
                      <span className="font-mono">{p.con.codigo_parte ?? 'sin código'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {noSeCrean > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] border-collapse text-left text-apoyo">
                  <thead>
                    <tr className="text-[11px] font-bold uppercase tracking-[0.06em] text-secundario">
                      <th className="px-2 py-2">Fila</th>
                      <th className="px-2 py-2">Producto</th>
                      <th className="px-2 py-2">Qué pasa</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revision.incompletas.slice(0, FILAS_A_LA_VISTA).map((fila) => (
                      <tr key={fila.fila} className="border-t border-linea">
                        <td className="px-2 py-2">{fila.lugar ?? fila.fila}</td>
                        <td className="px-2 py-2 font-bold">{fila.producto}</td>
                        <td className="px-2 py-2 font-semibold text-aviso">
                          {fila.texto}
                          {fila.motivo === 'FOTO_NO_ESTA' && fila.foto_buscada && (
                            <span className="ml-1.5 inline-block rounded-full bg-aviso-fondo px-2 py-0.5 font-mono text-[11.5px] font-bold">
                              {fila.foto_buscada}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                    {noSeCrean > FILAS_A_LA_VISTA && (
                      <tr className="border-t border-linea">
                        <td className="px-2 py-2 text-detalle">…</td>
                        <td className="px-2 py-2 text-detalle">
                          {conPlural(noSeCrean - FILAS_A_LA_VISTA, 'fila más', 'filas más')}
                        </td>
                        <td className="px-2 py-2">
                          <a
                            href={`/v1/equipo/catalogo/importar/${revision.id}/errores`}
                            download="filas_que_no_se_crean.xlsx"
                            className="inline-flex items-center gap-1.5 font-bold text-pase-texto"
                          >
                            <IconFileSpreadsheet size={16} stroke={1.8} aria-hidden="true" />
                            Descargar la lista en Excel
                          </a>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setRevision(null)} className={botonBorde}>
                Cancelar
              </button>
              {revision.incompletas.length > 0 && (
                <button
                  type="button"
                  onClick={() => entrada.current?.click()}
                  disabled={ocupado}
                  className={botonBorde}
                >
                  Corregir{' '}
                  {revision.incompletas.length === 1
                    ? 'el que falta'
                    : `los ${revision.incompletas.length}`}{' '}
                  primero
                </button>
              )}
              <button
                type="button"
                disabled={ocupado || creando || (revision.crear === 0 && seActualizan.length === 0)}
                onClick={() => void crear()}
                className={botonVerde}
              >
                {creando ? 'Guardando…' : textoBoton}
              </button>
            </div>
          </section>
        ) : (
          !listo && (
            <p className="m-0 rounded-[20px] border border-linea bg-white px-5 py-6 text-apoyo text-secundario">
              Sube el Excel o el .zip con la plantilla. Antes de guardar te mostramos cuántos se
              crean, cuáles ya estaban y qué les cambia, y qué les falta a los demás.
            </p>
          )
        )}
      </div>
    </div>
  );
}

// ── Agregar uno ────────────────────────────────────────────────────────────

const VACIO = {
  categoria: 'graficas',
  marca: '',
  modelo: '',
  chip: '',
  memoria: '',
  tipo: '',
  sinonimos: '',
};

function AgregarUno({ alAgregar }: { alAgregar: () => void }) {
  const categorias = useCategorias();
  const [datos, setDatos] = useState(VACIO);
  const [versiones, setVersiones] = useState<Array<{ nombre: string; codigo_parte: string }>>([]);
  const [nueva, setNueva] = useState<{ nombre: string; codigo_parte: string } | null>(null);
  const [fotos, setFotos] = useState<ArchivoSubido[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);
  const archivo = useRef<HTMLInputElement>(null);

  async function guardar(seguir: boolean) {
    setGuardando(true);
    setError(null);
    setListo(null);
    try {
      const caracteristicas = Object.fromEntries(
        (
          [
            ['Chip', datos.chip],
            ['Memoria', datos.memoria],
            ['Tipo de memoria', datos.tipo],
          ] as const
        ).filter(([, valor]) => valor.trim()),
      );
      const { creados } = await llamarApi<{ creados: number }>('/equipo/catalogo', {
        metodo: 'POST',
        cuerpo: {
          categoria: datos.categoria,
          marca: datos.marca,
          modelo: datos.modelo,
          versiones: nueva?.nombre.trim() ? [...versiones, nueva] : versiones,
          caracteristicas,
          sinonimos: datos.sinonimos
            .split(/[;,]/)
            .map((s) => s.trim())
            .filter(Boolean),
          fotos: fotos.map((f) => f.ruta),
        },
      });
      setListo(`Listo: ${conPlural(creados, 'producto', 'productos')} en el catálogo.`);
      alAgregar();
      if (seguir) {
        setDatos({ ...VACIO, categoria: datos.categoria, marca: datos.marca });
        setVersiones([]);
        setNueva(null);
        setFotos([]);
      }
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos guardar el producto.');
    } finally {
      setGuardando(false);
    }
  }

  const cambio = (clave: keyof typeof VACIO) => (evento: { target: { value: string } }) =>
    setDatos({ ...datos, [clave]: evento.target.value });

  return (
    <section className="flex flex-col gap-4 rounded-[20px] border border-linea bg-white p-5">
      <b className="text-[18px]">Agregar un producto al catálogo</b>
      {error && <Mensaje tipo="error">{error}</Mensaje>}
      {listo && <Mensaje tipo="ok">{listo}</Mensaje>}
      <div className="grid gap-3 md:grid-cols-3">
        <label className={etiqueta}>
          Categoría
          <select value={datos.categoria} onChange={cambio('categoria')} className={campo}>
            {categorias.map((c) => (
              <option key={c.slug} value={c.slug}>
                {c.nombre}
              </option>
            ))}
          </select>
        </label>
        <label className={etiqueta}>
          Marca
          <input
            value={datos.marca}
            onChange={cambio('marca')}
            placeholder="ASUS"
            className={campo}
          />
        </label>
        <label className={etiqueta}>
          Modelo (familia)
          <input
            value={datos.modelo}
            onChange={cambio('modelo')}
            placeholder="TUF Gaming RTX 5070"
            className={campo}
          />
        </label>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-apoyo font-medium">Versiones</span>
        <div className="flex flex-wrap items-center gap-2">
          {versiones.map((v, i) => (
            <span
              key={`${v.nombre}-${i}`}
              className="flex h-10 items-center gap-2 rounded-xl border border-linea bg-superficie pl-3 pr-1.5"
            >
              <b className="text-apoyo">{v.nombre}</b>
              <span className="font-mono text-nota text-secundario">{v.codigo_parte}</span>
              <button
                type="button"
                aria-label={`Quitar ${v.nombre}`}
                onClick={() => setVersiones(versiones.filter((_, j) => j !== i))}
                className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white"
              >
                <IconX size={14} stroke={2} aria-hidden="true" />
              </button>
            </span>
          ))}
          {nueva ? (
            <span className="flex flex-wrap items-center gap-2">
              <input
                aria-label="Versión"
                value={nueva.nombre}
                onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })}
                placeholder="OC"
                className="h-10 w-24 rounded-xl border border-borde px-3 text-apoyo"
              />
              <input
                aria-label="Código de parte"
                value={nueva.codigo_parte}
                onChange={(e) => setNueva({ ...nueva, codigo_parte: e.target.value })}
                placeholder="TUF-RTX5070-O12G-GAMING"
                className="h-10 w-64 rounded-xl border border-borde px-3 font-mono text-nota"
              />
              <button
                type="button"
                disabled={!nueva.nombre.trim()}
                onClick={() => {
                  setVersiones([...versiones, nueva]);
                  setNueva(null);
                }}
                className="h-10 rounded-xl bg-tinta px-3 text-apoyo font-bold text-white"
              >
                Listo
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setNueva({ nombre: '', codigo_parte: '' })}
              className="flex h-10 items-center gap-1 rounded-xl border border-dashed border-pase px-3 text-apoyo font-bold text-pase-texto"
            >
              <IconPlus size={15} stroke={2.2} aria-hidden="true" />
              Agregar versión
            </button>
          )}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <label className={etiqueta}>
          Chip
          <input
            value={datos.chip}
            onChange={cambio('chip')}
            placeholder="RTX 5070"
            className={campo}
          />
        </label>
        <label className={etiqueta}>
          Memoria
          <input
            value={datos.memoria}
            onChange={cambio('memoria')}
            placeholder="12 GB"
            className={campo}
          />
        </label>
        <label className={etiqueta}>
          Tipo de memoria
          <input
            value={datos.tipo}
            onChange={cambio('tipo')}
            placeholder="GDDR7"
            className={campo}
          />
        </label>
        <label className={etiqueta}>
          <span>
            Sinónimos <span className="text-secundario">(opcional)</span>
          </span>
          <input
            value={datos.sinonimos}
            onChange={cambio('sinonimos')}
            placeholder="5070 tuf, tuf 5070"
            className={campo}
          />
        </label>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-apoyo font-medium">Fotos</span>
        <div className="flex flex-wrap gap-2.5">
          {fotos.map((foto) => (
            <span key={foto.ruta} className="relative">
              <Miniatura
                ruta={foto.ruta}
                categoria={datos.categoria}
                className="h-[74px] w-[74px] rounded-xl border border-linea"
                glifo={40}
                grosor={3}
              />
              <button
                type="button"
                aria-label="Quitar foto"
                onClick={() => setFotos(fotos.filter((f) => f.ruta !== foto.ruta))}
                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-tinta text-white"
              >
                <IconX size={12} stroke={2.5} aria-hidden="true" />
              </button>
            </span>
          ))}
          {fotos.length < 8 && (
            <button
              type="button"
              disabled={subiendo}
              onClick={() => archivo.current?.click()}
              aria-label="Agregar foto"
              className="flex h-[74px] w-[74px] items-center justify-center rounded-xl border border-dashed border-borde text-secundario"
            >
              {subiendo ? '…' : <IconCamera size={20} stroke={1.8} aria-hidden="true" />}
            </button>
          )}
          <input
            ref={archivo}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            className="hidden"
            onChange={async (e) => {
              const foto = e.target.files?.[0];
              e.target.value = '';
              if (!foto) return;
              setSubiendo(true);
              try {
                const subida = await subirFoto(foto);
                setFotos((actuales) => [...actuales, subida]);
              } catch (er) {
                setError(er instanceof ErrorApi ? er.message : 'No pudimos subir la foto.');
              } finally {
                setSubiendo(false);
              }
            }}
          />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={guardando || subiendo}
          onClick={() => void guardar(false)}
          className={botonVerde}
        >
          {guardando ? 'Guardando…' : 'Guardar en el catálogo'}
        </button>
        <button
          type="button"
          disabled={guardando || subiendo}
          onClick={() => void guardar(true)}
          className={botonBorde}
        >
          Guardar y agregar otro
        </button>
      </div>
    </section>
  );
}

// ── Eliminar todos ─────────────────────────────────────────────────────────

/**
 * «Eliminar todos» (docs/17 §4): pregunta antes, borra por tandas mostrando el avance y nunca
 * toca los que usa una tienda.
 */
function VentanaEliminarTodos({
  abierta,
  alCerrar,
  alEliminar,
  alSubir,
}: {
  abierta: boolean;
  alCerrar: () => void;
  alEliminar: () => void;
  alSubir: () => void;
}) {
  const [resumen, setResumen] = useState<ResumenEliminarCatalogo | null>(null);
  const [hechos, setHechos] = useState<number | null>(null);
  const [fin, setFin] = useState<RespuestaEliminarCatalogo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trabajando = hechos !== null && !fin;

  useEffect(() => {
    if (!abierta) return;
    setResumen(null);
    setHechos(null);
    setFin(null);
    setError(null);
    void llamarApi<ResumenEliminarCatalogo>('/equipo/catalogo/eliminar-todos').then(
      setResumen,
      (e: unknown) =>
        setError(e instanceof ErrorApi ? e.message : 'No pudimos contar los productos.'),
    );
  }, [abierta]);

  async function eliminar() {
    if (!resumen) return;
    setHechos(0);
    setError(null);
    let total = 0;
    try {
      for (let vuelta = 0; vuelta < 1000; vuelta++) {
        const tanda = await llamarApi<RespuestaEliminarCatalogo>(
          '/equipo/catalogo/eliminar-todos',
          {
            metodo: 'POST',
            cuerpo: { tanda: 50 },
          },
        );
        total += tanda.eliminados;
        setHechos(total);
        if (tanda.quedan === 0 || tanda.eliminados === 0) {
          setFin({ ...tanda, eliminados: total });
          break;
        }
      }
    } catch (e) {
      setError(
        `${e instanceof ErrorApi ? e.message : 'Se cortó.'} Se eliminaron ${total}; vuelve a intentarlo para seguir.`,
      );
      setHechos(null);
    }
    alEliminar();
  }

  return (
    <Ventana
      titulo="Eliminar todos"
      abierta={abierta}
      alCerrar={() => {
        if (!trabajando) alCerrar();
      }}
    >
      <div role="alertdialog" aria-labelledby="titulo-eliminar" className="flex flex-col gap-3.5">
        {error && <Mensaje tipo="error">{error}</Mensaje>}
        {fin ? (
          <>
            <Mensaje tipo="ok">
              Listo: se eliminaron {conPlural(fin.eliminados, 'producto', 'productos')}.
              {fin.se_quedan > 0
                ? ` ${fin.se_quedan === 1 ? 'Queda 1 que usan' : `Quedan ${fin.se_quedan} que usan`} las tiendas.`
                : ''}{' '}
              Ya puedes subir el catálogo nuevo.
            </Mensaje>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={alCerrar} className={botonBorde}>
                Cerrar
              </button>
              <button type="button" onClick={alSubir} className={botonVerde}>
                <IconUpload size={17} stroke={1.9} aria-hidden="true" />
                Subir archivo
              </button>
            </div>
          </>
        ) : !resumen ? (
          <p className="m-0 text-secundario">{error ? '' : 'Contando…'}</p>
        ) : resumen.se_eliminan === 0 ? (
          <>
            <h2 id="titulo-eliminar" className="m-0 text-seccion">
              No hay nada que eliminar
            </h2>
            <p className="m-0 text-apoyo text-secundario">
              {resumen.total === 0
                ? 'El catálogo ya está vacío.'
                : `Los ${resumen.total} productos los usan tiendas en sus publicaciones o pedidos.`}
            </p>
            <div className="flex justify-end">
              <button type="button" onClick={alCerrar} className={botonBorde}>
                Cerrar
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="titulo-eliminar" className="m-0 text-seccion">
              ¿Estás seguro de que quieres eliminar{' '}
              {resumen.total === 1 ? 'el producto' : `${resumen.total} productos`}?
            </h2>
            <p className="m-0 text-apoyo text-secundario">
              Se borran del catálogo con sus fotos.{' '}
              <b className="text-tinta">No se puede deshacer.</b>
            </p>
            {resumen.se_quedan > 0 && (
              <p className="m-0 rounded-xl bg-ambar px-3.5 py-2.5 text-apoyo text-ambar-texto">
                {resumen.se_quedan === 1
                  ? '1 se queda: lo usan'
                  : `${resumen.se_quedan} se quedan: los usan`}{' '}
                tiendas en sus publicaciones o pedidos. Se{' '}
                {resumen.se_eliminan === 1
                  ? 'elimina el otro'
                  : `eliminan los otros ${resumen.se_eliminan}`}
                .
              </p>
            )}
            {trabajando ? (
              <div className="flex flex-col gap-2" role="status">
                <span className="text-apoyo font-semibold">
                  Eliminando productos… {hechos} de {resumen.se_eliminan} · no cierres esta ventana
                </span>
                <span className="h-2 overflow-hidden rounded-full bg-superficie">
                  <span
                    className="block h-full rounded-full bg-error transition-[width]"
                    style={{
                      width: `${Math.min(100, Math.round(((hechos ?? 0) / resumen.se_eliminan) * 100))}%`,
                    }}
                  />
                </span>
              </div>
            ) : (
              <div className="flex justify-end gap-2">
                <button type="button" onClick={alCerrar} className={botonBorde}>
                  Cancelar
                </button>
                <button type="button" onClick={() => void eliminar()} className={botonRojo}>
                  Sí, eliminar {resumen.se_eliminan}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </Ventana>
  );
}

// ── Página ─────────────────────────────────────────────────────────────────

/**
 * El catálogo del equipo (COR15 del lienzo final): lo que usa la publicación rápida para llenar
 * todo solo. Productos, lo publicado a mano por revisar, subir un archivo y agregar uno.
 */
export function CatalogoEquipo({ pestanaInicial }: { pestanaInicial: Pestana }) {
  const router = useRouter();
  const ruta = usePathname();
  const parametros = useSearchParams();
  const [pestana, setPestana] = useState<Pestana>(pestanaInicial);
  const [resumen, setResumen] = useState<{ total: number; por_revisar: number } | null>(null);
  const [editando, setEditando] = useState<Editable | null>(null);
  const [eliminando, setEliminando] = useState(false);
  const [recargar, setRecargar] = useState(0);

  const actualizar = useCallback(() => {
    void llamarApi<RespuestaCatalogoEquipo>('/equipo/catalogo?pagina=1').then(
      (r) => setResumen({ total: r.total, por_revisar: r.por_revisar }),
      () => undefined,
    );
  }, []);
  useEffect(actualizar, [actualizar, recargar]);

  function ir(nueva: Pestana) {
    setPestana(nueva);
    const consulta = new URLSearchParams(parametros.toString());
    if (nueva === 'productos') consulta.delete('tab');
    else consulta.set('tab', nueva);
    router.replace(`${ruta}${consulta.size ? `?${consulta.toString()}` : ''}`, { scroll: false });
  }

  const pestanas: Array<[Pestana, string, number | null, string]> = [
    ['productos', 'Productos', resumen?.total ?? null, 'bg-superficie text-tinta'],
    ['revisar', 'Por revisar', resumen?.por_revisar ?? null, 'bg-contador text-tinta'],
    ['excel', 'Subir archivo', null, ''],
    ['agregar', 'Agregar uno', null, ''],
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-titulo">Catálogo</h1>
          <span className="text-apoyo text-secundario">
            {resumen ? `${conPlural(resumen.total, 'producto', 'productos')} · ` : ''}lo que usa la
            publicación rápida para llenar todo solo
          </span>
        </div>
        <span className="flex flex-wrap gap-2">
          <button type="button" onClick={() => ir('excel')} className={botonBorde}>
            <IconUpload size={17} stroke={1.9} aria-hidden="true" />
            Subir archivo
          </button>
          <button type="button" onClick={() => ir('agregar')} className={botonVerde}>
            <IconPlus size={17} stroke={2.2} aria-hidden="true" />
            Agregar producto
          </button>
          <button type="button" onClick={() => setEliminando(true)} className={botonRojoBorde}>
            <IconTrash size={17} stroke={1.9} aria-hidden="true" />
            Eliminar todos
          </button>
        </span>
      </div>
      <div
        role="tablist"
        aria-label="Catálogo"
        className="flex gap-1 overflow-x-auto border-b border-linea [scrollbar-width:none]"
      >
        {pestanas.map(([clave, texto, numero, clase]) => (
          <button
            key={clave}
            type="button"
            role="tab"
            aria-selected={pestana === clave}
            onClick={() => ir(clave)}
            className={`flex h-11 shrink-0 items-center gap-2 border-b-[3px] px-3 text-apoyo ${
              pestana === clave
                ? 'border-pase font-bold text-pase-texto'
                : 'border-transparent font-medium text-tinta'
            }`}
          >
            {texto}
            {numero !== null && numero > 0 && (
              <span className={`rounded-full px-2 text-[11px] font-bold leading-5 ${clase}`}>
                {numero}
              </span>
            )}
          </button>
        ))}
      </div>
      {pestana === 'productos' && <Productos alEditar={setEditando} recargar={recargar} />}
      {pestana === 'revisar' && (
        <PorRevisar
          alEditar={setEditando}
          alCambiar={() => setRecargar((n) => n + 1)}
          recargar={recargar}
        />
      )}
      {pestana === 'excel' && <SubirArchivo alCrear={() => setRecargar((n) => n + 1)} />}
      {pestana === 'agregar' && <AgregarUno alAgregar={() => setRecargar((n) => n + 1)} />}
      <VentanaEliminarTodos
        abierta={eliminando}
        alCerrar={() => setEliminando(false)}
        alEliminar={() => setRecargar((n) => n + 1)}
        alSubir={() => {
          setEliminando(false);
          ir('excel');
        }}
      />
      <VentanaEditar
        producto={editando}
        alCerrar={() => setEditando(null)}
        alGuardar={() => {
          setEditando(null);
          setRecargar((n) => n + 1);
        }}
      />
    </div>
  );
}
