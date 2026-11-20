// src/app/inicio/inicio.page.ts
import { Component, computed, effect, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonIcon,
  IonModal,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  qrCodeOutline,
  expandOutline,
  warningOutline,
  alertCircle,
  alertCircleOutline,
  chevronForward,
  medicalOutline,
  documentTextOutline,
  addOutline,
  addCircleOutline,
  removeCircleOutline,
  trashOutline,
  closeOutline,
  pulseOutline,
  medkitOutline,
  timeOutline,
  calendarOutline,
  callOutline,
  personOutline,
  peopleOutline,
} from 'ionicons/icons';
import { toDataURL } from 'qrcode';
import { PatientDataService } from '../core/services/patient-data.service';
import { AuthService } from '../core/services/auth.service';
import {
  Allergy,
  AllergySeverity,
  CurrentMedication,
  Diagnosis,
  EmergencyContactEntry,
} from '../core/models/medical-record.model';

type DiagnosisStatus = Diagnosis['status'];

type ProfileTab = 'alergias' | 'medicamentos' | 'diagnosticos' | 'contactos';

interface ProfileTabDef {
  value: ProfileTab;
  label: string;
  icon: string;
  /** Reutiliza la misma paleta que .list-item-icon (danger/success/primary/info). */
  colorClass: 'danger' | 'success' | 'primary' | 'info';
}

@Component({
  selector: 'app-inicio',
  standalone: true,
  imports: [
    CommonModule,
    DatePipe,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonIcon,
    IonModal,
  ],
  templateUrl: './inicio.page.html',
  styleUrls: ['./inicio.page.scss'],
})
export class InicioPage {
  /** Definición de las 4 "ventanas" seleccionables (Alergias/Medicamentos/Diagnósticos/Contactos de emergencia). */
  readonly profileTabs: ProfileTabDef[] = [
    { value: 'alergias', label: 'Alergias', icon: 'warning-outline', colorClass: 'danger' },
    { value: 'medicamentos', label: 'Medicamentos', icon: 'medical-outline', colorClass: 'success' },
    { value: 'diagnosticos', label: 'Diagnósticos', icon: 'document-text-outline', colorClass: 'primary' },
    { value: 'contactos', label: 'Contactos de emergencia', icon: 'call-outline', colorClass: 'info' },
  ];

  profile = this.patientData.profile;
  record = this.patientData.medicalRecord;
  age = this.patientData.age;

  fullName = computed(() => `${this.profile().firstName} ${this.profile().lastName}`);

  // ===== QR de emergencia (tarjeta principal) =====
  isQrOpen = signal(false);
  qrDataUrl = signal<string | null>(null);
  qrError = signal('');

  /**
   * Payload codificado en el QR. TODO(producto/backend): definir el
   * formato final del enlace de "ficha de emergencia" (¿deep link a la
   * app, URL pública de solo lectura, o solo el documento de identidad?).
   * Por ahora se usa un deep link básico con el id del paciente para que
   * el QR ya sea funcional mientras se confirma el formato definitivo.
   */
  private qrPayload = computed(() => {
    const p = this.profile();
    const id = p.userId || p.documentId || 'sin-id';
    return `bestcare://emergencia/${id}`;
  });

  // ===== Alergias: modal de detalle (lista + alta desplegable) =====
  isAllergiesOpen = signal(false);
  isAllergyFormOpen = signal(false);
  newAllergyName = '';
  newAllergySeverity: AllergySeverity = 'moderada';
  newAllergyReaction = '';
  newAllergyNotes = '';
  addAllergyError = signal('');

  constructor(
    private patientData: PatientDataService,
    private authService: AuthService,
    private router: Router,
  ) {
    addIcons({
      qrCodeOutline,
      expandOutline,
      warningOutline,
      alertCircle,
      alertCircleOutline,
      chevronForward,
      medicalOutline,
      documentTextOutline,
      addOutline,
      addCircleOutline,
      removeCircleOutline,
      trashOutline,
      closeOutline,
      pulseOutline,
      medkitOutline,
      timeOutline,
      calendarOutline,
      callOutline,
      personOutline,
      peopleOutline,
    });

    // Genera el QR de forma automática (y lo regenera si cambia el id del
    // paciente) para que la miniatura dentro de la tarjeta azul esté
    // siempre visible, sin depender de que el usuario abra el modal.
    effect(() => {
      this.generateQr();
    });
  }

  /** Al tocar la tarjeta de MediCard, lleva a editar los datos del paciente. */
  goToEditProfile() {
    this.router.navigateByUrl('/perfil/editar');
  }

  /** Al tocar una fila del historial médico, abre su modal de detalle (lista + alta). */
  openSegment(tab: ProfileTab) {
    switch (tab) {
      case 'alergias':
        this.openAllergiesModal();
        break;
      case 'medicamentos':
        this.openMedicationsModal();
        break;
      case 'diagnosticos':
        this.openDiagnosesModal();
        break;
      case 'contactos':
        this.openContactsModal();
        break;
    }
  }

  /** Texto "X registradas/activos" que se muestra bajo cada ventana seleccionable. */
  countLabel(tab: ProfileTab): string {
    switch (tab) {
      case 'alergias': {
        const n = this.record().allergies.length;
        return `${n} registrada${n === 1 ? '' : 's'}`;
      }
      case 'medicamentos': {
        const n = this.record().currentMedications.length;
        return `${n} activo${n === 1 ? '' : 's'}`;
      }
      case 'diagnosticos': {
        const n = this.record().diagnoses.length;
        return `${n} registrado${n === 1 ? '' : 's'}`;
      }
      case 'contactos': {
        const n = this.record().emergencyContacts.length;
        return `${n} contacto${n === 1 ? '' : 's'}`;
      }
    }
  }

  /**
   * Genera (o regenera) la imagen del QR de emergencia. Se usa tanto para
   * la miniatura siempre visible en la tarjeta azul como, si hiciera
   * falta, para refrescarla justo antes de mostrar el modal ampliado.
   */
  private async generateQr() {
    this.qrError.set('');
    try {
      const url = await toDataURL(this.qrPayload(), {
        errorCorrectionLevel: 'M',
        margin: 1,
        width: 320,
        color: { dark: '#0B1F3A', light: '#FFFFFF' },
      });
      this.qrDataUrl.set(url);
    } catch (err) {
      console.error('[BestCare][generateQr] no se pudo generar el código QR', err);
      this.qrError.set('No se pudo generar el código. Intenta de nuevo.');
    }
  }

  /** Abre el modal con la disposición completa del QR de emergencia. */
  async openQr() {
    this.isQrOpen.set(true);
    if (!this.qrDataUrl()) {
      await this.generateQr();
    }
  }

  closeQr() {
    this.isQrOpen.set(false);
  }

  /** TODO(debug): idem, confirma si ion-modal recibió la orden de presentarse. */
  logModalEvent(modal: string, event: string) {
    console.log(`[BestCare][ion-modal:${modal}] evento =`, event);
  }

  /**
   * Guarda alergias/medicamentos/diagnósticos/contactos de emergencia
   * después de cada alta/baja local: SIEMPRE en el dispositivo, y además
   * en Bigback si hay sesión activa (best-effort).
   *
   * Antes, si `authToken()` no estaba disponible, este método salía sin
   * hacer nada (`if (!token) return`) y ni siquiera se guardaba en el
   * teléfono. Ahora se llama a `persistMedicalRecord` siempre: el guardado
   * local no depende del token, solo el intento de sync remoto lo usa
   * (ver PatientDataService.persistMedicalRecord).
   */
  private async syncMedicalRecord() {
    try {
      await this.patientData.persistMedicalRecord(this.authService.authToken());
    } catch (err) {
      console.error('[BestCare][syncMedicalRecord] fallo al sincronizar con Bigback (ya quedó guardado en el teléfono)', err);
    }
  }

  async removeAllergy(allergyId: string) {
    this.record.update(r => ({
      ...r,
      allergies: r.allergies.filter(a => a.id !== allergyId),
    }));
    await this.syncMedicalRecord();
  }

  openAllergiesModal() {
    this.isAllergyFormOpen.set(false);
    this.resetAllergyForm();
    this.isAllergiesOpen.set(true);
  }

  closeAllergiesModal() {
    this.isAllergiesOpen.set(false);
  }

  private resetAllergyForm() {
    this.newAllergyName = '';
    this.newAllergySeverity = 'moderada';
    this.newAllergyReaction = '';
    this.newAllergyNotes = '';
    this.addAllergyError.set('');
  }

  /** Muestra u oculta, dentro del modal de Alergias, la sección para dar de alta una nueva. */
  toggleAllergyForm() {
    if (this.isAllergyFormOpen()) {
      this.isAllergyFormOpen.set(false);
      return;
    }
    this.resetAllergyForm();
    this.isAllergyFormOpen.set(true);
  }

  async saveNewAllergy() {
    const name = this.newAllergyName.trim();
    if (!name) {
      this.addAllergyError.set('Escribe el nombre de la alergia.');
      return;
    }

    const yaExiste = this.record().allergies.some(
      (a) => a.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (yaExiste) {
      this.addAllergyError.set('Esa alergia ya está registrada.');
      return;
    }

    const newAllergy: Allergy = {
      // TODO: si el backend expone un endpoint dedicado para alergias
      // (ej. POST /patient/allergies), reemplazar este id local por el
      // que devuelva el servidor y persistir ahí en vez de solo en el
      // signal local (igual que removeAllergy() hoy, esto solo vive en
      // memoria de la app mientras no exista ese endpoint confirmado).
      id: `al-${Date.now()}`,
      name,
      severity: this.newAllergySeverity,
      reaction: this.newAllergyReaction.trim() || undefined,
      notes: this.newAllergyNotes.trim() || undefined,
    };

    this.record.update((r) => ({
      ...r,
      allergies: [...r.allergies, newAllergy],
    }));

    // Colapsa el formulario y lo deja listo para una próxima alta, pero
    // mantiene el modal abierto para que el usuario vea la lista actualizada.
    this.isAllergyFormOpen.set(false);
    this.resetAllergyForm();
    await this.syncMedicalRecord();
  }

  // ===== Medicamentos: modal de detalle (lista + alta desplegable) =====
  isMedicationsOpen = signal(false);
  isMedicationFormOpen = signal(false);
  newMedicationName = '';
  newMedicationDosage = '';
  newMedicationFrequency = '';
  newMedicationNotes = '';
  addMedicationError = signal('');

  async removeMedication(medicationId: string) {
    this.record.update(r => ({
      ...r,
      currentMedications: r.currentMedications.filter(m => m.id !== medicationId),
    }));
    await this.syncMedicalRecord();
  }

  openMedicationsModal() {
    this.isMedicationFormOpen.set(false);
    this.resetMedicationForm();
    this.isMedicationsOpen.set(true);
  }

  closeMedicationsModal() {
    this.isMedicationsOpen.set(false);
  }

  private resetMedicationForm() {
    this.newMedicationName = '';
    this.newMedicationDosage = '';
    this.newMedicationFrequency = '';
    this.newMedicationNotes = '';
    this.addMedicationError.set('');
  }

  toggleMedicationForm() {
    if (this.isMedicationFormOpen()) {
      this.isMedicationFormOpen.set(false);
      return;
    }
    this.resetMedicationForm();
    this.isMedicationFormOpen.set(true);
  }

  async saveNewMedication() {
    const name = this.newMedicationName.trim();
    if (!name) {
      this.addMedicationError.set('Escribe el nombre del medicamento.');
      return;
    }

    const yaExiste = this.record().currentMedications.some(
      (m) => m.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (yaExiste) {
      this.addMedicationError.set('Ese medicamento ya está registrado.');
      return;
    }

    const newMedication: CurrentMedication = {
      // TODO: si el backend expone un endpoint dedicado para medicamentos
      // (ej. POST /patient/medications), reemplazar este id local por el
      // que devuelva el servidor, igual que con las alergias.
      id: `med-${Date.now()}`,
      name,
      dosage: this.newMedicationDosage.trim() || 'Sin especificar',
      frequency: this.newMedicationFrequency.trim() || 'Sin especificar',
      notes: this.newMedicationNotes.trim() || undefined,
    };

    this.record.update((r) => ({
      ...r,
      currentMedications: [...r.currentMedications, newMedication],
    }));

    this.isMedicationFormOpen.set(false);
    this.resetMedicationForm();
    await this.syncMedicalRecord();
  }

  // ===== Diagnósticos: modal de detalle (lista + alta desplegable) =====
  isDiagnosesOpen = signal(false);
  isDiagnosisFormOpen = signal(false);
  newDiagnosisName = '';
  newDiagnosisStatus: DiagnosisStatus = 'activo';
  newDiagnosisDate = '';
  newDiagnosisNotes = '';
  addDiagnosisError = signal('');

  async removeDiagnosis(diagnosisId: string) {
    this.record.update(r => ({
      ...r,
      diagnoses: r.diagnoses.filter(d => d.id !== diagnosisId),
    }));
    await this.syncMedicalRecord();
  }

  openDiagnosesModal() {
    this.isDiagnosisFormOpen.set(false);
    this.resetDiagnosisForm();
    this.isDiagnosesOpen.set(true);
  }

  closeDiagnosesModal() {
    this.isDiagnosesOpen.set(false);
  }

  private resetDiagnosisForm() {
    this.newDiagnosisName = '';
    this.newDiagnosisStatus = 'activo';
    this.newDiagnosisDate = '';
    this.newDiagnosisNotes = '';
    this.addDiagnosisError.set('');
  }

  toggleDiagnosisForm() {
    if (this.isDiagnosisFormOpen()) {
      this.isDiagnosisFormOpen.set(false);
      return;
    }
    this.resetDiagnosisForm();
    this.isDiagnosisFormOpen.set(true);
  }

  async saveNewDiagnosis() {
    const name = this.newDiagnosisName.trim();
    if (!name) {
      this.addDiagnosisError.set('Escribe el nombre del diagnóstico.');
      return;
    }

    const yaExiste = this.record().diagnoses.some(
      (d) => d.name.trim().toLowerCase() === name.toLowerCase(),
    );
    if (yaExiste) {
      this.addDiagnosisError.set('Ese diagnóstico ya está registrado.');
      return;
    }

    const newDiagnosis: Diagnosis = {
      // TODO: si el backend expone un endpoint dedicado para diagnósticos
      // (ej. POST /patient/diagnoses), reemplazar este id local por el
      // que devuelva el servidor, igual que con las alergias.
      id: `dx-${Date.now()}`,
      name,
      status: this.newDiagnosisStatus,
      diagnosedAt: this.newDiagnosisDate || undefined,
      notes: this.newDiagnosisNotes.trim() || undefined,
    };

    this.record.update((r) => ({
      ...r,
      diagnoses: [...r.diagnoses, newDiagnosis],
    }));

    this.isDiagnosisFormOpen.set(false);
    this.resetDiagnosisForm();
    await this.syncMedicalRecord();
  }

  // ===== Contactos de emergencia: modal de detalle (lista + alta desplegable) =====
  isContactsOpen = signal(false);
  isContactFormOpen = signal(false);
  newContactName = '';
  newContactRelationship = '';
  newContactPhone = '';
  addContactError = signal('');

  async removeEmergencyContact(contactId: string) {
    this.record.update(r => ({
      ...r,
      emergencyContacts: r.emergencyContacts.filter(c => c.id !== contactId),
    }));
    await this.syncMedicalRecord();
  }

  openContactsModal() {
    this.isContactFormOpen.set(false);
    this.resetContactForm();
    this.isContactsOpen.set(true);
  }

  closeContactsModal() {
    this.isContactsOpen.set(false);
  }

  private resetContactForm() {
    this.newContactName = '';
    this.newContactRelationship = '';
    this.newContactPhone = '';
    this.addContactError.set('');
  }

  toggleContactForm() {
    if (this.isContactFormOpen()) {
      this.isContactFormOpen.set(false);
      return;
    }
    this.resetContactForm();
    this.isContactFormOpen.set(true);
  }

  async saveNewContact() {
    const name = this.newContactName.trim();
    const phone = this.newContactPhone.trim();

    if (!name) {
      this.addContactError.set('Escribe el nombre del contacto.');
      return;
    }
    if (!phone) {
      this.addContactError.set('Escribe un teléfono de contacto.');
      return;
    }

    const newContact: EmergencyContactEntry = {
      // TODO: igual que con alergias/medicamentos/diagnósticos, reemplazar
      // por el id que devuelva el backend en cuanto exista un endpoint
      // dedicado (ej. POST /patient/emergency-contacts).
      id: `ec-${Date.now()}`,
      name,
      relationship: this.newContactRelationship.trim() || 'Sin especificar',
      phone,
    };

    this.record.update((r) => ({
      ...r,
      emergencyContacts: [...r.emergencyContacts, newContact],
    }));

    this.isContactFormOpen.set(false);
    this.resetContactForm();
    await this.syncMedicalRecord();
  }
}
