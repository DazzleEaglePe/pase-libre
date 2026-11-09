import { isIPv6 } from 'node:net';

/**
 * La clave con la que se cuenta una IP en los límites. Una IPv4 es ella misma; una IPv6 cuenta
 * por su /64, porque un solo cliente suele tener el /64 entero y, si no, podría estrenar una
 * dirección por pedido. Las IPv4 escritas como IPv6 (`::ffff:1.2.3.4`) vuelven a IPv4.
 */
export function claveDeIp(ip: string | undefined | null): string {
  if (!ip) return 'desconocida';
  const mapeada = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (mapeada) return mapeada[1]!;
  if (!isIPv6(ip)) return ip;
  const sinZona = ip.split('%')[0]!.toLowerCase();
  const [izquierda = '', derecha = ''] = sinZona.split('::');
  const partesIzq = izquierda ? izquierda.split(':') : [];
  const partesDer = sinZona.includes('::') && derecha ? derecha.split(':') : [];
  const relleno = sinZona.includes('::') ? 8 - partesIzq.length - partesDer.length : 0;
  const grupos = [...partesIzq, ...Array<string>(Math.max(0, relleno)).fill('0'), ...partesDer];
  return `${grupos
    .slice(0, 4)
    .map((g) => g.replace(/^0+(?=.)/, ''))
    .join(':')}::/64`;
}
