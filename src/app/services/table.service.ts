import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { tap } from 'rxjs';

export interface TableConfig {
    id: number;
    name?: string;
    capacity?: number;
    shape: 'round' | 'square' | 'rectangular' | 'presidential';
    posX?: number;
    posY?: number;
}

@Injectable({
    providedIn: 'root'
})
export class TableService {
    private http = inject(HttpClient);
    private baseUrl = environment.apiBaseUrl;

    tables = signal<TableConfig[]>([]);

    private normalizeTable(item: any): TableConfig | null {
        if (!item) return null;
        const id = Number(item.id);
        if (isNaN(id)) return null;

        // Mapeo de shapes: consolidamos layout 'one-side' -> 'presidential'
        let shape = item.shape || 'round';
        if (shape === 'rectangular' && item.layout === 'one-side') {
            shape = 'presidential';
        }

        return {
            ...item,
            id,
            name: item.name || (item.number !== undefined ? String(item.number) : "Mesa X"),
            shape: shape as any,
            capacity: item.capacity || undefined,
            posX: item.posX !== undefined ? Number(item.posX) : undefined,
            posY: item.posY !== undefined ? Number(item.posY) : undefined
        };
    }

    loadTables() {
        return this.http.get<{ data: TableConfig[] }>(`${this.baseUrl}/api/tables`).pipe(
            tap(response => {
                let list = response.data;

                if (!Array.isArray(list)) {
                    list = [];
                }

                // Normalizar items: asegurar que tengan un ID único
                const tableMap = new Map<number, TableConfig>();

                list.forEach((item: TableConfig) => {
                    const normalized = this.normalizeTable(item);
                    if (normalized && !tableMap.has(normalized.id)) {
                        tableMap.set(normalized.id, normalized);
                    }
                });

                this.tables.set(Array.from(tableMap.values()));
            })
        );
    }

    addTable(table: TableConfig) {
        // Enviamos el objeto tal cual, dejando que el backend decida qué campos usar.
        // Quitamos la redundancia si queremos que el 'name' sea el protagonista.
        const payload = { ...table };
        return this.http.post<any>(`${this.baseUrl}/api/tables`, payload).pipe(
            tap(response => {
                const newTableRaw = (response as any).data || response;
                const normalized = this.normalizeTable(newTableRaw);

                if (normalized) {
                    this.tables.update(current => [...current, normalized]);
                } else {
                    console.warn('⚠️ Could not normalize newly created table:', response);
                    // Fallback con el objeto original si la normalización falla pero el ID era conocido
                    this.tables.update(current => [...current, table]);
                }
            })
        );
    }

    updateTable(id: number, config: Partial<TableConfig>) {
        return this.http.patch<TableConfig>(`${this.baseUrl}/api/tables/${id}`, config).pipe(
            tap(updatedTable => {
                this.tables.update(current =>
                    current.map(t => t.id === id ? { ...t, ...config } : t)
                );
            })
        );
    }

    deleteTable(id: number) {
        return this.http.delete(`${this.baseUrl}/api/table/${id}`).pipe(
            tap(() => {
                this.tables.update(current => current.filter(t => t.id !== id));
            })
        );
    }

    requestDeleteCode(): Promise<any> {
        // triggers an email with a code for confirmation
        return this.http.post(`${this.baseUrl}/api/tables/request-delete`, {}).toPromise().then(r => r!);
    }

    deleteAllTables(code?: string): Promise<any> {
        this.tables.set([]);
        let url = `${this.baseUrl}/api/tables`;
        if (code) {
            const separator = url.includes('?') ? '&' : '?';
            url = `${url}${separator}code=${encodeURIComponent(code)}`;
        }
        return this.http.delete(url).toPromise().then(r => r!);
    }
}
