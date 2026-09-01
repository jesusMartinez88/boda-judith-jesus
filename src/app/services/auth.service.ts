import { Injectable, signal, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { catchError, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AuthLoginRequest,
  AuthLoginResponse,
  AuthRegisterRequest,
  AuthRegisterResponse,
} from '../../types/api';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private baseUrl = environment.apiBaseUrl;
  private platformId = inject(PLATFORM_ID);

  // En SSR no hay localStorage → el usuario se considera no autenticado.
  // En cliente se lee el token persistido.
  private isAuthenticatedSignal = signal<boolean>(this.checkToken());

  isAuthenticated = this.isAuthenticatedSignal.asReadonly();

  login(credentials: AuthLoginRequest) {
    return this.http
      .post<AuthLoginResponse>(`${this.baseUrl}/api/auth/login`, credentials)
      .pipe(
        tap((response) => {
          if (response?.token && isPlatformBrowser(this.platformId)) {
            localStorage.setItem('auth_token', response.token);
            this.isAuthenticatedSignal.set(true);
          }
        }),
        catchError((err) => {
          console.error('[auth] login error:', err);
          throw err;
        }),
      );
  }

  register(payload: AuthRegisterRequest) {
    return this.http
      .post<AuthRegisterResponse>(`${this.baseUrl}/api/auth/register`, payload)
      .pipe(
        tap((response) => {
          if (response?.token && isPlatformBrowser(this.platformId)) {
            localStorage.setItem('auth_token', response.token);
            this.isAuthenticatedSignal.set(true);
          }
        }),
        catchError((err) => {
          console.error('[auth] register error:', err);
          throw err;
        }),
      );
  }

  logout() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('auth_token');
    }
    this.isAuthenticatedSignal.set(false);
    this.router.navigate(['/login']);
  }

  private checkToken(): boolean {
    if (!isPlatformBrowser(this.platformId)) {
      return false;
    }
    return !!localStorage.getItem('auth_token');
  }
}
