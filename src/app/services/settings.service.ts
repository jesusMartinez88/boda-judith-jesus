import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { tap } from 'rxjs';

export interface AppSettings {
    max_guests_per_table: number;
    total_estimated_guests?: number;
    auto_assign_tables?: boolean;
}

@Injectable({
    providedIn: 'root'
})
export class SettingsService {
    private http = inject(HttpClient);
    private baseUrl = environment.apiBaseUrl;

    settings = signal<AppSettings>({ max_guests_per_table: 10, total_estimated_guests: 0, auto_assign_tables: false });

    loadSettings() {
        return this.http.get<AppSettings>(`${this.baseUrl}/api/settings`).pipe(
            tap(s => {
                const data = (s as any).data || s;
                const newSettings: AppSettings = { ...this.settings() };

                // Si es un array (común en algunas APIs de configuración)
                if (Array.isArray(data)) {
                    data.forEach((item: any) => {
                        const key = item.key || item.name;
                        if (key === 'max_guests_per_table') {
                            newSettings.max_guests_per_table = Number(item.value);
                        } else if (key === 'total_estimated_guests') {
                            newSettings.total_estimated_guests = Number(item.value);
                        } else if (key === 'auto_assign_tables') {
                            newSettings.auto_assign_tables = item.value === true || item.value === 'true' || item.value === 1;
                        }
                    });
                } else if (data && typeof data === 'object') {
                    if (data.max_guests_per_table !== undefined) {
                        newSettings.max_guests_per_table = Number(data.max_guests_per_table);
                    }
                    if (data.total_estimated_guests !== undefined) {
                        newSettings.total_estimated_guests = Number(data.total_estimated_guests);
                    }
                    if (data.auto_assign_tables !== undefined) {
                        newSettings.auto_assign_tables = data.auto_assign_tables === true || data.auto_assign_tables === 'true' || data.auto_assign_tables === 1;
                    }
                }

                this.settings.set(newSettings);
            })
        );
    }

    updateMaxGuests(max: number) {
        return this.http.put(`${this.baseUrl}/api/settings/max_guests_per_table`, { value: max }).pipe(
            tap(() => this.settings.update(s => ({ ...s, max_guests_per_table: max })))
        );
    }

    updateTotalEstimatedGuests(total: number) {
        return this.http.put(`${this.baseUrl}/api/settings/total_estimated_guests`, { value: total }).pipe(
            tap(() => this.settings.update(s => ({ ...s, total_estimated_guests: total })))
        );
    }

    updateAutoAssignTables(enabled: boolean) {
        return this.http.put(`${this.baseUrl}/api/settings/auto_assign_tables`, { value: enabled }).pipe(
            tap(() => this.settings.update(s => ({ ...s, auto_assign_tables: enabled })))
        );
    }
}
