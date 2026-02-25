import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { tap } from 'rxjs';

export interface AppSettings {
    max_guests_per_table: number;
}

@Injectable({
    providedIn: 'root'
})
export class SettingsService {
    private http = inject(HttpClient);
    private baseUrl = environment.apiBaseUrl;

    settings = signal<AppSettings>({ max_guests_per_table: 10 });

    loadSettings() {
        return this.http.get<AppSettings>(`${this.baseUrl}/api/settings`).pipe(
            tap(s => {
                let finalSettings = (s as any).data || s;

                // Si es un array (común en algunas APIs de configuración)
                if (Array.isArray(finalSettings)) {
                    const maxGuestSetting = finalSettings.find((item: any) =>
                        item.key === 'max_guests_per_table' || item.name === 'max_guests_per_table'
                    );
                    if (maxGuestSetting) {
                        finalSettings = { max_guests_per_table: Number(maxGuestSetting.value) };
                    }
                }

                if (finalSettings && typeof finalSettings.max_guests_per_table !== 'undefined') {
                    this.settings.set(finalSettings);
                } else {
                    console.warn('⚠️ Could not find max_guests_per_table in response:', finalSettings);
                }
            })
        );
    }

    updateMaxGuests(max: number) {
        return this.http.put(`${this.baseUrl}/api/settings/max_guests_per_table`, { value: max }).pipe(
            tap(() => this.settings.update(s => ({ ...s, max_guests_per_table: max })))
        );
    }
}
