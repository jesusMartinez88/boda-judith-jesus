import { Routes } from '@angular/router';

import { authGuard, adminGuard } from './services/auth.guard';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./components/landing/landing.component').then((m) => m.LandingComponent),
  },
  {
    path: 'register',
    loadComponent: () => import('./components/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'login',
    loadComponent: () => import('./components/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'judith-jesus',
    loadComponent: () =>
      import('./components/invitations/judith-jesus/judith-jesus.component').then(
        (m) => m.JudithJesusComponent,
      ),
  },
  {
    path: 'helena-juan',
    loadComponent: () =>
      import('./components/invitations/helena-juan/helena-juan.component').then(
        (m) => m.HelenaJuanComponent,
      ),
  },
  {
    path: ':tenant/dashboard',
    loadComponent: () =>
      import('./components/dashboard/dashboard.component').then((m) => m.DashboardComponent),
    canActivate: [authGuard],
  },
  {
    path: ':tenant',
    loadComponent: () =>
      import('./components/invitation-not-found/invitation-not-found.component').then(
        (m) => m.InvitationNotFoundComponent,
      ),
  },
  {
    path: 'admin/users',
    loadComponent: () =>
      import('./components/admin-users/admin-users.component').then(
        (m) => m.AdminUsersComponent,
      ),
    canActivate: [authGuard, adminGuard],
  },
  { path: '**', redirectTo: '' },
];
