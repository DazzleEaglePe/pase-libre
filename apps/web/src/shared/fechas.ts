const DIA_LIMA = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima' });

/** Días de calendario en Lima entre una fecha y ahora: ayer a las 23:59 ya es «Ayer». */
function diasDesde(iso: string, ahora = new Date()): number {
  const dia = (fecha: Date) => Date.parse(DIA_LIMA.format(fecha));
  return Math.max(0, Math.round((dia(ahora) - dia(new Date(iso))) / 86_400_000));
}

/** «Hoy», «Ayer» o «Hace 9 días», como la columna «Actualizado» del lienzo. */
export function haceCuanto(iso: string, ahora = new Date()): string {
  const dias = diasDesde(iso, ahora);
  if (dias === 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  return `Hace ${dias} días`;
}
