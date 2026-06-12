import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';
import { ApiResponse, TodoEntity } from '../../types/api';

export interface Todo {
  id?: number;
  name: string;
  date?: string | null;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root',
})
export class TodosService {
  private apiUrl = `${environment.apiBaseUrl}/api/todos`;
  private http = inject(HttpClient);

  // Master signal for all todos
  todos = signal<Todo[]>([]);
  isLoading = signal<boolean>(false);

  async loadTodos(): Promise<Todo[]> {
    this.isLoading.set(true);
    try {
      const response = await firstValueFrom(
        this.http.get<ApiResponse<TodoEntity[]> | TodoEntity[]>(this.apiUrl),
      );
      const list = (
        response && 'data' in (response as ApiResponse<TodoEntity[]>)
          ? (response as ApiResponse<TodoEntity[]>).data
          : response
      ) as TodoEntity[];
      const rawItems = Array.isArray(list) ? list : [];
      const finalItems: Todo[] = rawItems.map((it) => ({
        id: it.id,
        name: it.name,
        date: it.date ?? null,
        status: String(it.status),
        createdAt: it.createdAt,
        updatedAt: it.updatedAt,
      }));
      this.todos.set(finalItems);
      return finalItems;
    } catch (error) {
      console.error('Error in loadTodos:', error);
      return [];
    } finally {
      this.isLoading.set(false);
    }
  }

  async createTodo(todo: Todo): Promise<Todo> {
    try {
      const result = await firstValueFrom(
        this.http.post<ApiResponse<TodoEntity>>(this.apiUrl, todo),
      );
      const created = result.data as TodoEntity;
      await this.loadTodos(); // Refresh list
      return created as Todo;
    } catch (error) {
      console.error('Error creating todo:', error);
      throw error;
    }
  }

  async updateTodo(id: number, todo: Partial<Todo>): Promise<Todo> {
    try {
      const result = await firstValueFrom(
        this.http.patch<ApiResponse<TodoEntity>>(`${this.apiUrl}/${id}`, todo),
      );
      const updated = result.data as TodoEntity;
      await this.loadTodos(); // Refresh list
      return updated as Todo;
    } catch (error) {
      console.error('Error updating todo:', error);
      throw error;
    }
  }

  async deleteTodo(id: number): Promise<ApiResponse<{ message?: string }>> {
    try {
      const result = await firstValueFrom(
        this.http.delete<ApiResponse<{ message?: string }>>(`${this.apiUrl}/${id}`),
      );
      await this.loadTodos(); // Refresh list
      return result;
    } catch (error) {
      console.error('Error deleting todo:', error);
      throw error;
    }
  }
}
