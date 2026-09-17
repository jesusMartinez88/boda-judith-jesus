import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse } from '../../types/api';

/**
 * Categorías que el visitante puede elegir en el formulario público de la
 * landing. Es distinta del universo de "Contact" (CRUD admin) y de
 * "Invitation", así que vive en su propio servicio.
 */
export type ContactMessageCategory =
  | 'info'
  | 'soporte'
  | 'sugerencia'
  | 'otro';

/**
 * Payload que acepta el endpoint público `POST /api/contact-message`.
 *
 * El campo `website` es un honeypot: si llega relleno, el servidor lo
 * considerará spam y devolverá 400. El cliente también lo bloquea antes
 * de salir hacia el backend.
 */
export interface ContactMessagePayload {
  name: string;
  email: string;
  category?: ContactMessageCategory;
  subject?: string;
  message: string;
  website?: string;
}

export interface ContactMessageResult {
  sent: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ContactMessageService {
  private readonly apiUrl = `${environment.apiBaseUrl}/api/contact-message`;
  private readonly http = inject(HttpClient);

  /**
   * Envía un mensaje al propietario del producto desde el formulario
   * público de la landing. No requiere autenticación.
   *
   * Resuelve con `ApiResponse<ContactMessageResult>` aunque
   * `success === false`; lanza excepción ante errores de red o HTTP sin
   * cuerpo JSON parseable.
   */
  async sendContactMessage(
    payload: ContactMessagePayload,
  ): Promise<ApiResponse<ContactMessageResult>> {
    try {
      const response = await firstValueFrom(
        this.http.post<ApiResponse<ContactMessageResult>>(this.apiUrl, payload),
      );
      return response;
    } catch (error) {
      console.error('Error sending contact message:', error);
      throw error;
    }
  }
}
