import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
  computed,
  ElementRef,
  viewChild,
} from '@angular/core';

import { GuestService, Guest } from '../../../services/guest.service';
import { SettingsService } from '../../../services/settings.service';
import { TableService, TableConfig } from '../../../services/table.service';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormControl,
  FormGroup,
  Validators,
} from '@angular/forms';
import { DragDropModule, CdkDragDrop, CdkDragEnd } from '@angular/cdk/drag-drop';
import { firstValueFrom, Subscription } from 'rxjs';
import { TablesLegendComponent } from './tables-legend/tables-legend.component';
import { TablesHeaderComponent } from './tables-header/tables-header.component';
import { ExportPdfBtnComponent } from './export-pdf-btn/export-pdf-btn';
import { GuestFormModalComponent } from '../../../shared/components/guest-form-modal/guest-form-modal.component';
import { GuestDeleteModalComponent } from '../../../shared/components/guest-delete-modal/guest-delete-modal.component';

export interface HallSearchResult {
  guest: Guest;
  location: 'seated' | 'queue';
  tableId: number | null;
  tableName: string | null;
  seatNumber: number | null;
}

interface TableWithGuests {
  id: number;
  name: string | undefined;
  capacity: number;
  shape: string;
  posX: number | undefined;
  posY: number | undefined;
  guests: Guest[];
}

interface SeatDropData {
  tableId: number;
  seatIndex: number;
}

type TableDropData = Guest[] | SeatDropData | number | null;
type TableShape = TableConfig['shape'];
type PrintStickerDesign = 'classic' | 'botanical' | 'modern' | 'romantic' | 'aquamarine' | 'ai';

interface PrintStickerDesignOption {
  id: PrintStickerDesign;
  name: string;
  description: string;
}

interface TablePositionUpdate {
  id: number;
  posX: number;
  posY: number;
}

function isSeatDropData(value: TableDropData): value is SeatDropData {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isTableShape(value: unknown): value is TableShape {
  return (
    value === 'round' || value === 'square' || value === 'rectangular' || value === 'presidential'
  );
}

@Component({
  selector: 'app-tables',
  imports: [
    ReactiveFormsModule,
    TablesLegendComponent,
    TablesHeaderComponent,
    DragDropModule,
    ExportPdfBtnComponent,
    GuestFormModalComponent,
    GuestDeleteModalComponent,
  ],
  templateUrl: './tables.component.html',
  styleUrl: './tables.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TablesComponent implements OnInit {
  private guestService = inject(GuestService);
  private settingsService = inject(SettingsService);
  private tableService = inject(TableService);
  private fb = inject(FormBuilder);

  guests = this.guestService.guests;
  maxGuests = computed(() => this.settingsService.settings().max_guests_per_table);
  //autoAssign = computed(() => this.settingsService.settings().auto_assign_tables ?? false);

  isLoading = signal(true);
  draggedGuest: Guest | null = null;

  readonly hallElement = viewChild.required<ElementRef>('hall');

  // Drag animation state
  draggingGuestId = signal<string | undefined>(undefined);
  newlySeatedIds = signal<Set<string>>(new Set());
  isReceivingGuest = signal<boolean>(false);

  // Modal para nuevo/editar invitado
  showAddModal = signal(false);
  selectedGuestForModal = signal<Guest | null>(null);

  // Modal para nueva mesa
  showCreateTableModal = signal(false);
  tableForm: FormGroup = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    capacity: [10, [Validators.required, Validators.min(1), Validators.max(25)]],
    shape: ['round', [Validators.required]],
  });

  // Modal para confirmar borrado de mesa
  showDeleteConfirm = signal(false);
  tableIdToDelete = signal<number | null>(null);

  // Modal para confirmar borrado de invitado
  showGuestDeleteConfirm = signal(false);
  guestToDelete = signal<Guest | null>(null);

  // Modal para avisar de mesa llena
  showFullTableModal = signal(false);
  fullTableName = signal('');
  fullTableCapacity = signal(0);

  // Modal para elegir diseno de pegatina
  selectedPrintTable = signal<TableWithGuests | null>(null);
  selectedPrintDesign = signal<PrintStickerDesign>('classic');
  readonly printStickerDesigns: PrintStickerDesignOption[] = [
    {
      id: 'classic',
      name: 'Clásico',
      description: 'Borde elegante y lista limpia',
    },
    {
      id: 'botanical',
      name: 'Botánico',
      description: 'Detalles florales suaves',
    },
    {
      id: 'modern',
      name: 'Moderno',
      description: 'Tipografía compacta y alto contraste',
    },
    {
      id: 'romantic',
      name: 'Romántico',
      description: 'Marco delicado en tonos boda',
    },
    {
      id: 'aquamarine',
      name: 'Verde Agua',
      description: 'Diseño elegante verde agua con copas de brindis',
    },
    {
      id: 'ai',
      name: 'Diseño IA',
      description: 'Genera una ilustración personalizada mediante IA gratis',
    },
  ];

  aiPrompt = signal<string>('');
  aiImageUrl = signal<string>('');
  isGeneratingAiImage = signal<boolean>(false);

  // Modal genérico para avisos/errores
  showGenericModal = signal(false);
  genericModalTitle = signal('');
  genericModalMessage = signal('');

  // Edición inline de nombres de mesa
  editingTableId = signal<number | null>(null);
  editingNameControl = new FormControl<string>('', { nonNullable: true });

  searchTerm = signal<string>('');
  searchControl = new FormControl<string>('', { nonNullable: true });
  hallSearchTerm = signal<string>('');
  hallSearchControl = new FormControl<string>('', { nonNullable: true });
  highlightedTableId = signal<number | null>(null);
  isQueueHighlighted = signal<boolean>(false);
  selectedTablePanelId = signal<number | null>(null);
  showAssignSeatModal = signal<boolean>(false);
  assignSearchTerm = signal<string>('');
  assignSearchControl = new FormControl<string>('', { nonNullable: true });
  selectedGuestToAssign = signal<Guest | null>(null);
  selectedSeatToAssign = signal<number | null>(null);
  isEditLayoutMode = signal<boolean>(true);
  private tableWasDragged = false;

  private capacityControls = new Map<number, FormControl<number>>();
  private capacitySubs = new Map<number, Subscription>();

  // Organizar invitados por mesa siguiendo ESTRICTAMENTE la configuración
  tables = computed(() => {
    const guestList = this.guests();
    const configs = this.tableService.tables();

    if (!Array.isArray(configs) || configs.length === 0) return [];

    return configs
      .map((config) => {
        const tableId = Number(config.id);
        return {
          id: tableId,
          name: config.name,
          capacity: config.capacity || this.maxGuests(),
          shape: config.shape || 'round',
          posX: config.posX,
          posY: config.posY,
          guests: guestList.filter((g) => {
            if (g.attending === 0) return false;
            const guestTableId = Number(g.tableId || 0);
            if (guestTableId !== tableId || guestTableId === 0) return false;
            // siempre mostrar únicamente invitados que ya tienen un número de asiento
            return g.seatNumber !== null && g.seatNumber !== undefined;
          }),
        };
      })
      .sort((a, b) => a.id - b.id);
  });

  unassignedGuests = computed(() => {
    const guestList = this.guests();
    const tableConfigs = this.tableService.tables();

    // Excluir siempre invitados que han rechazado
    const filteredList = guestList.filter((g) => g.attending !== 0 && g.attendance !== false);

    // Si no hay mesas cargadas aún, todos se ven como sin asignar (excepto rechazados)
    if (!tableConfigs || tableConfigs.length === 0) return filteredList;

    const validTableIds = new Set(tableConfigs.map((t) => Number(t.id)));

    return filteredList.filter((g) => {
      const tableId = Number(g.tableId || 0);
      if (tableId === 0 || !validTableIds.has(tableId)) {
        return true;
      }
      // siempre considerar sin asiento como "por asignar"
      if (g.seatNumber === null || g.seatNumber === undefined) {
        return true;
      }
      return false;
    });
  });

  filteredUnassignedGuests = computed(() => {
    const guests = this.unassignedGuests();
    const term = this.searchTerm().toLowerCase().trim();

    if (!term) return guests;

    return guests.filter(
      (g) =>
        g.name.toLowerCase().includes(term) ||
        (g.email && g.email.toLowerCase().includes(term)) ||
        (g.phone && g.phone.includes(term)),
    );
  });

  hallSearchResults = computed((): HallSearchResult[] => {
    const term = this.hallSearchTerm().toLowerCase().trim();
    if (!term) return [];

    const attending = this.guests().filter((g) => g.attending !== 0 && g.attendance !== false);
    const tableConfigs = this.tableService.tables();
    const tableNameById = new Map(
      tableConfigs.map((t) => [Number(t.id), t.name || `Mesa ${t.id}`]),
    );
    const validTableIds = new Set(tableConfigs.map((t) => Number(t.id)));

    return attending
      .filter(
        (g) =>
          g.name.toLowerCase().includes(term) ||
          (g.email && g.email.toLowerCase().includes(term)) ||
          (g.phone && g.phone.includes(term)),
      )
      .map((guest) => {
        const tableId = Number(guest.tableId || 0);
        const hasSeat = guest.seatNumber !== null && guest.seatNumber !== undefined;
        const isSeated = tableId > 0 && validTableIds.has(tableId) && hasSeat;

        if (isSeated) {
          return {
            guest,
            location: 'seated' as const,
            tableId,
            tableName: tableNameById.get(tableId) ?? `Mesa ${tableId}`,
            seatNumber: guest.seatNumber ?? null,
          };
        }

        return {
          guest,
          location: 'queue' as const,
          tableId: null,
          tableName: null,
          seatNumber: null,
        };
      });
  });

  selectedTablePanelData = computed((): (TableWithGuests & { sortedGuests: Guest[] }) | null => {
    const tableId = this.selectedTablePanelId();
    if (tableId === null) return null;

    const table = this.tables().find((t) => t.id === tableId);
    if (!table) return null;

    const sortedGuests = [...table.guests].sort(
      (a, b) => (a.seatNumber ?? 0) - (b.seatNumber ?? 0),
    );

    return { ...table, sortedGuests };
  });

  selectedTableFreeSeats = computed((): number[] => {
    const panel = this.selectedTablePanelData();
    if (!panel) return [];

    const occupied = new Set<number>();
    panel.sortedGuests.forEach((g) => {
      const n = g.seatNumber;
      if (n !== null && n !== undefined) occupied.add(Number(n));
    });

    const free: number[] = [];
    for (let i = 1; i <= panel.capacity; i++) {
      if (!occupied.has(i)) free.push(i);
    }
    return free;
  });

  assignableGuests = computed((): Guest[] => {
    const term = this.assignSearchTerm().toLowerCase().trim();
    const list = this.unassignedGuests();
    if (!term) return list;

    return list.filter(
      (g) =>
        g.name.toLowerCase().includes(term) ||
        (g.email && g.email.toLowerCase().includes(term)) ||
        (g.phone && g.phone.includes(term)),
    );
  });

  hallHeight = computed(() => {
    const currentTables = this.tables();
    if (currentTables.length === 0) return 1200;

    let maxBottom = 0;
    currentTables.forEach((t) => {
      if (t.posX !== undefined && t.posY !== undefined) {
        const height = t.shape === 'rectangular' ? 340 : t.shape === 'presidential' ? 240 : 340;
        const bottom = t.posY + height + 110; // 110px de margen
        if (bottom > maxBottom) maxBottom = bottom;
      }
    });

    return Math.max(1200, maxBottom);
  });

  hallWidth = computed(() => {
    const currentTables = this.tables();
    if (currentTables.length === 0) return 1000;

    let maxRight = 0;
    currentTables.forEach((t) => {
      if (t.posX !== undefined && t.posY !== undefined) {
        const width =
          t.shape === 'rectangular' || t.shape === 'presidential'
            ? this.getRectTableWidth(t.capacity, t.shape) + 60
            : 340;
        const right = t.posX + width + 110; // 110px de margen
        if (right > maxRight) maxRight = right;
      }
    });

    return Math.max(1000, maxRight);
  });

  ngOnInit() {
    this.loadData();
    this.searchControl.valueChanges.subscribe((v) => this.searchTerm.set((v ?? '').toString()));
    this.hallSearchControl.valueChanges.subscribe((v) =>
      this.hallSearchTerm.set((v ?? '').toString()),
    );
    this.assignSearchControl.valueChanges.subscribe((v) =>
      this.assignSearchTerm.set((v ?? '').toString()),
    );
  }

  getHallSearchLocationMessage(result: HallSearchResult): string {
    if (result.location === 'seated' && result.tableName) {
      const seatInfo = result.seatNumber ? ` (asiento ${result.seatNumber})` : '';
      return `${result.guest.name} está sentado en ${result.tableName}${seatInfo}`;
    }
    return `${result.guest.name} está en cola de recepción (sin asiento)`;
  }

  onHallSearchSelect(result: HallSearchResult) {
    this.locateGuest(result);
  }

  onHallSearchKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter') return;
    const results = this.hallSearchResults();
    if (results.length === 1) {
      this.locateGuest(results[0]);
    }
  }

  locateGuest(result: HallSearchResult) {
    if (result.location === 'seated' && result.tableId !== null) {
      this.highlightTable(result.tableId);
      this.scrollToTable(result.tableId);
      return;
    }
    this.highlightQueue();
  }

  highlightTable(tableId: number) {
    this.highlightedTableId.set(tableId);
    setTimeout(() => this.highlightedTableId.set(null), 3000);
  }

  scrollToTable(tableId: number) {
    setTimeout(() => {
      const el = document.querySelector(`[data-table-id="${tableId}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }, 50);
  }

  highlightQueue() {
    this.isQueueHighlighted.set(true);
    setTimeout(() => this.isQueueHighlighted.set(false), 3000);
    document
      .querySelector('.reception-queue')
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  openTablePanel(table: TableWithGuests) {
    this.selectedTablePanelId.set(table.id);
  }

  closeTablePanel() {
    this.selectedTablePanelId.set(null);
  }

  onTableDragStarted() {
    this.tableWasDragged = true;
  }

  onTableSurfaceClick(event: Event, table: TableWithGuests) {
    const target = event.target as HTMLElement;
    if (
      target.closest('.table-config-overlay') ||
      target.closest('.edit-table-input') ||
      target.closest('.table-num')
    ) {
      return;
    }

    if (this.tableWasDragged) {
      this.tableWasDragged = false;
      return;
    }

    this.openTablePanel(table);
  }

  onTablePanelEdit(guest: Guest, event: MouseEvent) {
    event.stopPropagation();
    this.openEditModal(guest);
  }

  onTablePanelDelete(guest: Guest, event: MouseEvent) {
    event.stopPropagation();
    this.deleteGuest(guest);
  }

  printTableSticker(table: TableWithGuests, event?: MouseEvent) {
    event?.stopPropagation();
    this.selectedPrintTable.set(table);
    this.selectedPrintDesign.set('classic');
    this.aiPrompt.set(this.generateDefaultAiPrompt(table));
    this.aiImageUrl.set('');
    this.isGeneratingAiImage.set(false);
  }

  generateDefaultAiPrompt(table: TableWithGuests): string {
    const guestNames = table.guests.map((g) => g.name || 'Invitado').join(', ');
    const tableName = table.name || `MESA ${table.id}`;
    return `Elegant wedding seating chart card, Tiffany blue background with sophisticated gold borders. Clean central rectangle containing the text "MESA" and number "${tableName.replace(/Mesa\s+/i, '')}". Guests list: ${guestNames}. Cursive romantic calligraphy at the bottom says "Judith & Jesús" and "11 de Julio de 2026". Minimalist luxury sticker design, vector illustration, white paper texture, high contrast, clean text rendering, professional print template.`;
  }

  generateAiImage() {
    const prompt = this.aiPrompt().trim();
    if (!prompt) return;

    this.isGeneratingAiImage.set(true);
    const encodedPrompt = encodeURIComponent(prompt);
    const randomSeed = Math.floor(Math.random() * 1000000);
    const imageUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}?width=800&height=1200&nologo=true&seed=${randomSeed}`;

    const img = new Image();
    img.src = imageUrl;
    img.onload = () => {
      this.aiImageUrl.set(imageUrl);
      this.isGeneratingAiImage.set(false);
    };
    img.onerror = () => {
      this.isGeneratingAiImage.set(false);
      this.triggerAlert('Error', 'No se pudo generar la imagen. Inténtalo de nuevo.');
    };
  }

  closePrintDesignModal() {
    this.selectedPrintTable.set(null);
  }

  selectPrintDesign(design: PrintStickerDesign) {
    this.selectedPrintDesign.set(design);
  }

  getPrintPreviewGuests(table: TableWithGuests): Guest[] {
    return [...table.guests]
      .sort((a, b) => (a.seatNumber ?? 0) - (b.seatNumber ?? 0))
      .slice(0, 4);
  }

  getSelectedPrintDesignName(): string {
    return (
      this.printStickerDesigns.find((design) => design.id === this.selectedPrintDesign())?.name ??
      'Clásico'
    );
  }

  confirmPrintTableSticker() {
    const table = this.selectedPrintTable();
    if (!table) return;

    this.openTableStickerPrintWindow(table, this.selectedPrintDesign());
  }

  copyGuestsToClipboard() {
    const table = this.selectedPrintTable();
    if (!table) return;

    const sortedGuests = [...table.guests].sort(
      (a, b) => (a.seatNumber ?? 0) - (b.seatNumber ?? 0),
    );

    const text = sortedGuests
      .map(
        (g) =>
          `${g.name || 'Invitado'}${g.seatNumber ? ` - Asiento ${g.seatNumber}` : ''}`,
      )
      .join('\n');

    navigator.clipboard.writeText(text).then(
      () => {
        this.triggerAlert('Copiado', 'La lista de invitados se copió al portapapeles.');
      },
      (err) => {
        console.error('Error al copiar:', err);
        this.triggerAlert('Error', 'No se pudo copiar la lista.');
      },
    );
  }

  downloadGuestsCSV() {
    const table = this.selectedPrintTable();
    if (!table) return;

    const sortedGuests = [...table.guests].sort(
      (a, b) => (a.seatNumber ?? 0) - (b.seatNumber ?? 0),
    );

    // BOM para compatibilidad con Excel (acentos en español)
    let csvContent = '\uFEFF';
    csvContent += 'Invitado,Asiento\n';
    sortedGuests.forEach((g) => {
      const name = (g.name || 'Invitado').replace(/"/g, '""');
      const seat = g.seatNumber ? `Asiento ${g.seatNumber}` : 'Sin asiento';
      csvContent += `"${name}","${seat}"\n`;
    });

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const tableNameClean = (table.name || `Mesa_${table.id}`).toLowerCase().replace(/\s+/g, '_');
    link.setAttribute('download', `invitados_${tableNameClean}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  private openTableStickerPrintWindow(table: TableWithGuests, design: PrintStickerDesign) {
    const sortedGuests = [...table.guests].sort(
      (a, b) => (a.seatNumber ?? 0) - (b.seatNumber ?? 0),
    );
    const tableName = table.name || `Mesa ${table.id}`;
    const printableWindow = window.open('', '_blank', 'width=520,height=720');

    if (!printableWindow) {
      this.triggerAlert(
        'Impresión bloqueada',
        'El navegador ha bloqueado la ventana de impresión. Permite ventanas emergentes e inténtalo de nuevo.',
      );
      return;
    }

    this.closePrintDesignModal();

    const guestRows = sortedGuests
      .map((guest) => {
        const seat = guest.seatNumber ? `Asiento ${guest.seatNumber}` : 'Sin asiento';
        return `
          <li>
            <span class="guest-name">${this.escapeHtml(guest.name || 'Invitado')}</span>
            <span class="seat-number">${this.escapeHtml(seat)}</span>
          </li>
        `;
      })
      .join('');
    const designStyles = this.getPrintableStickerStyles(design);
    const designLabel = this.getPrintableStickerLabel(design);

    const content = `
      <!doctype html>
      <html lang="es">
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <title>Pegatina ${this.escapeHtml(tableName)} - ${this.escapeHtml(designLabel)}</title>
          <link rel="preconnect" href="https://fonts.googleapis.com">
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
          <link href="https://fonts.googleapis.com/css2?family=Great+Vibes&family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap" rel="stylesheet">
          <style>
            @page {
              size: 100mm 150mm;
              margin: 0;
            }

            * {
              box-sizing: border-box;
            }

            body {
              margin: 0;
              min-height: 100vh;
              display: grid;
              place-items: center;
              background: #f8fafc;
              color: #1e293b;
              font-family: Georgia, 'Times New Roman', serif;
            }

            .sticker {
              width: 100mm;
              min-height: 150mm;
              padding: 12mm 10mm;
              display: flex;
              flex-direction: column;
              align-items: stretch;
              gap: 8mm;
              ${designStyles.sticker}
            }

            header {
              text-align: center;
              padding-bottom: 6mm;
              ${designStyles.header}
            }

            .eyebrow {
              display: block;
              margin-bottom: 3mm;
              font-family: Arial, sans-serif;
              font-size: 10pt;
              font-weight: 700;
              letter-spacing: 0.08em;
              text-transform: uppercase;
              ${designStyles.eyebrow}
            }

            h1 {
              margin: 0;
              font-size: 30pt;
              line-height: 1.05;
              ${designStyles.heading}
            }

            .count {
              margin: 3mm 0 0;
              color: #64748b;
              font-family: Arial, sans-serif;
              font-size: 11pt;
            }

            .guest-list-card {
              width: 100%;
            }

            ul {
              list-style: none;
              margin: 0;
              padding: 0;
              display: flex;
              flex-direction: column;
              gap: 2.6mm;
              font-family: Arial, sans-serif;
            }

            li {
              display: flex;
              justify-content: space-between;
              gap: 4mm;
              padding: 2.8mm 0;
              break-inside: avoid;
              ${designStyles.listItem}
            }

            .guest-name {
              font-size: 12pt;
              font-weight: 700;
            }

            .seat-number {
              color: #64748b;
              font-size: 10pt;
              white-space: nowrap;
            }

            .empty {
              margin: auto 0;
              color: #64748b;
              text-align: center;
              font-family: Arial, sans-serif;
              font-size: 12pt;
            }

            .sticker-footer {
              display: none;
            }

            @media print {
              body {
                background: white;
              }
            }
          </style>
        </head>
        <body>
          <main class="sticker" aria-label="Pegatina de ${this.escapeHtml(tableName)}">
            <header>
              <span class="eyebrow">Judith & Jesús</span>
              <h1>${this.escapeHtml(tableName)}</h1>
              <p class="count">${sortedGuests.length} invitados</p>
            </header>
            <div class="guest-list-card">
              ${
                sortedGuests.length > 0
                  ? `<ul>${guestRows}</ul>`
                  : '<p class="empty">Esta mesa aún no tiene invitados sentados.</p>'
              }
            </div>
            <footer class="sticker-footer">
              <span class="footer-names">Judith & Jesús</span>
              <span class="footer-date">11 DE JULIO DE 2026</span>
            </footer>
          </main>
          <script>
            window.addEventListener('load', () => {
              window.setTimeout(() => window.print(), 200);
            });
          </script>
        </body>
      </html>
    `;

    printableWindow.document.open();
    printableWindow.document.write(content);
    printableWindow.document.close();
  }

  private getPrintableStickerLabel(design: PrintStickerDesign): string {
    return this.printStickerDesigns.find((option) => option.id === design)?.name ?? 'Clásico';
  }

  private getPrintableStickerStyles(design: PrintStickerDesign): {
    sticker: string;
    header: string;
    eyebrow: string;
    heading: string;
    listItem: string;
  } {
    switch (design) {
      case 'aquamarine':
        return {
          sticker: `
            background-color: #92d7db;
            background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 150'><path d='M 6 36 V 114 H 12 C 12 133, 30 144, 50 144 C 70 144, 88 133, 88 114 H 94 V 36 H 88 C 88 17, 70 6, 50 6 C 30 6, 12 17, 12 36 H 6 Z' fill='%2392d7db'/><path d='M 8.5 37.5 V 112.5 H 14 C 14 130.5, 30 141.5, 50 141.5 C 70 141.5, 86 130.5, 86 112.5 H 91.5 V 37.5 H 86 C 86 19.5, 70 8.5, 50 8.5 C 30 8.5, 14 19.5, 14 37.5 H 8.5 Z' fill='none' stroke='%23ffffff' stroke-width='0.6'/><g transform='translate(74, 102) scale(0.18)' stroke='%23114b53' stroke-width='3' fill='none'><g transform='rotate(-12 50 100)'><ellipse cx='50' cy='180' rx='30' ry='8' fill='%23ffffff' stroke='%23114b53' stroke-width='4'/><line x1='50' y1='180' x2='50' y2='110' stroke='%23114b53' stroke-width='4'/><path d='M 25 50 Q 25 110 50 110 Q 75 110 75 50 Z' fill='%23ffffff' stroke='%23114b53' stroke-width='4'/><path d='M 28 75 Q 50 80 72 75' stroke='%23114b53' stroke-width='3'/><circle cx='45' cy='65' r='2.5' fill='%23114b53'/><circle cx='55' cy='60' r='2' fill='%23114b53'/><circle cx='40' cy='55' r='2.5' fill='%23114b53'/></g><g transform='translate(35, 10) rotate(10 50 100)'><ellipse cx='50' cy='180' rx='30' ry='8' fill='%23ffffff' stroke='%23114b53' stroke-width='4'/><line x1='50' y1='180' x2='50' y2='110' stroke='%23114b53' stroke-width='4'/><path d='M 25 50 Q 25 110 50 110 Q 75 110 75 50 Z' fill='%23ffffff' stroke='%23114b53' stroke-width='4'/><path d='M 28 75 Q 50 80 72 75' stroke='%23114b53' stroke-width='3'/><circle cx='45' cy='65' r='2.5' fill='%23114b53'/><circle cx='52' cy='58' r='2' fill='%23114b53'/><circle cx='38' cy='70' r='3' fill='%23114b53'/></g></g></svg>");
            background-size: 100% 100%;
            background-repeat: no-repeat;
            padding: 16mm 14mm 10mm 14mm;
            display: flex;
            flex-direction: column;
            align-items: stretch;
            gap: 0;
            box-shadow: none;
            border: none;
          }
          .sticker .guest-list-card {
            background: #ffffff;
            padding: 5mm 6mm;
            border: 0.3mm solid #ffffff;
            flex-grow: 1;
            margin-bottom: 2mm;
            display: flex;
            flex-direction: column;
            justify-content: center;
          }
          .sticker .guest-list-card ul {
            gap: 1.8mm;
          }
          .sticker .guest-list-card .guest-name {
            color: #114b53;
            font-family: Arial, sans-serif;
            font-size: 11pt;
            letter-spacing: 0.02em;
            text-transform: uppercase;
          }
          .sticker .guest-list-card .seat-number {
            color: #1b5d67;
            font-family: Arial, sans-serif;
            font-size: 9pt;
          }
          .sticker .count {
            display: none;
          }
          .sticker .sticker-footer {
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-top: 1mm;
          }
          .sticker .footer-names {
            font-family: 'Great Vibes', cursive;
            font-size: 26pt;
            color: #114b53;
            line-height: 1;
          }
          .sticker .footer-date {
            font-family: Arial, sans-serif;
            font-size: 8pt;
            letter-spacing: 0.15em;
            color: #114b53;
            margin-top: 1mm;
            font-weight: bold;
          }
          .sticker {`,
          header: 'border: none; margin-bottom: 2mm; padding-bottom: 2mm;',
          eyebrow: 'display: none;',
          heading: "font-family: 'Playfair Display', Georgia, serif; font-size: 32pt; color: #114b53; text-transform: uppercase; letter-spacing: 0.05em;",
          listItem: 'border-bottom: 0.25mm solid #e0f2f1; padding: 2.2mm 0;',
        };
      case 'botanical':
        return {
          sticker:
            'background: #fbfff8; border: 1.2mm solid #b7d8bc; box-shadow: inset 0 0 0 2mm #f0f8ee;',
          header:
            'border-bottom: 0.4mm solid #cfe6d0; position: relative;',
          eyebrow: 'color: #2f7d4f;',
          heading: 'color: #1f3f2d;',
          listItem: 'border-bottom: 0.25mm solid #dceedd;',
        };
      case 'modern':
        return {
          sticker:
            'background: #ffffff; border: 1.1mm solid #111827; box-shadow: inset 0 0 0 1mm #e5e7eb;',
          header: 'border-bottom: 0.6mm solid #111827;',
          eyebrow: 'color: #111827;',
          heading: 'color: #111827; font-family: Arial, sans-serif; font-size: 28pt;',
          listItem: 'border-bottom: 0.25mm solid #d1d5db;',
        };
      case 'romantic':
        return {
          sticker:
            'background: #fff8fb; border: 1.2mm double #d88ead; box-shadow: inset 0 0 0 2mm #fff;',
          header: 'border-bottom: 0.4mm solid #f0c9d9;',
          eyebrow: 'color: #a21caf;',
          heading: 'color: #831843;',
          listItem: 'border-bottom: 0.25mm solid #f5d7e3;',
        };
      case 'classic':
      default:
        return {
          sticker: 'background: #fffdf9; border: 1.2mm solid #e8c3d4;',
          header: 'border-bottom: 0.4mm solid #f3d8e5;',
          eyebrow: 'color: #be185d;',
          heading: 'color: #1e293b;',
          listItem: 'border-bottom: 0.25mm solid #f1e4eb;',
        };
    }
  }

  async onTablePanelUnseat(guest: Guest, event: MouseEvent) {
    event.stopPropagation();
    const guestId = this.guestKey(guest);
    if (!guestId) return;

    try {
      await this.guestService.updateGuestTable(guestId, null, null);
    } catch (error) {
      console.error('Error unseating guest:', error);
      this.triggerAlert(
        'Error',
        'No se pudo enviar el invitado a la cola. Por favor, inténtalo de nuevo.',
      );
    }
  }

  openAssignSeatModalForSelectedTable() {
    const panel = this.selectedTablePanelData();
    if (!panel) return;

    if (this.selectedTableFreeSeats().length === 0) {
      this.triggerAlert('Mesa completa', 'No hay asientos libres en esta mesa.');
      return;
    }

    this.selectedGuestToAssign.set(null);
    this.selectedSeatToAssign.set(this.selectedTableFreeSeats()[0] ?? null);
    this.assignSearchControl.setValue('');
    this.showAssignSeatModal.set(true);
  }

  closeAssignSeatModal() {
    this.showAssignSeatModal.set(false);
    this.selectedGuestToAssign.set(null);
    this.selectedSeatToAssign.set(null);
  }

  selectGuestToAssign(guest: Guest) {
    this.selectedGuestToAssign.set(guest);
  }

  isGuestSelectedForAssign(guest: Guest): boolean {
    const selected = this.selectedGuestToAssign();
    if (!selected) return false;
    return this.guestKey(selected) === this.guestKey(guest);
  }

  onAssignSeatChange(value: string) {
    const n = Number(value);
    this.selectedSeatToAssign.set(Number.isFinite(n) ? n : null);
  }

  async confirmAssignSeat() {
    const panel = this.selectedTablePanelData();
    const guest = this.selectedGuestToAssign();
    const seat = this.selectedSeatToAssign();

    if (!panel || !guest || seat === null) return;

    const guestId = this.guestKey(guest);
    if (!guestId) return;

    if (!this.selectedTableFreeSeats().includes(seat)) {
      this.triggerAlert('Asiento no disponible', 'Ese asiento ya no está libre. Elige otro.');
      return;
    }

    try {
      await this.guestService.updateGuestTable(guestId, panel.id, seat);
      this.closeAssignSeatModal();
    } catch (error) {
      console.error('Error assigning guest seat:', error);
      this.triggerAlert('Error', 'No se pudo asignar el asiento. Por favor, inténtalo de nuevo.');
    }
  }

  getCapacityControl(tableId: number, initialCapacity: number): FormControl<number> {
    const existing = this.capacityControls.get(tableId);
    if (existing) return existing;

    const ctrl = new FormControl<number>(Number(initialCapacity || 1), { nonNullable: true });
    this.capacityControls.set(tableId, ctrl);

    const sub = ctrl.valueChanges.subscribe((v) => {
      const n = Number(v);
      if (!Number.isFinite(n)) return;
      this.updateTableCapacity(tableId, n);
    });
    this.capacitySubs.set(tableId, sub);
    return ctrl;
  }

  async loadData() {
    this.isLoading.set(true);
    try {
      await this.guestService.loadGuests();

      this.settingsService.loadSettings().subscribe();
      this.tableService.loadTables().subscribe();
    } catch (error) {
      console.error('Error loading tables data:', error);
    } finally {
      this.isLoading.set(false);
    }
  }

  /** Returns the best available unique key for a guest (used in templates). */
  guestKey(guest: Guest): string {
    return guest.id ?? guest.email ?? guest.phone ?? '';
  }

  // --- HTML5 Drag & Drop Handlers ---

  /** Previene la animación de retorno al soltar un invitado */
  onGuestDragEnded(event: CdkDragEnd) {
    // Simplemente resetear sin animación
    if (event.source) {
      event.source.reset();
    }
  }

  onReceptionQueueEntered() {
    this.isReceivingGuest.set(true);
  }

  onReceptionQueueExited() {
    this.isReceivingGuest.set(false);
  }

  /** Returns the guest at a specific seat of a table (1-indexed: 1, 2, 3...) */
  getGuestAtSeat(tableId: number, seatIndex: number): Guest | undefined {
    return this.guests().find((g) => Number(g.tableId) === tableId && g.seatNumber === seatIndex);
  }

  async onDrop<T extends TableDropData>(event: CdkDragDrop<T, unknown, Guest>) {
    const guest = event.item.data as Guest;
    const guestId = this.guestKey(guest);

    if (!guestId) return;

    const targetData = event.container.data;

    // Normalizar destino
    let tableId: number | null = null;
    let seatNumber: number | null = null;

    if (targetData === undefined || targetData === null) {
      // Cola de recepción
      tableId = null;
      seatNumber = null;
    } else if (typeof targetData === 'number') {
      // Dropped on the table background (auto-assign seat)
      tableId = targetData;
      const table = this.tables().find((t) => t.id === tableId);
      if (table) {
        const currentGuestId = this.guestKey(guest);
        // Find first free seat (1-indexed: 1, 2, 3..., excluding the dragged guest's current position)
        for (let i = 1; i <= table.capacity; i++) {
          const occupant = this.getGuestAtSeat(tableId, i);
          if (!occupant || this.guestKey(occupant) === currentGuestId) {
            seatNumber = i;
            break;
          }
        }
        if (seatNumber === null) {
          this.fullTableName.set(table?.name || '');
          this.fullTableCapacity.set(table?.capacity || 0);
          this.showFullTableModal.set(true);
          return;
        }
      }
    } else if (isSeatDropData(targetData)) {
      // Dropped on a specific seat
      tableId = targetData.tableId;
      seatNumber = targetData.seatIndex;
    }

    if (!guest) return;

    // Si ya hay alguien en ese asiento de esa mesa, y venimos de otro sitio, swap
    if (tableId !== null && seatNumber !== null) {
      const existingGuest = this.getGuestAtSeat(tableId, seatNumber);
      if (existingGuest && this.guestKey(existingGuest) !== guestId) {
        // Swap: move the existing guest to the previous seat of the dragged guest
        const prevTableId =
          guest.tableId !== undefined && guest.tableId !== 0 ? Number(guest.tableId) : null;
        const prevSeatNumber =
          guest.seatNumber !== undefined && guest.seatNumber !== null
            ? Number(guest.seatNumber)
            : null;
        const existingGuestId = this.guestKey(existingGuest);

        try {
          // IMPORTANTE: Primero mover al invitado existente a un lugar temporal (cola de recepción)
          // para liberar el asiento y evitar problemas de capacidad
          await this.guestService.updateGuestTable(existingGuestId, null, null);

          // Luego mover al invitado arrastrado al nuevo asiento
          await this.guestService.updateGuestTable(guestId, tableId, seatNumber);

          // Finalmente mover al invitado que estaba al asiento original del arrastrado
          await this.guestService.updateGuestTable(existingGuestId, prevTableId, prevSeatNumber);

          // Trigger sit-down animation for both guests
          if (tableId !== null) {
            const sid = this.guestKey(guest);
            if (sid) {
              this.newlySeatedIds.update((s) => new Set([...s, sid]));
              setTimeout(() => {
                this.newlySeatedIds.update((s) => {
                  const n = new Set(s);
                  n.delete(sid);
                  return n;
                });
              }, 1500);
            }
          }
          if (prevTableId !== null) {
            const eid = existingGuest.id ?? existingGuest.email ?? existingGuest.phone;
            if (eid) {
              this.newlySeatedIds.update((s) => new Set([...s, eid]));
              setTimeout(() => {
                this.newlySeatedIds.update((s) => {
                  const n = new Set(s);
                  n.delete(eid);
                  return n;
                });
              }, 1500);
            }
          }
        } catch (error) {
          console.error('Error swapping guests:', error);
        }
        return; // Exit early after swap
      }
    }

    try {
      await this.guestService.updateGuestTable(guestId, tableId, seatNumber);

      // Trigger sit-down animation
      if (tableId !== null) {
        const sid = this.guestKey(guest);
        if (sid) {
          this.newlySeatedIds.update((s) => new Set([...s, sid]));
          setTimeout(() => {
            this.newlySeatedIds.update((s) => {
              const n = new Set(s);
              n.delete(sid);
              return n;
            });
          }, 1500);
        }
      }
    } catch (error) {
      console.error('Error updating guest table/seat:', error);
    }
  }

  deleteGuest(guest: Guest) {
    this.guestToDelete.set(guest);
    this.showGuestDeleteConfirm.set(true);
  }

  async confirmDeleteGuest() {
    const guest = this.guestToDelete();
    // use id if available, otherwise fall back to email/phone so we at least remove from state
    const guestId = guest?.id || guest?.email || guest?.phone;
    if (!guestId) return;

    try {
      this.showGuestDeleteConfirm.set(false);
      await this.guestService.deleteGuest(guestId);
    } catch (error) {
      console.error('Error deleting guest:', error);
      this.triggerAlert('Error', 'No se pudo eliminar al invitado. Por favor, inténtalo de nuevo.');
    } finally {
      this.guestToDelete.set(null);
    }
  }

  cancelDeleteGuest() {
    this.showGuestDeleteConfirm.set(false);
    this.guestToDelete.set(null);
  }

  openAddModal() {
    this.selectedGuestForModal.set(null);
    this.showAddModal.set(true);
  }

  closeAddModal() {
    this.showAddModal.set(false);
    this.selectedGuestForModal.set(null);
  }

  openEditModal(guest: Guest) {
    this.selectedGuestForModal.set(guest);
    this.showAddModal.set(true);
  }

  triggerAlert(title: string, message: string) {
    this.genericModalTitle.set(title);
    this.genericModalMessage.set(message);
    this.showGenericModal.set(true);
  }

  private escapeHtml(value: string): string {
    return value.replace(
      /[&<>"']/g,
      (char) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#039;',
        })[char] ?? char,
    );
  }

  closeGenericModal() {
    this.showGenericModal.set(false);
  }
  openCreateTableModal() {
    const currentTables = this.tableService.tables();
    const suggestedName = `Mesa ${currentTables.length + 1}`;

    this.tableForm.reset({
      name: suggestedName,
      capacity: this.maxGuests() || 10,
      shape: 'round',
    });
    this.showCreateTableModal.set(true);
  }

  closeCreateTableModal() {
    this.showCreateTableModal.set(false);
  }

  async confirmAddTable() {
    if (this.tableForm.invalid) {
      this.tableForm.markAllAsTouched();
      return;
    }
    const data = this.tableForm.getRawValue() as {
      name: string;
      capacity: number;
      shape: unknown;
    };
    const currentTables = this.tableService.tables();
    const shape = isTableShape(data.shape) ? data.shape : 'round';

    // Validación: Nombre duplicado
    const duplicate = currentTables.find(
      (t) =>
        (t.name || '').toLowerCase() ===
        String(data.name || '')
          .trim()
          .toLowerCase(),
    );
    if (duplicate) {
      this.triggerAlert(
        'Nombre Duplicado',
        `Ya existe una mesa con el nombre "${data.name}". Por favor, elige uno diferente.`,
      );
      return;
    }

    const nextId = currentTables.length > 0 ? Math.max(...currentTables.map((t) => t.id)) + 1 : 1;

    try {
      this.isLoading.set(true);
      await firstValueFrom(
        this.tableService.addTable({
          id: nextId,
          name: String(data.name || `Mesa ${currentTables.length + 1}`),
          capacity: Number(data.capacity),
          shape,
        }),
      );
      this.closeCreateTableModal();
    } catch (error) {
      console.error('Error adding table:', error);
      // Fallback local
      this.tableService.tables.update((t) => [
        ...t,
        {
          id: nextId,
          name: String(data.name || `Mesa ${currentTables.length + 1}`),
          shape,
          capacity: Number(data.capacity),
        },
      ]);
      this.closeCreateTableModal();
    } finally {
      this.isLoading.set(false);
    }
  }

  async toggleTableShape(id: number, currentShape: string) {
    const shapes: TableShape[] = ['round', 'square', 'rectangular', 'presidential'];
    const currentIndex = isTableShape(currentShape) ? shapes.indexOf(currentShape) : 0;
    const nextIndex = (currentIndex + 1) % shapes.length;
    const newShape = shapes[nextIndex];

    // Actualización optimista local
    this.tableService.tables.update((current) =>
      current.map((t) => (t.id === id ? { ...t, shape: newShape } : t)),
    );

    try {
      await firstValueFrom(this.tableService.updateTable(id, { shape: newShape }));
    } catch (error) {
      console.error('Error updating table shape:', error);
    }
  }

  onTableDragEnded(event: CdkDragEnd, tableId: number) {
    if (!this.isEditLayoutMode()) {
      this.tableWasDragged = false;
      return;
    }

    const element = event.source.getRootElement();
    const parentElement = document.querySelector('.tables-grid');

    if (!parentElement) return;

    const parentRect = parentElement.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();

    // Calcular posición exacta relativa al contenedor padre (.tables-grid)
    const posX = Math.round(elementRect.left - parentRect.left);
    const posY = Math.round(elementRect.top - parentRect.top);

    // Actualización optimista local en el servicio
    this.tableService.tables.update((current) =>
      current.map((t) => (t.id === tableId ? { ...t, posX, posY } : t)),
    );

    // Resetear la transformación del CDK para que el elemento se posicione puramente por style.left/top
    event.source.reset();

    // Persistir en servidor con los valores exactos calculados
    this.tableService.updateTable(tableId, { posX, posY }).subscribe({
      error: (err) => console.error('Error saving table position:', err),
    });

    setTimeout(() => {
      this.tableWasDragged = false;
    }, 150);
  }

  toggleEditLayout() {
    const enteringEditMode = !this.isEditLayoutMode();

    if (enteringEditMode) {
      // CAPTURA: Antes de activar el modo absoluto, guardamos dónde están las mesas en el grid
      const grid = document.querySelector('.tables-grid');
      if (grid) {
        const containers = grid.querySelectorAll('.table-container') as NodeListOf<HTMLElement>;
        const updates: TablePositionUpdate[] = [];

        containers.forEach((container) => {
          const id = Number(container.getAttribute('data-table-id'));
          if (id) {
            // Capturamos el offset respecto al grid
            updates.push({
              id,
              posX: container.offsetLeft,
              posY: container.offsetTop,
            });
          }
        });

        if (updates.length > 0) {
          this.tableService.tables.update((current) =>
            current.map((t) => {
              const match = updates.find((u) => u.id === t.id);
              return match ? { ...t, posX: match.posX, posY: match.posY } : t;
            }),
          );
        }
      }
    }

    this.isEditLayoutMode.set(enteringEditMode);
  }

  async updateTableCapacity(id: number, newCapacity: number) {
    const table = this.tables().find((t) => t.id === id);
    if (!table) return;

    // Identificar invitados que están en asientos que van a desaparecer (1-indexed: asientos > newCapacity)
    const guestsInRemovedSeats = table.guests.filter(
      (g) => g.seatNumber !== undefined && g.seatNumber !== null && g.seatNumber > newCapacity,
    );

    // Si quedan más invitados que la nueva capacidad (ej. invitados sin asiento específico), también los sacamos
    const validGuests = table.guests.filter((g) => !guestsInRemovedSeats.includes(g));
    const extraGuestsToUnassign =
      validGuests.length > newCapacity ? validGuests.slice(newCapacity) : [];

    const overflowingGuests = [...guestsInRemovedSeats, ...extraGuestsToUnassign];

    // Unassign overflowing guests
    for (const guest of overflowingGuests) {
      if (guest.id) {
        await this.guestService.updateGuestTable(guest.id, null);
      }
    }

    // Actualización optimista local de la mesa
    this.tableService.tables.update((current) =>
      current.map((t) => (t.id === id ? { ...t, capacity: newCapacity } : t)),
    );

    try {
      await firstValueFrom(this.tableService.updateTable(id, { capacity: newCapacity }));
    } catch (error) {
      console.error('Error updating table capacity:', error);
    }
  }

  startEditingTable(id: number, currentName: string | undefined) {
    this.editingNameControl.setValue(currentName || `Mesa ${id}`);
    this.editingTableId.set(id);
  }

  async saveTableName(id: number) {
    const newName = (this.editingNameControl.value || '').trim();

    if (!newName) {
      this.editingTableId.set(null);
      return;
    }

    // Validación: Nombre duplicado (excluyendo la mesa actual)
    const currentTables = this.tableService.tables();
    const duplicate = currentTables.find(
      (t) => t.id !== id && (t.name || '').toLowerCase() === newName.toLowerCase(),
    );

    if (duplicate) {
      this.triggerAlert('Nombre Duplicado', `Ya existe otra mesa con el nombre "${newName}".`);
      this.editingTableId.set(null);
      return;
    }

    this.editingTableId.set(null);

    // Actualización optimista local
    this.tableService.tables.update((current) =>
      current.map((t) => (t.id === id ? { ...t, name: newName } : t)),
    );

    try {
      await firstValueFrom(this.tableService.updateTable(id, { name: newName }));
    } catch (error) {
      console.error('Error updating table name:', error);
    }
  }

  deleteTable(id: number) {
    this.tableIdToDelete.set(id);
    this.showDeleteConfirm.set(true);
  }

  async confirmDeleteTable() {
    const id = this.tableIdToDelete();
    if (id === null) return;

    // Actualización optimista local
    this.tableService.tables.update((current) => current.filter((t) => t.id !== id));

    // Actualizar invitados localmente (se podría mover al servicio pero aquí es mesa-específico)
    this.guestService.guests.update((list) =>
      list.map((g) => (g.tableId === id ? { ...g, tableId: null } : g)),
    );

    try {
      this.showDeleteConfirm.set(false);
      await firstValueFrom(this.tableService.deleteTable(id));
    } catch (error) {
      console.error('Error deleting table:', error);
    } finally {
      this.tableIdToDelete.set(null);
    }
  }

  cancelDeleteTable() {
    this.showDeleteConfirm.set(false);
    this.tableIdToDelete.set(null);
  }

  getTableNameToDelete(): string {
    const id = this.tableIdToDelete();
    if (id === null) return '';
    const table = this.tableService.tables().find((t) => t.id === id);
    return table?.name || `Mesa ${id}`;
  }

  closeFullTableModal() {
    this.showFullTableModal.set(false);
    this.fullTableName.set('');
    this.fullTableCapacity.set(0);
  }

  getMenuClass(mealType?: string): string {
    if (!mealType) return 'menu-normal';
    const type = mealType.toLowerCase();
    if (type.includes('vege')) return 'menu-vegetarian';
    if (type.includes('vegan')) return 'menu-vegan';
    if (type.includes('celia') || type.includes('gluten')) return 'menu-celiac';
    if (type.includes('lacto')) return 'menu-lactose';
    if (type.includes('fruto')) return 'menu-nuts';
    if (type.includes('kid') || type.includes('infant')) return 'menu-kid';
    return 'menu-normal';
  }

  isBottomSeat(index: number, total: number): boolean {
    if (total === 0) return false;
    const angle = (360 / total) * index;
    return angle > 45 && angle < 135;
  }

  getSequence(n: number): number[] {
    return Array.from({ length: n }, (_, i) => i);
  }

  /**
   * Seat spacing in px for rectangular/presidential tables.
   * Keeps seats comfortably spaced: min 55px, max 80px.
   */
  getRectSeatSpacing(capacity: number, shape: string): number {
    const seatsPerSide = shape === 'presidential' ? capacity : Math.ceil(capacity / 2);
    // Shrink spacing a little for large tables to keep them manageable
    if (seatsPerSide <= 4) return 75;
    if (seatsPerSide <= 6) return 68;
    if (seatsPerSide <= 8) return 62;
    return 56;
  }

  /** Width of the table-surface div in px */
  getRectTableWidth(
    capacity: number,
    shape: 'rectangular' | 'presidential' | 'round' | 'square',
  ): number {
    if (shape !== 'rectangular' && shape !== 'presidential') return 0;
    const layoutSeats = shape === 'presidential' ? capacity : Math.ceil(capacity / 2);
    return layoutSeats * 75 + 30; // 75px per seat slot + 30px padding
  }

  getSeatX(shape: string, capacity: number, seatIdx: number): number {
    if (shape === 'round') {
      const angle = (360 / capacity) * seatIdx;
      const rad = (angle * Math.PI) / 180;
      return 170 + 108 * Math.cos(rad);
    } else if (shape === 'square') {
      const radius = this.isBottomSeat(seatIdx, capacity) ? 125 : 112;
      const angle = (360 / capacity) * seatIdx;
      const rad = (angle * Math.PI) / 180;
      return 170 + radius * Math.cos(rad);
    } else if (shape === 'rectangular') {
      const totalOnSide = Math.ceil(capacity / 2);
      const sideIndex = seatIdx % totalOnSide;
      const width = this.getRectTableWidth(capacity, 'rectangular') + 60;
      const seatSpacing = this.getRectSeatSpacing(capacity, shape);
      const translateX = (sideIndex - (totalOnSide - 1) / 2) * seatSpacing;
      return width / 2 + translateX;
    } else if (shape === 'presidential') {
      const totalOnSide = capacity;
      const sideIndex = seatIdx;
      const width = this.getRectTableWidth(capacity, 'presidential') + 60;
      const seatSpacing = this.getRectSeatSpacing(capacity, shape);
      const translateX = (sideIndex - (totalOnSide - 1) / 2) * seatSpacing;
      return width / 2 + translateX;
    }
    return 0;
  }

  getSeatY(shape: string, capacity: number, seatIdx: number): number {
    if (shape === 'round') {
      const angle = (360 / capacity) * seatIdx;
      const rad = (angle * Math.PI) / 180;
      return 170 + 108 * Math.sin(rad);
    } else if (shape === 'square') {
      const radius = this.isBottomSeat(seatIdx, capacity) ? 125 : 112;
      const angle = (360 / capacity) * seatIdx;
      const rad = (angle * Math.PI) / 180;
      return 170 + radius * Math.sin(rad);
    } else if (shape === 'rectangular') {
      const totalOnSide = Math.ceil(capacity / 2);
      const isBottom = seatIdx >= totalOnSide;
      const offsetY = isBottom ? 100 : -100;
      return 170 + offsetY;
    } else if (shape === 'presidential') {
      return 120 + 90;
    }
    return 0;
  }
}
