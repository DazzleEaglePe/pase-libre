/**
 * Datos y pasos de la semilla. Los usa `seed.ts` y también las pruebas del catálogo,
 * que así corren sobre los mismos productos y ofertas del lienzo.
 */
import { normalizarTexto, slugDe } from '@paselibre/contracts';
import type { Condicion, Moneda, PrismaClient, Rol } from '@prisma/client';

import { RESPUESTAS_RAPIDAS_INICIALES } from '../src/modules/cuenta/respuestas-rapidas';
import { cifrarClave } from '../src/modules/sesion/clave';

/**
 * Clave de las cuentas de demostración. Solo existe en desarrollo y staging;
 * la semilla se niega a crear estas cuentas en producción.
 */
export const CLAVE_DEMO = 'pase-demo-2026';

const GALERIAS = [
  { nombre: 'Maxiplaza', slug: 'maxiplaza', orden: 1 },
  { nombre: 'Cyberplaza', slug: 'cyberplaza', orden: 2 },
];

const CATEGORIAS = [
  { nombre: 'Gráficas', slug: 'graficas' },
  { nombre: 'Procesadores', slug: 'procesadores' },
  { nombre: 'Placas', slug: 'placas' },
  { nombre: 'RAM', slug: 'ram' },
  { nombre: 'Cases', slug: 'cases' },
  { nombre: 'Monitores', slug: 'monitores' },
  { nombre: 'Periféricos', slug: 'perifericos' },
];

const MARCAS = [
  'MSI',
  'ASUS',
  'Gigabyte',
  'Zotac',
  'PNY',
  'Intel',
  'AMD',
  'Kingston',
  'Corsair',
  'G.Skill',
  'LG',
  'Samsung',
  'Logitech',
  'Redragon',
  'HyperX',
  'Antryx',
  'Cooler Master',
];

export async function sembrarBase(prisma: PrismaClient): Promise<void> {
  for (const g of GALERIAS) {
    await prisma.galeria.upsert({ where: { slug: g.slug }, update: {}, create: g });
  }
  for (const [orden, c] of CATEGORIAS.entries()) {
    await prisma.categoria.upsert({ where: { slug: c.slug }, update: {}, create: { ...c, orden } });
  }
  for (const nombre of MARCAS) {
    await prisma.marca.upsert({
      where: { nombre },
      update: {},
      create: { nombre, slug: slugDe(nombre) },
    });
  }
}

interface TiendaDemo {
  clave: string;
  tipo: 'TIENDA' | 'INDEPENDIENTE';
  nombre: string;
  galeria: string | null;
  stand: string | null;
  whatsapp: string;
  estado?: 'ACTIVA' | 'SUSPENDIDA';
  usuarios: Array<{
    usuario: string;
    nombre: string;
    rol: Rol;
    correo?: string;
    /** Sin primer ingreso: todavía tiene la clave temporal. */
    sinPrimerIngreso?: boolean;
  }>;
}

const TIENDAS: TiendaDemo[] = [
  {
    clave: 'A',
    tipo: 'TIENDA',
    nombre: 'Tienda A',
    galeria: 'maxiplaza',
    stand: '212',
    whatsapp: '987111212',
    usuarios: [
      { usuario: 'tiendaa', nombre: 'Luis P.', rol: 'DUENO', correo: 'luis@tiendaa.pe' },
      { usuario: 'tiendaa.kevin', nombre: 'Kevin S.', rol: 'ASESOR' },
    ],
  },
  {
    clave: 'B',
    tipo: 'TIENDA',
    nombre: 'Tienda B',
    galeria: 'cyberplaza',
    stand: '101',
    whatsapp: '987222101',
    usuarios: [{ usuario: 'tiendab', nombre: 'Carla V.', rol: 'DUENO' }],
  },
  {
    clave: 'C',
    tipo: 'TIENDA',
    nombre: 'Tienda C',
    galeria: 'cyberplaza',
    stand: '118',
    whatsapp: '987333118',
    usuarios: [{ usuario: 'tiendac', nombre: 'Rosa M.', rol: 'DUENO' }],
  },
  {
    clave: 'D',
    tipo: 'TIENDA',
    nombre: 'Tienda D',
    galeria: 'maxiplaza',
    stand: '230',
    whatsapp: '987333230',
    usuarios: [{ usuario: 'tiendad', nombre: 'Marco T.', rol: 'DUENO', sinPrimerIngreso: true }],
  },
  {
    clave: 'E',
    tipo: 'TIENDA',
    nombre: 'Tienda E',
    galeria: 'maxiplaza',
    stand: '305',
    whatsapp: '987555305',
    usuarios: [{ usuario: 'tiendae', nombre: 'Ana L.', rol: 'DUENO' }],
  },
  {
    clave: 'J',
    tipo: 'INDEPENDIENTE',
    nombre: 'Jorge R.',
    galeria: null,
    stand: null,
    whatsapp: '987444000',
    usuarios: [{ usuario: 'jorge.r', nombre: 'Jorge R.', rol: 'DUENO', sinPrimerIngreso: true }],
  },
];

interface ProductoDemo {
  titulo: string;
  categoria: string;
  marca: string;
  modelo: string;
  etiquetas: string[];
  caracteristicas?: Record<string, string>;
  /** [tienda, condición, stock, precio en la moneda (sin céntimos o con decimales), moneda, visible, días desde la última actualización, estado] */
  ofertas: Array<
    [string, Condicion, number, number | null, Moneda, boolean, number, ('ACTIVA' | 'PAUSADA')?]
  >;
}

const PRODUCTOS: ProductoDemo[] = [
  {
    titulo: 'MSI GeForce RTX 3070 Ventus 3X OC 8 GB',
    categoria: 'graficas',
    marca: 'MSI',
    modelo: 'GeForce RTX 3070 Ventus 3X OC',
    etiquetas: ['NVIDIA', 'RTX 3070', '8 GB', 'GDDR6', 'Ventus'],
    caracteristicas: {
      Memoria: '8 GB GDDR6, 256 bits',
      Salidas: '3 DisplayPort 1.4a, 1 HDMI 2.1',
      Consumo: '220 W · fuente de 650 W',
    },
    ofertas: [
      ['B', 'USADO', 1, 240, 'USD', true, 0],
      ['A', 'USADO', 2, 250, 'USD', true, 2],
      ['C', 'NUEVO', 1, 265, 'USD', true, 1],
      ['E', 'NUEVO', 3, null, 'USD', false, 0],
    ],
  },
  {
    titulo: 'ASUS TUF Gaming GeForce RTX 3070 Ti OC 8 GB',
    categoria: 'graficas',
    marca: 'ASUS',
    modelo: 'TUF Gaming GeForce RTX 3070 Ti OC',
    etiquetas: ['NVIDIA', 'RTX 3070 Ti', '8 GB', 'GDDR6X'],
    ofertas: [
      ['D', 'USADO', 1, 285, 'USD', true, 1],
      ['J', 'USADO', 1, null, 'USD', false, 1],
    ],
  },
  {
    titulo: 'Gigabyte GeForce RTX 3070 Gaming OC 8 GB',
    categoria: 'graficas',
    marca: 'Gigabyte',
    modelo: 'GeForce RTX 3070 Gaming OC',
    etiquetas: ['NVIDIA', 'RTX 3070', '8 GB', 'GDDR6'],
    ofertas: [['C', 'NUEVO', 2, 270, 'USD', true, 2]],
  },
  {
    titulo: 'MSI GeForce RTX 3070 Gaming Z Trio 8 GB LHR',
    categoria: 'graficas',
    marca: 'MSI',
    modelo: 'GeForce RTX 3070 Gaming Z Trio LHR',
    etiquetas: ['NVIDIA', 'RTX 3070', '8 GB', 'GDDR6'],
    ofertas: [['D', 'USADO', 1, 260, 'USD', true, 3]],
  },
  {
    titulo: 'Zotac Gaming GeForce RTX 3070 Twin Edge 8 GB',
    categoria: 'graficas',
    marca: 'Zotac',
    modelo: 'Gaming GeForce RTX 3070 Twin Edge',
    etiquetas: ['NVIDIA', 'RTX 3070', '8 GB', 'GDDR6'],
    ofertas: [['E', 'USADO', 0, null, 'USD', false, 9]],
  },
  {
    titulo: 'ASUS Dual GeForce RTX 4060 OC 8 GB',
    categoria: 'graficas',
    marca: 'ASUS',
    modelo: 'Dual GeForce RTX 4060 OC',
    etiquetas: ['NVIDIA', 'RTX 4060', '8 GB', 'GDDR6'],
    ofertas: [['D', 'NUEVO', 5, 1699.99, 'PEN', true, 0]],
  },
  {
    titulo: 'MSI GeForce RTX 3060 Ventus 2X 12 GB',
    categoria: 'graficas',
    marca: 'MSI',
    modelo: 'GeForce RTX 3060 Ventus 2X',
    etiquetas: ['NVIDIA', 'RTX 3060', '12 GB', 'GDDR6', 'Ventus'],
    ofertas: [['A', 'USADO', 0, 190, 'USD', false, 1]],
  },
  {
    titulo: 'Intel Core i5-14400F',
    categoria: 'procesadores',
    marca: 'Intel',
    modelo: 'Core i5-14400F',
    etiquetas: ['Intel', 'i5', 'LGA1700', '10 núcleos'],
    ofertas: [
      ['C', 'NUEVO', 3, null, 'USD', false, 1],
      ['A', 'NUEVO', 3, 165, 'USD', false, 9],
    ],
  },
  {
    titulo: 'Kingston Fury Beast DDR5 32 GB (2 × 16) 6000 MHz',
    categoria: 'ram',
    marca: 'Kingston',
    modelo: 'Fury Beast DDR5 6000',
    etiquetas: ['DDR5', '32 GB', '6000 MHz'],
    ofertas: [
      ['B', 'NUEVO', 8, 98, 'USD', true, 1],
      ['A', 'NUEVO', 6, 98, 'USD', true, 0],
    ],
  },
  {
    titulo: 'LG UltraGear 27GS60F 27" 180 Hz',
    categoria: 'monitores',
    marca: 'LG',
    modelo: 'UltraGear 27GS60F',
    etiquetas: ['27 pulgadas', '180 Hz', 'IPS'],
    ofertas: [
      ['E', 'NUEVO', 4, null, 'USD', false, 2],
      ['A', 'NUEVO', 2, 799, 'PEN', true, 12],
    ],
  },
  {
    titulo: 'ASUS TUF Gaming B650-Plus WiFi',
    categoria: 'placas',
    marca: 'ASUS',
    modelo: 'TUF Gaming B650-Plus WiFi',
    etiquetas: ['AM5', 'B650', 'DDR5', 'WiFi'],
    ofertas: [['J', 'NUEVO', 2, 175, 'USD', true, 2]],
  },
  {
    titulo: 'Logitech G502 X Plus inalámbrico',
    categoria: 'perifericos',
    marca: 'Logitech',
    modelo: 'G502 X Plus',
    etiquetas: ['Mouse', 'Inalámbrico', 'RGB'],
    ofertas: [['C', 'USADO', 1, 420, 'PEN', true, 3]],
  },
  {
    titulo: 'Antryx FX 790 Mid Tower ARGB',
    categoria: 'cases',
    marca: 'Antryx',
    modelo: 'FX 790',
    etiquetas: ['Mid tower', 'ARGB'],
    ofertas: [['B', 'NUEVO', 6, null, 'USD', false, 3]],
  },
  {
    titulo: 'Redragon Kumara K552 RGB',
    categoria: 'perifericos',
    marca: 'Redragon',
    modelo: 'Kumara K552',
    etiquetas: ['Teclado', 'Mecánico', 'RGB'],
    ofertas: [['A', 'USADO', 1, 90, 'PEN', false, 20, 'PAUSADA']],
  },
];

const DIA = 24 * 60 * 60 * 1000;

export async function sembrarDemo(prisma: PrismaClient): Promise<void> {
  const claveHash = await cifrarClave(CLAVE_DEMO);
  const ahora = Date.now();

  // Cuenta del equipo de PaseLibre.
  await prisma.usuario.upsert({
    where: { usuario: 'equipo' },
    update: {},
    create: {
      usuario: 'equipo',
      nombre: 'Dazz',
      rol: 'EQUIPO',
      claveHash,
      debeCambiarClave: false,
      primerIngresoEn: new Date(ahora),
    },
  });

  const tiendas = new Map<string, { id: string; responsableId: string }>();
  for (const t of TIENDAS) {
    const galeria = t.galeria
      ? await prisma.galeria.findUniqueOrThrow({ where: { slug: t.galeria } })
      : null;
    const existente = await prisma.tienda.findFirst({ where: { nombre: t.nombre } });
    const tienda =
      existente ??
      (await prisma.tienda.create({
        data: {
          tipo: t.tipo,
          nombre: t.nombre,
          galeriaId: galeria?.id ?? null,
          stand: t.stand,
          whatsapp: t.whatsapp,
          estado: t.estado ?? 'ACTIVA',
          horario: 'Lunes a sábado, 10:00 a 19:00',
        },
      }));
    let responsableId = '';
    for (const u of t.usuarios) {
      // Al volver a sembrar, las cuentas demo regresan a su estado del lienzo
      // (clave demo, primer ingreso pendiente donde corresponde y sin bloqueos).
      const estadoDemo = {
        claveHash,
        debeCambiarClave: Boolean(u.sinPrimerIngreso),
        primerIngresoEn: u.sinPrimerIngreso ? null : new Date(ahora - 5 * DIA),
        estado: 'ACTIVO' as const,
        intentosFallidos: 0,
        intentosDesde: null,
        bloqueadoHasta: null,
      };
      const usuario = await prisma.usuario.upsert({
        where: { usuario: u.usuario },
        update: {
          ...estadoDemo,
          sesiones: {
            updateMany: { where: { revocadaEn: null }, data: { revocadaEn: new Date(ahora) } },
          },
        },
        create: {
          tiendaId: tienda.id,
          usuario: u.usuario,
          nombre: u.nombre,
          rol: u.rol,
          correo: u.correo ?? null,
          whatsapp: t.whatsapp,
          claveHash,
          debeCambiarClave: Boolean(u.sinPrimerIngreso),
          primerIngresoEn: u.sinPrimerIngreso ? null : new Date(ahora - 5 * DIA),
          respuestasRapidas: {
            create: RESPUESTAS_RAPIDAS_INICIALES.map((texto, orden) => ({ texto, orden })),
          },
        },
      });
      responsableId ||= usuario.id;
    }
    tiendas.set(t.clave, { id: tienda.id, responsableId });
  }

  const terminos = new Map<string, number>();
  for (const p of PRODUCTOS) {
    const categoria = await prisma.categoria.findUniqueOrThrow({ where: { slug: p.categoria } });
    const marca = await prisma.marca.findUniqueOrThrow({ where: { nombre: p.marca } });
    const textoBusqueda = normalizarTexto([p.titulo, p.marca, p.modelo, ...p.etiquetas].join(' '));
    for (const palabra of new Set(textoBusqueda.split(' '))) {
      terminos.set(palabra, (terminos.get(palabra) ?? 0) + 1);
    }
    const producto = await prisma.producto.upsert({
      where: { slug: slugDe(p.titulo) },
      update: { textoBusqueda },
      create: {
        titulo: p.titulo,
        slug: slugDe(p.titulo),
        categoriaId: categoria.id,
        marcaId: marca.id,
        modelo: p.modelo,
        caracteristicas: p.caracteristicas ?? {},
        textoBusqueda,
        revisado: true,
      },
    });
    for (const nombre of p.etiquetas) {
      const etiqueta = await prisma.etiqueta.upsert({
        where: { clave: normalizarTexto(nombre) },
        update: {},
        create: { nombre, clave: normalizarTexto(nombre) },
      });
      await prisma.productoEtiqueta.upsert({
        where: { productoId_etiquetaId: { productoId: producto.id, etiquetaId: etiqueta.id } },
        update: {},
        create: { productoId: producto.id, etiquetaId: etiqueta.id },
      });
    }
    for (const [clave, condicion, stock, precio, moneda, visible, dias, estado] of p.ofertas) {
      const tienda = tiendas.get(clave);
      if (!tienda) throw new Error(`Tienda ${clave} no está en la semilla.`);
      const yaExiste = await prisma.oferta.findFirst({
        where: { productoId: producto.id, tiendaId: tienda.id, condicion, vigente: true },
      });
      if (yaExiste) continue;
      await prisma.oferta.create({
        data: {
          productoId: producto.id,
          tiendaId: tienda.id,
          responsableId: tienda.responsableId,
          condicion,
          stock,
          moneda,
          precioVisible: visible,
          precioCentimos: precio === null ? null : BigInt(Math.round(precio * 100)),
          estado: estado ?? 'ACTIVA',
          actualizadaEn: new Date(ahora - dias * DIA),
        },
      });
    }
  }
  for (const [palabra, veces] of terminos) {
    await prisma.termino.upsert({
      where: { palabra },
      update: { veces },
      create: { palabra, veces },
    });
  }
}
