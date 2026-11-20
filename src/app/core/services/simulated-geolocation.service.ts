// src/app/core/services/simulated-geolocation.service.ts
import { Injectable, signal } from '@angular/core';
import { Coordenadas } from '../utils/geo.util';

// Punto de referencia (CDMX) alrededor del cual se simula la posición del usuario.
const ORIGEN_BASE: Coordenadas = { lat: 19.4326, lng: -99.1332 };

/**
 * Simula el comportamiento de un GPS real (delay al obtener el "fix" +
 * ligera variación en cada lectura) sin depender de ningún plugin nativo
 * ni de permisos del dispositivo/emulador.
 *
 * Pensado para reemplazarse en el futuro por @capacitor/geolocation sin
 * tener que tocar los componentes que lo consumen (misma interfaz de
 * signals: ubicacion, cargando).
 */
@Injectable({ providedIn: 'root' })
export class SimulatedGeolocationService {
  readonly ubicacion = signal<Coordenadas | null>(null);
  readonly cargando = signal(false);
  readonly precisionMetros = signal(0);

  /**
   * "Obtiene" la ubicación del usuario. Cada llamada agrega un pequeño
   * jitter aleatorio (equivalente a moverse un par de cuadras) para que
   * el refresco se sienta real en las demos.
   */
  async obtenerUbicacion(): Promise<Coordenadas> {
    this.cargando.set(true);

    // Simula el tiempo que tarda un GPS en obtener el primer fix.
    await this.esperar(900 + Math.random() * 600);

    const jitterLat = (Math.random() - 0.5) * 0.01; // ~± 500 m
    const jitterLng = (Math.random() - 0.5) * 0.01;

    const posicion: Coordenadas = {
      lat: ORIGEN_BASE.lat + jitterLat,
      lng: ORIGEN_BASE.lng + jitterLng,
    };

    this.ubicacion.set(posicion);
    this.precisionMetros.set(Math.round(15 + Math.random() * 25));
    this.cargando.set(false);

    return posicion;
  }

  private esperar(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
