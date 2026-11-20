// src/app/core/services/patient-data.service.ts
import { Injectable, signal, computed, inject } from '@angular/core';
import { PatientProfile } from '../models/patient-profile.model';
import { MedicalRecord } from '../models/medical-record.model';
import { HealthCenter } from '../models/health-center.model';
import { ApiService } from './api.service';
import { MedicalRecordStorageService } from './medical-record-storage.service';
import { UpdatePatientRequest, FhirPatient, FhirBundle } from '../models/api-dto.model';
import { fhirPatientToProfile, fhirPatientToMedicalRecord } from '../utils/fhir-patient.mapper';

const EMPTY_PROFILE: PatientProfile = {
  userId: '',
  firstName: '',
  lastName: '',
  documentType: 'V',
  documentId: '',
  birthDate: '',
  gender: 'Other',
  phoneNumber: '',
  avatarUrl: undefined,
};

const EMPTY_MEDICAL_RECORD: MedicalRecord = {
  userId: '',
  bloodType: 'O+',
  allergies: [],
  chronicConditions: [],
  diagnoses: [],
  currentMedications: [],
  emergencyContacts: [],
  medicalDevices: [],
  isOrganDonor: false,
};

@Injectable({ providedIn: 'root' })
export class PatientDataService {
  private api = inject(ApiService);
  private localCache = inject(MedicalRecordStorageService);

  // Se llenan con datos reales tras el login (ver AuthService.loadProfile).
  // Antes de iniciar sesión quedan en un estado "vacío" en vez de null para
  // no romper los templates existentes (perfil.page.html, inicio.page.html).
  profile = signal<PatientProfile>(EMPTY_PROFILE);
  medicalRecord = signal<MedicalRecord>(EMPTY_MEDICAL_RECORD);

  age = computed(() => {
    const birthDate = this.profile().birthDate;
    if (!birthDate) return 0;
    const birth = new Date(birthDate);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  });

  // TODO: Bigback aún no expone un endpoint de centros de salud en la
  // colección de Postman entregada (ej. GET /health-centers). Se mantiene
  // como dato de ejemplo hasta que ese endpoint exista; en cuanto esté
  // disponible, reemplazar este signal por una llamada a this.api.getFhir/post.
  healthCenters = signal<HealthCenter[]>([
    {
      id: 'hc-1',
      name: 'Hospital General Universitario',
      type: 'hospital',
      status: 'operativo',
      latitude: 19.4326,
      longitude: -99.1332,
      address: 'Av. Universidad 3000, CDMX',
      phone: '5555000111',
      category: 'Hospital · Urgencias 24h',
      distanceKm: 0.8,
      isOpenNow: true,
      hours: 'Abierto 24 horas',
    },
    {
      id: 'hc-2',
      name: 'Centro de Salud Tlatelolco',
      type: 'clinica',
      status: 'operativo',
      latitude: 19.4487,
      longitude: -99.1418,
      address: 'Eje Central Lázaro Cárdenas, CDMX',
      phone: '5555000222',
      category: 'CESSA · Medicina General',
      distanceKm: 1.2,
      isOpenNow: true,
      hours: 'Lun-Vie · 7:00-20:00',
    },
    {
      id: 'hc-3',
      name: 'Cruz Roja — Módulo Norte',
      type: 'ambulancia',
      status: 'operativo',
      latitude: 19.4569,
      longitude: -99.1276,
      address: 'Calz. de Guadalupe, CDMX',
      phone: '5555000333',
      category: 'Emergencias · Primeros Auxilios',
      distanceKm: 1.9,
      isOpenNow: true,
      hours: 'Abierto 24 horas',
    },
    {
      id: 'hc-4',
      name: 'Clínica IMSS #23',
      type: 'clinica',
      status: 'colapsado',
      latitude: 19.4126,
      longitude: -99.1657,
      address: 'Av. Insurgentes Sur, CDMX',
      phone: '5555000444',
      category: 'Clínica · Consulta Externa',
      distanceKm: 2.4,
      isOpenNow: false,
      hours: 'Lun-Vie · 8:00-16:00',
    },
    {
      id: 'hc-5',
      name: 'Farmacia con Médico Guadalupe',
      type: 'centro_acopio',
      status: 'operativo',
      latitude: 19.4406,
      longitude: -99.1289,
      address: 'Calle Guadalupe 45, CDMX',
      phone: '5555000555',
      category: 'Farmacia · Consulta Rápida',
      distanceKm: 0.3,
      isOpenNow: true,
      hours: 'Todos los días · 8:00-22:00',
    },
  ]);

  /** Puebla profile/medicalRecord a partir de la respuesta FHIR de /patient/me */
  setFromFhir(fhirPatient: FhirPatient, userId: string): void {
    // El recurso FHIR de Bigback no trae avatarUrl (ver fhir-patient.mapper.ts),
    // así que se conserva el que ya esté en memoria para no perderlo en
    // cada login/refresh; hydrateLocalCollections lo termina de restaurar
    // desde el caché en disco justo después (ver AuthService.loadProfile).
    const currentAvatarUrl = this.profile().avatarUrl;
    this.profile.set(fhirPatientToProfile(fhirPatient, userId, currentAvatarUrl));
    this.medicalRecord.set(fhirPatientToMedicalRecord(fhirPatient, userId));
  }

  /**
   * Sobrepone, sobre lo que acaba de traer setFromFhir, las 4 colecciones
   * que hoy solo viven de forma confiable en el caché local del
   * dispositivo (allergies, currentMedications, diagnoses,
   * emergencyContacts) — ver el porqué en MedicalRecordStorageService.
   *
   * Debe llamarse SIEMPRE justo después de setFromFhir (login y
   * restauración de sesión, ver AuthService.loadProfile); si no se llama,
   * fhirPatientToMedicalRecord deja esas colecciones en `[]` y cualquier
   * alergia/medicamento/diagnóstico/contacto agregado desde el teléfono
   * "desaparece" visualmente en cada login, aunque siga en la caché.
   */
  async hydrateLocalCollections(userId: string): Promise<void> {
    const cached = await this.localCache.load(userId);
    if (!cached) return;
    this.medicalRecord.update((r) => ({
      ...r,
      allergies: cached.medicalRecord.allergies,
      currentMedications: cached.medicalRecord.currentMedications,
      diagnoses: cached.medicalRecord.diagnoses,
      emergencyContacts: cached.medicalRecord.emergencyContacts,
      chronicConditions: cached.medicalRecord.chronicConditions,
      medicalDevices: cached.medicalRecord.medicalDevices,
      // El recurso FHIR no trae esto hoy: vive en el caché local.
      isOrganDonor: cached.medicalRecord.isOrganDonor ?? r.isOrganDonor,
      weightKg: r.weightKg ?? cached.medicalRecord.weightKg,
      heightM: r.heightM ?? cached.medicalRecord.heightM,
    }));
    if (!this.profile().avatarUrl && cached.profile.avatarUrl) {
      this.profile.update((p) => ({ ...p, avatarUrl: cached.profile.avatarUrl }));
    }
  }

  /**
   * Modo SIN CONEXIÓN: carga perfil y registro médico completos desde el
   * caché local (no solo las 4 colecciones como hydrateLocalCollections).
   * Devuelve false si no hay caché para ese paciente.
   */
  async restoreFromCache(userId: string): Promise<boolean> {
    const cached = await this.localCache.load(userId);
    if (!cached) return false;
    this.profile.set({ ...cached.profile, userId });
    this.medicalRecord.set({ ...cached.medicalRecord, userId });
    return true;
  }

  /** Limpia el estado EN MEMORIA al cerrar sesión.
   *
   * A propósito NO borra la caché local en disco (MedicalRecordStorageService):
   * si el mismo paciente vuelve a iniciar sesión en este teléfono, sus
   * alergias/medicamentos/diagnósticos/contactos deben seguir ahí. Para
   * borrar los datos de un paciente del dispositivo de forma explícita
   * (ej. "borrar mis datos"), usar localCache.clear(userId) aparte.
   */
  clear(): void {
    this.profile.set(EMPTY_PROFILE);
    this.medicalRecord.set(EMPTY_MEDICAL_RECORD);
  }

  /**
   * POST /api/v2/patient/update
   *
   * OJO con el avatar: igual que allergies/currentMedications/diagnoses/
   * emergencyContacts (ver comentario en MedicalRecordStorageService),
   * Bigback/FHIR no tiene dónde guardar avatarUrl, así que esta es la
   * ÚNICA fuente de verdad de la foto de perfil: el caché local en disco
   * (SecureStoragePlugin). Antes, este método nunca llamaba a
   * `localCache.save(...)`, así que una foto nueva solo vivía en el
   * signal en RAM y desaparecía al cerrar la app o, peor, al terminar
   * este mismo método si el backend respondía con el recurso Patient
   * (`setFromFhir` la pisaba con `undefined`). Se corrige:
   * 1) dándole prioridad al avatar recién elegido en el formulario sobre
   *    cualquier valor que venga (o no) de Bigback, y
   * 2) persistiendo siempre el resultado final en el caché local.
   */
  async updateProfile(authToken: string, changes: Omit<UpdatePatientRequest, 'auth_token'>): Promise<void> {
    const body: UpdatePatientRequest = { auth_token: authToken, ...changes };
    const newAvatarUrl = changes['avatar_url'] as string | undefined;

    const updated = await this.api.post<FhirPatient | { ok?: boolean; correo?: string }>(
      '/patient/update',
      body,
    );

    // Si cambió el correo y el servidor lo devuelve, se comprueba que sea el nuevo.
    const sentEmail = changes['correo'] as string | undefined;
    const returnedEmail = (updated as { correo?: unknown } | null)?.correo;
    if (sentEmail && typeof returnedEmail === 'string' && returnedEmail.trim().toLowerCase() !== sentEmail.trim().toLowerCase()) {
      throw new Error('El servidor no guardó el cambio de correo.');
    }

    let userId = this.profile().userId;

    if (updated && (updated as FhirPatient).resourceType === 'Patient') {
      userId = userId || (updated as FhirPatient).id || '';
      this.profile.set(
        fhirPatientToProfile(updated as FhirPatient, userId, newAvatarUrl ?? this.profile().avatarUrl),
      );
      this.medicalRecord.set(fhirPatientToMedicalRecord(updated as FhirPatient, userId));
      await this.hydrateLocalCollections(userId);
    } else {
      // El backend respondió solo un ack: se reflejan localmente los cambios conocidos.
      const firstName = changes['first_name'] as string | undefined;
      const lastName = changes['last_name'] as string | undefined;
      const phone = changes['phone'] as string | undefined;
      const birthDate = changes['birth_date'] as string | undefined;
      const gender = changes['gender'] as PatientProfile['gender'] | undefined;
      const documentType = changes['document_type'] as PatientProfile['documentType'] | undefined;
      const documentId = changes['document_id'] as string | undefined;
      const bloodType = changes['blood_type'] as MedicalRecord['bloodType'] | undefined;

      this.profile.update((p) => ({
        ...p,
        firstName: firstName ?? p.firstName,
        lastName: lastName ?? p.lastName,
        phoneNumber: phone ?? p.phoneNumber,
        birthDate: birthDate ?? p.birthDate,
        gender: gender ?? p.gender,
        documentType: documentType ?? p.documentType,
        documentId: documentId ?? p.documentId,
        avatarUrl: newAvatarUrl ?? p.avatarUrl,
      }));
      if (bloodType) {
        this.medicalRecord.update((m) => ({ ...m, bloodType }));
      }
    }

    // Peso y altura: la llave presente con `undefined` significa "en blanco".
    if ('weight_kg' in changes || 'height_m' in changes) {
      this.medicalRecord.update((m) => ({
        ...m,
        weightKg: changes['weight_kg'] as number | undefined,
        heightM: changes['height_m'] as number | undefined,
      }));
    }

    // Donante de órganos: se aplica DESPUÉS de las ramas de arriba porque el
    // mapper lo deja en false y hydrate lo restaura con el valor viejo del caché.
    if ('is_organ_donor' in changes) {
      this.medicalRecord.update((m) => ({
        ...m,
        isOrganDonor: !!changes['is_organ_donor'],
      }));
    }

    // Verificación de cédula contra el servidor (solo si se intentó cambiar).
    if ('document_id' in changes && changes['document_id']) {
      const me = await this.api.post<FhirPatient>(
        '/patient/me',
        { auth_token: authToken },
        { fhir: true, retries: 1 },
      );
      if (me?.resourceType === 'Patient') {
        const real = fhirPatientToProfile(me, userId || me.id || '', this.profile().avatarUrl);
        this.profile.set(real);
        const sent = String(changes['document_id']).trim();
        if (real.documentId.trim() !== sent) {
          await this.localCache.save(userId, this.profile(), this.medicalRecord());
          throw new Error(
            'No se pudo actualizar la cédula desde la app por ahora. Contacta a soporte para corregirla.',
          );
        }
      }
    }

    await this.localCache.save(userId, this.profile(), this.medicalRecord());
  }

  /** GET /fhir/Patient?identifier=<cedula> */
  async searchByDocument(documentId: string): Promise<PatientProfile | null> {
    const bundle = await this.api.getFhir<FhirBundle>(`/Patient?identifier=${encodeURIComponent(documentId)}`);
    const resource = bundle?.entry?.[0]?.resource;
    return resource ? fhirPatientToProfile(resource, resource.id ?? documentId) : null;
  }

  /**
   * Persiste alergias/medicamentos/diagnósticos/contactos de emergencia:
   * primero EN EL DISPOSITIVO (fuente de verdad garantizada) y, si hay
   * sesión activa, intenta también reflejarlo en Bigback (best-effort).
   *
   * 1) Guardado local (MedicalRecordStorageService): esto es lo que
   *    realmente resuelve "no se guarda la información" — deja de
   *    depender de la red o de que Bigback acepte estas llaves. Se hace
   *    siempre, con o sin `authToken`, para no perder nada si por algún
   *    motivo no hay sesión/token disponible en el momento de guardar.
   *
   * 2) Sync remoto (best-effort): no existe en la colección de Postman
   *    entregada un endpoint dedicado (ej. POST /patient/allergies,
   *    /patient/medications, /patient/diagnoses), así que este método
   *    reutiliza POST /patient/update -el único endpoint de escritura que
   *    sí confirmamos- enviando los arreglos completos con nombres de
   *    llave en snake_case, siguiendo la misma convención que ya usa
   *    UpdatePatientRequest (first_name, birth_date, blood_type, etc).
   *    Es una apuesta razonable, NO una certeza: solo funciona si el
   *    recurso Patient de Bigback en verdad mapea estas llaves. Hay que
   *    confirmar con el equipo de backend:
   *      a) si /patient/update acepta allergies/current_medications/
   *         diagnoses/emergency_contacts dentro del payload y los persiste, o
   *      b) si van a publicar endpoints dedicados para cada colección.
   *    Si este paso falla (red, timeout, o Bigback ignora las llaves), el
   *    dato YA quedó a salvo en el paso 1, así que no se pierde: solo
   *    significa que, por ahora, ese paciente solo tiene su información
   *    en este dispositivo y no en el servidor.
   */
  async persistMedicalRecord(authToken?: string | null): Promise<void> {
    const userId = this.profile().userId;
    const r = this.medicalRecord();

    await this.localCache.save(userId, this.profile(), r);

    if (!authToken) return;

    // 'allergies' y 'chronic_conditions' son campos de TEXTO plano en Odoo:
    // se mandan solo los nombres, separados por coma.
    const allergyNames = r.allergies.map((a) => a.name).join(', ');
    const chronicNames = (r.chronicConditions as unknown[])
      .map((c) => (typeof c === 'string' ? c : ((c as { name?: string })?.name ?? '')))
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
      .join(', ');

    const body = {
      auth_token: authToken,
      allergies: allergyNames,
      chronic_conditions: chronicNames,
      is_organ_donor: r.isOrganDonor,
      current_medications: r.currentMedications,
      diagnoses: r.diagnoses,
      // Confirmado que /patient/update NO guarda esto (responde 005); sigue
      // viviendo solo en el caché local. Ver comentarios previos.
      emergency_contacts: r.emergencyContacts,
    };
    await this.api.post('/patient/update', body);
  }
}
