// src/app/core/models/patient-profile.model.ts

export type DocumentType = 'V' | 'E' | 'P';
export type Gender = 'M' | 'F' | 'Other';

export interface PatientProfile {
    userId: string;           // FK hacia User.id
    firstName: string;
    lastName: string;
    documentType: DocumentType;
    documentId: string;
    birthDate: string;        // ISO Date (YYYY-MM-DD)
    gender: Gender;
    phoneNumber: string;
    avatarUrl?: string;
}