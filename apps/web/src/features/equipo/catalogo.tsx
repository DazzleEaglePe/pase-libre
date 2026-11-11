'use client';

import type {
  ArchivoSubido,
  CategoriaResumen,
  ProductoDelCatalogo,
  ProductoPorRevisar,
  RespuestaCatalogoEquipo,
  RespuestaImportacion,
  RespuestaPorRevisar,
  RevisionImportacion,
} from '@paselibre/contracts';
import {
  IconArrowRight,
  IconCamera,
  IconCornerDownRight,
  IconFileSpreadsheet,
  IconPlus,
  IconSearch,
  IconUpload,
  IconX,
} from '@tabler/icons-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';

import { ErrorApi, llamarApi, subirFoto } from '@/shared/api/cliente';
import { haceRato } from '@/shared/fechas';
import { conPlural } from '@/shared/plural';
import { campo, etiqueta } from '@/shared/ui/estilos';
import { Miniatura } from '@/shared/ui/miniatura';
import { Ventana } from '@/shared/ui/ventana';

type Pestana = 'productos' | 'revisar' | 'excel' | 'agregar';

const botonVerde =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full bg-pase px-5 text-apoyo font-bold text-white no-underline disabled:bg-borde disabled:text-detalle';
const botonBorde =
  'inline-flex h-11 items-center justify-center gap-2 rounded-full border border-tinta bg-white px-5 text-apoyo font-bold text-tinta no-underline';

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
  useEffect(() => {
    setDatos(producto);
    setError(null);
  }, [producto]);

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
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
        },
      });
      alGuardar();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos guardar el producto.');
    } finally {
      setGuardando(false);
    }
  }

  const cambio = (clave: keyof Editable) => (evento: { target: { value: string } }) =>
    datos && setDatos({ ...datos, [clave]: evento.target.value });

  return (
    <Ventana titulo="Corregir el producto" abierta={Boolean(producto)} alCerrar={alCerrar}>
      {datos && (
        <form onSubmit={guardar} className="flex flex-col gap-3.5">
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
              <input value={datos.modelo} onChange={cambio('modelo')} className={campo} required />
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
          <div className="flex gap-2 pt-1">
            <button type="submit" disabled={guardando} className={botonVerde}>
              {guardando ? 'Guardando…' : 'Guardar y agregar'}
            </button>
            <button type="button" onClick={alCerrar} className={botonBorde}>
              Cancelar
            </button>
          </div>
        </form>
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
                        {p.version
                          ? p.titulo.replace(new RegExp(`\\s+${p.version}$`), '')
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

function SubirArchivo({ alCrear }: { alCrear: () => void }) {
  const entrada = useRef<HTMLInputElement>(null);
  const [revision, setRevision] = useState<RevisionImportacion | null>(null);
  const [leyendo, setLeyendo] = useState(false);
  const [creando, setCreando] = useState(false);
  const [encima, setEncima] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [listo, setListo] = useState<number | null>(null);

  async function leer(archivo: File) {
    setLeyendo(true);
    setError(null);
    setListo(null);
    setRevision(null);
    try {
      const formulario = new FormData();
      formulario.append('archivo', archivo);
      setRevision(
        await llamarApi<RevisionImportacion>('/equipo/catalogo/importar', {
          metodo: 'POST',
          formulario,
        }),
      );
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos leer el archivo.');
    } finally {
      setLeyendo(false);
    }
  }

  async function crear() {
    if (!revision) return;
    setCreando(true);
    setError(null);
    try {
      const { creados } = await llamarApi<RespuestaImportacion>(
        `/equipo/catalogo/importar/${revision.id}/crear`,
        { metodo: 'POST' },
      );
      setListo(creados);
      setRevision(null);
      alCrear();
    } catch (e) {
      setError(e instanceof ErrorApi ? e.message : 'No pudimos crear los productos.');
    } finally {
      setCreando(false);
    }
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,330px)_minmax(0,1fr)]">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setEncima(true);
        }}
        onDragLeave={() => setEncima(false)}
        onDrop={(e) => {
          e.preventDefault();
          setEncima(false);
          const archivo = e.dataTransfer.files[0];
          if (archivo) void leer(archivo);
        }}
        className={`flex flex-col items-center gap-2.5 rounded-[20px] border-2 border-dashed px-5 py-6 text-center ${
          encima ? 'border-pase bg-pase-suave' : 'border-borde bg-white'
        }`}
      >
        <IconUpload size={30} stroke={1.8} aria-hidden="true" className="text-pase" />
        <b className="text-cuerpo">
          {leyendo ? 'Leyendo el archivo…' : 'Arrastra tu archivo aquí'}
        </b>
        <span className="text-apoyo text-secundario">
          o{' '}
          <button type="button" onClick={() => entrada.current?.click()} className="underline">
            elige un archivo
          </button>
        </span>
        <input
          ref={entrada}
          type="file"
          accept=".xlsx,.csv,.zip,application/zip,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const archivo = e.target.files?.[0];
            e.target.value = '';
            if (archivo) void leer(archivo);
          }}
        />
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
          <b className="text-tinta">fotos/</b>. Cada foto se llama como el código de parte (ej.
          TUF-RTX5070-O12G-GAMING.jpg).
        </span>
        <a
          href="/plantilla-catalogo.csv"
          download
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
            Listo: {conPlural(listo, 'producto nuevo', 'productos nuevos')} en el catálogo.
          </Mensaje>
        )}
        {revision ? (
          <section className="flex flex-col gap-3 rounded-[20px] border border-linea bg-white p-4">
            <span className="flex flex-col">
              <b className="text-cuerpo">Revisión antes de guardar · {revision.nombre}</b>
              <span className="text-nota text-secundario">
                Nada se guarda hasta que tú lo confirmes. {revision.filas_leidas} filas leídas
                {revision.fotos_encontradas > 0
                  ? ` · ${revision.fotos_encontradas} fotos encontradas en fotos/`
                  : ''}
              </span>
            </span>
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  [revision.crear, 'se van a crear', 'bg-pase-suave text-marca'],
                  [revision.existentes, 'ya existían (se omiten)', 'bg-superficie text-tinta'],
                  [
                    revision.incompletas.length,
                    'con datos incompletos',
                    'bg-aviso-fondo text-aviso',
                  ],
                ] as const
              ).map(([numero, texto, clase]) => (
                <span key={texto} className={`flex flex-col rounded-xl px-3.5 py-2.5 ${clase}`}>
                  <b className="text-[24px] leading-8">{numero}</b>
                  <span className="text-nota">{texto}</span>
                </span>
              ))}
            </div>
            {revision.incompletas.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[480px] border-collapse text-left text-apoyo">
                  <thead>
                    <tr className="text-[11px] font-bold uppercase tracking-[0.06em] text-secundario">
                      <th className="px-2 py-2">Fila</th>
                      <th className="px-2 py-2">Producto</th>
                      <th className="px-2 py-2">Qué falta</th>
                    </tr>
                  </thead>
                  <tbody>
                    {revision.incompletas.slice(0, 50).map((fila) => (
                      <tr key={fila.fila} className="border-t border-linea">
                        <td className="px-2 py-2">{fila.fila}</td>
                        <td className="px-2 py-2 font-bold">{fila.producto}</td>
                        <td className="px-2 py-2 font-semibold text-aviso">{fila.falta}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={creando || revision.crear === 0}
                onClick={() => void crear()}
                className={botonVerde}
              >
                {creando ? 'Creando…' : `Crear los ${revision.crear}`}
              </button>
              {revision.incompletas.length > 0 && (
                <button
                  type="button"
                  onClick={() => entrada.current?.click()}
                  className={botonBorde}
                >
                  Corregir los {revision.incompletas.length} primero
                </button>
              )}
            </div>
          </section>
        ) : (
          !listo && (
            <p className="m-0 rounded-[20px] border border-linea bg-white px-5 py-6 text-apoyo text-secundario">
              Sube el Excel con la plantilla. Antes de guardar te mostramos cuántos se crean, cuáles
              ya estaban y qué les falta a los demás.
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
