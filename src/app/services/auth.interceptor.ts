import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { AuthService } from './auth.service';
import { isFirstPartyApiUrl } from './auth-security';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const platformId = inject(PLATFORM_ID);

  // En SSR no hay localStorage → no hay token que añadir.
  const isBrowser = isPlatformBrowser(platformId);
  const token = isBrowser ? localStorage.getItem('auth_token') : null;

  // Solo la API propia puede recibir credenciales.
  if (!isFirstPartyApiUrl(req.url)) {
    return next(req);
  }

  let request = req;
  if (token) {
    request = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      // Solo deslogueamos si:
      // - Estamos en el navegador,
      // - Tenemos token,
      // - El backend dice explícitamente que el token no es válido.
      if (!isBrowser) {
        return throwError(() => error);
      }
      const hasToken = !!localStorage.getItem('auth_token');
      const isLoginEndpoint = req.url.includes('/api/auth/login');
      const isRegisterEndpoint = req.url.includes('/api/auth/register');
      const message = (error.error && (error.error.message || error.error.error)) || '';
      const tokenError =
        error.status === 401 &&
        hasToken &&
        !isLoginEndpoint &&
        !isRegisterEndpoint &&
        (message.toLowerCase().includes('token') ||
          message.toLowerCase().includes('expired') ||
          message.toLowerCase().includes('invalid') ||
          message.toLowerCase().includes('authorization'));

      if (tokenError) {
        console.warn('Token invalid or expired. Logging out...');
        authService.logout();
      }
      return throwError(() => error);
    }),
  );
};
