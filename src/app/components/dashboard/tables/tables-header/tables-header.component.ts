import { Component, EventEmitter, Input, Output } from '@angular/core';


@Component({
    selector: 'app-tables-header',
    standalone: true,
    imports: [],
    templateUrl: './tables-header.component.html',
    styleUrl: './tables-header.component.css'
})
export class TablesHeaderComponent {
    @Input() isEditMode = false;
    @Output() addTable = new EventEmitter<void>();
    @Output() toggleEditMode = new EventEmitter<void>();

    onAddTable() {
        this.addTable.emit();
    }

    onToggleEditMode() {
        this.toggleEditMode.emit();
    }
}
