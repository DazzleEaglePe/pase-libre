import type { RespuestaOpcionesRegistro } from '@paselibre/contracts';
import type { Metadata } from 'next';

import { EstadoSolicitud } from '@/features/registro/estado-solicitud';
import { consultarApi } from '@/shared/api/servidor';
import { enlaceWhatsappEquipo } from '@/shared/whatsapp-equipo';
import { MarcoPagina } from '@/shared/ui/marco-pagina';

export const metadata: Metadata = {
  title: 'Tu solicitud',
  // La dirección lleva el código de consulta: que no salga en buscadores ni a otros sitios.
  robots: { index: false },
  referrer: 'no-referrer',
};

/** `/registro/solicitud/:consulta`: cómo va la solicitud, con el código que solo conoce quien la envió. */
export default async function PaginaSolicitud({
  params,
}: {
  params: Promise<{ consulta: string }>;
}) {
  const { consulta } = await params;
  const { cuerpo: opciones } = await consultarApi<RespuestaOpcionesRegistro>('/registro/opciones');

  return (
    <MarcoPagina sesion={null}>
      <main className="mx-auto w-full max-w-[760px] flex-1 px-4 pb-16 pt-8 sm:px-8 sm:pt-12">
        <EstadoSolicitud
          consulta={consulta}
          opciones={opciones ?? { activo: false, galerias: [], categorias: [] }}
          whatsappEquipo={enlaceWhatsappEquipo(
            'Hola, necesito ayuda con mi solicitud de cuenta en PaseLibre.',
          )}
        />
      </main>
    </MarcoPagina>
  );
}
