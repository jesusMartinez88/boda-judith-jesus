import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const authGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;
  }
  router.navigate(['/login']);
  return false;
};

/**
 * Protege rutas que solo el admin puede ver. Asume que `authGuard` corre antes
 * (el canActivate se evalúa en orden y todos deben pasar). Si el usuario
 * está autenticado pero NO es admin, lo mandamos a su dashboard.
 */
export const adminGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/login']);
    return false;
  }

  if (authService.isAdmin()) {
    return true;
  }

  // Usuario autenticado pero sin permisos: lo mandamos a su dashboard.
  const slug = authService.currentUser()?.slug;
  router.navigate(slug ? [`/${slug}/dashboard`] : ['/login']);
  return false;
};
