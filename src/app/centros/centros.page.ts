// src/app/centros/centros.page.ts
import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSearchbar,
  IonIcon,
  IonButton,
  IonSpinner,
  IonSkeletonText,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  alertOutline,
  callOutline,
  medicalOutline,
  businessOutline,
  carSportOutline,
  medkitOutline,
  chevronForward,
  locationSharp,
  syncOutline,
  timeOutline,
} from 'ionicons/icons';
import { PatientDataService } from '../core/services/patient-data.service';
import { SimulatedGeolocationService } from '../core/services/simulated-geolocation.service';
import { HealthCenter, HealthCenterType } from '../core/models/health-center.model';
import { distanciaHaversineKm, proyectarEnMapa } from '../core/utils/geo.util';

const TYPE_ICON: Record<HealthCenterType, string> = {
  hospital: 'medical-outline',
  clinica: 'business-outline',
  ambulancia: 'car-sport-outline',
  centro_acopio: 'medkit-outline',
};

interface CentroEnMapa extends HealthCenter {
  top: number;
  left: number;
}

@Component({
  selector: 'app-centros',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonSearchbar,
    IonIcon,
    IonButton,
    IonSpinner,
    IonSkeletonText,
  ],
  templateUrl: './centros.page.html',
  styleUrls: ['./centros.page.scss'],
})
export class CentrosPage implements OnInit {
  searchTerm = signal('');
  centers = this.patientData.healthCenters;

  // Estado de la ubicación (simulada): mismos signals que expondría
  // en el futuro un servicio con @capacitor/geolocation real.
  ubicacion = this.geo.ubicacion;
  cargandoUbicacion = this.geo.cargando;

  // Centros con distancia REAL (Haversine) respecto a la posición
  // simulada del usuario, ya ordenados de más cercano a más lejano.
  centrosConDistancia = computed<HealthCenter[]>(() => {
    const pos = this.ubicacion();
    const lista = this.centers();
    if (!pos) return lista;

    return lista
      .map((c) => ({
        ...c,
        distanceKm: distanciaHaversineKm(pos, { lat: c.latitude, lng: c.longitude }),
      }))
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  });

  filtered = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    const all = this.centrosConDistancia();
    if (!term) return all;
    return all.filter((c) => c.name.toLowerCase().includes(term));
  });

  featured = computed(() => {
    if (!this.ubicacion()) return null;
    return this.centrosConDistancia()[0] ?? null;
  });

  // Pines proyectados en el mapa-placeholder según su posición relativa real.
  mapDots = computed<CentroEnMapa[]>(() => {
    const pos = this.ubicacion();
    if (!pos) return [];

    return this.centrosConDistancia()
      .slice(0, 6)
      .map((c) => {
        const { top, left } = proyectarEnMapa(pos, { lat: c.latitude, lng: c.longitude });
        return { ...c, top, left };
      });
  });

  // Cadena de puntos "usuario -> centros cercanos" para trazar la ruta
  // punteada del mapa simulado (coordenadas en % dentro del viewBox 0-100).
  mapRoutePoints = computed<string>(() => {
    const dots = this.mapDots().slice(0, 4);
    if (!dots.length) return '';

    const puntos = [{ top: 50, left: 50 }, ...dots];
    return puntos.map((p) => `${p.left},${p.top}`).join(' ');
  });

  constructor(
    private patientData: PatientDataService,
    private geo: SimulatedGeolocationService
  ) {
    addIcons({
      alertOutline,
      callOutline,
      medicalOutline,
      businessOutline,
      carSportOutline,
      medkitOutline,
      chevronForward,
      locationSharp,
      syncOutline,
      timeOutline,
    });
  }

  ngOnInit(): void {
    // Si ya tenemos una ubicación de una visita previa a esta pestaña,
    // no la volvemos a pedir; si no, la "obtenemos" (simulada).
    if (!this.ubicacion()) {
      this.geo.obtenerUbicacion();
    }
  }

  actualizarUbicacion(): void {
    if (this.cargandoUbicacion()) return;
    this.geo.obtenerUbicacion();
  }

  iconFor(center: HealthCenter): string {
    return TYPE_ICON[center.type];
  }

  onSearch(ev: any) {
    this.searchTerm.set(ev.detail.value ?? '');
  }

  callEmergency() {
    window.open('tel:911', '_system');
  }
}
