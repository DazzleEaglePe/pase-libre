export interface RespuestaSalud {
  estado: 'ok';
  servicio: 'paselibre-api';
  fecha: string;
}

export interface RespuestaSaludLista {
  estado: 'ok' | 'error';
  base_de_datos: 'ok' | 'error';
}
