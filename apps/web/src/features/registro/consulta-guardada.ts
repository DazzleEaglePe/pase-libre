/**
 * El código con el que quien se registró vuelve a ver su solicitud. Va en la dirección de la
 * pantalla de estado y, de respaldo, en este aparato: así «Mi solicitud» sirve aunque cierre la
 * pestaña. Si el navegador no deja guardar, no pasa nada: tiene la dirección.
 */
const CLAVE = 'pl_solicitud';

export function guardarConsulta(consulta: string): void {
  try {
    window.localStorage.setItem(CLAVE, consulta);
  } catch {
    // Sin almacenamiento (modo privado): se sigue con la dirección.
  }
}

export function consultaGuardada(): string | null {
  try {
    return window.localStorage.getItem(CLAVE);
  } catch {
    return null;
  }
}
