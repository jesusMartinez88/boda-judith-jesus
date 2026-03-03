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

    constructor() {
        this.financeForm = this.fb.group({
            description: ['', [Validators.required, Validators.minLength(3)]],
            amount: [0, [Validators.required, Validators.min(0.01)]],
            type: ['expense', Validators.required],
            category: ['Otros']
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
            this.financeForm.reset({ type: 'expense', amount: 0, category: 'Otros' });
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
            category: record.category
        });
        // Scroll to form
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    cancelEdit() {
        this.editingRecordId.set(null);
        this.financeForm.reset({ type: 'expense', amount: 0, category: 'Otros' });
    }

    getBadgeClass(type: string): string {
        return type === 'income' ? 'badge-income' : 'badge-expense';
    }
}
