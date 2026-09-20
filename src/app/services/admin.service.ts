import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  ApiResponse,
  AdminUser,
  AdminUserPatch,
  LandingQuestionnaire,
} from '../../types/api';
import { LandingQuestionnaireService } from './landing-questionnaire.service';

export interface VisitStats {
  totalVisits: number;
  todayVisits: number;
  weekVisits: number;
  lastVisitAt: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiBaseUrl;
  private questionnaireService = inject(LandingQuestionnaireService);

  listUsers(): Promise<AdminUser[]> {
    return firstValueFrom(
      this.http.get<ApiResponse<AdminUser[]>>(`${this.baseUrl}/api/admin/users`),
    ).then((res) => res.data ?? []);
  }

  updateUser(id: number, patch: AdminUserPatch): Promise<AdminUser> {
    return firstValueFrom(
      this.http.patch<ApiResponse<AdminUser>>(
        `${this.baseUrl}/api/admin/users/${id}`,
        patch,
      ),
    ).then((res) => res.data as AdminUser);
  }

  deleteUser(id: number): Promise<void> {
    return firstValueFrom(
      this.http.delete<ApiResponse<unknown>>(`${this.baseUrl}/api/admin/users/${id}`),
    ).then(() => undefined);
  }

  getVisitStats(): Promise<VisitStats> {
    return firstValueFrom(
      this.http.get<ApiResponse<VisitStats>>(`${this.baseUrl}/api/admin/stats/visits`),
    ).then((res) => res.data as VisitStats);
  }

  getLandingQuestionnaire(userId: number): Promise<LandingQuestionnaire | null> {
    return this.questionnaireService.getForUser(userId);
  }
}
