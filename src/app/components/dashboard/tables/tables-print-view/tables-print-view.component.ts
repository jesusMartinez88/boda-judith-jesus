import { Component, input } from '@angular/core';
import { Guest } from '../../../../services/guest.service';
import { TableWithGuests } from '../tables.component';

@Component({
  selector: 'app-tables-print-view',
  standalone: true,
  templateUrl: './tables-print-view.component.html',
  styleUrl: './tables-print-view.component.css',
})
export class TablesPrintViewComponent {
  readonly tables = input.required<TableWithGuests[]>();

  isCaptain(table: TableWithGuests, guest: Guest): boolean {
    if (!table.captainIds || !guest.id) return false;
    return table.captainIds.includes(Number(guest.id));
  }
}
