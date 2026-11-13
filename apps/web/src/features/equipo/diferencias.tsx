import { normalizarTexto } from '@paselibre/contracts';

/** Una palabra de un nombre y si está solo en ese nombre (no en el otro). */
export interface PalabraComparada {
  texto: string;
  distinta: boolean;
}

/**
 * Compara dos nombres palabra por palabra (con `normalizarTexto`, así «CL30» y «cl-30» son la
 * misma) y marca las que están en uno y no en el otro (doc 20, A9). Una palabra repetida cuenta
 * cada vez: si «16GB» sale dos veces en uno y una en el otro, la segunda es distinta.
 */
export function compararNombres(
  uno: string,
  otro: string,
): [PalabraComparada[], PalabraComparada[]] {
  const marcar = (este: string, aquel: string): PalabraComparada[] => {
    const quedan = new Map<string, number>();
    for (const palabra of aquel.split(/\s+/).filter(Boolean)) {
      const clave = normalizarTexto(palabra);
      quedan.set(clave, (quedan.get(clave) ?? 0) + 1);
    }
    return este
      .split(/\s+/)
      .filter(Boolean)
      .map((texto) => {
        const clave = normalizarTexto(texto);
        // Un signo suelto («–», «/») no es una palabra que cambie.
        if (!clave) return { texto, distinta: false };
        const cuantas = quedan.get(clave) ?? 0;
        if (cuantas > 0) quedan.set(clave, cuantas - 1);
        return { texto, distinta: cuantas === 0 };
      });
  };
  return [marcar(uno, otro), marcar(otro, uno)];
}

/** Un nombre con las palabras que cambian en negrita: «Corsair … DDR5 6000 **CL30**». */
export function NombreComparado({ palabras }: { palabras: PalabraComparada[] }) {
  return (
    <>
      {palabras.map((palabra, i) => (
        <span key={i}>
          {i > 0 && ' '}
          {palabra.distinta ? (
            <b className="font-extrabold text-tinta">{palabra.texto}</b>
          ) : (
            palabra.texto
          )}
        </span>
      ))}
    </>
  );
}
