import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Contact {
  id?: number;
  name: string;
  phone: string;
  side: string;
  linkSent: boolean;
  sentAt?: string;
  createdAt?: string;
}

export interface ContactCategory {
  id?: number;
  name: string;
  slug: string;
}

@Injectable({
  providedIn: 'root'
})
export class ContactService {
  private apiUrl = `${environment.apiBaseUrl}/api/contacts`;
  private categoriesUrl = `${environment.apiBaseUrl}/api/categories`;
  private http = inject(HttpClient);

  contacts = signal<Contact[]>([]);
  categories = signal<ContactCategory[]>([]);

  async loadCategories(): Promise<ContactCategory[]> {
    try {
      const response = await firstValueFrom(this.http.get<{ success: boolean, data: ContactCategory[] }>(this.categoriesUrl));
      if (response.success) {
        this.categories.set(response.data);
        return response.data;
      }
      return [];
    } catch (error) {
      console.error('Error loading categories:', error);
      return [];
    }
  }

  async createCategory(name: string): Promise<any> {
    try {
      const response = await firstValueFrom(this.http.post<{ success: boolean, data: ContactCategory }>(this.categoriesUrl, { name }));
      if (response.success) {
        this.categories.update(current => [...current, response.data]);
      }
      return response;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  }

  async loadContacts(side?: string): Promise<Contact[]> {
    try {
      const url = side ? `${this.apiUrl}?side=${side}` : this.apiUrl;
      const response = await firstValueFrom(this.http.get<{ success: boolean, data: Contact[] }>(url));
      if (response.success) {
        this.contacts.set(response.data);
        return response.data;
      }
      return [];
    } catch (error) {
      console.error('Error loading contacts:', error);
      return [];
    }
  }

  async createContact(contact: Contact): Promise<any> {
    try {
      const response = await firstValueFrom(this.http.post<{ success: boolean, data: Contact }>(this.apiUrl, contact));
      if (response.success) {
        this.contacts.update(current => [...current, response.data]);
      }
      return response;
    } catch (error) {
      console.error('Error creating contact:', error);
      throw error;
    }
  }

  async createContactsBulk(contacts: Contact[]): Promise<any> {
    try {
      const response = await firstValueFrom(this.http.post<{ success: boolean, data: any }>(this.apiUrl, contacts));
      if (response.success) {
        await this.loadContacts();
      }
      return response;
    } catch (error) {
      console.error('Error bulk creating contacts:', error);
      throw error;
    }
  }

  async patchContact(id: number, partialData: Partial<Contact>): Promise<any> {
    try {
      const response = await firstValueFrom(this.http.patch<{ success: boolean, data: Contact }>(`${this.apiUrl}/${id}`, partialData));
      if (response.success) {
        this.contacts.update(current => 
          current.map(c => c.id === id ? { ...c, ...response.data } : c)
        );
      }
      return response;
    } catch (error) {
      console.error('Error patching contact:', error);
      throw error;
    }
  }

  async deleteContact(id: number): Promise<any> {
    try {
      const response = await firstValueFrom(this.http.delete<{ success: boolean }>(`${this.apiUrl}/${id}`));
      if (response.success) {
        this.contacts.update(current => current.filter(c => c.id !== id));
      }
      return response;
    } catch (error) {
      console.error('Error deleting contact:', error);
      throw error;
    }
  }
}
