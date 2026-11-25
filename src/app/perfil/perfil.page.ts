// src/app/perfil/perfil.page.ts
import { Component, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Browser } from '@capacitor/browser';
import {
  IonContent,
  IonIcon,
  AlertController,
  ModalController,
} from '@ionic/angular';
import { addIcons } from 'ionicons';
import {
  personCircleOutline,
  createOutline,
  lockClosedOutline,
  logOutOutline,
  documentTextOutline,
  trashOutline,
  chevronForward,
} from 'ionicons/icons';
import { AuthService } from '../core/services/auth.service';
import { PatientDataService } from '../core/services/patient-data.service';
import { EditarPerfilPage } from './editar-perfil/editar-perfil.page';
import { CambiarContrasenaPage } from './cambiar-contrasena/cambiar-contrasena.page';

@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, IonContent, IonIcon],
  templateUrl: './perfil.page.html',
  styleUrls: ['./perfil.page.scss'],
})
export class PerfilPage {
  profile = this.patientData.profile;

  fullName = computed(() => `${this.profile().firstName} ${this.profile().lastName}`);

  constructor(
    private authService: AuthService,
    private patientData: PatientDataService,
    private modalController: ModalController,
    private alertController: AlertController,
  ) {
    addIcons({
      personCircleOutline,
      createOutline,
      lockClosedOutline,
      logOutOutline,
      documentTextOutline,
      trashOutline,
      chevronForward,
    });
  }

  async goToEditProfile() {
    const modal = await this.modalController.create({
      component: EditarPerfilPage,
      cssClass: 'bc-fullscreen-modal',
    });
    await modal.present();
  }

  async goToChangePassword() {
    const modal = await this.modalController.create({
      component: CambiarContrasenaPage,
      cssClass: 'bc-fullscreen-modal',
    });
    await modal.present();
  }

  async goToTerms() {
    await Browser.open({ url: 'https://bestclinic.io/bestclinic_terms/' });
  }

  async logout() {
    const alert = await this.alertController.create({
      header: 'Cerrar sesión',
      message: '¿Seguro que deseas cerrar tu sesión?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Cerrar sesión',
          role: 'destructive',
          handler: () => this.authService.logout(),
        },
      ],
    });
    await alert.present();
  }

  async deleteAccount() {
    const alert = await this.alertController.create({
      header: 'Eliminar mi cuenta',
      message: 'Esta acción es permanente y borrará todos tus datos. ¿Deseas continuar?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          cssClass: 'alert-danger-btn',
          handler: () => {
            // TODO: reemplazar por llamada real a la API (DELETE /account)
            this.authService.logout();
          },
        },
      ],
    });
    await alert.present();
  }
}
