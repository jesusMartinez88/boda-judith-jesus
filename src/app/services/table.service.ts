import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { tap, map } from 'rxjs';
import { ApiResponse, TableEntity } from '../../types/api';

export interface TableConfig {
  id: number;
  name?: string;
  capacity?: number;
  shape: 'round' | 'square' | 'rectangular' | 'presidential';
  posX?: number;
  posY?: number;
  captainIds?: number[] | null;
  rotation?: number;
}

@Injectable({
  providedIn: 'root',
})
export class TableService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiBaseUrl;

  tables = signal<TableConfig[]>([]);

  private normalizeTable(item: Record<string, unknown> | TableEntity | null): TableConfig | null {
    if (!item) return null;
    const id = Number(item.id);
    if (isNaN(id)) return null;

    // Mapeo de shapes: consolidamos layout 'one-side' -> 'presidential'
    const obj = item as Record<string, unknown>;
    let shape = (obj['shape'] as string) || 'round';
    if (shape === 'rectangular' && obj['layout'] === 'one-side') {
      shape = 'presidential';
    }

    // Handle captainIds (new format) or legacy captainId (single captain)
    let captainIds: number[] | null = null;
    if (obj['captainIds'] != null && Array.isArray(obj['captainIds'])) {
      captainIds = (obj['captainIds'] as number[]).map((id) => Number(id)).filter((n) => !isNaN(n));
    } else if (obj['captainId'] != null) {
      // Legacy support: convert single captainId to array
      const singleId = Number(obj['captainId']);
      if (!isNaN(singleId)) {
        captainIds = [singleId];
      }
    }

    return {
      ...item,
      id,
      name:
        (obj['name'] as string) || (obj['number'] !== undefined ? String(obj['number']) : 'Mesa X'),
      shape: shape as TableConfig['shape'],
      capacity: (obj['capacity'] as number) || undefined,
      posX: obj['posX'] !== undefined ? Number(obj['posX'] as unknown) : undefined,
      posY: obj['posY'] !== undefined ? Number(obj['posY'] as unknown) : undefined,
      captainIds,
      rotation: obj['rotation'] !== undefined ? Number(obj['rotation']) : 0,
    };
  }

  loadTables() {
    return this.http.get<ApiResponse<TableEntity[]>>(`${this.baseUrl}/api/tables`).pipe(
      tap((response) => {
        let list = response.data as TableEntity[] | undefined;

        if (!Array.isArray(list)) {
          list = [];
        }

        // Normalizar items: asegurar que tengan un ID único
        const tableMap = new Map<number, TableConfig>();

        list.forEach((item: TableEntity) => {
          const normalized = this.normalizeTable(item);
          if (normalized && !tableMap.has(normalized.id)) {
            tableMap.set(normalized.id, normalized);
          }
        });

        this.tables.set(Array.from(tableMap.values()));
      }),
    );
  }

  addTable(table: TableConfig) {
    // Enviamos el objeto tal cual, dejando que el backend decida qué campos usar.
    // Quitamos la redundancia si queremos que el 'name' sea el protagonista.
    const payload = { ...table };
    return this.http.post<ApiResponse<TableEntity>>(`${this.baseUrl}/api/tables`, payload).pipe(
      tap((response) => {
        const newTableRaw =
          (response as ApiResponse<TableEntity>).data || (response as unknown as TableEntity);
        const normalized = this.normalizeTable(newTableRaw as TableEntity);

        if (normalized) {
          this.tables.update((current) => [...current, normalized]);
        } else {
          console.warn('⚠️ Could not normalize newly created table:', response);
          // Fallback con el objeto original si la normalización falla pero el ID era conocido
          this.tables.update((current) => [...current, table]);
        }
      }),
    );
  }

  updateTable(id: number, config: Partial<TableConfig>) {
    return this.http
      .patch<ApiResponse<TableEntity> | TableEntity>(`${this.baseUrl}/api/tables/${id}`, config)
      .pipe(
        map((response) => {
          const wrapped = response as ApiResponse<TableEntity>;
          if (typeof wrapped === 'object' && wrapped !== null && 'success' in wrapped) {
            if (wrapped.success === false) {
              throw new Error(wrapped.error || wrapped.message || 'Error updating table');
            }
            return wrapped.data ?? (response as TableEntity);
          }
          return response as TableEntity;
        }),
        tap((data) => {
          const normalized = this.normalizeTable(data as TableEntity);
          if (normalized) {
            this.tables.update((current) =>
              current.map((t) => (t.id === id ? { ...t, ...normalized } : t)),
            );
            return;
          }
          this.tables.update((current) =>
            current.map((t) => (t.id === id ? { ...t, ...config } : t)),
          );
        }),
      );
  }

  deleteTable(id: number) {
    return this.http
      .delete<
        ApiResponse<{ id: number; name: string; unassignedGuests: number; configDeleted: boolean }>
      >(`${this.baseUrl}/api/table/${id}`)
      .pipe(
        tap(() => {
          this.tables.update((current) => current.filter((t) => t.id !== id));
        }),
      );
  }

  requestDeleteCode(): Promise<ApiResponse<{ code?: string }>> {
    // triggers an email with a code for confirmation
    return this.http
      .post<ApiResponse<{ code?: string }>>(`${this.baseUrl}/api/tables/request-delete`, {})
      .toPromise()
      .then((r) => r!);
  }

  deleteAllTables(code?: string): Promise<ApiResponse<{ deletedAll: boolean; resetSeq: boolean }>> {
    this.tables.set([]);
    let url = `${this.baseUrl}/api/tables`;
    if (code) {
      const separator = url.includes('?') ? '&' : '?';
      url = `${url}${separator}code=${encodeURIComponent(code)}`;
    }
    return this.http
      .delete<ApiResponse<{ deletedAll: boolean; resetSeq: boolean }>>(url)
      .toPromise()
      .then((r) => r!);
  }
}
