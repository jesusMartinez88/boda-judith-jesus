import { Component, EventEmitter, Output } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
    selector: 'app-tables-header',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './tables-header.component.html',
    styleUrl: './tables-header.component.css'
})
export class TablesHeaderComponent {
    @Output() addTable = new EventEmitter<void>();

    onAddTable() {
        this.addTable.emit();
    }
}
