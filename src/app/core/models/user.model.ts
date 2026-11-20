// src/app/core/models/user.model.ts

export type AccountStatus = 'active' | 'inactive' | 'suspended';

export interface User {
    id: string;              // UUID / Integer - Identificador único de registro
    email: string;
    passwordHash?: string;   // Nunca debería viajar al frontend en respuestas normales
    status: AccountStatus;
    createdAt: string;       // ISO Datetime
    updatedAt: string;       // ISO Datetime
}