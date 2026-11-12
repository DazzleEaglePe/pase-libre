import { Conversacion } from '@/features/mensajes/conversacion';
import { obtenerSesion } from '@/shared/api/servidor';
import { sesionPuede } from '@/shared/permisos';

export default async function PaginaConversacion({ params }: { params: Promise<{ id: string }> }) {
  const [{ id }, sesion] = await Promise.all([params, obtenerSesion()]);
  // «Marcar vendido» y «Deshacer» solo para quien tiene ese permiso (N12); la API también lo exige.
  return (
    <Conversacion key={id} id={id} puedeMarcarVendido={sesionPuede(sesion, 'MARCAR_VENDIDO')} />
  );
}
