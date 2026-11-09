/**
 * Guarda en memoria, por `ms`, lo que es igual para todos y cambia poco (categorías, galerías y
 * totales de la portada). Pedidos a la vez comparten la misma consulta. Si falla, no se guarda.
 * En las pruebas no guarda nada: cada prueba crea datos y espera verlos al instante.
 */
export function recordarPor<T>(ms: number, cargar: () => Promise<T>): () => Promise<T> {
  let guardado: { hasta: number; promesa: Promise<T> } | null = null;
  return () => {
    if (process.env.NODE_ENV === 'test' || ms <= 0) return cargar();
    const ahora = Date.now();
    if (guardado && guardado.hasta > ahora) return guardado.promesa;
    const promesa = cargar().catch((error: unknown) => {
      guardado = null;
      throw error;
    });
    guardado = { hasta: ahora + ms, promesa };
    return promesa;
  };
}

/** Lo mismo, por clave: guarda cada valor `ms` y deja de crecer en `maximo` claves. */
export class MemoriaPorClave<V> {
  private readonly valores = new Map<string, { hasta: number; valor: V }>();

  constructor(
    private readonly ms: number,
    private readonly maximo = 5_000,
  ) {}

  leer(clave: string): V | undefined {
    if (process.env.NODE_ENV === 'test') return undefined;
    const fila = this.valores.get(clave);
    if (!fila) return undefined;
    if (fila.hasta < Date.now()) {
      this.valores.delete(clave);
      return undefined;
    }
    return fila.valor;
  }

  /** `true` si estaba guardada, aunque el valor sea `undefined`. */
  tiene(clave: string): boolean {
    if (process.env.NODE_ENV === 'test') return false;
    const fila = this.valores.get(clave);
    return Boolean(fila && fila.hasta >= Date.now());
  }

  guardar(clave: string, valor: V): void {
    if (process.env.NODE_ENV === 'test') return;
    if (this.valores.size >= this.maximo) this.valores.clear();
    this.valores.set(clave, { hasta: Date.now() + this.ms, valor });
  }
}
