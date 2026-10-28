import { Conversacion } from '@/features/mensajes/conversacion';

export default async function PaginaConversacion({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Conversacion key={id} id={id} />;
}
