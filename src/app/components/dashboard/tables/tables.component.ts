import { Component, OnInit, inject, signal, computed, ViewChild, ElementRef } from '@angular/core';

import { GuestService, Guest } from '../../../services/guest.service';
import { SettingsService } from '../../../services/settings.service';
import { TableService, TableConfig } from '../../../services/table.service';
import { ReactiveFormsModule, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { DragDropModule, CdkDragDrop, CdkDragRelease } from '@angular/cdk/drag-drop';
import { firstValueFrom, Subscription } from 'rxjs';
import { TablesLegendComponent } from './tables-legend/tables-legend.component';
import { TablesHeaderComponent } from './tables-header/tables-header.component';
import { ExportPdfBtnComponent } from './export-pdf-btn/export-pdf-btn';

@Component({
    selector: 'app-tables',
    standalone: true,
    imports: [ReactiveFormsModule, TablesLegendComponent, TablesHeaderComponent, DragDropModule, ExportPdfBtnComponent],
    templateUrl: './tables.component.html',
    styleUrl: './tables.component.css'
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

    @ViewChild('hall') hallElement!: ElementRef;

    // Drag animation state
    draggingGuestId = signal<string | undefined>(undefined);
    newlySeatedIds = signal<Set<string>>(new Set());
    isReceivingGuest = signal<boolean>(false);

    // Modal para nuevo/editar invitado
    showAddModal = signal(false);
    isEditingGuest = signal(false);
    editingGuestId = signal<string | null>(null);
    guestForm: FormGroup = this.fb.group({
        name: ['', [Validators.required, Validators.minLength(3)]],
        email: ['', [Validators.email]],
        phone: [''],
        attendance: [true],
        isAdult: [1, [Validators.required]],
        mealType: ['normal', [Validators.required]],
        allergies: [''],
        notes: [''],
        needsTransport: [false]
    });

    // Modal para nueva mesa
    showCreateTableModal = signal(false);
    tableForm: FormGroup = this.fb.group({
        name: ['', [Validators.required, Validators.minLength(2)]],
        capacity: [10, [Validators.required, Validators.min(1), Validators.max(25)]],
        shape: ['round', [Validators.required]]
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
    editingNameControl = new FormControl<string>('', { nonNullable: true });

    searchTerm = signal<string>('');
    searchControl = new FormControl<string>('', { nonNullable: true });
    isEditLayoutMode = signal<boolean>(false);

    private capacityControls = new Map<number, FormControl<number>>();
    private capacitySubs = new Map<number, Subscription>();

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
                    if (g.attending === 0) return false;
                    const guestTableId = Number(g.tableId || 0);
                    if (guestTableId !== tableId || guestTableId === 0) return false;
                    // siempre mostrar únicamente invitados que ya tienen un número de asiento
                    return g.seatNumber !== null && g.seatNumber !== undefined;
                })
            };
        }).sort((a, b) => a.id - b.id);
    });

    unassignedGuests = computed(() => {
        const guestList = this.guests();
        const tableConfigs = this.tableService.tables();

        // Excluir siempre invitados que han rechazado
        const filteredList = guestList.filter(g => g.attending !== 0 && g.attendance !== false);

        // Si no hay mesas cargadas aún, todos se ven como sin asignar (excepto rechazados)
        if (!tableConfigs || tableConfigs.length === 0) return filteredList;

        const validTableIds = new Set(tableConfigs.map(t => Number(t.id)));

        return filteredList.filter(g => {
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
        currentTables.forEach(t => {
            if (t.posX !== undefined && t.posY !== undefined) {
                const width = (t.shape === 'rectangular' || t.shape === 'presidential')
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
        // Reactive search input -> signal
        this.searchControl.valueChanges.subscribe(v => this.searchTerm.set((v ?? '').toString()));
    }

    getCapacityControl(tableId: number, initialCapacity: number): FormControl<number> {
        const existing = this.capacityControls.get(tableId);
        if (existing) return existing;

        const ctrl = new FormControl<number>(Number(initialCapacity || 1), { nonNullable: true });
        this.capacityControls.set(tableId, ctrl);

        const sub = ctrl.valueChanges.subscribe(v => {
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
    onGuestDragEnded(event: any) {
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
        return this.guests().find(g => Number(g.tableId) === tableId && g.seatNumber === seatIndex);
    }

    async onDrop(event: CdkDragDrop<any>) {
        // Resetear el estado de recepción inmediatamente
        this.isReceivingGuest.set(false);
        
        const guest = event.item.data as Guest;
        let targetData = event.container.data;

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
            const table = this.tables().find(t => t.id === tableId);
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
                if(seatNumber === null) {
                  this.fullTableName.set(table?.name || '');
                  this.fullTableCapacity.set(table?.capacity || 0);
                  this.showFullTableModal.set(true);
                  return;
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
        this.isEditingGuest.set(false);
        this.editingGuestId.set(null);
        this.guestForm.reset({
            name: '',
            email: '',
            phone: '',
            attendance: true,
            isAdult: 1,
            mealType: 'normal',
            allergies: '',
            notes: '',
            needsTransport: false
        });
        this.showAddModal.set(true);
    }

    closeAddModal() {
        this.showAddModal.set(false);
        this.isEditingGuest.set(false);
        this.editingGuestId.set(null);
    }

    openEditModal(guest: Guest) {
        this.isEditingGuest.set(true);
        this.editingGuestId.set(guest.id || null);
        this.guestForm.reset({
            name: guest.name || '',
            email: guest.email || '',
            phone: guest.phone || '',
            attendance: guest.attendance !== false && guest.attending !== 0,
            isAdult: (guest.isAdult ?? 1),
            mealType: guest.mealType || 'normal',
            allergies: guest.allergies || '',
            notes: guest.notes || '',
            needsTransport: !!guest.needsTransport
        });
        this.showAddModal.set(true);
    }

    async saveGuest() {
        if (this.guestForm.invalid) {
            this.guestForm.markAllAsTouched();
            this.triggerAlert('Nombre Requerido', 'Por favor, rellena al menos el nombre del invitado.');
            return;
        }

        try {
            this.isLoading.set(true);

            const formValue = this.guestForm.value as any;
            const isAdult = Number(formValue.isAdult) === 1;
            const guestData: Guest = {
                name: (formValue.name || '').trim(),
                email: (formValue.email || '').trim(),
                phone: (formValue.phone || '').trim(),
                attendance: formValue.attendance !== false,
                isAdult: isAdult ? 1 : 0,
                adults: isAdult ? 1 : 0,
                children: isAdult ? 0 : 1,
                attending: (formValue.attendance === false) ? 0 : 1,
                mealType: formValue.mealType || 'normal',
                allergies: formValue.allergies || '',
                notes: formValue.notes || '',
                needsTransport: !!formValue.needsTransport,
                isSavedInBbdd: false
            };

            if (this.isEditingGuest() && this.editingGuestId()) {
                await this.guestService.updateGuest(this.editingGuestId()!, guestData);
            } else {
                // No mandar email en alta manual desde mesas
                (guestData as any).sendEmail = false;
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

        this.tableForm.reset({
            name: suggestedName,
            capacity: this.maxGuests() || 10,
            shape: 'round'
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
        const data = this.tableForm.value as any;
        const currentTables = this.tableService.tables();

        // Validación: Nombre duplicado
        const duplicate = currentTables.find(t => (t.name || '').toLowerCase() === String(data.name || '').trim().toLowerCase());
        if (duplicate) {
            this.triggerAlert('Nombre Duplicado', `Ya existe una mesa con el nombre "${data.name}". Por favor, elige uno diferente.`);
            return;
        }

        const nextId = currentTables.length > 0 ? Math.max(...currentTables.map(t => t.id)) + 1 : 1;

        try {
            this.isLoading.set(true);
            await firstValueFrom(this.tableService.addTable({
                id: nextId,
                name: String(data.name || `Mesa ${currentTables.length + 1}`),
                capacity: Number(data.capacity),
                shape: data.shape as any
            }));
            this.closeCreateTableModal();
        } catch (error) {
            console.error('Error adding table:', error);
            // Fallback local
            this.tableService.tables.update(t => [...t, {
                id: nextId,
                name: String(data.name || `Mesa ${currentTables.length + 1}`),
                shape: data.shape as any,
                capacity: Number(data.capacity)
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

        // Identificar invitados que están en asientos que van a desaparecer (1-indexed: asientos > newCapacity)
        const guestsInRemovedSeats = table.guests.filter(g =>
            g.seatNumber !== undefined && g.seatNumber !== null && g.seatNumber > newCapacity
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
    getRectTableWidth(capacity: number, shape: 'rectangular' | 'presidential' | 'round' | 'square'): number {
        if (shape !== 'rectangular' && shape !== 'presidential') return 0;
        const layoutSeats = shape === 'presidential' ? capacity : Math.ceil(capacity / 2);
        return (layoutSeats * 75) + 30; // 75px per seat slot + 30px padding
    }

    getSeatX(shape: string, capacity: number, seatIdx: number): number {
        if (shape === 'round') {
            const angle = (360 / capacity) * seatIdx;
            const rad = angle * Math.PI / 180;
            return 170 + (108 * Math.cos(rad));
        } else if (shape === 'square') {
            const radius = this.isBottomSeat(seatIdx, capacity) ? 125 : 112;
            const angle = (360 / capacity) * seatIdx;
            const rad = angle * Math.PI / 180;
            return 170 + (radius * Math.cos(rad));
        } else if (shape === 'rectangular') {
            const totalOnSide = Math.ceil(capacity / 2);
            const sideIndex = seatIdx % totalOnSide;
            const width = this.getRectTableWidth(capacity, 'rectangular') + 60;
            const seatSpacing = this.getRectSeatSpacing(capacity, shape);
            const translateX = (sideIndex - (totalOnSide - 1) / 2) * seatSpacing;
            return (width / 2) + translateX;
        } else if (shape === 'presidential') {
            const totalOnSide = capacity;
            const sideIndex = seatIdx;
            const width = this.getRectTableWidth(capacity, 'presidential') + 60;
            const seatSpacing = this.getRectSeatSpacing(capacity, shape);
            const translateX = (sideIndex - (totalOnSide - 1) / 2) * seatSpacing;
            return (width / 2) + translateX;
        }
        return 0;
    }

    getSeatY(shape: string, capacity: number, seatIdx: number): number {
        if (shape === 'round') {
            const angle = (360 / capacity) * seatIdx;
            const rad = angle * Math.PI / 180;
            return 170 + (108 * Math.sin(rad));
        } else if (shape === 'square') {
            const radius = this.isBottomSeat(seatIdx, capacity) ? 125 : 112;
            const angle = (360 / capacity) * seatIdx;
            const rad = angle * Math.PI / 180;
            return 170 + (radius * Math.sin(rad));
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
