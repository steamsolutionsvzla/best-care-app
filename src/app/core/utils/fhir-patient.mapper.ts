// src/app/core/utils/fhir-patient.mapper.ts
import { FhirPatient } from '../models/api-dto.model';
import { PatientProfile, DocumentType, Gender } from '../models/patient-profile.model';
import { MedicalRecord, BloodType } from '../models/medical-record.model';

/**
 * Convierte un recurso FHIR Patient (devuelto por /patient/me o /fhir/Patient)
 * en los modelos que usa la app.
 *
 * FORMA REAL DE BIGBACK (verificada con smoke-test.sh contra producción):
 *  - identifier[0]: { system: "http://venezuela.gob.ve/ci", value, type: { text: "V" } }
 *      -> type.text trae el tipo de documento (V/E/P...).
 *      -> OJO: en cuentas creadas sin cédula, value trae el CORREO (pendiente con backend).
 *  - extension "http://hl7.org/fhir/StructureDefinition/patient-bloodType"
 *      -> valueCodeableConcept.coding[0].code = "O+" (no viene como valueString).
 *  - extension "urn:bestclinic:ext:weightKg" / "urn:bestclinic:ext:heightM"
 *      -> valueQuantity.value con unit "kg" / "m" respectivamente (verificado
 *      con smoke-test.sh contra producción: PATCH con {weight_kg, height_m}
 *      en /patient/update -> GET /patient/me ya las trae como estas 2
 *      extensiones). OJO: la llave para ESCRIBIR en /patient/update es
 *      'weight_kg' / 'height_m' (snake_case, plano); 'weight'/'height' NO
 *      existen y el backend responde 005 "No se enviaron campos para
 *      actualizar" si se usan (ver patient-data.service.ts).
 *  - contained[]: recursos AllergyIntolerance incrustados
 *      -> { id, clinicalStatus, verificationStatus, code: { text } }. No traen severidad.
 *  - extension urn:bestclinic:ext:authToken / qrToken: NO se leen aquí a propósito.
 *    Nunca los guardes ni los registres en logs.
 *  - Medicamentos, diagnósticos y contactos de emergencia NO vienen en el Patient
 *    (siguen viviendo solo en el caché local del dispositivo).
 */

// Tipos locales "sueltos" para no depender de que FhirPatient (api-dto.model.ts)
// ya declare estos campos. Si luego los agregas allí, puedes borrar esto.
interface FhirCoding { system?: string; code?: string; display?: string }
interface FhirCodeableConcept { text?: string; coding?: FhirCoding[] }
interface FhirQuantityLoose { value?: number; unit?: string; code?: string }
interface FhirExtensionLoose {
  url?: string;
  valueString?: string;
  valueDecimal?: number;
  valueQuantity?: FhirQuantityLoose;
  valueCodeableConcept?: FhirCodeableConcept;
}
interface FhirIdentifierLoose { value?: string; system?: string; type?: { text?: string } }
interface FhirAllergyContained {
  resourceType?: string;
  id?: string;
  clinicalStatus?: FhirCodeableConcept;
  verificationStatus?: FhirCodeableConcept;
  code?: FhirCodeableConcept;
}
type FhirPatientWithContained = FhirPatient & { contained?: FhirAllergyContained[] };

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const INACTIVE_ALLERGY_STATUS = ['inactive', 'resolved'];
const CI_SYSTEM = 'http://venezuela.gob.ve/ci';

export function fhirPatientToProfile(fhir: FhirPatient, userId: string, existingAvatarUrl?: string): PatientProfile {
  const name = fhir.name?.[0];
  const phone = fhir.telecom?.find((t) => t.system === 'phone')?.value ?? '';
  const identifiers = (fhir.identifier ?? []) as FhirIdentifierLoose[];
  const identifier = identifiers.find((i) => i.system === CI_SYSTEM) ?? identifiers[0];

  return {
    userId,
    firstName: name?.given?.join(' ') ?? '',
    lastName: name?.family ?? '',
    // Bigback manda el tipo de documento en identifier.type.text; 'V' solo si falta.
    documentType: (identifier?.type?.text?.trim().toUpperCase() || 'V') as DocumentType,
    documentId: identifier?.value ?? '',
    birthDate: fhir.birthDate ?? '',
    gender: mapGender(fhir.gender),
    phoneNumber: phone,
    // Bigback/FHIR no expone la foto de perfil: se conserva la que ya exista
    // localmente para que profile.set(...) no la pise con undefined.
    avatarUrl: existingAvatarUrl,
  };
}

function mapGender(g?: FhirPatient['gender']): Gender {
  if (g === 'male') return 'M';
  if (g === 'female') return 'F';
  return 'Other';
}

/** Tipo de sangre válido desde la extensión patient-bloodType; undefined si no viene o no es reconocible. */
function readBloodType(fhir: FhirPatient): BloodType | undefined {
  const extensions = (fhir.extension ?? []) as FhirExtensionLoose[];
  // Acepta "patient-bloodType" (real) y "blood-type" (supuesto anterior).
  const ext = extensions.find((e) => e.url?.toLowerCase().replace(/-/g, '').includes('bloodtype'));
  const cc = ext?.valueCodeableConcept;
  const raw = cc?.coding?.[0]?.code ?? cc?.coding?.[0]?.display ?? cc?.text ?? ext?.valueString;
  const normalized = raw?.trim().toUpperCase();
  return normalized && BLOOD_TYPES.includes(normalized) ? (normalized as BloodType) : undefined;
}

/**
 * Lee una extensión numérica cuya URL matchea `urlPattern` (p. ej. "weight"
 * o "height"), tomando valueQuantity.value (forma real confirmada para
 * weightKg/heightM), con valueDecimal/valueString como respaldo por si
 * Bigback cambia el formato. Aplica `unitToBaseFactor` para normalizar la
 * unidad a la que usa el modelo local (kg para peso, m para altura).
 * Devuelve undefined si la extensión no viene, o si el valor no es un
 * número válido/positivo, para no inventar un peso/altura falso.
 */
function readNumericExtension(
  fhir: FhirPatient,
  urlPattern: RegExp,
  unitToBaseFactor: (unit?: string) => number,
): number | undefined {
  const extensions = (fhir.extension ?? []) as FhirExtensionLoose[];
  const ext = extensions.find((e) => !!e.url && urlPattern.test(e.url));
  if (!ext) return undefined;

  const quantity = ext.valueQuantity;
  const rawValue =
    quantity?.value ?? ext.valueDecimal ?? (ext.valueString !== undefined ? parseFloat(ext.valueString) : undefined);
  if (rawValue === undefined || Number.isNaN(rawValue)) return undefined;

  const factor = unitToBaseFactor(quantity?.unit ?? quantity?.code);
  const normalized = rawValue * factor;
  return Number.isFinite(normalized) && normalized > 0 ? normalized : undefined;
}

/**
 * Peso (kg) desde la extensión "urn:bestclinic:ext:weightKg" (confirmada:
 * valueQuantity con unit "kg"). Si alguna vez viniera en gramos ("g") se
 * convierte a kg; cualquier otra unidad (incl. "kg" o ausencia) se asume ya
 * en kg.
 */
function readWeight(fhir: FhirPatient): number | undefined {
  return readNumericExtension(fhir, /weight/i, (unit) => (unit?.trim().toLowerCase() === 'g' ? 1 / 1000 : 1));
}

/**
 * Altura (m) desde la extensión "urn:bestclinic:ext:heightM" (confirmada:
 * valueQuantity con unit "m"). Si alguna vez viniera en centímetros ("cm")
 * se convierte a metros; cualquier otra unidad (incl. "m" o ausencia) se
 * asume ya en m.
 */
function readHeight(fhir: FhirPatient): number | undefined {
  return readNumericExtension(fhir, /height/i, (unit) => (unit?.trim().toLowerCase() === 'cm' ? 1 / 100 : 1));
}

/** Alergias activas desde los AllergyIntolerance incrustados en Patient.contained. */
function readAllergies(fhir: FhirPatient) {
  const contained = (fhir as FhirPatientWithContained).contained ?? [];
  return contained
    .filter((r) => r.resourceType === 'AllergyIntolerance')
    .filter((r) => !INACTIVE_ALLERGY_STATUS.includes(r.clinicalStatus?.coding?.[0]?.code ?? ''))
    .filter((r) => r.verificationStatus?.coding?.[0]?.code !== 'entered-in-error')
    .map((r, i) => ({
      id: r.id ? `al-${r.id}` : `al-${i}`,
      name: (r.code?.text ?? r.code?.coding?.[0]?.display ?? '').trim(),
      // Bigback no envía severidad; se mantiene el valor por defecto que ya usaba la app.
      severity: 'moderada' as const,
    }))
    .filter((a) => a.name.length > 0);
}

export function fhirPatientToMedicalRecord(fhir: FhirPatient, userId: string): MedicalRecord {
  return {
    userId,
    // TODO(modelo): si no viene, hoy se inventa 'O+'. Lo correcto en una app médica es
    // permitir "desconocido" (BloodType | undefined) y mostrar "Sin registrar".
    bloodType: readBloodType(fhir) ?? 'O+',
    // Confirmado contra producción (smoke-test.sh): Bigback SÍ expone peso y
    // altura en /patient/me como extensiones FHIR una vez que se guardan con
    // /patient/update usando las llaves 'weight_kg'/'height_m'. Si por algún
    // motivo no vienen (cuenta sin dato guardado), quedan undefined y
    // PatientDataService.hydrateLocalCollections rellena desde el caché
    // local del dispositivo — así quedan disponibles por las 2 vías.
    weightKg: readWeight(fhir),
    heightM: readHeight(fhir),
    allergies: readAllergies(fhir),
    chronicConditions: [],
    diagnoses: [],
    currentMedications: [],
    emergencyContacts: [],
    medicalDevices: [],
    isOrganDonor: false,
  };
}