import { Component, computed, input, inject } from '@angular/core';
import { Guest } from '../../../../services/guest.service';
import { SettingsService } from '../../../../services/settings.service';
import { TableWithGuests } from '../tables.component';

@Component({
  selector: 'app-tables-print-view',
  standalone: true,
  templateUrl: './tables-print-view.component.html',
  styleUrl: './tables-print-view.component.css',
})
export class TablesPrintViewComponent {
  readonly tables = input.required<TableWithGuests[]>();
  private settingsService = inject(SettingsService);
  enableHighchairs = computed(() => this.settingsService.settings().enable_highchairs ?? false);

  sortedTables = computed(() => {
    return [...this.tables()].sort((a, b) => {
      const nameA = a.name || '';
      const nameB = b.name || '';
      return nameA.localeCompare(nameB, undefined, { numeric: true, sensitivity: 'base' });
    });
  });

  isCaptain(table: TableWithGuests, guest: Guest): boolean {
    if (!table.captainIds || !guest.id) return false;
    return table.captainIds.includes(Number(guest.id));
  }
}
