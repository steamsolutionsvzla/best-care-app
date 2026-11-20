// src/app/app.routes.ts
import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    redirectTo: 'auth/login',
    pathMatch: 'full',
  },
  {
    path: 'auth/login',
    loadComponent: () => import('./auth/login/login.page').then(m => m.LoginPage),
  },
  {
    path: 'auth/register',
    loadComponent: () => import('./auth/register/register.page').then(m => m.RegisterPage),
  },
  {
    path: 'auth/recuperar',
    loadComponent: () => import('./auth/recuperar/recuperar.page').then(m => m.RecuperarPage),
  },
  {
    path: 'tabs',
    loadComponent: () => import('./tabs/tabs.page').then(m => m.TabsPage),
    children: [
      {
        path: 'inicio',
        loadComponent: () => import('./inicio/inicio.page').then(m => m.InicioPage),
      },
      {
        path: 'centros',
        loadComponent: () => import('./centros/centros.page').then(m => m.CentrosPage),
      },
      {
        path: 'perfil',
        loadComponent: () => import('./perfil/perfil.page').then(m => m.PerfilPage),
      },
      {
        path: '',
        redirectTo: 'inicio',
        pathMatch: 'full',
      },
    ],
  },
  {
    path: 'perfil/editar',
    loadComponent: () =>
      import('./perfil/editar-perfil/editar-perfil.page').then(m => m.EditarPerfilPage),
  },
  {
    // Compatibilidad con la ruta anterior /home
    path: 'home',
    redirectTo: 'tabs/inicio',
  },
];