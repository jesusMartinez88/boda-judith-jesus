import { Injectable, inject, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { tap } from 'rxjs';

export interface TableConfig {
    id: number;
    name?: string;
    capacity?: number; // Si es undefined, usa el global
    shape: 'round' | 'square';
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
        // El id puede venir como id
        const id = Number(item.id);
        if (isNaN(id)) return null;

        return {
            ...item,
            id,
            // Prioridad: name > number
            name: item.name || (item.number !== undefined ? String(item.number) : "Mesa X"),
            shape: item.shape || 'round',
            capacity: item.capacity || undefined
        };
    }

    loadTables() {
        return this.http.get<any>(`${this.baseUrl}/api/tables`).pipe(
            tap(response => {
                let list = response.data || response.tables || response;

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
}
