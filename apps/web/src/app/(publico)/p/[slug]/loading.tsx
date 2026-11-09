/** Mientras carga la ficha de un producto: la foto a la izquierda y las tiendas a la derecha. */
export default function CargandoFicha() {
  return (
    <div role="status" aria-label="Cargando el producto" className="grid gap-8 md:grid-cols-2">
      <span className="aspect-square w-full rounded-[20px] bg-superficie motion-safe:animate-pulse" />
      <div className="flex flex-col gap-3 motion-safe:animate-pulse">
        <span className="h-8 w-11/12 rounded-lg bg-superficie" />
        <span className="h-4 w-1/2 rounded bg-superficie" />
        {Array.from({ length: 3 }, (_, i) => (
          <span key={i} className="h-24 w-full rounded-2xl border border-linea bg-white" />
        ))}
      </div>
    </div>
  );
}
