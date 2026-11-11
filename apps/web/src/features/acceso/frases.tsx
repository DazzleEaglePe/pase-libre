'use client';

import { useEffect, useState } from 'react';

const FRASES = [
  'Hoy lo pasas tú, mañana te lo pasan a ti.',
  'Juntos, Wilson lo tiene todo.',
  'Lo que no está en tu stand, está en el de tu vecino.',
  'Entre tiendas no hay competencia: hay pases.',
  'Un cliente que se queda en Wilson es una venta para todos.',
];

/**
 * Las frases de abajo del verde (COR3): cambian cada 4,5 s con sus puntitos. Con «reducir
 * movimiento» se queda la primera.
 */
export function FrasesQueCambian() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const reloj = setInterval(() => setI((actual) => (actual + 1) % FRASES.length), 4500);
    return () => clearInterval(reloj);
  }, []);
  return (
    <div className="flex flex-col gap-3">
      <p aria-live="off" className="m-0 text-[17px] font-bold italic">
        «{FRASES[i]}»
      </p>
      <span aria-hidden="true" className="flex items-center gap-1.5">
        {FRASES.map((frase, k) => (
          <span
            key={frase}
            className={`h-2 rounded-full transition-all ${k === i ? 'w-[22px] bg-acento' : 'w-2 bg-white/35'}`}
          />
        ))}
      </span>
    </div>
  );
}
