import Link from 'next/link';

import { ContactoEquipo, DatoResponsable, Documento, Seccion } from './documento';

/** Términos de uso (RNF-22, RNF-23). Borrador: ver `BORRADOR` en documento.tsx. */
export function Terminos() {
  return (
    <Documento
      titulo="Términos de uso"
      resumen="Las reglas para usar PaseLibre. Son cortas: léelas antes de publicar."
    >
      <Seccion titulo="1. Qué es PaseLibre">
        <p>
          PaseLibre es una plataforma gratuita para que las tiendas y los vendedores independientes
          de las galerías de Wilson publiquen los componentes de PC y periféricos que tienen, y se
          encuentren entre ellos para hacer pases.
        </p>
        <p>
          PaseLibre lo administra <DatoResponsable campo="nombre" /> (RUC{' '}
          <DatoResponsable campo="ruc" />
          ). Al usar PaseLibre aceptas estos términos.
        </p>
      </Seccion>

      <Seccion titulo="2. PaseLibre no vende ni intermedia" id="no-intermedia">
        <p>
          PaseLibre solo pone en contacto a quien busca con quien tiene. El precio, el pago, la
          entrega, la garantía y cualquier otro acuerdo son entre ustedes. PaseLibre no cobra
          comisiones, no recibe pagos y no responde por lo que se pacte entre las partes.
        </p>
        <p>
          Antes de pagar, revisa el producto y confirma con quién estás tratando. Desconfía de
          precios muy por debajo del mercado.
        </p>
      </Seccion>

      <Seccion titulo="3. Tu cuenta">
        <ul>
          <li>
            Por ahora las cuentas las crea el equipo de PaseLibre para dueños de tienda, asesores y
            vendedores independientes. No hay registro abierto.
          </li>
          <li>
            La cuenta es personal. No la compartas: lo que se haga con ella es responsabilidad de
            quien la tiene.
          </li>
          <li>
            Si crees que alguien más entró a tu cuenta, cambia tu contraseña en Configuración y
            avísale al equipo.
          </li>
          <li>Los datos de tu tienda tienen que ser ciertos: nombre, galería, stand y WhatsApp.</li>
        </ul>
      </Seccion>

      <Seccion titulo="4. Qué puedes publicar" id="reglas">
        <ul>
          <li>Componentes de PC y periféricos que tengas o puedas conseguir.</li>
          <li>
            Con datos ciertos: condición (nuevo o usado), cantidad disponible y, si lo muestras,
            precio.
          </li>
          <li>Con fotos tuyas o que tengas permiso de usar.</li>
          <li>
            Mantén el stock al día. Si algo ya no lo tienes, bájale la cantidad, pausa la
            publicación o elimínala.
          </li>
        </ul>
      </Seccion>

      <Seccion titulo="5. Qué no está permitido">
        <ul>
          <li>Publicar productos robados, falsificados o cuya venta esté prohibida.</li>
          <li>Publicar productos que no tienes para atraer contactos.</li>
          <li>Insultar, amenazar o acosar a alguien por mensajes.</li>
          <li>Mandar publicidad o mensajes repetidos que nadie pidió.</li>
          <li>
            Copiar el catálogo con programas automáticos, o intentar ver precios o datos de las
            tiendas sin una cuenta.
          </li>
          <li>Usar la cuenta de otra persona.</li>
        </ul>
      </Seccion>

      <Seccion titulo="6. Mensajes">
        <p>
          Los mensajes son privados entre las dos personas de la conversación: el equipo de
          PaseLibre no los lee. Si alguien te molesta, puedes bloquearlo o denunciarlo desde la
          conversación. Para revisar una denuncia, el equipo puede pedirte que le muestres los
          mensajes.
        </p>
      </Seccion>

      <Seccion titulo="7. Si no se cumplen estas reglas">
        <p>
          El equipo puede pausar publicaciones o suspender cuentas que no cumplan estos términos,
          sobre todo después de una denuncia. Si crees que fue un error, escríbele al equipo.
        </p>
        <p>
          También puedes pedir que se elimine tu cuenta cuando quieras; la{' '}
          <Link href="/privacidad" className="font-medium underline">
            política de privacidad
          </Link>{' '}
          explica qué pasa con tus datos.
        </p>
      </Seccion>

      <Seccion titulo="8. Costo">
        <p>
          PaseLibre es gratis. Si algún día se cobra por algo, se avisará antes y nadie pagará sin
          haberlo aceptado.
        </p>
      </Seccion>

      <Seccion titulo="9. Cambios a estos términos">
        <p>
          Si estos términos cambian, la fecha de arriba cambia y, si el cambio es importante, se
          avisará en PaseLibre.
        </p>
      </Seccion>

      <Seccion titulo="10. Ley y contacto">
        <p>Estos términos se rigen por las leyes del Perú.</p>
        <p>
          Para cualquier duda,{' '}
          <ContactoEquipo mensaje="Hola, tengo una duda sobre los términos de PaseLibre." />.
        </p>
      </Seccion>
    </Documento>
  );
}
