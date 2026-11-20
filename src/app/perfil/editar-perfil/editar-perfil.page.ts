// src/app/perfil/editar-perfil/editar-perfil.page.ts
import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonItem,
  IonInput,
  IonSelect,
  IonSelectOption,
  IonIcon,
  IonSpinner,
  IonText,
  IonToggle,
  ToastController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  arrowBackOutline,
  cameraOutline,
  personOutline,
  callOutline,
  calendarOutline,
  idCardOutline,
  waterOutline,
  maleFemaleOutline,
  barbellOutline,
  swapVerticalOutline,
  mailOutline,
  lockClosedOutline,
  heartOutline,
} from 'ionicons/icons';
import { AuthService } from '../../core/services/auth.service';
import { PatientDataService } from '../../core/services/patient-data.service';
import { DocumentType, Gender } from '../../core/models/patient-profile.model';
import { BloodType } from '../../core/models/medical-record.model';
import { resizeImageToJpegDataUrl } from '../../core/utils/image.util';

/** Mínimo de caracteres para la contraseña nueva (ajustar a la regla real de Bigback). */
const MIN_PASSWORD_LENGTH = 8;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

@Component({
  selector: 'app-editar-perfil',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonItem,
    IonInput,
    IonSelect,
    IonSelectOption,
    IonIcon,
    IonSpinner,
    IonText,
    IonToggle,
  ],
  templateUrl: './editar-perfil.page.html',
  styleUrls: ['./editar-perfil.page.scss'],
})
export class EditarPerfilPage {
  // Datos de identidad (PatientProfile)
  firstName = '';
  lastName = '';
  phone = '';
  birthDate = '';
  gender: Gender = 'Other';
  documentType: DocumentType = 'V';
  documentId = '';
  avatarUrl: string | undefined = undefined;

  // Cuenta
  email = '';
  /** Correo con el que se abrió la pantalla; sirve para saber si cambió. */
  private originalEmail = '';
  /** Contraseña nueva (opcional). Vacía = no se cambia. */
  newPassword = '';
  confirmPassword = '';

  // Datos médicos (MedicalRecord)
  bloodType: BloodType = 'O+';
  isOrganDonor = false;
  /** Peso en kg como texto del formulario ('' = sin registrar) */
  weight = '';
  /** Altura en metros como texto del formulario ('' = sin registrar) */
  height = '';

  readonly bloodTypes: BloodType[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  /** Fuerza que los popover de ion-select midan según su contenido. */
  selectPopoverOptions = { size: 'auto' as const };

  submitting = signal(false);
  errorMessage = signal('');

  constructor(
    private authService: AuthService,
    private patientData: PatientDataService,
    private router: Router,
    private toastController: ToastController,
  ) {
    addIcons({
      arrowBackOutline,
      cameraOutline,
      personOutline,
      callOutline,
      calendarOutline,
      idCardOutline,
      waterOutline,
      maleFemaleOutline,
      barbellOutline,
      swapVerticalOutline,
      mailOutline,
      lockClosedOutline,
      heartOutline,
    });

    // Precargar el formulario con los datos actuales del paciente.
    const profile = this.patientData.profile();
    const medicalRecord = this.patientData.medicalRecord();

    this.firstName = profile.firstName;
    this.lastName = profile.lastName;
    this.phone = profile.phoneNumber;
    this.birthDate = profile.birthDate;
    this.gender = profile.gender;
    this.documentType = profile.documentType;
    this.documentId = profile.documentId;
    this.avatarUrl = profile.avatarUrl;

    this.email = this.authService.currentUser()?.email ?? '';
    this.originalEmail = this.email;

    this.bloodType = medicalRecord.bloodType;
    this.isOrganDonor = !!medicalRecord.isOrganDonor;
    this.weight = medicalRecord.weightKg != null ? String(medicalRecord.weightKg) : '';
    this.height = medicalRecord.heightM != null ? String(medicalRecord.heightM) : '';
  }

  /** Texto -> número aceptando coma o punto decimal. `undefined` si está en blanco. */
  private parseOptionalDecimal(value: string): number | undefined {
    const raw = String(value ?? '').trim().replace(',', '.');
    return raw === '' ? undefined : Number(raw);
  }

  /**
   * Elegir una nueva foto de perfil. La imagen se reduce (máx. 512 px, JPEG)
   * ANTES de usarla (ver image.util.ts).
   */
  async onAvatarSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      this.avatarUrl = await resizeImageToJpegDataUrl(file);
      this.errorMessage.set('');
    } catch (err) {
      console.error('[BestCare][editar-perfil] no se pudo procesar la foto', err);
      this.errorMessage.set('No se pudo procesar la foto. Intenta con otra imagen.');
    } finally {
      input.value = '';
    }
  }

  async onSave() {
    this.errorMessage.set('');

    if (!this.firstName || !this.lastName) {
      this.errorMessage.set('El nombre y el apellido son obligatorios.');
      return;
    }

    const weightKg = this.parseOptionalDecimal(this.weight);
    if (weightKg !== undefined && (!Number.isFinite(weightKg) || weightKg < 2 || weightKg > 500)) {
      this.errorMessage.set('Ingresa un peso válido en kilogramos (ej. 70).');
      return;
    }
    const heightM = this.parseOptionalDecimal(this.height);
    if (heightM !== undefined && (!Number.isFinite(heightM) || heightM < 0.3 || heightM > 2.5)) {
      this.errorMessage.set('Ingresa una altura válida en metros (ej. 1.75).');
      return;
    }

    // Correo: solo se valida/envía si el usuario lo cambió.
    const newEmail = this.email.trim();
    const emailChanged = newEmail !== '' && newEmail.toLowerCase() !== this.originalEmail.trim().toLowerCase();
    if (emailChanged && !EMAIL_REGEX.test(newEmail)) {
      this.errorMessage.set('Ingresa un correo válido.');
      return;
    }

    // Contraseña: solo si el usuario escribió una nueva.
    const passwordChanged = this.newPassword !== '';
    if (passwordChanged) {
      if (this.newPassword.length < MIN_PASSWORD_LENGTH) {
        this.errorMessage.set(`La contraseña nueva debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
        return;
      }
      if (this.newPassword !== this.confirmPassword) {
        this.errorMessage.set('Las contraseñas no coinciden.');
        return;
      }
    }

    const token = this.authService.authToken();
    if (!token) {
      this.errorMessage.set('Tu sesión expiró. Vuelve a iniciar sesión.');
      return;
    }

    // La cédula solo se envía si el usuario la cambió.
    const original = this.patientData.profile();
    const documentChanged =
      this.documentId.trim() !== original.documentId.trim() || this.documentType !== original.documentType;

    this.submitting.set(true);
    try {
      await this.patientData.updateProfile(token, {
        first_name: this.firstName,
        last_name: this.lastName,
        phone: this.phone,
        birth_date: this.birthDate,
        gender: this.gender,
        ...(documentChanged
          ? { document_type: this.documentType, document_id: this.documentId.trim() }
          : {}),
        ...(emailChanged ? { correo: newEmail } : {}),
        ...(passwordChanged ? { password: this.newPassword } : {}),
        blood_type: this.bloodType,
        is_organ_donor: this.isOrganDonor,
        weight_kg: weightKg,
        height_m: heightM,
        avatar_url: this.avatarUrl,
      });

      // Mantener el correo de la sesión al día para que la UI y el próximo
      // precargado del formulario muestren el nuevo.
      if (emailChanged) {
        this.authService.currentUser.update((u) => (u ? { ...u, email: newEmail } : u));
        this.originalEmail = newEmail;
      }
      // La contraseña no se conserva en memoria después de guardar.
      this.newPassword = '';
      this.confirmPassword = '';

      const toast = await this.toastController.create({
        message: 'Tus datos se actualizaron correctamente.',
        duration: 2000,
        color: 'success',
        position: 'top',
      });
      await toast.present();

      this.router.navigateByUrl('/tabs/perfil');
    } catch (err) {
      console.error('[BestCare][editar-perfil] update falló', err);
      this.errorMessage.set(
        err instanceof Error && err.message
          ? err.message
          : 'No se pudieron guardar los cambios. Intenta de nuevo.',
      );
    } finally {
      this.submitting.set(false);
    }
  }

  goBack() {
    this.router.navigateByUrl('/tabs/perfil');
  }
}
