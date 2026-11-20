// src/app/core/models/medical-record.model.ts

export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export type AllergySeverity = 'leve' | 'moderada' | 'severa';

export interface Allergy {
    id: string;
    name: string;
    severity: AllergySeverity;
    reaction?: string;
    notes?: string;
    diagnosedAt?: string;   // ISO Date, opcional
}

export interface CurrentMedication {
    id: string;
    name: string;
    dosage: string;
    frequency: string;
    notes?: string;
}

export interface Diagnosis {
    id: string;
    name: string;
    diagnosedAt?: string;   // ISO Date
    status: 'activo' | 'controlado' | 'resuelto';
    notes?: string;
}

/**
 * Contacto de emergencia individual, listado en el 4to segmento de
 * "Historial médico" (Alergias/Medicamentos/Diagnósticos/Contactos).
 * No confundir con `EmergencyContact` (más abajo), que modela el ICE
 * contact único devuelto por FHIR; esta entrada soporta múltiples
 * contactos gestionados localmente desde la tarjeta de inicio.
 */
export interface EmergencyContactEntry {
    id: string;
    name: string;
    relationship: string;
    phone: string;
}

export interface MedicalRecord {
    userId: string;                        // FK hacia User.id
    bloodType: BloodType;
    weightKg?: number;                     // Peso en kilogramos (opcional)
    heightM?: number;                      // Altura en metros, ej. 1.75 (opcional)
    allergies: Allergy[];
    chronicConditions: string[];
    diagnoses: Diagnosis[];
    currentMedications: CurrentMedication[];
    emergencyContacts: EmergencyContactEntry[];
    medicalDevices: string[];              // ej: marcapasos, prótesis
    isOrganDonor: boolean;
    insuranceProvider?: string;
    insurancePolicyId?: string;
}

export interface EmergencyContact {
    userId: string;                        // FK hacia User.id
    iceContactName: string;
    iceContactRelationship: string;
    iceContactPhone: string;
}

export interface SyncSecurity {
    userId: string;
    qrSecureToken: string;
    lastSyncAt: string;                    // ISO Datetime
}