const MESES = [
  'ene.',
  'feb.',
  'mar.',
  'abr.',
  'may.',
  'jun.',
  'jul.',
  'ago.',
  'set.',
  'oct.',
  'nov.',
  'dic.',
];
const MES_Y_ANIO = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Lima',
  year: 'numeric',
  month: 'numeric',
});

/** «nov. 2026», en hora de Lima. */
export function mesCorto(iso: string): string {
  const partes = MES_Y_ANIO.formatToParts(new Date(iso));
  const mes = Number(partes.find((parte) => parte.type === 'month')?.value ?? '1');
  const anio = partes.find((parte) => parte.type === 'year')?.value ?? '';
  return `${MESES[mes - 1] ?? ''} ${anio}`.trim();
}

/**
 * El sello dorado «★ Fundadora» (doc 20, punto 7): va solo en el perfil de la tienda, junto a su
 * nombre. En las tarjetas del feed no sale.
 */
export function SelloFundadora() {
  return (
    <span className="inline-flex h-6 shrink-0 items-center whitespace-nowrap rounded-full bg-[linear-gradient(135deg,#F7D774,#C99A2E)] px-2.5 text-[12px] font-extrabold text-[#3B2A00]">
      ★ Fundadora
    </span>
  );
}
