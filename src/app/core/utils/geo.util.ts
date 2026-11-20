// src/app/core/utils/geo.util.ts

export interface Coordenadas {
  lat: number;
  lng: number;
}

/**
 * Distancia entre dos coordenadas usando la fórmula de Haversine.
 * Se usa tanto con ubicación real como simulada: el cálculo es el mismo,
 * lo único "simulado" es el origen (la posición del usuario).
 */
export function distanciaHaversineKm(a: Coordenadas, b: Coordenadas): number {
  const RADIO_TIERRA_KM = 6371;
  const dLat = aRadianes(b.lat - a.lat);
  const dLng = aRadianes(b.lng - a.lng);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(aRadianes(a.lat)) * Math.cos(aRadianes(b.lat)) * Math.sin(dLng / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return Math.round(RADIO_TIERRA_KM * c * 10) / 10;
}

/**
 * Convierte la posición relativa entre el usuario y un centro en un punto
 * (top %, left %) dentro del mapa-placeholder, para que los pines se vean
 * ubicados de forma coherente según su latitud/longitud real.
 */
export function proyectarEnMapa(
  origen: Coordenadas,
  destino: Coordenadas,
  escala = 1700
): { top: number; left: number } {
  const deltaLat = destino.lat - origen.lat;
  const deltaLng = destino.lng - origen.lng;

  // Latitud mayor = más al norte = más arriba en pantalla (top menor)
  const top = clamp(50 - deltaLat * escala, 8, 90);
  // Longitud mayor = más al este = más a la derecha (left mayor)
  const left = clamp(50 + deltaLng * escala, 8, 92);

  return { top, left };
}

function aRadianes(grados: number): number {
  return (grados * Math.PI) / 180;
}

function clamp(valor: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valor));
}
