import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GuestService, Guest } from '../../../services/guest.service';
import { SettingsService } from '../../../services/settings.service';
import { TableService, TableConfig } from '../../../services/table.service';
import { FormsModule } from '@angular/forms';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { firstValueFrom } from 'rxjs';
import { TablesLegendComponent } from './tables-legend/tables-legend.component';
import { TablesHeaderComponent } from './tables-header/tables-header.component';

@Component({
    selector: 'app-tables',
    standalone: true,
    imports: [CommonModule, FormsModule, TablesLegendComponent, TablesHeaderComponent, DragDropModule],
    templateUrl: './tables.component.html',
    styleUrl: './tables.component.css'
})
export class TablesComponent implements OnInit {
    private guestService = inject(GuestService);
    private settingsService = inject(SettingsService);
    private tableService = inject(TableService);

    guests = this.guestService.guests;
    maxGuests = computed(() => this.settingsService.settings().max_guests_per_table);

    isLoading = signal(true);
    draggedGuest: Guest | null = null;

    // Drag animation state
    draggingGuestId = signal<string | undefined>(undefined);
    newlySeatedIds = signal<Set<string>>(new Set());

    // Modal para nuevo/editar invitado
    showAddModal = signal(false);
    isEditingGuest = signal(false);
    editingGuestId = signal<string | null>(null);
    newGuest = signal<Guest>({
        name: '',
        email: '',
        phone: '',
        attending: 1,
        mealType: 'normal',
        needsTransport: false,
        isSavedInBbdd: false
    });

    // Modal para nueva mesa
    showCreateTableModal = signal(false);
    newTableData = signal({
        name: '',
        capacity: 10,
        shape: 'round' as 'round' | 'square' | 'rectangular' | 'presidential'
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

    // Modal genérico para avisos/errores
    showGenericModal = signal(false);
    genericModalTitle = signal('');
    genericModalMessage = signal('');

    // Edición inline de nombres de mesa
    editingTableId = signal<number | null>(null);
    editingName = signal<string>('');

    searchTerm = signal<string>('');
    isEditLayoutMode = signal<boolean>(false);

    // Organizar invitados por mesa siguiendo ESTRICTAMENTE la configuración
    tables = computed(() => {
        const guestList = this.guests();
        const configs = this.tableService.tables();

        if (!Array.isArray(configs) || configs.length === 0) return [];

        return configs.map(config => {
            const tableId = Number(config.id);
            return {
                id: tableId,
                name: config.name,
                capacity: config.capacity || this.maxGuests(),
                shape: config.shape || 'round',
                posX: config.posX,
                posY: config.posY,
                guests: guestList.filter(g => {
                    const guestTableId = Number(g.tableId || 0);
                    return guestTableId === tableId && guestTableId !== 0;
                })
            };
        }).sort((a, b) => a.id - b.id);
    });

    unassignedGuests = computed(() => {
        const guestList = this.guests();
        const tableConfigs = this.tableService.tables();

        // Si no hay mesas cargadas aún, todos se ven como sin asignar (o esperamos)
        if (!tableConfigs || tableConfigs.length === 0) return guestList;

        const validTableIds = new Set(tableConfigs.map(t => Number(t.id)));

        return guestList.filter(g => {
            const tableId = Number(g.tableId || 0);
            return tableId === 0 || !validTableIds.has(tableId);
        });
    });

    filteredUnassignedGuests = computed(() => {
        const guests = this.unassignedGuests();
        const term = this.searchTerm().toLowerCase().trim();

        if (!term) return guests;

        return guests.filter(g =>
            g.name.toLowerCase().includes(term) ||
            (g.email && g.email.toLowerCase().includes(term)) ||
            (g.phone && g.phone.includes(term))
        );
    });

    hallHeight = computed(() => {
        const currentTables = this.tables();
        if (currentTables.length === 0) return 1200;

        let maxBottom = 0;
        currentTables.forEach(t => {
            if (t.posX !== undefined && t.posY !== undefined) {
                // Cada mesa ocupa unos 340px + margen, usamos 450 para aire inferior
                const bottom = t.posY + 450;
                if (bottom > maxBottom) maxBottom = bottom;
            }
        });

        return Math.max(1200, maxBottom);
    });

    hallWidth = computed(() => {
        const currentTables = this.tables();
        if (currentTables.length === 0) return 1000;

        let maxRight = 0;
        currentTables.forEach(t => {
            if (t.posX !== undefined && t.posY !== undefined) {
                // Cada mesa ocupa unos 340px + margen, usamos 450 para aire lateral
                const right = t.posX + 450;
                if (right > maxRight) maxRight = right;
            }
        });

        return Math.max(1000, maxRight);
    });

    ngOnInit() {
        this.loadData();
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

    /** Returns the guest at a specific seat of a table */
    getGuestAtSeat(tableId: number, seatIndex: number): Guest | undefined {
        return this.guests().find(g => Number(g.tableId) === tableId && g.seatNumber === seatIndex);
    }

    async onDrop(event: CdkDragDrop<any>) {
        const guest = event.item.data as Guest;
        let targetData = event.container.data;

        // Normalizar destino
        let tableId: number | null = null;
        let seatNumber: number | null = null;

        if (targetData === undefined) {
            // Cola de recepción
            tableId = null;
            seatNumber = null;
        } else if (typeof targetData === 'number') {
            // Dropped on the table background (auto-assign seat)
            tableId = targetData;
            const table = this.tables().find(t => t.id === tableId);
            if (table) {
                const currentGuestId = this.guestKey(guest);
                // Find first free seat (excluding the dragged guest's current position)
                for (let i = 0; i < table.capacity; i++) {
                    const occupant = this.getGuestAtSeat(tableId, i);
                    if (!occupant || this.guestKey(occupant) === currentGuestId) {
                        seatNumber = i;
                        break;
                    }
                }
            }
        } else if (targetData && typeof targetData === 'object') {
            // Dropped on a specific seat
            tableId = targetData.tableId;
            seatNumber = targetData.seatIndex;
        }

        if (!guest) return;

        const guestId = guest.id || guest.email || guest.phone;
        if (!guestId) return;

        // Si ya hay alguien en ese asiento de esa mesa, y venimos de otro sitio, swap
        if (tableId !== null && seatNumber !== null) {
            const existingGuest = this.getGuestAtSeat(tableId, seatNumber);
            if (existingGuest && this.guestKey(existingGuest) !== guestId) {
                // Swap: move the existing guest to the previous seat of the dragged guest
                const prevTableId = (guest.tableId !== undefined && guest.tableId !== 0) ? Number(guest.tableId) : null;
                const prevSeatNumber = (guest.seatNumber !== undefined && guest.seatNumber !== null) ? Number(guest.seatNumber) : null;
                const existingGuestId = this.guestKey(existingGuest);

                // Mover al que ya estaba de forma asíncrona pero sin bloquear el flujo principal
                this.guestService.updateGuestTable(existingGuestId, prevTableId, prevSeatNumber);
            }
        }

        try {
            await this.guestService.updateGuestTable(guestId, tableId, seatNumber);

            // Trigger sit-down animation
            if (tableId !== null) {
                const sid = guest.id ?? guest.email ?? guest.phone;
                if (sid) {
                    this.newlySeatedIds.update(s => new Set([...s, sid]));
                    setTimeout(() => {
                        this.newlySeatedIds.update(s => { const n = new Set(s); n.delete(sid); return n; });
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
        const guestId = guest?.id;
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
        this.isEditingGuest.set(false);
        this.editingGuestId.set(null);
        this.newGuest.set({
            name: '',
            email: '',
            phone: '',
            attending: 1,
            mealType: 'normal',
            needsTransport: false,
            isSavedInBbdd: false
        });
        this.showAddModal.set(true);
    }

    closeAddModal() {
        this.showAddModal.set(false);
        this.isEditingGuest.set(false);
        this.editingGuestId.set(null);
    }

    updateNewGuestField(field: keyof Guest, value: any) {
        this.newGuest.update(guest => ({ ...guest, [field]: value }));
    }

    openEditModal(guest: Guest) {
        this.isEditingGuest.set(true);
        this.editingGuestId.set(guest.id || null);
        this.newGuest.set({ ...guest });
        this.showAddModal.set(true);
    }

    async saveGuest() {
        const guestData = this.newGuest();
        if (!guestData.name) {
            this.triggerAlert('Nombre Requerido', 'Por favor, rellena al menos el nombre del invitado.');
            return;
        }

        try {
            this.isLoading.set(true);

            if (this.isEditingGuest() && this.editingGuestId()) {
                await this.guestService.updateGuest(this.editingGuestId()!, guestData);
            } else {
                await this.guestService.registerGuest(guestData);
            }

            // Al guardar, el servicio ya actualiza la señal

            this.closeAddModal();
        } catch (error) {
            console.error('Error saving guest:', error);
            this.triggerAlert('Error de Guardado', 'Hubo un problema al guardar los datos. Por favor, inténtalo de nuevo.');
        } finally {
            this.isLoading.set(false);
        }
    }

    triggerAlert(title: string, message: string) {
        this.genericModalTitle.set(title);
        this.genericModalMessage.set(message);
        this.showGenericModal.set(true);
    }

    closeGenericModal() {
        this.showGenericModal.set(false);
    }
    openCreateTableModal() {
        const currentTables = this.tableService.tables();
        const suggestedName = `Mesa ${currentTables.length + 1}`;

        this.newTableData.set({
            name: suggestedName,
            capacity: this.maxGuests() || 10,
            shape: 'round'
        });
        this.showCreateTableModal.set(true);
    }

    closeCreateTableModal() {
        this.showCreateTableModal.set(false);
    }

    updateNewTableField(field: string, value: any) {
        this.newTableData.update(data => ({ ...data, [field]: value }));
    }

    async confirmAddTable() {
        const data = this.newTableData();
        const currentTables = this.tableService.tables();

        // Validación: Nombre duplicado
        const duplicate = currentTables.find(t => (t.name || '').toLowerCase() === data.name.trim().toLowerCase());
        if (duplicate) {
            this.triggerAlert('Nombre Duplicado', `Ya existe una mesa con el nombre "${data.name}". Por favor, elige uno diferente.`);
            return;
        }

        const nextId = currentTables.length > 0 ? Math.max(...currentTables.map(t => t.id)) + 1 : 1;

        try {
            this.isLoading.set(true);
            await firstValueFrom(this.tableService.addTable({
                id: nextId,
                name: data.name || `Mesa ${currentTables.length + 1}`,
                capacity: data.capacity,
                shape: data.shape as any
            }));
            this.closeCreateTableModal();
        } catch (error) {
            console.error('Error adding table:', error);
            // Fallback local
            this.tableService.tables.update(t => [...t, {
                id: nextId,
                name: data.name,
                shape: data.shape as any,
                capacity: data.capacity
            }]);
            this.closeCreateTableModal();
        } finally {
            this.isLoading.set(false);
        }
    }

    async toggleTableShape(id: number, currentShape: string) {
        const shapes: ('round' | 'square' | 'rectangular' | 'presidential')[] =
            ['round', 'square', 'rectangular', 'presidential'];
        const nextIndex = (shapes.indexOf(currentShape as any) + 1) % shapes.length;
        const newShape = shapes[nextIndex];

        // Actualización optimista local
        this.tableService.tables.update(current =>
            current.map(t => t.id === id ? { ...t, shape: newShape } : t)
        );

        try {
            await firstValueFrom(this.tableService.updateTable(id, { shape: newShape }));
        } catch (error) {
            console.error('Error updating table shape:', error);
        }
    }

    onTableDragEnded(event: any, tableId: number) {
        if (!this.isEditLayoutMode()) return;

        const element = event.source.getRootElement();
        const parentElement = document.querySelector('.tables-grid');

        if (!parentElement) return;

        const parentRect = parentElement.getBoundingClientRect();
        const elementRect = element.getBoundingClientRect();

        // Calcular posición exacta relativa al contenedor padre (.tables-grid)
        const posX = Math.round(elementRect.left - parentRect.left);
        const posY = Math.round(elementRect.top - parentRect.top);

        // Actualización optimista local en el servicio
        this.tableService.tables.update(current =>
            current.map(t => t.id === tableId ? { ...t, posX, posY } : t)
        );

        // Resetear la transformación del CDK para que el elemento se posicione puramente por style.left/top
        event.source.reset();

        // Persistir en servidor con los valores exactos calculados
        this.tableService.updateTable(tableId, { posX, posY }).subscribe({
            error: (err) => console.error('Error saving table position:', err)
        });
    }

    toggleEditLayout() {
        const enteringEditMode = !this.isEditLayoutMode();

        if (enteringEditMode) {
            // CAPTURA: Antes de activar el modo absoluto, guardamos dónde están las mesas en el grid
            const grid = document.querySelector('.tables-grid');
            if (grid) {
                const containers = grid.querySelectorAll('.table-container') as NodeListOf<HTMLElement>;
                const updates: any[] = [];

                containers.forEach(container => {
                    const id = Number(container.getAttribute('data-table-id'));
                    if (id) {
                        // Capturamos el offset respecto al grid
                        updates.push({
                            id,
                            posX: container.offsetLeft,
                            posY: container.offsetTop
                        });
                    }
                });

                if (updates.length > 0) {
                    this.tableService.tables.update(current =>
                        current.map(t => {
                            const match = updates.find(u => u.id === t.id);
                            return match ? { ...t, posX: match.posX, posY: match.posY } : t;
                        })
                    );
                }
            }
        }

        this.isEditLayoutMode.set(enteringEditMode);
    }

    async updateTableCapacity(id: number, newCapacity: number) {
        const table = this.tables().find(t => t.id === id);
        if (!table) return;

        // Identificar invitados que están en asientos que van a desaparecer
        const guestsInRemovedSeats = table.guests.filter(g =>
            g.seatNumber !== undefined && g.seatNumber !== null && g.seatNumber >= newCapacity
        );

        // Si quedan más invitados que la nueva capacidad (ej. invitados sin asiento específico), también los sacamos
        const validGuests = table.guests.filter(g => !guestsInRemovedSeats.includes(g));
        const extraGuestsToUnassign = validGuests.length > newCapacity ? validGuests.slice(newCapacity) : [];

        const overflowingGuests = [...guestsInRemovedSeats, ...extraGuestsToUnassign];

        // Unassign overflowing guests
        for (const guest of overflowingGuests) {
            if (guest.id) {
                await this.guestService.updateGuestTable(guest.id, null);
            }
        }

        // Actualización optimista local de la mesa
        this.tableService.tables.update(current =>
            current.map(t => t.id === id ? { ...t, capacity: newCapacity } : t)
        );

        try {
            await firstValueFrom(this.tableService.updateTable(id, { capacity: newCapacity }));
        } catch (error) {
            console.error('Error updating table capacity:', error);
        }
    }

    startEditingTable(id: number, currentName: string | undefined) {
        this.editingName.set(currentName || `Mesa ${id}`);
        this.editingTableId.set(id);
    }

    async saveTableName(id: number) {
        const newName = this.editingName().trim();

        if (!newName) {
            this.editingTableId.set(null);
            return;
        }

        // Validación: Nombre duplicado (excluyendo la mesa actual)
        const currentTables = this.tableService.tables();
        const duplicate = currentTables.find(t => t.id !== id && (t.name || '').toLowerCase() === newName.toLowerCase());

        if (duplicate) {
            this.triggerAlert('Nombre Duplicado', `Ya existe otra mesa con el nombre "${newName}".`);
            this.editingTableId.set(null);
            return;
        }

        this.editingTableId.set(null);

        // Actualización optimista local
        this.tableService.tables.update(current =>
            current.map(t => t.id === id ? { ...t, name: newName } : t)
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
        this.tableService.tables.update(current => current.filter(t => t.id !== id));

        // Actualizar invitados localmente (se podría mover al servicio pero aquí es mesa-específico)
        this.guestService.guests.update(list => list.map(g => g.tableId === id ? { ...g, tableId: null } : g));

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
        const table = this.tableService.tables().find(t => t.id === id);
        return table?.name || `Mesa ${id}`;
    }

    closeFullTableModal() {
        this.showFullTableModal.set(false);
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
    getRectTableWidth(capacity: number, shape: string): number {
        const seatsPerSide = shape === 'presidential' ? capacity : Math.ceil(capacity / 2);
        const spacing = this.getRectSeatSpacing(capacity, shape);
        return seatsPerSide * spacing + 20; // 20px padding total
    }
}
