// src/app/core/models/api-dto.model.ts
//
// Estos tipos reflejan EXACTAMENTE los payloads que aparecen en la colección
// "Paciente Bigback.postman_collection.json". La colección no trae ejemplos
// de respuesta (los arrays "response": [] están vacíos), así que los campos
// de respuesta (AuthResponse, FhirPatient) son una interpretación razonable
// a partir de los nombres usados en las peticiones y del estándar FHIR.
// -> Se recomienda ejecutar la colección contra el ambiente real una vez
//    disponible y ajustar estos tipos con las respuestas reales.

/** POST /api/v2/patient/create */
export interface CreatePatientRequest {
  first_name: string;
  last_name: string;
  correo: string;
  phone: string;
  password: string;
  document_type?: string;
  document_id?: string;
}

/** POST /api/v2/patient/auth */
export interface AuthRequest {
  correo: string;
  password: string;
}

/** Respuesta esperada de /api/v2/patient/auth (a confirmar con backend) */
export interface AuthResponse {
  auth_token: string;
  [key: string]: unknown;
}

/**
 * POST /api/v2/patient/recover-password
 *
 * ⚠️ SIN CONFIRMAR CON BACKEND: a diferencia de create/auth/me/update, no
 * hay un endpoint de recuperación de contraseña en la colección de
 * Postman "Paciente Bigback" entregada hasta ahora. Se sigue la misma
 * convención de nombres que el resto de /patient/* (campo "correo",
 * snake_case) como apuesta razonable — ver la nota completa junto a
 * AuthService.requestPasswordRecovery(). Cuando el equipo de backend
 * confirme la ruta real (puede que sea /patient/forgot-password,
 * /patient/reset-password, etc.) y el payload esperado, ajustar solo ahí
 * y en ese método; el resto de la app (RecuperarPage) no cambia.
 */
export interface RecoverPasswordRequest {
  correo: string;
}

/** POST /api/v2/patient/me (Accept: application/fhir+json) */
export interface MeRequest {
  auth_token: string;
}

/** POST /api/v2/patient/update */
export interface UpdatePatientRequest {
  auth_token: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  birth_date?: string;
  gender?: string;
  document_type?: string;
  document_id?: string;
  avatar_url?: string;
  blood_type?: string;
  /** Peso en kg. Llave confirmada contra producción (ver smoke-test.sh). */
  weight_kg?: number;
  /** Altura en metros. Llave confirmada contra producción. */
  height_m?: number;
  allergies?: string;
  /** Texto plano separado por coma (mismo criterio que allergies). */
  chronic_conditions?: string;
  is_organ_donor?: boolean;
  /** Cambio de correo. Solo enviar si el usuario lo modificó. */
  correo?: string;
  /** Nueva contraseña. Solo enviar si el usuario escribió una; NUNCA registrarla en logs. */
  password?: string;
  [key: string]: unknown;
}

/** Recurso FHIR Patient simplificado a los campos que consumimos hoy */
export interface FhirPatient {
  resourceType: 'Patient';
  id?: string;
  identifier?: { system?: string; value: string }[];
  name?: { given?: string[]; family?: string }[];
  telecom?: { system: string; value: string }[];
  gender?: 'male' | 'female' | 'other' | 'unknown';
  birthDate?: string;
  extension?: { url: string; valueString?: string;[key: string]: unknown }[];
  meta?: { lastUpdated?: string };
  [key: string]: unknown;
}

/** GET /fhir/Patient?identifier=... devuelve un Bundle FHIR */
export interface FhirBundle {
  resourceType: 'Bundle';
  total?: number;
  entry?: { resource: FhirPatient }[];
}
