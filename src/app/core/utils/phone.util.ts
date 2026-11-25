// src/app/core/utils/phone.util.ts

/** Prefijos válidos de operadores venezolanos. */
const VE_PREFIXES = ['0412', '0422', '0414', '0424', '0416', '0426'];

/** Teléfono venezolano: 4 dígitos de prefijo + 7 dígitos (11 en total). */
const VE_PHONE_REGEX = /^(0412|0422|0414|0424|0416|0426)\d{7}$/;

/**
 * Valida un número de teléfono venezolano (04XX-XXXXXXX).
 * Acepta espacios, guiones y puntos como separadores; los elimina antes
 * de verificar el patrón.
 */
export function isValidVePhone(raw: string): boolean {
  const digits = raw.replace(/[\s\-\.\(\)]/g, '');
  return VE_PHONE_REGEX.test(digits);
}

/**
 * Normaliza el teléfono a solo dígitos (04XXXXXXXXX).
 * Útil antes de enviar al backend.
 */
export function normalizeVePhone(raw: string): string {
  return raw.replace(/[\s\-\.\(\)]/g, '');
}
