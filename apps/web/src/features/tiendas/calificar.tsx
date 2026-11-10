'use client';

import { ASPECTOS_DEL_COMPRADOR, ASPECTOS_DEL_VENDEDOR } from '@paselibre/contracts';
import { IconStar, IconStarFilled } from '@tabler/icons-react';
import { useId, useState } from 'react';

import { ErrorApi, llamarApi } from '@/shared/api/cliente';

/**
 * «¿Cómo te fue con Computer Shock?» (PCH_WebCalificar, PCH_CelCalificar): las estrellas, lo que
 * se marca y un texto opcional. Quien compró califica a quien vendió (`deVendedor`); quien
 * vendió, a quien compró. Va en el chat al cerrar la venta y en el historial.
 */
export function TarjetaCalificar({
  ventaId,
  tienda,
  deVendedor = true,
  alTerminar,
}: {
  ventaId: string;
  tienda: string;
  /** Se califica a quien vendió (lo hace quien compró). */
  deVendedor?: boolean;
  alTerminar: (estrellas: number) => void;
}) {
  const id = useId();
  const [estrellas, setEstrellas] = useState(0);
  const [aspectos, setAspectos] = useState<string[]>([]);
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lista: readonly string[] = deVendedor ? ASPECTOS_DEL_VENDEDOR : ASPECTOS_DEL_COMPRADOR;

  async function enviar() {
    setEnviando(true);
    setError(null);
    try {
      await llamarApi(`/ventas/${ventaId}/opinion`, {
        metodo: 'POST',
        cuerpo: { estrellas, aspectos, ...(texto.trim() ? { texto: texto.trim() } : {}) },
      });
      alTerminar(estrellas);
    } catch (falla) {
      setError(falla instanceof ErrorApi ? falla.message : 'No pudimos enviar tu opinión.');
      setEnviando(false);
    }
  }

  return (
    <div className="flex flex-col gap-3.5 rounded-2xl border-2 border-pase bg-pase-suave p-4 sm:p-5">
      <div className="flex flex-col gap-1">
        <b className="text-[17px] font-bold leading-6">¿Cómo te fue con {tienda}?</b>
        <span className="text-apoyo text-secundario">
          Opcional. La venta ya cuenta; esto suma a su reputación.
        </span>
      </div>
      <div role="radiogroup" aria-label="Estrellas" className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((numero) => (
          <button
            key={numero}
            type="button"
            role="radio"
            aria-checked={estrellas === numero}
            aria-label={`${numero} ${numero === 1 ? 'estrella' : 'estrellas'}`}
            onClick={() => setEstrellas(numero)}
            className="flex h-11 w-11 items-center justify-center rounded-full text-[#D49B00] hover:bg-white"
          >
            {numero <= estrellas ? (
              <IconStarFilled size={28} aria-hidden="true" />
            ) : (
              <IconStar size={28} stroke={1.6} aria-hidden="true" />
            )}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {lista.map((aspecto) => {
          const marcado = aspectos.includes(aspecto);
          return (
            <button
              key={aspecto}
              type="button"
              aria-pressed={marcado}
              onClick={() =>
                setAspectos(
                  marcado ? aspectos.filter((otro) => otro !== aspecto) : [...aspectos, aspecto],
                )
              }
              className={`h-10 rounded-full border px-3.5 text-apoyo ${
                marcado
                  ? 'border-tinta bg-tinta font-bold text-white'
                  : 'border-borde bg-white font-medium text-tinta'
              }`}
            >
              {aspecto}
            </button>
          );
        })}
      </div>
      <label htmlFor={`${id}-texto`} className="sr-only">
        Tu opinión
      </label>
      <textarea
        id={`${id}-texto`}
        value={texto}
        maxLength={500}
        rows={2}
        onChange={(evento) => setTexto(evento.target.value)}
        placeholder="Cuéntale a otras tiendas cómo te fue (opcional)"
        className="min-h-16 resize-y rounded-xl border border-borde bg-white px-3.5 py-3 text-cuerpo placeholder:text-detalle"
      />
      {error && (
        <p role="alert" className="m-0 text-apoyo text-error">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          disabled={estrellas === 0 || enviando}
          onClick={() => void enviar()}
          className="h-11 rounded-full bg-pase px-5 font-bold text-white disabled:bg-borde"
        >
          {enviando ? 'Enviando…' : 'Enviar opinión'}
        </button>
        <span className="text-nota text-secundario">
          Suma a su reputación. La otra tienda no ve quién dio cada estrella.
        </span>
      </div>
    </div>
  );
}
