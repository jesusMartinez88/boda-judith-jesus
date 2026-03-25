import { inject, Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Todo {
  id?: number;
  name: string;
  date: string;
  status: 'pending' | 'completed';
  createdAt?: string;
  updatedAt?: string;
}

@Injectable({
  providedIn: 'root'
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
      const response = await firstValueFrom(this.http.get<any>(this.apiUrl));
      const list = response.data || response;
      const finalItems = Array.isArray(list) ? list : [];
      this.todos.set(finalItems);
      return finalItems;
    } catch (error) {
      console.error('Error in loadTodos:', error);
      return [];
    } finally {
      this.isLoading.set(false);
    }
  }

  async createTodo(todo: Todo): Promise<any> {
    try {
      const result = await firstValueFrom(this.http.post(this.apiUrl, todo));
      await this.loadTodos(); // Refresh list
      return result;
    } catch (error) {
      console.error('Error creating todo:', error);
      throw error;
    }
  }

  async updateTodo(id: number, todo: Partial<Todo>): Promise<any> {
    try {
      const result = await firstValueFrom(this.http.patch(`${this.apiUrl}/${id}`, todo));
      await this.loadTodos(); // Refresh list
      return result;
    } catch (error) {
      console.error('Error updating todo:', error);
      throw error;
    }
  }

  async deleteTodo(id: number): Promise<any> {
    try {
      const result = await firstValueFrom(this.http.delete(`${this.apiUrl}/${id}`));
      await this.loadTodos(); // Refresh list
      return result;
    } catch (error) {
      console.error('Error deleting todo:', error);
      throw error;
    }
  }
}
