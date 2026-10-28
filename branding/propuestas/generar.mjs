/**
 * Arma la hoja de propuestas de línea gráfica de PaseLibre.
 *
 *   cd branding && npm run propuestas
 *
 * Escribe `propuestas/index.html` y avisa si algún par de colores de texto no llega a 4,5:1.
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { PROPUESTAS } from './datos.mjs';
import { contraste, hojaDePropuestas } from './hoja.mjs';

const destino = fileURLToPath(new URL('./index.html', import.meta.url));
writeFileSync(destino, hojaDePropuestas());

const pares = [
  ['texto', 'fondo'],
  ['texto', 'superficie'],
  ['suave', 'fondo'],
  ['sobrePrimario', 'primario'],
  ['sobreExito', 'exito'],
  ['sobreAlerta', 'alerta'],
  ['sobreOscuro', 'oscuro'],
];
for (const propuesta of PROPUESTAS) {
  const resumen = pares.map(([a, b]) => {
    const razon = contraste(propuesta.tokens[a], propuesta.tokens[b]);
    return `${a}/${b} ${razon.toFixed(1)}${razon < 4.5 ? ' ✗' : ''}`;
  });
  console.log(`${propuesta.nombre}: ${resumen.join(' · ')}`);
}
console.log('Listo: propuestas/index.html');
