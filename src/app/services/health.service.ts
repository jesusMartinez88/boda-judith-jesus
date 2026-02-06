import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { resource } from '@angular/core';
import { firstValueFrom } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class HealthService {
  constructor(private http: HttpClient) {}

  private baseUrl = environment.apiBaseUrl;

  warmUpResource = resource({
    loader: async () => {
      try {
        await firstValueFrom(this.http.get(`${this.baseUrl}/health`));
        console.log('✓ Servidor warm-up completado');
      } catch {
        console.log('Servidor warm-up iniciado (error silencioso)');
      }
    }
  });

  warmUpServer(): void {
    // Dispara la petición en segundo plano
    this.warmUpResource.reload();
  }
}
