import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FinancesService, FinanceRecord } from '../../../services/finances.service';

@Component({
    selector: 'app-finances',
    standalone: true,
    imports: [CommonModule, FormsModule, ReactiveFormsModule],
    templateUrl: './finances.component.html',
    styleUrl: './finances.component.css'
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
        this.records().forEach(r => {
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
            .filter(r => r.type === 'income')
            .reduce((acc, r) => acc + r.amount, 0);
    });

    totalExpense = computed(() => {
        return this.records()
            .filter(r => r.type === 'expense')
            .reduce((acc, r) => acc + r.amount, 0);
    });

    balance = computed(() => this.totalIncome() - this.totalExpense());

    // Gastos por persona
    expensesByPerson = computed(() => {
        const expenses = this.records().filter(r => r.type === 'expense' && r.paidBy);
        const byPerson = new Map<string, number>();

        expenses.forEach(expense => {
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
        const incomes = this.records().filter(r => r.type === 'income' && r.paidBy);
        const byPerson = new Map<string, number>();

        incomes.forEach(income => {
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
        
        this.records().forEach(r => {
            if (r.paidBy) allPeople.add(r.paidBy.trim());
        });

        return Array.from(allPeople).map(person => {
            const expenses = this.records()
                .filter(r => r.type === 'expense' && r.paidBy?.trim() === person)
                .reduce((sum, r) => sum + r.amount, 0);
            
            const incomes = this.records()
                .filter(r => r.type === 'income' && r.paidBy?.trim() === person)
                .reduce((sum, r) => sum + r.amount, 0);

            return {
                name: person,
                expenses,
                incomes,
                balance: incomes - expenses
            };
        }).sort((a, b) => b.expenses - a.expenses);
    });

    constructor() {
        this.financeForm = this.fb.group({
            description: ['', [Validators.required, Validators.minLength(3)]],
            amount: [0, [Validators.required, Validators.min(0.01)]],
            type: ['expense', Validators.required],
            category: ['Otros'],
            paidBy: ['', [Validators.required, Validators.minLength(2)]]
        });
    }

    ngOnInit() {
        this.loadData();
        
        // Listen to paidBy field changes for autocomplete
        this.financeForm.get('paidBy')?.valueChanges.subscribe(value => {
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
        } catch (error) {
            console.error('Error submitting form:', error);
        } finally {
            this.isSubmitting.set(false);
        }
    }

    async deleteRecord(id: number | undefined) {
        if (!id) return;
        if (confirm('¿Estás seguro de que quieres eliminar este registro?')) {
            try {
                await this.financesService.deleteFinance(id);
            } catch (error) {
                console.error('Error deleting record:', error);
            }
        }
    }

    editRecord(record: FinanceRecord) {
        if (!record.id) return;
        this.editingRecordId.set(record.id);
        this.financeForm.patchValue({
            description: record.description,
            amount: record.amount,
            type: record.type,
            category: record.category,
            paidBy: record.paidBy || ''
        });
        // Scroll to form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    cancelEdit() {
        this.editingRecordId.set(null);
        this.financeForm.reset({ type: 'expense', amount: 0, category: 'Otros', paidBy: '' });
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
            this.currentPage.update(p => p + 1);
        }
    }

    previousPage() {
        if (this.hasPreviousPage()) {
            this.currentPage.update(p => p - 1);
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

        const filtered = this.uniquePaidByNames().filter(name => 
            name.toLowerCase().includes(trimmedValue)
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
                this.selectedSuggestionIndex.update(i => 
                    i < suggestions.length - 1 ? i + 1 : i
                );
                break;
            case 'ArrowUp':
                event.preventDefault();
                this.selectedSuggestionIndex.update(i => i > 0 ? i - 1 : -1);
                break;
            case 'Enter':
                event.preventDefault();
                const index = this.selectedSuggestionIndex();
                if (index >= 0 && index < suggestions.length) {
                    this.selectSuggestion(suggestions[index]);
                }
                break;
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
