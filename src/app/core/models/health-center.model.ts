// src/app/core/models/health-center.model.ts

export type HealthCenterType = 'clinica' | 'hospital' | 'ambulancia' | 'centro_acopio';
export type HealthCenterStatus = 'operativo' | 'colapsado';

export interface HealthCenter {
    id: string;
    name: string;
    type: HealthCenterType;
    status: HealthCenterStatus;
    latitude: number;
    longitude: number;
    address?: string;
    phone?: string;
    category?: string;     // ej: "Hospital · Urgencias 24h" (para UI)
    distanceKm?: number;   // distancia calculada al usuario (para UI)
    isOpenNow?: boolean;   // horario actual (para UI)
    hours?: string;        // ej: "Abierto 24h" / "Lun-Vie 7:00-20:00" (para UI)
}