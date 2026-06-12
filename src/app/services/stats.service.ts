import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { ApiResponse, GuestEntity } from '../../types/api';

export interface WeddingStats {
  total: number;
  confirmed: number;
  pending: number;
  needTransport: number;
  declined?: number; // Opcional por si se añade luego
}

@Injectable({
  providedIn: 'root',
})
export class StatsService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiBaseUrl;

  getStats() {
    return this.http.get<ApiResponse<WeddingStats>>(`${this.baseUrl}/api/stats`);
  }

  getAttendance() {
    return this.http.get<ApiResponse<{ confirmed: number; pending: number }>>(
      `${this.baseUrl}/api/attendance`,
    );
  }

  getTransportation() {
    return this.http.get<ApiResponse<{ needTransport: number; noTransport: number }>>(
      `${this.baseUrl}/api/transportation`,
    );
  }

  getAllergies() {
    return this.http.get<ApiResponse<{ allergies: string; count: number }[]>>(
      `${this.baseUrl}/api/allergies`,
    );
  }

  getAllergiesStats() {
    return this.http.get<ApiResponse<{ allergies: string; count: number }[]>>(
      `${this.baseUrl}/api/stats/allergies`,
    );
  }

  getGuests() {
    return this.http.get<ApiResponse<GuestEntity[]>>(`${this.baseUrl}/api/guests`);
  }
}
