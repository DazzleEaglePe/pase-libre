'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { llamarApi } from '@/shared/api/cliente';

import { InvitacionPie } from './invitacion-pie';

/**
 * Las secciones de la barra negra donde va la banda «¿Conoces una tienda…?» al final (doc 19,
 * punto 14): Todas las categorías (su página, los precios por modelo y los resultados de una
 * categoría), Pedidos en vivo y Remates de hoy, Recién llegados, De tiendas que sigues y Wilson
 * en vivo. El inicio lleva la suya (`BannerInvitar`); Mensajes, Publicar, Configuración y el
 * panel no llevan ninguna.
 */
export function enSeccionDeLaBarra(ruta: string, parametros: URLSearchParams): boolean {
  if (ruta === '/categorias' || ruta.startsWith('/categorias/')) return true;
  if (ruta === '/buscar') {
    return parametros.has('categoria') || parametros.get('orden') === 'recientes';
  }
  return (
    ruta === '/pedidos-en-vivo' || ruta === '/tiendas-que-sigues' || ruta === '/wilson-en-vivo'
  );
}

/**
 * Si se cerró en esta visita: el pie de otra sección (o del otro grupo de páginas) no la vuelve
 * a mostrar aunque la sesión que trajo el servidor sea de antes de la X.
 */
let cerradaEnEstaVisita = false;

function Banda({ cerrada }: { cerrada: boolean }) {
  const ruta = usePathname();
  const parametros = useSearchParams();
  const [oculta, setOculta] = useState(cerrada || cerradaEnEstaVisita);
  if (oculta || !enSeccionDeLaBarra(ruta, new URLSearchParams(parametros.toString()))) {
    return null;
  }

  function cerrar() {
    cerradaEnEstaVisita = true;
    setOculta(true);
    // Si no se guardó, vuelve a salir la próxima vez: no hay nada más que hacer aquí.
    void llamarApi('/secciones/invitar-cerrado', { metodo: 'POST', cuerpo: {} }).catch(
      () => undefined,
    );
  }

  return <InvitacionPie conSesion alCerrar={cerrar} />;
}

/**
 * La banda «¿Conoces una tienda que debería estar aquí?» dentro del pie de las secciones de la
 * barra negra (doc 19, punto 14). Es la misma del inicio, con su X; pero aquí, si la cierran, no
 * vuelve más en ninguna sección (se guarda en la cuenta, `invitar_secciones_cerrado`).
 */
export function InvitacionSecciones({ cerrada }: { cerrada: boolean }) {
  return (
    <Suspense fallback={null}>
      <Banda cerrada={cerrada} />
    </Suspense>
  );
}
