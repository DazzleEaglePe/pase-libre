import { Controller, Get, UseGuards } from '@nestjs/common';
import type { RespuestaCuenta } from '@paselibre/contracts';

import { SesionActual, SesionGuard } from '../../shared/guards/sesion.guard';
import type { SesionActiva } from '../sesion/sesion.types';

/** Configuración de la cuenta (RF-58). Por ahora solo lectura; la edición llega el 30/10. */
@Controller('cuenta')
@UseGuards(SesionGuard)
export class CuentaController {
  @Get()
  cuenta(@SesionActual() { usuario }: SesionActiva): RespuestaCuenta {
    const { tienda } = usuario;
    return {
      usuario: {
        usuario: usuario.usuario,
        nombre: usuario.nombre,
        correo: usuario.correo,
        whatsapp: usuario.whatsapp,
      },
      tienda: tienda
        ? {
            nombre: tienda.nombre,
            tipo: tienda.tipo,
            galeria: tienda.galeria?.nombre ?? null,
            stand: tienda.stand,
            whatsapp: tienda.whatsapp,
            horario: tienda.horario,
            descripcion: tienda.descripcion,
            precio_visible_defecto: tienda.precioVisibleDefecto,
            moneda_defecto: tienda.monedaDefecto,
          }
        : null,
    };
  }
}
