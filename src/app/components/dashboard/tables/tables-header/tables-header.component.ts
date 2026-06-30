import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-tables-header',
  standalone: true,
  imports: [],
  templateUrl: './tables-header.component.html',
  styleUrl: './tables-header.component.css',
})
export class TablesHeaderComponent {
  readonly isEditMode = input(false);
  readonly totalTables = input(0);
  readonly addTable = output<void>();
  readonly toggleEditMode = output<void>();

  onAddTable() {
    this.addTable.emit();
  }

  onToggleEditMode() {
    this.toggleEditMode.emit();
  }

  onPrintList() {
    window.print();
  }
}
