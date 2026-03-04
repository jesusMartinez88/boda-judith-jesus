import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { tap } from 'rxjs';

export interface AppSettings {
    max_guests_per_table: number;
    total_estimated_guests?: number;
}

@Injectable({
    providedIn: 'root'
})
export class SettingsService {
    private http = inject(HttpClient);
    private baseUrl = environment.apiBaseUrl;

    settings = signal<AppSettings>({ max_guests_per_table: 10, total_estimated_guests: 0 });

    loadSettings() {
        return this.http.get<AppSettings>(`${this.baseUrl}/api/settings`).pipe(
            tap(s => {
                let data = (s as any).data || s;
                const newSettings: AppSettings = { ...this.settings() };

                // Si es un array (común en algunas APIs de configuración)
                if (Array.isArray(data)) {
                    const maxGuestSetting = data.find((item: any) =>
                        item.key === 'max_guests_per_table' || item.name === 'max_guests_per_table'
                    );
                    if (maxGuestSetting) {
                        newSettings.max_guests_per_table = Number(maxGuestSetting.value);
                    }

                    const estimatedGuestsSetting = data.find((item: any) =>
                        item.key === 'total_estimated_guests' || item.name === 'total_estimated_guests'
                    );
                    if (estimatedGuestsSetting) {
                        newSettings.total_estimated_guests = Number(estimatedGuestsSetting.value);
                    }
                } else {
                    if (typeof data.max_guests_per_table !== 'undefined') {
                        newSettings.max_guests_per_table = Number(data.max_guests_per_table);
                    }
                    if (typeof data.total_estimated_guests !== 'undefined') {
                        newSettings.total_estimated_guests = Number(data.total_estimated_guests);
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
}
