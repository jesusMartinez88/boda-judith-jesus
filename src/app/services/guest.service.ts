import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { SettingsService } from './settings.service';
import confetti from 'canvas-confetti';

export interface Guest {
  id?: string;
  name: string;
  email: string;
  phone: string;
  attending: number;
  attendance?: boolean;
  adults?: number;
  children?: number;
  isAdult?: number;
  mealType: string;
  needsTransport: boolean;
  isSavedInBbdd: boolean;
  sendEmail?: boolean;
  tableId?: number | null; // Primary field for backend assignment
  tableName?: string | number; // Fallback field
  seatNumber?: number | null; // Position in the table
  allergies?: string;
  notes?: string;
}

declare let window: any;

@Injectable({
  providedIn: 'root'
})
export class GuestService {
  private apiUrl = environment.apiUrl;
  private sheetUrl = (window as any).NG_APP_SHEETURL || process.env['NG_APP_SHEETURL'] || null;

  // Master signal for all guests in the app
  guests = signal<Guest[]>([]);

  private http = inject(HttpClient);
  private settingsService = inject(SettingsService);

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
        // Asegurar mapeo de ID (servidor suele devolver _id o id)
        if (guest._id && !guest.id) guest.id = guest._id;

        // Normalización de tableId (Prioridad camelCase del servidor)
        let tVal = guest.tableId ?? guest.table_id ?? guest.tableName ?? guest.table_name;
        if (typeof tVal === 'string') {
          const match = tVal.match(/\d+/);
          if (match) tVal = Number(match[0]);
        }
        guest.tableId = (tVal !== undefined && tVal !== null && !isNaN(Number(tVal)) && Number(tVal) !== 0) ? Number(tVal) : null;

        // Normalización de seatNumber (Prioridad camelCase del servidor)
        const sVal = guest.seatNumber ?? guest.seat_number;
        guest.seatNumber = (sVal !== undefined && sVal !== null) ? Number(sVal) : null;

        // Normalización de needsTransport
        const transportVal = guest.needsTransport ?? guest.needs_transport ?? guest.needTransport;
        guest.needsTransport = transportVal === true || transportVal === 1 || transportVal === '1' || transportVal === 'true';

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
      // Si sólo se ha indicado si es adulto/niño (flujo interno), derivamos adults/children
      if (guest.isAdult !== undefined && guest.adults === undefined && guest.children === undefined) {
        if (guest.isAdult) {
          guest.adults = 1;
          guest.children = 0;
        } else {
          guest.adults = 0;
          guest.children = 1;
        }
      }

      if (guest.attendance === false) {
        guest.attending = 0;
        guest.adults = 0;
        guest.children = 0;
      } else if (guest.adults !== undefined || guest.children !== undefined) {
        // Flujo del formulario público: se calcula a partir de adultos + niños
        const adults = Number(guest.adults || 0);
        const children = Number(guest.children || 0);
        guest.attending = adults + children;
      } else {
        // Flujo interno (ej. creación desde mesas): si no hay conteo, asumimos 1 asistente
        guest.attending = guest.attending ?? 1;
      }
      this.guests.update((current: Guest[]) => [...current, guest]);

      const response = await firstValueFrom(this.http.post(this.apiUrl, guest));
      
      // La respuesta tiene formato { success: true, data: { id: 75, ... }, message: "..." }
      // Necesitamos extraer data.id para actualizar el guest local
      const responseData = response as any;
      if (responseData && responseData.data && responseData.data.id) {
        // Actualizar el guest con el nuevo ID
        const guestWithId = { ...guest, id: responseData.data.id };
        this.guests.update((current: Guest[]) =>
          current.map(g => g.name === guest.name && g.email === guest.email && g.phone === guest.phone ? guestWithId : g)
        );
      }

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

      return responseData;
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

  async updateGuestTable(guestId: string, tableId: number | null, seatNumber: number | null = null): Promise<any> {
    if (!guestId) return Promise.reject('No guest ID provided');

    // Normalizar: 0 debe ser null
    const normalizedTableId = (tableId === 0 || tableId === null || tableId === undefined) ? null : tableId;
    const normalizedSeatNumber = (seatNumber === 0 || seatNumber === null || seatNumber === undefined) ? null : seatNumber;

    // Optimístico
    this.guests.update((current: Guest[]) =>
      current.map(g => (g.id === guestId || g.email === guestId || g.phone === guestId) ? { ...g, tableId: normalizedTableId, seatNumber: normalizedSeatNumber } : g)
    );

    // Enviamos solo los campos especificados por el usuario (camelCase)
    // tableId y seatNumber
    return firstValueFrom(this.http.patch(`${this.apiUrl}/${guestId}`, {
      tableId: normalizedTableId,
      seatNumber: normalizedSeatNumber
    }));
  }

  async deleteGuest(guestId: string): Promise<any> {
    // Optimístico
    this.guests.update((current: Guest[]) => current.filter(g => g.id !== guestId));
    return firstValueFrom(this.http.delete(`${this.apiUrl}/${guestId}`));
  }

  async requestDeleteCode(): Promise<any> {
    // Triggers an email with a code for confirmation
    return firstValueFrom(this.http.post(`${this.apiUrl}/request-delete`, {}));
  }

  async deleteAllGuests(code?: string): Promise<any> {
    this.guests.set([]);
    let url = this.apiUrl;
    if (code) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}code=${encodeURIComponent(code)}`;
    }
    return firstValueFrom(this.http.delete(url));
  }
}
