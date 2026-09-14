import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, LandingQuestionnaire, LandingQuestionnairePatch } from '../../types/api';

/**
 * Servicio del cuestionario inicial de la landing.
 *
 *   GET  /api/landing-questionnaire           → cuestionario del usuario autenticado
 *   PUT  /api/landing-questionnaire           → guarda el cuestionario del usuario autenticado
 *   GET  /api/admin/users/:id/landing-questionnaire → solo admins
 *
 * El backend ya hace upsert por userId, así que `save()` es seguro
 * llamarlo aunque el cliente ya hubiera rellenado el cuestionario antes.
 */
@Injectable({
  providedIn: 'root',
})
export class LandingQuestionnaireService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiBaseUrl;

  /**
   * Devuelve el cuestionario del usuario autenticado, o `null` si
   * todavía no lo ha rellenado.
   */
  getMine(): Promise<LandingQuestionnaire | null> {
    return firstValueFrom(
      this.http.get<ApiResponse<LandingQuestionnaire | null>>(
        `${this.baseUrl}/api/landing-questionnaire`,
      ),
    ).then((res) => res.data ?? null);
  }

  /**
   * Crea o actualiza el cuestionario del usuario autenticado.
   */
  save(patch: LandingQuestionnairePatch): Promise<LandingQuestionnaire> {
    return firstValueFrom(
      this.http.put<ApiResponse<LandingQuestionnaire>>(
        `${this.baseUrl}/api/landing-questionnaire`,
        patch,
      ),
    ).then((res) => res.data as LandingQuestionnaire);
  }

  /**
   * Recupera el cuestionario de un usuario concreto (solo admins).
   * Devuelve `null` si el usuario aún no lo ha rellenado.
   */
  getForUser(userId: number): Promise<LandingQuestionnaire | null> {
    return firstValueFrom(
      this.http.get<ApiResponse<LandingQuestionnaire | null>>(
        `${this.baseUrl}/api/admin/users/${userId}/landing-questionnaire`,
      ),
    ).then((res) => res.data ?? null);
  }
}