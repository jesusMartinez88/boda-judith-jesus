import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, FinanceEntity } from '../../types/api';

@Injectable({
  providedIn: 'root',
})
export class FinancesService {
  private apiUrl = `${environment.apiUrl.replace('/guests', '')}/finances`;

  // Master signal for all finance records
  records = signal<FinanceEntity[]>([]);

  private http = inject(HttpClient);

  async loadFinances(): Promise<FinanceEntity[]> {
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<FinanceEntity[]> | FinanceEntity[]>(this.apiUrl),
      );
      const list = (
        response && 'data' in (response as ApiResponse<FinanceEntity[]>)
          ? (response as ApiResponse<FinanceEntity[]>).data
          : response
      ) as FinanceEntity[];
      const finalItems = Array.isArray(list) ? list : [];
      this.records.set(finalItems);
      return finalItems;
    } catch (error) {
      console.error('Error in loadFinances:', error);
      return [];
    }
  }

  async createFinance(record: FinanceEntity): Promise<FinanceEntity> {
    try {
      const result = await firstValueFrom(
        this.http.post<ApiResponse<FinanceEntity>>(this.apiUrl, record),
      );
      const created = result.data as FinanceEntity;
      await this.loadFinances(); // Refresh list
      return created as FinanceEntity;
    } catch (error) {
      console.error('Error creating finance record:', error);
      throw error;
    }
  }

  async updateFinance(id: number, record: Partial<FinanceEntity>): Promise<FinanceEntity> {
    try {
      const result = await firstValueFrom(
        this.http.patch<ApiResponse<FinanceEntity>>(`${this.apiUrl}/${id}`, record),
      );
      const updated = result.data as FinanceEntity;
      await this.loadFinances(); // Refresh list
      return updated as FinanceEntity;
    } catch (error) {
      console.error('Error updating finance record:', error);
      throw error;
    }
  }

  async deleteFinance(id: number): Promise<ApiResponse<{ message?: string }>> {
    try {
      const result = await firstValueFrom(
        this.http.delete<ApiResponse<{ message?: string }>>(`${this.apiUrl}/${id}`),
      );
      await this.loadFinances(); // Refresh list
      return result;
    } catch (error) {
      console.error('Error deleting finance record:', error);
      throw error;
    }
  }
}
