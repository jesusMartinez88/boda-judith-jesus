import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import confetti from 'canvas-confetti';

export interface Guest {
  id?: string;
  name: string;
  email: string;
  phone: string;
  attending: number;
  adults?: number;
  children?: number;
  isAdult?: number;
  mealType: string;
  needsTransport: boolean;
  isSavedInBbdd: boolean;
  tableId?: number | null; // Primary field for backend assignment
  tableName?: string | number; // Fallback field
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

  // Master signal for all guests in the app
  guests = signal<Guest[]>([]);

  private http = inject(HttpClient);

  // Método público para cargar invitados
  async loadGuests(): Promise<Guest[]> {
    try {
      const response = await firstValueFrom(this.http.get<any>(this.apiUrl));

      // Unwrapping flexible de la respuesta
      let list = null;

      if (Array.isArray(response)) {
        list = response;
      } else if (response && typeof response === 'object') {
        // Buscar en propiedades comunes
        list = response.data || response.guests || response.items || response.rows || response.list;

        // Si no se encuentra en las comunes, buscar el primer array que aparezca en el objeto
        if (!list || !Array.isArray(list)) {
          const firstArrayKey = Object.keys(response).find(key => Array.isArray(response[key]));
          if (firstArrayKey) {
            list = response[firstArrayKey];
          }
        }
      }

      const finalItems = (Array.isArray(list) ? list : []).map((guest: any) => {
        // Normalización progresiva: tableId > tableName
        let idVal = guest.tableId ?? guest.tableName;

        // Si idVal es un string (ej: "Mesa 1", "Mesa1", "1"), extraer el primer número que aparezca
        if (typeof idVal === 'string') {
          const match = idVal.match(/\d+/);
          if (match) idVal = Number(match[0]);
        }

        const numericId = Number(idVal);

        if (idVal !== undefined && idVal !== null && !isNaN(numericId) && numericId !== 0) {
          guest.tableId = numericId;
        } else {
          guest.tableId = null;
        }
        return guest;
      });

      this.guests.set(finalItems);
      return finalItems;
    } catch (error) {
      console.error('Error in loadGuests:', error);
      return [];
    }
  }

  // Registra un invitado y recarga el recurso de lista
  async registerGuest(guest: Guest): Promise<any> {
    try {
      // Actualización optimista
      this.guests.update((current: Guest[]) => [...current, guest]);

      const result = await firstValueFrom(this.http.post(this.apiUrl, guest));
      guest.isSavedInBbdd = true;

      // Enviar también a Google Sheets como backup (JSONP para evitar CORS)
      this.addToGoogleSheetsJsonp(guest).catch(error => {
        console.warn('Error adding to Google Sheets backup (JSONP):', error);
      });
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#be185d', '#ec4899', '#f472b6', '#ffffff']
      });

      return result;
    } catch (error) {
      console.error('Error registering guest:', error);
      // Si falla el servidor, intentar guardar en Google Sheets vía JSONP
      try {
        const sheetResult = await this.addToGoogleSheetsJsonp(guest);
        confetti({
          particleCount: 150,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#be185d', '#ec4899', '#f472b6', '#ffffff']
        });
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
      params.set('adults', String(guest.adults ?? '0'));
      params.set('children', String(guest.children ?? '0'));
      params.set('mealType', guest.mealType || '');
      params.set('needsTransport', String(guest.needsTransport ?? ''));
      params.set('isSavedInBbdd', String(guest.isSavedInBbdd ?? ''));
      params.set('allergies', guest.allergies || '');
      params.set('notes', guest.notes || '');
      params.set('callback', callbackName);

      const script = document.createElement('script');
      script.src = base + '?' + params.toString();
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
  getCachedGuests(): Guest[] {
    return this.guests();
  }

  async updateGuest(guestId: string, guestData: Partial<Guest>): Promise<any> {
    // Optimístico
    this.guests.update((current: Guest[]) =>
      current.map(g => g.id === guestId ? { ...g, ...guestData } : g)
    );
    return firstValueFrom(this.http.patch(`${this.apiUrl}/${guestId}`, guestData));
  }

  async updateGuestTable(guestId: string, tableId: number | null): Promise<any> {
    // Optimístico
    this.guests.update((current: Guest[]) =>
      current.map(g => g.id === guestId ? { ...g, tableId } : g)
    );

    // El backend espera el campo 'tableId' con el ID numérico o null
    return firstValueFrom(this.http.patch(`${this.apiUrl}/${guestId}`, {
      tableId
    }));
  }

  async deleteGuest(guestId: string): Promise<any> {
    // Optimístico
    this.guests.update((current: Guest[]) => current.filter(g => g.id !== guestId));
    return firstValueFrom(this.http.delete(`${this.apiUrl}/${guestId}`));
  }
}
