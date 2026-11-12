// ¿Cuánta memoria cuestan los contadores del limitador con muchas IPs? (docs/16 §3)
//   UNICAS=0 k6 run ips.js   (40 IPs)   frente a   UNICAS=1 k6 run ips.js   (120 000 IPs)
// Mide el proceso de la API (RSS) antes y después de cada corrida. Solo contra una API local.
import http from 'k6/http';
export const options = { vus: 50, iterations: 120000 };
export default function () {
  const unicas = __ENV.UNICAS === '1';
  const n = __ITER * 50 + __VU;
  const ip = unicas ? `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}` : `10.7.7.${n % 40}`;
  http.get(`${__ENV.BASE || 'http://localhost:3042'}/v1/categorias`, { headers: { 'X-Forwarded-For': ip } });
}
