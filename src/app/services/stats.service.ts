import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';

export interface WeddingStats {
    total: number;
    confirmed: number;
    pending: number;
    needTransport: number;
    declined?: number; // Opcional por si se añade luego
}

@Injectable({
    providedIn: 'root'
})
export class StatsService {
    private http = inject(HttpClient);
    private baseUrl = environment.apiBaseUrl;

    getStats() {
        return this.http.get<WeddingStats>(`${this.baseUrl}/api/stats`);
    }

    getAttendance() {
        return this.http.get(`${this.baseUrl}/api/attendance`);
    }

    getTransportation() {
        return this.http.get(`${this.baseUrl}/api/transportation`);
    }

    getAllergies() {
        return this.http.get(`${this.baseUrl}/api/allergies`);
    }

    getAllergiesStats() {
        return this.http.get<any>(`${this.baseUrl}/api/stats/allergies`);
    }

    getGuests() {
        return this.http.get(`${this.baseUrl}/api/guests`);
    }
}
