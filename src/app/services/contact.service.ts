import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, ContactEntity } from '../../types/api';

export interface Contact {
  id?: number;
  name: string;
  phone: string;
  countryCode: string;
  side: string;
  linkSent: boolean;
  invitationStatus?: InvitationStatus;
  sentAt?: string;
  respondedAt?: string;
  createdAt?: string;
}

export type InvitationStatus = 'not_sent' | 'sent' | 'responded';

export interface ContactCategory {
  id?: number;
  name: string;
  slug: string;
}

@Injectable({
  providedIn: 'root',
})
export class ContactService {
  private apiUrl = `${environment.apiBaseUrl}/api/contacts`;
  private categoriesUrl = `${environment.apiBaseUrl}/api/categories`;
  private http = inject(HttpClient);

  contacts = signal<Contact[]>([]);
  categories = signal<ContactCategory[]>([]);

  async loadCategories(): Promise<ContactCategory[]> {
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<ContactCategory[]>>(this.categoriesUrl),
      );
      if (response.success) {
        const data = response.data || [];
        this.categories.set(data);
        return data;
      }
      return [];
    } catch (error) {
      console.error('Error loading categories:', error);
      return [];
    }
  }

  async createCategory(name: string): Promise<ApiResponse<ContactCategory>> {
    try {
      const response = await firstValueFrom(
        this.http.post<ApiResponse<ContactCategory>>(this.categoriesUrl, { name }),
      );
      if (response.success && response.data) {
        const newCat = response.data;
        this.categories.update((current) => [...current, newCat]);
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
      const response = await firstValueFrom(this.http.get<ApiResponse<Contact[]>>(url));
      if (response.success) {
        const data = response.data || [];
        this.contacts.set(data);
        return data;
      }
      return [];
    } catch (error) {
      console.error('Error loading contacts:', error);
      return [];
    }
  }

  async createContact(contact: Contact): Promise<ApiResponse<Contact>> {
    try {
      const response = await firstValueFrom(
        this.http.post<ApiResponse<Contact>>(this.apiUrl, contact),
      );
      if (response.success && response.data) {
        const newContact = response.data;
        this.contacts.update((current) => [...current, newContact]);
      }
      return response;
    } catch (error) {
      console.error('Error creating contact:', error);
      throw error;
    }
  }

  async createContactsBulk(contacts: Contact[]): Promise<ApiResponse<ContactEntity[]>> {
    try {
      const response = await firstValueFrom(
        this.http.post<ApiResponse<ContactEntity[]>>(this.apiUrl, contacts),
      );
      if (response.success) {
        await this.loadContacts();
      }
      return response;
    } catch (error) {
      console.error('Error bulk creating contacts:', error);
      throw error;
    }
  }

  async patchContact(id: number, partialData: Partial<Contact>): Promise<ApiResponse<Contact>> {
    try {
      const response = await firstValueFrom(
        this.http.patch<ApiResponse<Contact>>(`${this.apiUrl}/${id}`, partialData),
      );
      if (response.success) {
        const newData = response.data;
        if (newData) {
          this.contacts.update((current) =>
            current.map((c) => (c.id === id ? { ...c, ...newData } : c)),
          );
        }
      }
      return response;
    } catch (error) {
      console.error('Error patching contact:', error);
      throw error;
    }
  }

  async deleteContact(id: number): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await firstValueFrom(
        this.http.delete<ApiResponse<{ message: string }>>(`${this.apiUrl}/${id}`),
      );
      if (response.success) {
        this.contacts.update((current) => current.filter((c) => c.id !== id));
      }
      return response;
    } catch (error) {
      console.error('Error deleting contact:', error);
      throw error;
    }
  }
}
