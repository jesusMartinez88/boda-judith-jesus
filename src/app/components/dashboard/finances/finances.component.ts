import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { FinancesService } from '../../../services/finances.service';
import { ToastComponent } from '../../../shared/toast/toast.component';
import { FinanceEntity } from '../../../../types/api';

@Component({
  selector: 'app-finances',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, ToastComponent],
  templateUrl: './finances.component.html',
  styleUrl: './finances.component.css',
})
export class FinancesComponent implements OnInit {
  private financesService = inject(FinancesService);
  private fb = inject(FormBuilder);

  // Expose Math to template
  Math = Math;

  records = this.financesService.records;
  financeForm: FormGroup;
  isSubmitting = signal(false);
  isLoading = signal(true);
  editingRecordId = signal<number | null>(null);
  // Toast notifications
  showToast = signal(false);
  toastMessage = signal('');
  toastType = signal<'success' | 'error' | null>(null);
  // Delete confirmation modal
  showDeleteModal = signal(false);
  deleteTargetId = signal<number | null>(null);
  deleteTargetDesc = signal('');

  // Pagination
  currentPage = signal(1);
  pageSize = signal(10);
  pageSizeOptions = [10, 20, 30, 50];

  // Autocomplete for paidBy field
  showSuggestions = signal(false);
  filteredSuggestions = signal<string[]>([]);
  selectedSuggestionIndex = signal(-1);

  // Get unique names from all records
  uniquePaidByNames = computed(() => {
    const names = new Set<string>();
    this.records().forEach((r) => {
      if (r.paidBy && r.paidBy.trim()) {
        names.add(r.paidBy.trim());
      }
    });
    return Array.from(names).sort();
  });

  // Paginated records
  paginatedRecords = computed(() => {
    const allRecords = this.records();
    const page = this.currentPage();
    const size = this.pageSize();
    const startIndex = (page - 1) * size;
    const endIndex = startIndex + size;
    return allRecords.slice(startIndex, endIndex);
  });

  totalPages = computed(() => {
    return Math.ceil(this.records().length / this.pageSize());
  });

  hasNextPage = computed(() => this.currentPage() < this.totalPages());
  hasPreviousPage = computed(() => this.currentPage() > 1);

  // Summary stats
  totalIncome = computed(() => {
    return this.records()
      .filter((r) => r.type === 'income')
      .reduce((acc, r) => acc + r.amount, 0);
  });

  totalExpense = computed(() => {
    return this.records()
      .filter((r) => r.type === 'expense')
      .reduce((acc, r) => acc + r.amount, 0);
  });

  balance = computed(() => this.totalIncome() - this.totalExpense());

  // Gastos por persona
  expensesByPerson = computed(() => {
    const expenses = this.records().filter((r) => r.type === 'expense' && r.paidBy);
    const byPerson = new Map<string, number>();

    expenses.forEach((expense) => {
      const person = expense.paidBy!.trim();
      const current = byPerson.get(person) || 0;
      byPerson.set(person, current + expense.amount);
    });

    return Array.from(byPerson.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  });

  // Ingresos por persona
  incomesByPerson = computed(() => {
    const incomes = this.records().filter((r) => r.type === 'income' && r.paidBy);
    const byPerson = new Map<string, number>();

    incomes.forEach((income) => {
      const person = income.paidBy!.trim();
      const current = byPerson.get(person) || 0;
      byPerson.set(person, current + income.amount);
    });

    return Array.from(byPerson.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  });

  // Balance neto por persona (ingresos - gastos)
  balanceByPerson = computed(() => {
    const allPeople = new Set<string>();

    this.records().forEach((r) => {
      if (r.paidBy) allPeople.add(r.paidBy.trim());
    });

    return Array.from(allPeople)
      .map((person) => {
        const expenses = this.records()
          .filter((r) => r.type === 'expense' && r.paidBy?.trim() === person)
          .reduce((sum, r) => sum + r.amount, 0);

        const incomes = this.records()
          .filter((r) => r.type === 'income' && r.paidBy?.trim() === person)
          .reduce((sum, r) => sum + r.amount, 0);

        return {
          name: person,
          expenses,
          incomes,
          balance: incomes - expenses,
        };
      })
      .sort((a, b) => b.expenses - a.expenses);
  });

  // UI tab for finances: 'movimientos' | 'por-persona'
  activeTab = signal<'movimientos' | 'por-persona'>('movimientos');

  setFinancesTab(tab: 'movimientos' | 'por-persona') {
    this.activeTab.set(tab);
  }

  constructor() {
    this.financeForm = this.fb.group({
      description: ['', [Validators.required, Validators.minLength(3)]],
      amount: [0, [Validators.required, Validators.min(0.01)]],
      type: ['expense', Validators.required],
      category: ['Otros'],
      paidBy: ['', [Validators.required, Validators.minLength(2)]],
    });
  }

  ngOnInit() {
    this.loadData();

    // Listen to paidBy field changes for autocomplete
    this.financeForm.get('paidBy')?.valueChanges.subscribe((value) => {
      this.onPaidByInput(value || '');
    });
  }

  async loadData() {
    this.isLoading.set(true);
    await this.financesService.loadFinances();
    this.isLoading.set(false);
  }

  async onSubmit() {
    if (this.financeForm.invalid) {
      this.financeForm.markAllAsTouched();
      return;
    }

    this.isSubmitting.set(true);
    try {
      if (this.editingRecordId()) {
        await this.financesService.updateFinance(this.editingRecordId()!, this.financeForm.value);
        this.editingRecordId.set(null);
      } else {
        await this.financesService.createFinance(this.financeForm.value);
      }
      this.financeForm.reset({ type: 'expense', amount: 0, category: 'Otros', paidBy: '' });
      // If form was opened as modal, close it after successful save
      if (this.showFormModal && this.showFormModal()) {
        this.closeFormModal();
      }
      // Show success toast
      this.showAppToast('Registro guardado correctamente', 'success');
    } catch (error) {
      console.error('Error submitting form:', error);
      // Show error toast
      const msg = this.getErrorMessage(error, 'No se ha podido guardar');
      this.showAppToast(msg, 'error');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  showAppToast(message: string, type: 'success' | 'error') {
    this.toastMessage.set(message);
    this.toastType.set(type);
    this.showToast.set(true);
    // Auto-hide after 3.5s
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

  private getErrorMessage(error: unknown, fallback = 'Error inesperado'): string {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    if (typeof error === 'string' && error.trim().length) {
      return error.trim();
    }

    if (
      error &&
      typeof error === 'object' &&
      'message' in error &&
      typeof (error as { message?: unknown }).message === 'string'
    ) {
      return (error as { message?: string }).message || fallback;
    }

    return fallback;
  }

  // Prompt user with modal to confirm delete
  promptDeleteRecord(record: FinanceEntity) {
    if (!record || !record.id) return;
    this.deleteTargetId.set(record.id);
    this.deleteTargetDesc.set(record.description || '');
    this.showDeleteModal.set(true);
  }

  // Cancel delete
  cancelDelete() {
    this.showDeleteModal.set(false);
    this.deleteTargetId.set(null);
    this.deleteTargetDesc.set('');
  }

  // Confirm and perform delete
  async confirmDelete() {
    const id = this.deleteTargetId();
    if (!id) return this.cancelDelete();
    this.isLoading.set(true);
    try {
      await this.financesService.deleteFinance(id);
      this.showAppToast('Registro eliminado correctamente', 'success');
      this.cancelDelete();
      // reload data
      await this.loadData();
    } catch (err) {
      console.error('Error deleting record:', err);
      const msg = this.getErrorMessage(err, 'No se ha podido eliminar');
      this.showAppToast(msg, 'error');
    } finally {
      this.isLoading.set(false);
    }
  }

  editRecord(record: FinanceEntity) {
    if (!record.id) return;
    this.editingRecordId.set(record.id);
    this.financeForm.patchValue({
      description: record.description,
      amount: record.amount,
      type: record.type,
      category: record.category,
      paidBy: record.paidBy || '',
    });
    // If viewport is narrow, open the form in modal for better UX on mobile/tablet
    if (window.innerWidth <= 1200) {
      this.showFormModal.set(true);
      setTimeout(() => {
        const input = document.getElementById('paidByInput') as HTMLInputElement | null;
        if (input) input.focus();
      }, 150);
    } else {
      // Desktop: scroll to inline form
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  openNewRecordForm() {
    // Reset editing state and show empty form, then scroll/focus for mobile
    this.editingRecordId.set(null);
    this.financeForm.reset({ type: 'expense', amount: 0, category: 'Otros', paidBy: '' });
    // Smooth scroll to the form and focus the paidBy input when available
    setTimeout(() => {
      const el = document.getElementById('finance-form');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      const input = document.getElementById('paidByInput') as HTMLInputElement | null;
      if (input) {
        input.focus();
      }
    }, 150);
  }

  // Modal control for mobile/tablet when form is hidden
  showFormModal = signal(false);

  openFormModal() {
    this.editingRecordId.set(null);
    this.financeForm.reset({ type: 'expense', amount: 0, category: 'Otros', paidBy: '' });
    this.showFormModal.set(true);
    setTimeout(() => {
      const input = document.getElementById('paidByInput') as HTMLInputElement | null;
      if (input) input.focus();
    }, 150);
  }

  closeFormModal() {
    this.showFormModal.set(false);
    // Clear editing state to avoid showing inline form after closing modal
    this.editingRecordId.set(null);
    this.financeForm.reset({ type: 'expense', amount: 0, category: 'Otros', paidBy: '' });
  }

  cancelEdit() {
    this.editingRecordId.set(null);
    this.financeForm.reset({ type: 'expense', amount: 0, category: 'Otros', paidBy: '' });
    // If the form is open in modal, close it as part of cancel
    if (this.showFormModal && this.showFormModal()) {
      this.closeFormModal();
    }
  }

  getBadgeClass(type: string): string {
    return type === 'income' ? 'badge-income' : 'badge-expense';
  }

  // Pagination methods
  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages()) {
      this.currentPage.set(page);
    }
  }

  nextPage() {
    if (this.hasNextPage()) {
      this.currentPage.update((p) => p + 1);
    }
  }

  previousPage() {
    if (this.hasPreviousPage()) {
      this.currentPage.update((p) => p - 1);
    }
  }

  changePageSize(size: number) {
    this.pageSize.set(size);
    this.currentPage.set(1); // Reset to first page when changing page size
  }

  getPageNumbers(): number[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: number[] = [];

    if (total <= 7) {
      // Show all pages if 7 or less
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      if (current > 3) {
        pages.push(-1); // Ellipsis
      }

      // Show pages around current
      const start = Math.max(2, current - 1);
      const end = Math.min(total - 1, current + 1);

      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      if (current < total - 2) {
        pages.push(-1); // Ellipsis
      }

      // Always show last page
      pages.push(total);
    }

    return pages;
  }

  // Autocomplete methods
  onPaidByInput(value: string) {
    const trimmedValue = value.trim().toLowerCase();

    if (!trimmedValue) {
      this.showSuggestions.set(false);
      this.filteredSuggestions.set([]);
      return;
    }

    const filtered = this.uniquePaidByNames().filter((name) =>
      name.toLowerCase().includes(trimmedValue),
    );

    this.filteredSuggestions.set(filtered);
    this.showSuggestions.set(filtered.length > 0);
    this.selectedSuggestionIndex.set(-1);
  }

  selectSuggestion(name: string) {
    this.financeForm.patchValue({ paidBy: name });
    this.showSuggestions.set(false);
    this.selectedSuggestionIndex.set(-1);
  }

  onPaidByKeydown(event: KeyboardEvent) {
    const suggestions = this.filteredSuggestions();

    if (!this.showSuggestions() || suggestions.length === 0) {
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        this.selectedSuggestionIndex.update((i) => (i < suggestions.length - 1 ? i + 1 : i));
        break;
      case 'ArrowUp':
        event.preventDefault();
        this.selectedSuggestionIndex.update((i) => (i > 0 ? i - 1 : -1));
        break;
      case 'Enter': {
        event.preventDefault();
        const index = this.selectedSuggestionIndex();
        if (index >= 0 && index < suggestions.length) {
          this.selectSuggestion(suggestions[index]);
        }
        break;
      }
      case 'Escape':
        this.showSuggestions.set(false);
        this.selectedSuggestionIndex.set(-1);
        break;
    }
  }

  onPaidByBlur() {
    // Delay to allow click on suggestion
    setTimeout(() => {
      this.showSuggestions.set(false);
      this.selectedSuggestionIndex.set(-1);
    }, 200);
  }

  onPaidByFocus() {
    const value = this.financeForm.get('paidBy')?.value || '';
    if (value.trim()) {
      this.onPaidByInput(value);
    }
  }
}
