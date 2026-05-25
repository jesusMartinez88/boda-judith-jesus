import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TodosService, Todo } from '../../../services/todos.service';
import { ToastComponent } from '../../../shared/toast/toast.component';

@Component({
  selector: 'app-todos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, DatePipe, ToastComponent],
  templateUrl: './todos.component.html',
  styleUrl: './todos.component.css',
})
export class TodosComponent implements OnInit {
  private todosService = inject(TodosService);
  private fb = inject(FormBuilder);

  todoForm: FormGroup;
  todos = this.todosService.todos;
  isLoading = this.todosService.isLoading;
  isSubmitting = signal(false);
  editingTodoId = signal<number | null>(null);

  // Custom delete modal state
  showDeleteModal = signal(false);
  todoToDelete = signal<Todo | null>(null);
  // Mobile form modal
  showFormModal = signal(false);
  // Toast notifications
  showToast = signal(false);
  toastMessage = signal('');
  toastType = signal<'success' | 'error' | null>(null);
  // Highlight recently saved todo
  lastSavedTodoId = signal<number | null>(null);

  pendingCount = computed(() => this.todos().filter((t) => t.status === 'pending').length);
  completedCount = computed(() => this.todos().filter((t) => t.status === 'completed').length);

  sortedTodos = computed(() => {
    return [...this.todos()].sort((a, b) => {
      // Completed last
      if (a.status !== b.status) {
        return a.status === 'completed' ? 1 : -1;
      }
      // Soonest first
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  });

  constructor() {
    this.todoForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(3)]],
      date: ['', [Validators.required]],
      status: ['pending'],
    });
  }

  ngOnInit() {
    this.loadData();
  }

  async loadData() {
    await this.todosService.loadTodos();
  }

  getStatusColor(todo: Todo): string {
    if (todo.status === 'completed') return '#10b981'; // Success Green

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(todo.date);
    targetDate.setHours(0, 0, 0, 0);

    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 5) return '#1e40af'; // Blue (Safe)
    if (diffDays <= 5 && diffDays > 2) return '#f0d01fff'; // Yellow/Orange (Warning)
    return '#ef4444'; // Red (Danger/Overdue)
  }

  getDueLabel(dateStr: string): string {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const targetDate = new Date(dateStr);
    targetDate.setHours(0, 0, 0, 0);

    const diffTime = targetDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return '(¡Es hoy!)';
    if (diffDays < 0)
      return `(Hace ${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? 'día' : 'días'})`;
    if (diffDays === 1) return '(Mañana)';
    return `(En ${diffDays} días)`;
  }

  async onSubmit() {
    if (this.todoForm.invalid) {
      this.todoForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    const formValue = this.todoForm.value;

    try {
      if (this.editingTodoId()) {
        await this.todosService.updateTodo(this.editingTodoId()!, formValue);
      } else {
        await this.todosService.createTodo(formValue);
      }
      // Determine which todo was saved so we can highlight it
      let savedId: number | null = null;
      if (this.editingTodoId()) {
        savedId = this.editingTodoId();
      } else {
        const matches = this.todos().filter(
          (t) => t.name === formValue.name && t.date === formValue.date && t.id,
        );
        if (matches.length > 0) {
          savedId = Math.max(...matches.map((m) => m.id!));
        }
      }
      if (savedId) {
        this.lastSavedTodoId.set(savedId);
        setTimeout(() => this.lastSavedTodoId.set(null), 2500);
      }
      // Close modal if open, else just reset inline form
      if (this.showFormModal && this.showFormModal()) {
        this.closeFormModal();
      } else {
        this.cancelEdit();
      }
      this.showAppToast('Tarea guardada correctamente', 'success');
    } catch (error) {
      console.error('Error saving todo:', error);
      this.showAppToast('No se pudo guardar la tarea', 'error');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  showAppToast(message: string, type: 'success' | 'error') {
    this.toastMessage.set(message);
    this.toastType.set(type);
    this.showToast.set(true);
    setTimeout(() => {
      this.showToast.set(false);
      this.toastMessage.set('');
      this.toastType.set(null);
    }, 3500);
  }

  hideToast() {
    this.showToast.set(false);
    this.toastMessage.set('');
    this.toastType.set(null);
  }

  editTodo(todo: Todo) {
    this.editingTodoId.set(todo.id!);
    this.todoForm.patchValue({
      name: todo.name,
      date: todo.date,
      status: todo.status,
    });
    // If on narrow screens, open modal for editing
    try {
      if (window && window.innerWidth && window.innerWidth <= 1200) {
        this.openFormModal();
      }
    } catch {
      // ignore (server side or unexpected)
    }
  }

  cancelEdit() {
    this.editingTodoId.set(null);
    this.todoForm.reset({ status: 'pending' });
  }

  async toggleStatus(todo: Todo) {
    const newStatus = todo.status === 'pending' ? 'completed' : 'pending';
    try {
      await this.todosService.updateTodo(todo.id!, { status: newStatus });
    } catch (error) {
      console.error('Error updating status:', error);
    }
  }

  async deleteTodo(id: number) {
    const todo = this.todos().find((t) => t.id === id);
    if (todo) {
      this.todoToDelete.set(todo);
      this.showDeleteModal.set(true);
    }
  }

  async confirmDelete() {
    const todo = this.todoToDelete();
    if (todo && todo.id) {
      try {
        await this.todosService.deleteTodo(todo.id);
        this.closeDeleteModal();
        this.showAppToast('Tarea eliminada', 'success');
      } catch (error) {
        console.error('Error deleting todo:', error);
        this.showAppToast('No se pudo eliminar la tarea', 'error');
      }
    }
  }

  closeDeleteModal() {
    this.showDeleteModal.set(false);
    this.todoToDelete.set(null);
  }

  openFormModal() {
    this.showFormModal.set(true);
  }

  closeFormModal() {
    this.showFormModal.set(false);
    this.cancelEdit();
  }
}
