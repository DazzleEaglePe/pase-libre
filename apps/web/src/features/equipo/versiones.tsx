import { NOVEDADES, VERSION, type DetalleParaElEquipo } from '@paselibre/contracts';

const GRUPOS: { clave: keyof DetalleParaElEquipo; titulo: string; color: string }[] = [
  { clave: 'nuevo', titulo: 'Nuevo', color: 'text-marca' },
  { clave: 'cambia', titulo: 'Cambia', color: 'text-[#C2410C]' },
  { clave: 'arregla', titulo: 'Arregla', color: 'text-tinta' },
  { clave: 'datos', titulo: 'Datos', color: 'text-secundario' },
];

/** «2026-11-12» → «12/11/2026». */
function dia(fecha: string): string {
  return fecha.split('-').reverse().join('/');
}

/**
 * Panel › Versiones (docs/18 §9): de la más nueva a la más antigua, con lo nuevo, lo que cambia,
 * lo que se arregla y los datos que se agregan. Sale de `NOVEDADES`, la misma lista del pie.
 */
export function Versiones() {
  return (
    <div className="flex max-w-[880px] flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-titulo">Versiones</h1>
        <p className="text-cuerpo text-secundario">
          Ahora corre la {VERSION}. Las tiendas ven en el pie solo los dos primeros números y unas
          frases cortas; aquí está el detalle completo.
        </p>
      </div>
      <ol className="flex flex-col gap-4">
        {NOVEDADES.map((novedad, i) => {
          const anterior = NOVEDADES[i + 1];
          return (
            <li
              key={novedad.version}
              id={`v${novedad.version}`}
              className="flex flex-col gap-3 rounded-[20px] border border-linea bg-white p-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-seccion">
                  Versión {novedad.version}
                  {novedad.version === VERSION && (
                    <span className="ml-2 rounded-full bg-pase-suave px-2 py-0.5 align-middle text-nota font-bold text-marca">
                      La que corre
                    </span>
                  )}
                </h2>
                <span className="text-nota text-secundario">
                  {dia(novedad.fecha)}
                  {anterior && <> · antes {anterior.version}</>}
                </span>
              </div>
              {novedad.equipo ? (
                <>
                  {GRUPOS.filter(({ clave }) => novedad.equipo?.[clave].length).map(
                    ({ clave, titulo, color }) => (
                      <section key={clave} className="flex flex-col gap-1.5">
                        <h3 className={`text-etiqueta uppercase ${color}`}>{titulo}</h3>
                        <ul className="flex flex-col gap-1 text-apoyo">
                          {novedad.equipo?.[clave].map((linea) => (
                            <li key={linea}>· {linea}</li>
                          ))}
                        </ul>
                      </section>
                    ),
                  )}
                  {novedad.publico.length > 0 && (
                    <section className="flex flex-col gap-1.5 border-t border-linea pt-3">
                      <h3 className="text-etiqueta uppercase text-secundario">
                        Lo que ven las tiendas
                      </h3>
                      <ul className="flex flex-col gap-1 text-apoyo text-secundario">
                        {novedad.publico.map((linea) => (
                          <li key={linea}>· {linea}</li>
                        ))}
                      </ul>
                    </section>
                  )}
                </>
              ) : (
                <p className="text-apoyo text-secundario">Versión base, sin detalle.</p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
