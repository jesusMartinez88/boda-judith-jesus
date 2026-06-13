import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, AuthLoginRequest, AuthLoginResponse } from '../../types/api';

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private baseUrl = environment.apiBaseUrl;

  private isAuthenticatedSignal = signal<boolean>(this.checkToken());

  isAuthenticated = this.isAuthenticatedSignal.asReadonly();

  login(credentials: AuthLoginRequest) {
    return this.http
      .post<ApiResponse<AuthLoginResponse>>(`${this.baseUrl}/api/auth/login`, credentials)
      .pipe(
        tap((response) => {
          const maybe = response as ApiResponse<AuthLoginResponse> | AuthLoginResponse;
          const token =
            (maybe as AuthLoginResponse).token ??
            (maybe as ApiResponse<AuthLoginResponse>).data?.token;
          if (token) {
            localStorage.setItem('auth_token', token);
            this.isAuthenticatedSignal.set(true);
          }
        }),
        catchError((err) => {
          console.error('Login error:', err);
          throw err;
        }),
      );
  }

  logout() {
    localStorage.removeItem('auth_token');
    this.isAuthenticatedSignal.set(false);
    this.router.navigate(['/login']);
  }

  private checkToken(): boolean {
    return !!localStorage.getItem('auth_token');
  }
}
