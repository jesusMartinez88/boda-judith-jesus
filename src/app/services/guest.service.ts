import { inject, Injectable, resource } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Guest {
  name: string;
  email: string;
  phone: string;
  attending: number;
  mealType: string;
  needsTransport: boolean;
  isSavedInBbdd: boolean;
  allergies?: string;
  notes?: string;
}

declare var window: any;

@Injectable({
  providedIn: 'root'
})
export class GuestService {
  private apiUrl = environment.apiUrl;
  private sheetUrl = (window as any).NG_APP_SHEETURL || process.env['NG_APP_SHEETURL'] || null;
  private _guestsResource: any | undefined;
  private _cachedGuests: Guest[] | undefined;

  private http = inject(HttpClient);

  // Crear el recurso de invitados perezosamente (no se crea ni carga en la inicialización)
  private createGuestsResource() {
    if (!this._guestsResource) {
      this._guestsResource = resource<Guest[], void>({
        loader: async () => {
          const list = await firstValueFrom(this.http.get<Guest[]>(this.apiUrl));
          this._cachedGuests = list;
          return list;
        }
      });
    }
    return this._guestsResource;
  }

  // Método público para forzar la carga de invitados cuando el componente lo solicite
  async loadGuests(): Promise<Guest[]> {
    const r = this.createGuestsResource();
    if (r && typeof r.read === 'function') {
      return r.read();
    }
    const list = await firstValueFrom(this.http.get<Guest[]>(this.apiUrl));
    this._cachedGuests = list;
    return list;
  }

  // Registra un invitado y recarga el recurso de lista
  async registerGuest(guest: Guest): Promise<any> {
    try {
      const result = await firstValueFrom(this.http.post(this.apiUrl, guest));
      // Actualiza la cache local de invitados (si existe la caché, refrescarla)
      try {
        const fresh = await this.getAllGuests();
        this._cachedGuests = fresh;
        guest.isSavedInBbdd = true;
      } catch (e) {
        // Ignorar error de refresco; no queremos bloquear el registro
      }

      // Enviar también a Google Sheets como backup (JSONP para evitar CORS)
      this.addToGoogleSheetsJsonp(guest).catch(error => {
        console.warn('Error adding to Google Sheets backup (JSONP):', error);
      });

      return result;
    } catch (error) {
      console.error('Error registering guest:', error);
      // Si falla el servidor, intentar guardar en Google Sheets vía JSONP
      try {
        const sheetResult = await this.addToGoogleSheetsJsonp(guest);
        console.log('Guest saved to Google Sheets backup (JSONP)');
        return sheetResult;
      } catch (sheetError) {
        console.error('Error registering guest (both servers failed):', sheetError);
        throw error;
      }
    }
  }

  // Fallback usando JSONP (evita problemas CORS). Usa GET y un callback global.
  private addToGoogleSheetsJsonp(guest: Guest): Promise<any> {
    const base = this.sheetUrl;
    console.log('sheetUrl: ', this.sheetUrl);
    if (!base) {
      return Promise.reject(new Error('Google Sheets URL not configured'));
    }
    return new Promise((resolve, reject) => {
      const callbackName = 'gs_cb_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
      (window as any)[callbackName] = (data: any) => {
        cleanup();
        resolve(data);
      };

      const params = new URLSearchParams();
      params.set('name', guest.name || '');
      params.set('email', guest.email || '');
      params.set('phone', guest.phone || '');
      params.set('attending', String(guest.attending ?? ''));
      params.set('mealType', guest.mealType || '');
      params.set('needsTransport', String(guest.needsTransport ?? ''));
      params.set('isSavedInBbdd', String(guest.isSavedInBbdd ?? ''));
      params.set('allergies', guest.allergies || '');
      params.set('notes', guest.notes || '');
      params.set('callback', callbackName);

      const script = document.createElement('script');
      script.src = base + '?' + params.toString();
      console.log('JSONP request URL:', script.src);
      script.onerror = (ev) => {
        cleanup();
        reject(new Error('JSONP script error'));
      };
      document.head.appendChild(script);

      function cleanup() {
        try {
          delete (window as any)[callbackName];
        } catch { }
        if (script.parentNode) script.parentNode.removeChild(script);
      }
    });
  }

  // Obtiene la lista actual desde la API (no desde la cache)
  async getAllGuests(): Promise<Guest[]> {
    try {
      return firstValueFrom(this.http.get<Guest[]>(this.apiUrl));
    } catch (error) {
      console.error('Error fetching guests:', error);
      throw error;
    }
  }

  // Devuelve el valor cacheado del recurso (si ya fue cargado)
  getCachedGuests(): Guest[] | undefined {
    // Retornar únicamente la caché local sin invocar ninguna carga
    return this._cachedGuests;
  }
}
