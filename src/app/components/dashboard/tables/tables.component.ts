import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GuestService, Guest } from '../../../services/guest.service';
import { SettingsService } from '../../../services/settings.service';
import { TableService, TableConfig } from '../../../services/table.service';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

@Component({
    selector: 'app-tables',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './tables.component.html',
    styleUrl: './tables.component.css'
})
export class TablesComponent implements OnInit {
    private guestService = inject(GuestService);
    private settingsService = inject(SettingsService);
    private tableService = inject(TableService);

    guests = signal<Guest[]>([]);
    maxGuests = computed(() => this.settingsService.settings().max_guests_per_table);

    isLoading = signal(true);
    draggedGuest: Guest | null = null;

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
        shape: 'round' as 'round' | 'square'
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

    // Organizar invitados por mesa siguiendo ESTRICTAMENTE la configuración
    tables = computed(() => {
        const guestList = this.guests();
        const configs = this.tableService.tables();

        if (!Array.isArray(configs)) return [];

        return configs.map(config => ({
            id: config.id,
            name: config.name,
            capacity: config.capacity || this.maxGuests(),
            shape: config.shape || 'round',
            guests: guestList.filter(g => Number(g.tableNumber) === Number(config.id))
        })).sort((a, b) => a.id - b.id);
    });

    unassignedGuests = computed(() => {
        const guestList = this.guests();
        const tableConfigs = this.tableService.tables();
        const validTableIds = new Set(Array.isArray(tableConfigs) ? tableConfigs.map(t => Number(t.id)) : []);

        return guestList.filter(g =>
            !g.tableNumber ||
            g.tableNumber === 0 ||
            !validTableIds.has(Number(g.tableNumber))
        );
    });

    ngOnInit() {
        this.loadData();
    }

    async loadData() {
        this.isLoading.set(true);
        try {
            const list = await this.guestService.loadGuests();
            console.log('📋 Guest List Received:', list);

            if (list.length > 0) {
                console.log('🔍 Sample Guest:', list[0]);
            }

            this.guests.set(list);

            this.settingsService.loadSettings().subscribe();
            this.tableService.loadTables().subscribe();
        } catch (error) {
            console.error('Error loading tables data:', error);
        } finally {
            this.isLoading.set(false);
        }
    }

    updateMaxGuests(val: number) {
        this.settingsService.updateMaxGuests(val).subscribe();
    }

    // --- HTML5 Drag & Drop Handlers ---

    onDragStart(guest: Guest) {
        this.draggedGuest = guest;
    }

    onDragOver(event: DragEvent) {
        event.preventDefault();
    }

    async onDrop(tableNumber: number | null) {
        if (!this.draggedGuest) return;

        // Validar capacidad de la mesa destino
        if (tableNumber !== null) {
            const targetTable = this.tables().find(t => t.id === tableNumber);
            if (targetTable && targetTable.guests.length >= targetTable.capacity) {
                // Solo bloqueamos si el invitado NO estaba ya en esta mesa
                if (this.draggedGuest.tableNumber !== tableNumber) {
                    this.fullTableName.set(targetTable.name || `Mesa ${tableNumber}`);
                    this.fullTableCapacity.set(targetTable.capacity);
                    this.showFullTableModal.set(true);
                    this.draggedGuest = null;
                    return;
                }
            }
        }

        const guest = this.draggedGuest;
        const guestId = guest.id || guest.email || guest.phone; // Fallback a email/phone si no hay ID

        if (!guestId) return;

        // Actualización optimista
        this.guests.update(list =>
            list.map(g => (g === guest ? { ...g, tableNumber: tableNumber || 0 } : g))
        );

        try {
            await this.guestService.updateGuestTable(guestId, tableNumber);
        } catch (error) {
            console.error('Error updating guest table:', error);
            // Revertir si falla (opcional, para simpleza no lo haremos aquí si no hay ID real)
        }

        this.draggedGuest = null;
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
            this.guests.update(list => list.filter(g => g.id !== guestId));
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

            // Recargar datos para ver los cambios
            const updatedList = await this.guestService.loadGuests();
            this.guests.set(updatedList);

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
        const nextId = currentTables.length > 0 ? Math.max(...currentTables.map(t => t.id)) + 1 : 1;

        this.newTableData.set({
            name: `Mesa ${nextId}`,
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
        const nextId = currentTables.length > 0 ? Math.max(...currentTables.map(t => t.id)) + 1 : 1;

        try {
            this.isLoading.set(true);
            await firstValueFrom(this.tableService.addTable({
                id: nextId,
                name: data.name,
                capacity: data.capacity,
                shape: data.shape
            }));
            this.closeCreateTableModal();
        } catch (error) {
            console.error('Error adding table:', error);
            // Fallback local
            this.tableService.tables.update(t => [...t, {
                id: nextId,
                name: data.name,
                shape: data.shape,
                capacity: data.capacity
            }]);
            this.closeCreateTableModal();
        } finally {
            this.isLoading.set(false);
        }
    }

    async toggleTableShape(id: number, currentShape: 'round' | 'square') {
        const newShape = currentShape === 'round' ? 'square' : 'round';
        // Actualización optimista local
        this.tableService.tables.update(current =>
            current.map(t => t.id === id ? { ...t, shape: newShape } : t)
        );

        try {
            await firstValueFrom(this.tableService.updateTable(id, { shape: newShape }));
        } catch (error) {
            console.error('Error updating table shape:', error);
            // Si falla la API y no tenemos modo offline real, el usuario al menos vio el cambio.
        }
    }

    async updateTableCapacity(id: number, newCapacity: number) {
        // Actualización optimista local
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
        this.editingTableId.set(null);

        if (!newName) return;

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

        // Actualizar invitados localmente para que no parezca que siguen en la mesa eliminada
        this.guests.update(list => list.map(g => g.tableNumber === id ? { ...g, tableNumber: 0 } : g));

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
}
