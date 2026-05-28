import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { AuthService } from './auth.service';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = localStorage.getItem('auth_token');
  
  // 1. Si la petición va hacia la API de Google/YouTube, déjala pasar limpia
  if (req.url.includes('googleapis.com')) {
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
      if (error.status === 401 || error.status === 403) {
        console.warn('Token expired or unauthorized. Logging out...');
        authService.logout();
      }
      return throwError(() => error);
    }),
  );
};
