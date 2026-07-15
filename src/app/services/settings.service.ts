import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { tap } from 'rxjs';
import { ApiResponse, SettingItem } from '../../types/api';

export interface AppSettings {
  max_guests_per_table: number;
  total_estimated_guests?: number;
  auto_assign_tables?: boolean;
  enable_highchairs?: boolean;
  enable_whatsapp?: boolean;
  whatsapp_apikey?: string;
  whatsapp_phone?: string;
}

@Injectable({
  providedIn: 'root',
})
export class SettingsService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiBaseUrl;

  settings = signal<AppSettings>({
    max_guests_per_table: 10,
    total_estimated_guests: 0,
    auto_assign_tables: false,
    enable_highchairs: false,
    enable_whatsapp: false,
    whatsapp_apikey: '',
    whatsapp_phone: '',
  });

  loadSettings() {
    return this.http.get<ApiResponse<SettingItem[]>>(`${this.baseUrl}/api/settings`).pipe(
      tap((s) => {
        const data = (s as ApiResponse<SettingItem[]>).data || (s as unknown);
        const newSettings: AppSettings = { ...this.settings() };

        // Si es un array (común en algunas APIs de configuración)
        if (Array.isArray(data)) {
          (data as SettingItem[]).forEach((item) => {
            const key =
              (item as SettingItem).key || (item as unknown as Record<string, unknown>)['name'];
            if (key === 'max_guests_per_table') {
              newSettings.max_guests_per_table = Number(item.value);
            } else if (key === 'total_estimated_guests') {
              newSettings.total_estimated_guests = Number(item.value);
            } else if (key === 'auto_assign_tables') {
              newSettings.auto_assign_tables =
                item.value === 'true' ||
                item.value === true ||
                item.value === '1' ||
                item.value === 1;
            } else if (key === 'enable_highchairs') {
              newSettings.enable_highchairs =
                item.value === 'true' ||
                item.value === true ||
                item.value === '1' ||
                item.value === 1;
            } else if (key === 'enable_whatsapp') {
              newSettings.enable_whatsapp =
                item.value === 'true' ||
                item.value === true ||
                item.value === '1' ||
                item.value === 1;
            } else if (key === 'whatsapp_apikey') {
              newSettings.whatsapp_apikey = String(item.value ?? '');
            } else if (key === 'whatsapp_phone') {
              newSettings.whatsapp_phone = String(item.value ?? '');
            }
          });
        } else if (data && typeof data === 'object') {
          const obj = data as Record<string, unknown>;
          if (obj['max_guests_per_table'] !== undefined) {
            newSettings.max_guests_per_table = Number(obj['max_guests_per_table']);
          }
          if (obj['total_estimated_guests'] !== undefined) {
            newSettings.total_estimated_guests = Number(obj['total_estimated_guests']);
          }
          if (obj['auto_assign_tables'] !== undefined) {
            const v = obj['auto_assign_tables'];
            newSettings.auto_assign_tables = v === true || v === 'true' || v === 1 || v === '1';
          }
          if (obj['enable_highchairs'] !== undefined) {
            const v = obj['enable_highchairs'];
            newSettings.enable_highchairs = v === true || v === 'true' || v === 1 || v === '1';
          }
          if (obj['enable_whatsapp'] !== undefined) {
            const v = obj['enable_whatsapp'];
            newSettings.enable_whatsapp = v === true || v === 'true' || v === 1 || v === '1';
          }
          if (obj['whatsapp_apikey'] !== undefined) {
            newSettings.whatsapp_apikey = String(obj['whatsapp_apikey'] ?? '');
          }
          if (obj['whatsapp_phone'] !== undefined) {
            newSettings.whatsapp_phone = String(obj['whatsapp_phone'] ?? '');
          }
        }

        this.settings.set(newSettings);
      }),
    );
  }

  updateMaxGuests(max: number) {
    return this.http
      .put(`${this.baseUrl}/api/settings/max_guests_per_table`, { value: max })
      .pipe(tap(() => this.settings.update((s) => ({ ...s, max_guests_per_table: max }))));
  }

  updateTotalEstimatedGuests(total: number) {
    return this.http
      .put(`${this.baseUrl}/api/settings/total_estimated_guests`, { value: total })
      .pipe(tap(() => this.settings.update((s) => ({ ...s, total_estimated_guests: total }))));
  }

  updateAutoAssignTables(enabled: boolean) {
    return this.http
      .put(`${this.baseUrl}/api/settings/auto_assign_tables`, { value: enabled })
      .pipe(tap(() => this.settings.update((s) => ({ ...s, auto_assign_tables: enabled }))));
  }
  updateEnableHighchairs(enabled: boolean) {
    return this.http
      .put(`${this.baseUrl}/api/settings/enable_highchairs`, { value: enabled })
      .pipe(tap(() => this.settings.update((s) => ({ ...s, enable_highchairs: enabled }))));
  }

  updateEnableWhatsApp(enabled: boolean) {
    return this.http
      .put(`${this.baseUrl}/api/settings/enable_whatsapp`, { value: enabled })
      .pipe(tap(() => this.settings.update((s) => ({ ...s, enable_whatsapp: enabled }))));
  }

  updateWhatsAppApikey(apikey: string) {
    return this.http
      .put(`${this.baseUrl}/api/settings/whatsapp_apikey`, { value: apikey })
      .pipe(tap(() => this.settings.update((s) => ({ ...s, whatsapp_apikey: apikey }))));
  }

  updateWhatsAppPhone(phone: string) {
    return this.http
      .put(`${this.baseUrl}/api/settings/whatsapp_phone`, { value: phone })
      .pipe(tap(() => this.settings.update((s) => ({ ...s, whatsapp_phone: phone }))));
  }
}
