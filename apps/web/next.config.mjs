import path from 'node:path';
import { fileURLToPath } from 'node:url';

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const apiInterna = process.env.API_INTERNAL_URL ?? 'http://localhost:3001';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  outputFileTracingRoot: workspaceRoot,
  poweredByHeader: false,
  // En local, la «N» de Next va a la derecha: abajo a la izquierda está la tarjeta de Pases del día.
  devIndicators: { position: 'bottom-right' },
  reactStrictMode: true,
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  // En vivo se llamó así hasta el 29/10; en la web ahora es «Pases del día» (D-53).
  async redirects() {
    return [
      { source: '/en-vivo', destination: '/pases-del-dia', permanent: true },
      { source: '/en-vivo/publicar', destination: '/pases-del-dia/publicar', permanent: true },
    ];
  },
  // La web y la API comparten origen: la cookie de sesión es del mismo sitio.
  // En producción nginx manda /v1 a la API y sirve /media desde el volumen de fotos;
  // en local lo hacen estos rewrites.
  async rewrites() {
    return [
      { source: '/v1/:ruta*', destination: `${apiInterna}/v1/:ruta*` },
      { source: '/media/:ruta*', destination: `${apiInterna}/media/:ruta*` },
    ];
  },
};

export default nextConfig;
