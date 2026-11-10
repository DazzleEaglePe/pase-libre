import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  precioDe,
  TEXTO_MODO_VENTA,
  TIENDA_RESERVADA,
  type HistorialConsulta,
  type RespuestaHistorial,
  type VentaEnHistorial,
} from '@paselibre/contracts';
import type { Prisma } from '@prisma/client';
import ExcelJS from 'exceljs';

import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ApiHttpException } from '../../shared/errors/api-http.exception';
import { AvisosService } from '../mensajes/avisos.service';
import type { SesionActiva } from '../sesion/sesion.types';

const NOMBRE_MES = new Intl.DateTimeFormat('es-PE', { month: 'long', timeZone: 'UTC' });
const MES_LIMA = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Lima',
  year: 'numeric',
  month: '2-digit',
});

/** «2026-11» del momento en Lima. */
const mesDe = (fecha: Date) => MES_LIMA.format(fecha).slice(0, 7);

/** Inicio y fin de un mes en hora de Lima (UTC-5, sin horario de verano). */
function rangoDe(mes: string): { desde: Date; hasta: Date } {
  const [anio, numero] = mes.split('-').map(Number) as [number, number];
  return {
    desde: new Date(Date.UTC(anio, numero - 1, 1, 5)),
    hasta: new Date(Date.UTC(anio, numero, 1, 5)),
  };
}

/** «2026-11» y 2 → «2026-09». */
function mesAnterior(mes: string, atras: number): string {
  const [anio, numero] = mes.split('-').map(Number) as [number, number];
  const fecha = new Date(Date.UTC(anio, numero - 1 - atras, 15));
  return `${fecha.getUTCFullYear()}-${String(fecha.getUTCMonth() + 1).padStart(2, '0')}`;
}

const etiquetaDe = (mes: string) => {
  const [anio, numero] = mes.split('-').map(Number) as [number, number];
  const nombre = NOMBRE_MES.format(new Date(Date.UTC(anio, numero - 1, 15)));
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
};

const SELECT_VENTA = {
  id: true,
  creadaEn: true,
  precioCentimos: true,
  moneda: true,
  recordadaEn: true,
  conversacionId: true,
  tiendaCompradora: { select: { id: true, nombre: true } },
  opiniones: { select: { lado: true, estrellas: true } },
  oferta: {
    select: {
      modoVenta: true,
      tiendaVisible: true,
      tienda: { select: { id: true, nombre: true } },
      producto: {
        select: {
          titulo: true,
          slug: true,
          categoria: { select: { slug: true, nombre: true } },
          fotos: { select: { ruta: true }, orderBy: { orden: 'asc' }, take: 1 },
        },
      },
    },
  },
} satisfies Prisma.VentaSelect;

type FilaVenta = Prisma.VentaGetPayload<{ select: typeof SELECT_VENTA }>;

/**
 * «Mis ventas y compras» (HI_A2_Web, sección 16 del lienzo final) y la pestaña «Vendidos» de
 * Mis publicaciones: cada venta marcada en el chat, por mes, con quién y cómo calificaron.
 */
@Injectable()
export class HistorialService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(AvisosService) private readonly avisos: AvisosService,
  ) {}

  private donde(lado: 'ventas' | 'compras', tiendaId: string): Prisma.VentaWhereInput {
    return lado === 'ventas' ? { oferta: { tiendaId } } : { tiendaCompradoraId: tiendaId };
  }

  async historial(consulta: HistorialConsulta, sesion: SesionActiva): Promise<RespuestaHistorial> {
    const tiendaId = sesion.usuario.tiendaId;
    const mes = consulta.mes ?? mesDe(new Date());
    const vacio: RespuestaHistorial = {
      lado: consulta.lado,
      mes,
      meses: [{ mes, etiqueta: etiquetaDe(mes) }],
      conteos: { ventas: 0, compras: 0 },
      promedio_ventas: null,
      por_categoria: [],
      tiendas: [],
      lista: [],
    };
    if (!tiendaId) return vacio;
    const { desde, hasta } = rangoDe(mes);
    const enElMes = { creadaEn: { gte: desde, lt: hasta } };

    const [filas, ventas, compras, fechas] = await Promise.all([
      this.prisma.venta.findMany({
        where: { ...this.donde(consulta.lado, tiendaId), ...enElMes },
        orderBy: { creadaEn: 'desc' },
        select: SELECT_VENTA,
      }),
      this.prisma.venta.count({ where: { ...this.donde('ventas', tiendaId), ...enElMes } }),
      this.prisma.venta.count({ where: { ...this.donde('compras', tiendaId), ...enElMes } }),
      this.prisma.venta.findMany({
        where: { OR: [this.donde('ventas', tiendaId), this.donde('compras', tiendaId)] },
        orderBy: { creadaEn: 'desc' },
        select: { creadaEn: true, oferta: { select: { tiendaId: true } } },
        take: 2000,
      }),
    ]);

    const lista = filas.map((fila) => this.aVenta(fila, consulta.lado));
    const meses = [...new Set([mes, mesDe(new Date()), ...fechas.map((f) => mesDe(f.creadaEn))])]
      .sort()
      .reverse()
      .slice(0, 6)
      .map((valor) => ({ mes: valor, etiqueta: etiquetaDe(valor) }));
    // El promedio de los tres meses anteriores, contando desde el de la primera venta.
    const vendidasPorMes = new Map<string, number>();
    for (const fila of fechas) {
      if (fila.oferta.tiendaId !== tiendaId) continue;
      const suyo = mesDe(fila.creadaEn);
      vendidasPorMes.set(suyo, (vendidasPorMes.get(suyo) ?? 0) + 1);
    }
    const primero = [...vendidasPorMes.keys()].sort()[0];
    const anteriores = [1, 2, 3]
      .map((atras) => mesAnterior(mes, atras))
      .filter((otro) => primero !== undefined && otro >= primero);
    const promedio =
      anteriores.length === 0
        ? null
        : Math.round(
            anteriores.reduce((suma, otro) => suma + (vendidasPorMes.get(otro) ?? 0), 0) /
              anteriores.length,
          );

    const porCategoria = new Map<string, number>();
    for (const venta of lista) {
      const nombre = venta.producto.categoria.nombre;
      porCategoria.set(nombre, (porCategoria.get(nombre) ?? 0) + 1);
    }
    const tiendas = new Map<string, string>();
    for (const venta of lista) {
      if (venta.otra_tienda.id) tiendas.set(venta.otra_tienda.id, venta.otra_tienda.nombre);
    }

    return {
      lado: consulta.lado,
      mes,
      meses,
      conteos: { ventas, compras },
      promedio_ventas: promedio === 0 ? null : promedio,
      por_categoria: [...porCategoria.entries()]
        .map(([categoria, items]) => ({ categoria, items }))
        .sort((a, b) => b.items - a.items || a.categoria.localeCompare(b.categoria, 'es')),
      tiendas: [...tiendas.entries()].map(([id, nombre]) => ({ id, nombre })),
      lista: consulta.tienda
        ? lista.filter((venta) => venta.otra_tienda.id === consulta.tienda)
        : lista,
    };
  }

  private aVenta(fila: FilaVenta, lado: 'ventas' | 'compras'): VentaEnHistorial {
    const { oferta } = fila;
    // Quien compró a una tienda reservada sigue sin saber cuál era.
    const otra =
      lado === 'ventas'
        ? {
            id: fila.tiendaCompradora?.id ?? '',
            nombre: fila.tiendaCompradora?.nombre ?? 'Sin tienda',
          }
        : oferta.tiendaVisible
          ? { id: oferta.tienda.id, nombre: oferta.tienda.nombre }
          : { id: '', nombre: TIENDA_RESERVADA };
    const deComprador = fila.opiniones.find((opinion) => opinion.lado === 'COMPRADOR');
    return {
      id: fila.id,
      fecha: fila.creadaEn.toISOString(),
      producto: {
        titulo: oferta.producto.titulo,
        slug: oferta.producto.slug,
        foto: oferta.producto.fotos[0]?.ruta ?? null,
        categoria: oferta.producto.categoria,
      },
      otra_tienda: otra,
      modo: oferta.modoVenta,
      precio:
        fila.precioCentimos === null || fila.moneda === null
          ? null
          : precioDe(Number(fila.precioCentimos), fila.moneda),
      conversacion_id: fila.conversacionId,
      calificacion: deComprador?.estrellas ?? null,
      puede_calificar: lado === 'compras' && !deComprador,
      puede_recordar:
        lado === 'ventas' &&
        !deComprador &&
        fila.recordadaEn === null &&
        Boolean(fila.tiendaCompradora),
    };
  }

  /** «Descargar Excel»: el mes elegido, una fila por venta o compra. */
  async excel(consulta: HistorialConsulta, sesion: SesionActiva): Promise<Buffer> {
    const datos = await this.historial(consulta, sesion);
    const libro = new ExcelJS.Workbook();
    libro.creator = 'PaseLibre';
    const hoja = libro.addWorksheet(
      `${consulta.lado === 'ventas' ? 'Ventas' : 'Compras'} ${etiquetaDe(datos.mes)}`,
    );
    hoja.columns = [
      { header: 'Fecha', key: 'fecha', width: 14 },
      { header: 'Producto', key: 'producto', width: 44 },
      { header: 'Categoría', key: 'categoria', width: 20 },
      {
        header: consulta.lado === 'ventas' ? 'Vendido a' : 'Comprado a',
        key: 'tienda',
        width: 24,
      },
      { header: 'Cómo', key: 'modo', width: 12 },
      { header: 'Moneda', key: 'moneda', width: 9 },
      { header: 'Precio', key: 'precio', width: 12, style: { numFmt: '#,##0.00' } },
      { header: 'Calificación', key: 'calificacion', width: 13 },
    ];
    hoja.getRow(1).font = { bold: true };
    for (const venta of datos.lista) {
      hoja.addRow({
        fecha: new Date(venta.fecha),
        producto: venta.producto.titulo,
        categoria: venta.producto.categoria.nombre,
        tienda: venta.otra_tienda.nombre,
        modo: TEXTO_MODO_VENTA[venta.modo],
        moneda: venta.precio ? (venta.precio.moneda === 'USD' ? 'US$' : 'S/') : '',
        precio: venta.precio ? venta.precio.centimos / 100 : null,
        calificacion: venta.calificacion,
      });
    }
    hoja.getColumn('fecha').numFmt = 'dd/mm/yyyy';
    return Buffer.from(await libro.xlsx.writeBuffer());
  }

  /**
   * «Recordarle» (HI_A2_Web): a quien compró y no calificó, un aviso y un mensaje en el chat.
   * Una sola vez por venta.
   */
  async recordar(ventaId: string, sesion: SesionActiva): Promise<void> {
    const tiendaId = sesion.usuario.tiendaId ?? '';
    const venta = await this.prisma.venta.findFirst({
      where: { id: ventaId, oferta: { tiendaId } },
      select: {
        compradorId: true,
        conversacionId: true,
        recordadaEn: true,
        oferta: { select: { producto: { select: { titulo: true } } } },
      },
    });
    if (!venta || !venta.compradorId) {
      throw new ApiHttpException(HttpStatus.NOT_FOUND, 'NO_ENCONTRADO', 'Esta venta no existe.');
    }
    const { count } = await this.prisma.venta.updateMany({
      where: { id: ventaId, recordadaEn: null },
      data: { recordadaEn: new Date() },
    });
    if (count === 0) {
      throw new ApiHttpException(HttpStatus.CONFLICT, 'CONFLICTO', 'Ya se lo recordaste.');
    }
    const quien = sesion.usuario.tienda?.nombre ?? 'La tienda';
    const producto = venta.oferta.producto.titulo;
    if (venta.conversacionId) {
      await this.prisma.mensaje.create({
        data: {
          conversacionId: venta.conversacionId,
          autorId: null,
          tipo: 'SISTEMA',
          texto: `¿Cómo te fue con ${producto}? Califica a ${quien}: ayuda a las demás tiendas.`,
        },
      });
    }
    await this.avisos.crear([venta.compradorId], {
      tipo: 'VENTA',
      titulo: `¿Cómo te fue con ${producto}?`,
      extracto: `Califica a ${quien}: ayuda a las demás tiendas.`,
      enlace: '/historial?lado=compras',
      accion: { tipo: 'ABRIR', texto: 'Calificar', enlace: '/historial?lado=compras' },
    });
  }
}
