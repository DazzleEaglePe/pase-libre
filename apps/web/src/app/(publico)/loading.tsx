/**
 * Mientras carga una página del catálogo (portada o resultados): la forma de lo que viene, para
 * que en 4G se note que el toque funcionó. Sin animación con «reducir movimiento».
 */
export default function Cargando() {
  return (
    <div role="status" aria-label="Cargando" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="h-8 w-2/3 max-w-[420px] rounded-lg bg-superficie" />
        <span className="h-4 w-1/2 max-w-[320px] rounded bg-superficie" />
      </div>
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <li
            key={i}
            className="flex flex-col gap-3 rounded-2xl border border-linea p-3 motion-safe:animate-pulse"
          >
            <span className="aspect-[4/3] w-full rounded-xl bg-superficie" />
            <span className="h-4 w-11/12 rounded bg-superficie" />
            <span className="h-3 w-2/3 rounded bg-superficie" />
            <span className="h-5 w-1/3 rounded bg-superficie" />
          </li>
        ))}
      </ul>
    </div>
  );
}
