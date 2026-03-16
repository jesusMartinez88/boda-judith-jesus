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

    records = this.financesService.records;
    financeForm: FormGroup;
    isSubmitting = signal(false);
    isLoading = signal(true);
    editingRecordId = signal<number | null>(null);

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
}
