import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface FinanceRecord {
  id?: number;
  description: string;
  amount: number;
  type: 'income' | 'expense';
  category?: string;
  paidBy?: string; // Nombre de quien hizo el gasto/ingreso
  date?: string;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root',
})
export class FinancesService {
  private apiUrl = `${environment.apiUrl.replace('/guests', '')}/finances`;

  // Master signal for all finance records
  records = signal<FinanceRecord[]>([]);

  private http = inject(HttpClient);

  async loadFinances(): Promise<FinanceRecord[]> {
    try {
      const response = await firstValueFrom(
        this.http.get<FinanceRecord[] | { data: FinanceRecord[] }>(this.apiUrl),
      );
      const list = response && 'data' in response ? response.data : response;
      const finalItems = Array.isArray(list) ? list : [];
      this.records.set(finalItems);
      return finalItems;
    } catch (error) {
      console.error('Error in loadFinances:', error);
      return [];
    }
  }

  async createFinance(record: FinanceRecord): Promise<FinanceRecord> {
    try {
      const result = await firstValueFrom(this.http.post<FinanceRecord>(this.apiUrl, record));
      await this.loadFinances(); // Refresh list
      return result;
    } catch (error) {
      console.error('Error creating finance record:', error);
      throw error;
    }
  }

  async updateFinance(id: number, record: Partial<FinanceRecord>): Promise<FinanceRecord> {
    try {
      const result = await firstValueFrom(
        this.http.patch<FinanceRecord>(`${this.apiUrl}/${id}`, record),
      );
      await this.loadFinances(); // Refresh list
      return result;
    } catch (error) {
      console.error('Error updating finance record:', error);
      throw error;
    }
  }

  async deleteFinance(id: number): Promise<unknown> {
    try {
      const result = await firstValueFrom(this.http.delete<unknown>(`${this.apiUrl}/${id}`));
      await this.loadFinances(); // Refresh list
      return result;
    } catch (error) {
      console.error('Error deleting finance record:', error);
      throw error;
    }
  }
}
