import { NextResponse, type NextRequest } from 'next/server';

/**
 * paselibre.shop abre en «Inicia sesión» (guía y COR3 del lienzo final). Sin la cookie de sesión
 * se redirige aquí, antes de pintar nada: la portada lleva `loading.tsx` y una redirección desde
 * la página saldría como 200 con «refresh». Con una cookie vencida lo resuelve la página.
 */
export function middleware(pedido: NextRequest) {
  if (pedido.cookies.has('pl_sesion')) return NextResponse.next();
  const destino = pedido.nextUrl.clone();
  destino.pathname = '/ingresar';
  destino.search = '';
  return NextResponse.redirect(destino, 307);
}

export const config = { matcher: ['/'] };
