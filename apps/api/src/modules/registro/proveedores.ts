import { Injectable, Logger } from '@nestjs/common';
import { rucValido, type DatosRuc } from '@paselibre/contracts';

/**
 * Los dos servicios de afuera que necesita el registro propio. Hoy solo hay versiones
 * simuladas (no hay contrato con un proveedor de SMS ni de consulta a SUNAT): por eso la API
 * se niega a encender `REGISTRO_PROPIO` en producción. Cuando existan los reales, se agregan
 * aquí con la misma forma y se cambia el `useClass` de `registro.module.ts`.
 */
export const PROVEEDOR_SMS = Symbol('PROVEEDOR_SMS');
export const PROVEEDOR_RUC = Symbol('PROVEEDOR_RUC');

export interface ProveedorSms {
  /** Con los simulados, el código viaja en la respuesta; con uno real, nunca. */
  readonly simulado: boolean;
  enviar(celular: string, texto: string): Promise<void>;
}

export interface ProveedorRuc {
  /** `null` si SUNAT no lo conoce. */
  consultar(ruc: string): Promise<DatosRuc | null>;
}

/** Guarda lo «enviado» para que las pruebas y el equipo lo puedan leer, y lo deja en el log. */
@Injectable()
export class SmsSimulado implements ProveedorSms {
  readonly simulado = true;
  readonly enviados: Array<{ celular: string; texto: string; en: Date }> = [];
  private readonly log = new Logger('SmsSimulado');

  enviar(celular: string, texto: string): Promise<void> {
    this.enviados.push({ celular, texto, en: new Date() });
    if (this.enviados.length > 200) this.enviados.shift();
    this.log.log(`SMS a ${celular}: ${texto}`);
    return Promise.resolve();
  }
}

/** RUC de ejemplo con el que se prueba a mano: «Tienda B Computer S.A.C.», activo y habido. */
export const RUC_DE_EJEMPLO = '20512345671';

/**
 * SUNAT de mentira. La decisión sale del dígito anterior al de control, para poder probar
 * los tres caminos escribiendo un RUC: termina en …0x → de baja y no habido; …9x → no existe;
 * cualquier otro → activo y habido.
 */
@Injectable()
export class RucSimulado implements ProveedorRuc {
  consultar(ruc: string): Promise<DatosRuc | null> {
    if (!rucValido(ruc)) return Promise.resolve(null);
    if (ruc === RUC_DE_EJEMPLO) {
      return Promise.resolve({
        razon_social: 'TIENDA B COMPUTER S.A.C.',
        estado: 'ACTIVO',
        condicion: 'HABIDO',
        domicilio: 'Cercado de Lima',
      });
    }
    const decisivo = ruc[9];
    if (decisivo === '9') return Promise.resolve(null);
    const activo = decisivo !== '0';
    return Promise.resolve({
      razon_social: `EMPRESA ${ruc.slice(2, 6)} S.A.C.`,
      estado: activo ? 'ACTIVO' : 'BAJA DE OFICIO',
      condicion: activo ? 'HABIDO' : 'NO HABIDO',
      domicilio: 'Cercado de Lima',
    });
  }
}
