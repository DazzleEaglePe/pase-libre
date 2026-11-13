/**
 * Los 3 puntitos de «escribiendo…» (doc 19, punto 19): una burbuja gris donde va a aparecer el
 * mensaje; saltan uno tras otro (1,2 s por vuelta, 0,15 s entre puntitos). Con «reducir
 * movimiento», quietos.
 */
export function Puntitos({ quien }: { quien: string }) {
  return (
    <div
      role="status"
      aria-label={`${quien} está escribiendo`}
      className="chat-puntitos flex shrink-0 gap-[5px] self-start rounded-2xl bg-[#f1f4f2] px-3.5 py-3"
    >
      <span className="chat-punto" aria-hidden="true" />
      <span className="chat-punto" aria-hidden="true" />
      <span className="chat-punto" aria-hidden="true" />
    </div>
  );
}
