/**
 * Carga con muchos visitantes distintos (opcional: --estres). Satura los límites de la API
 * a propósito, así que no se corre contra una demo en uso; deja pasar un minuto al final
 * para que la ventana de límites se despeje.
 *
 * Por qué 160: la API limita por ruta (cada ruta lleva su propio contador) y a quien no tiene
 * sesión lo cuenta por IP: 120 pedidos por minuto en cada ruta y solo 60 en la búsqueda
 * (docs/08 §4). Una página de resultados hace un pedido a `/buscar`, así que con menos de 60
 * visitantes en un minuto el límite no se toca aunque la web no reenvíe la IP de cada uno. Con
 * 160 sí: sin el reenvío, desde el 61.º reciben el error 500 de la web (con el código viejo
 * dio 60 respuestas 200 y 90 errores).
 */
import { dormir } from '../comun.mjs';
import { afirmar, grupo, prueba } from './corredor.mjs';

const VISITANTES = 160;
const CADA_MS = 150;

export async function verificarCarga({ web }) {
  grupo('Carga: muchos visitantes distintos a la vez (--estres)');
  await prueba(
    `${VISITANTES} visitantes distintos abren la misma página en ${Math.round((VISITANTES * CADA_MS) / 1000)} s y nadie ve un error`,
    async () => {
      const estados = {};
      await Promise.all(
        Array.from({ length: VISITANTES }, async (_, i) => {
          await dormir(i * CADA_MS);
          // Cada visitante llega con su propia IP, como detrás de nginx.
          const r = await fetch(`${web}/buscar?categoria=graficas`, {
            headers: { 'x-forwarded-for': `203.0.113.${(i % 250) + 1}` },
          });
          await r.text();
          estados[r.status] = (estados[r.status] ?? 0) + 1;
        }),
      );
      const mal = Object.keys(estados).some((s) => s !== '200');
      afirmar(
        !mal,
        `respuestas ${JSON.stringify(estados)}: la web llama a la API desde su propia IP y no reenvía la del visitante, así que todos los visitantes sin sesión comparten el límite de la API (60 búsquedas por minuto entre todos)`,
      );
      return `respuestas ${JSON.stringify(estados)}`;
    },
  );
  console.log('  … esperando un minuto a que se despejen los límites de la API');
  await dormir(70_000);
}
