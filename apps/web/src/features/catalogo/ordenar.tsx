'use client';

import { useRouter } from 'next/navigation';

/** «Ordenar» de los resultados: cambia de dirección al elegir, sin botón aparte. */
export function Ordenar({
  actual,
  opciones,
}: {
  actual: string;
  opciones: { valor: string; texto: string; href: string }[];
}) {
  const router = useRouter();
  return (
    <label className="flex items-center gap-2 text-apoyo text-secundario">
      Ordenar
      <select
        value={actual}
        onChange={(evento) => {
          const elegida = opciones.find((opcion) => opcion.valor === evento.target.value);
          if (elegida) router.push(elegida.href);
        }}
        className="h-10 rounded-xl border border-borde-control bg-white px-3 text-apoyo font-medium text-tinta"
      >
        {opciones.map((opcion) => (
          <option key={opcion.valor} value={opcion.valor}>
            {opcion.texto}
          </option>
        ))}
      </select>
    </label>
  );
}
