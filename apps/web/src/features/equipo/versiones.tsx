import { NOVEDADES, VERSION, type DetalleParaElEquipo, type Novedad } from '@paselibre/contracts';

import { MarcarVersionVista } from './version-vista';

/** NUEVO · CAMBIA · ARREGLA · DATOS, con el color de cada uno en claro y en oscuro (doc 19, punto 8). */
const GRUPOS: { clave: keyof DetalleParaElEquipo; titulo: string; color: string }[] = [
  { clave: 'nuevo', titulo: 'Nuevo', color: 'text-pase-texto' },
  { clave: 'cambia', titulo: 'Cambia', color: 'text-aviso' },
  { clave: 'arregla', titulo: 'Arregla', color: 'text-tinta' },
  { clave: 'datos', titulo: 'Datos', color: 'text-detalle' },
];

/** «2026-11-12» → «12/11/2026». */
function dia(fecha: string): string {
  return fecha.split('-').reverse().join('/');
}

/** «12/11/2026 · antes 1.8.7». */
function cuando(i: number): string {
  const novedad = NOVEDADES[i];
  const anterior = NOVEDADES[i + 1];
  if (!novedad) return '';
  return anterior ? `${dia(novedad.fecha)} · antes ${anterior.version}` : dia(novedad.fecha);
}

function Detalle({ novedad }: { novedad: Novedad }) {
  if (!novedad.equipo) {
    return (
      <p className="m-0 text-apoyo text-secundario">Versión base: desde aquí se empezó a contar.</p>
    );
  }
  const { equipo } = novedad;
  return (
    <>
      {GRUPOS.filter(({ clave }) => equipo[clave].length > 0).map(({ clave, titulo, color }) => (
        <section key={clave} className="flex flex-col gap-1.5">
          <h3 className={`text-etiqueta font-extrabold uppercase tracking-[0.06em] ${color}`}>
            {titulo}
          </h3>
          <ul className="m-0 flex list-none flex-col gap-1 p-0 text-apoyo">
            {equipo[clave].map((linea) => (
              <li key={linea}>· {linea}</li>
            ))}
          </ul>
        </section>
      ))}
      {novedad.publico.length > 0 && (
        <details className="text-nota text-secundario">
          <summary className="cursor-pointer list-none">
            Lo que ven las tiendas en «Novedades»: {novedad.publico.length}{' '}
            {novedad.publico.length === 1 ? 'frase corta' : 'frases cortas'} ·{' '}
            <span className="font-semibold text-pase-texto underline">Ver</span>
          </summary>
          <ul className="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-apoyo">
            {novedad.publico.map((linea) => (
              <li key={linea}>· {linea}</li>
            ))}
          </ul>
        </details>
      )}
    </>
  );
}

/**
 * Panel › Versiones (docs/18 §9 y doc 19, punto 8): la que corre, abierta y con borde verde;
 * las anteriores, de la más nueva a la más antigua, cerradas hasta que las tocas. Sale de
 * `NOVEDADES`. Al abrirla se apaga el puntito de la pastilla `v…` de la barra.
 */
export function Versiones({ vista }: { vista: boolean }) {
  const [actual, ...anteriores] = NOVEDADES;
  return (
    <div className="flex flex-col gap-5">
      {!vista && <MarcarVersionVista />}
      <div className="flex flex-col gap-1">
        <h1 className="text-titulo">Versiones</h1>
        <p className="m-0 text-cuerpo text-secundario">
          Ahora corre la {VERSION}. Las tiendas ven en el pie solo los dos primeros números y unas
          frases cortas; aquí está el detalle completo.
        </p>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        {actual && (
          <article
            id={`v${actual.version}`}
            className="flex flex-col gap-3 rounded-2xl border-[1.5px] border-acento bg-white p-5"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="flex items-center gap-2 text-[22px] font-bold">
                Versión {actual.version}
                {actual.version === VERSION && (
                  <span className="rounded-full bg-acento px-2 py-0.5 text-[11px] font-extrabold text-[#0F1412]">
                    ACTUAL
                  </span>
                )}
              </h2>
              <span className="text-nota text-secundario">{cuando(0)}</span>
            </div>
            <Detalle novedad={actual} />
          </article>
        )}
        <div className="flex flex-col gap-2.5">
          {anteriores.map((novedad, i) => (
            <details
              key={novedad.version}
              id={`v${novedad.version}`}
              className="group rounded-[14px] border border-linea bg-white"
            >
              <summary className="flex cursor-pointer list-none flex-col gap-0.5 px-4 py-3.5">
                <span className="flex items-center justify-between gap-2">
                  <b className="text-[16px] font-bold">Versión {novedad.version}</b>
                  <span
                    aria-hidden="true"
                    className="text-secundario transition-transform group-open:rotate-180"
                  >
                    ▾
                  </span>
                </span>
                <span className="text-nota text-secundario">{cuando(i + 1)}</span>
              </summary>
              <div className="flex flex-col gap-3 border-t border-linea px-4 pb-4 pt-3">
                <Detalle novedad={novedad} />
              </div>
            </details>
          ))}
          <p className="m-0 text-nota text-secundario">
            De la más nueva a la más antigua. La de arriba se abre sola; las demás se abren al
            tocarlas.
          </p>
        </div>
      </div>
    </div>
  );
}
