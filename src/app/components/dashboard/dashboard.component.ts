import { Component, OnInit, OnDestroy, inject, signal, computed, HostListener } from '@angular/core';
import { Router } from '@angular/router';
import { Location } from '@angular/common';

import { StatsService, WeddingStats } from '../../services/stats.service';
import { AuthService } from '../../services/auth.service';
import { TablesComponent } from './tables/tables.component';
import { SettingsComponent } from '../settings/settings.component';
import { FinancesComponent } from './finances/finances.component';
import { AttendanceProgressComponent } from './attendance-progress/attendance-progress.component';
import { Guest, GuestService } from '../../services/guest.service';
import { SettingsService } from '../../services/settings.service';
import { DragDropModule } from '@angular/cdk/drag-drop';
import { TodosComponent } from './todos/todos.component';
import { VersionService } from '../../services/version.service';
import { ContactsComponent } from './contacts/contacts.component';
import { MusicComponent } from './music/music.component';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [TablesComponent, SettingsComponent, FinancesComponent, AttendanceProgressComponent, DragDropModule, TodosComponent, ContactsComponent, MusicComponent],
    templateUrl: './dashboard.component.html',
    styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit, OnDestroy {
    private statsService = inject(StatsService);
    private guestService = inject(GuestService);
    private authService = inject(AuthService);
    private settingsService = inject(SettingsService);
    versionService = inject(VersionService);
    private router = inject(Router);
    private location = inject(Location);

    stats = signal<WeddingStats | null>(null);
    allergiesCount = signal<number | null>(null);

    // Invitados que han marcado que no asisten
    declinedGuestsList = computed(() => {
        const guests = this.guestService.guests();
        return guests.filter(g => g.attending === 0 || g.attendance === false);
    });

    // Invitados confirmados
    confirmedGuestsList = computed(() => {
        const guests = this.guestService.guests();
        return guests.filter(g => g.attending === 1 && g.attendance !== false);
    });

    // Invitados adultos
    adultsGuestsList = computed(() => {
        const guests = this.guestService.guests();
        return guests.filter(g => g.attending !== 0 && g.isAdult === 1);
    });

    // Invitados niños
    childrenGuestsList = computed(() => {
        const guests = this.guestService.guests();
        return guests.filter(g => g.attending !== 0 && g.isAdult === 0);
    });

    // Invitados sin asignar
    unassignedGuestsList = computed(() => {
        const guests = this.guestService.guests();
        return guests.filter(g => g.attending !== 0 && (!g.tableId || g.tableId === 0));
    });

    // Invitados que necesitan transporte
    transportGuestsList = computed(() => {
        const guests = this.guestService.guests();
        return guests.filter(g => g.attending !== 0 && g.needsTransport === true);
    });

    // Invitados con alergias
    allergiesGuestsList = computed(() => {
        const guests = this.guestService.guests();
        return guests.filter(g => g.attending !== 0 && g.allergies && g.allergies.trim() !== '');
    });

    // Modal genérico para mostrar listas de invitados
    showGuestsModal = signal(false);
    modalTitle = signal('');
    modalGuestsList = signal<Guest[]>([]);
    modalShowActions = signal(false); // Para mostrar/ocultar botones de acción

    showDeclinedGuestsModal = signal(false);

    // Automatic count based on the shared signal in GuestService
    unassignedGuestsCount = computed(() => {
        const guests = this.guestService.guests();
        return guests.filter(g => g.attending !== 0 && (!g.tableId || g.tableId === 0)).length;
    });

    sentGuestsCount = computed(() => {
        const guests = this.guestService.guests();
        // exclude declines
        return guests.filter(g => g.attending !== 0 && g.tableId && g.tableId !== 0).length;
    });

    // total shown to the user (exclude declined)
    displayTotal = computed(() => {
        const s = this.stats();
        if (!s) return 0;
        const declined = s.declined || 0;
        return s.total - declined;
    });

    childrenCount = computed(() => {
        const guests = this.guestService.guests();
        return guests
            .filter(g => g.attending !== 0) // Exclude declined guests
            .reduce((total, guest: Guest) => {
                const childrenFromRsvp = Number(guest.children) || 0;
                return total + (childrenFromRsvp > 0 ? childrenFromRsvp : guest.isAdult === 1 ? 0 : 1);
            }, 0);
    });

    adultsCount = computed(() => {
        const guests = this.guestService.guests();
        return guests
            .filter(g => g.attending !== 0) // Exclude declined guests
            .reduce((total, guest: Guest) => {
                const adultsFromRsvp = Number(guest.adults) || 0;
                return total + (adultsFromRsvp > 0 ? adultsFromRsvp : guest.isAdult === 1 ? 1 : 0);
            }, 0);
    });


    pendings = computed(() => {
        const estimated = this.settingsService.settings().total_estimated_guests || 0;
        const confirmed = this.stats()?.confirmed || 0;
        const declined = this.stats()?.declined || 0;
        return estimated - confirmed - declined;
    });

    isLoading = signal(true);
    error = signal<string | null>(null);
    currentView = signal<'stats' | 'tables' | 'settings' | 'finances' | 'todos' | 'contacts' | 'music'>('stats');
    isMenuOpen = signal(false);
    showExitConfirm = signal(false);

    ngOnInit() {
        this.loadStats();
        this.settingsService.loadSettings().subscribe();

        // Restore persisted view and menu state
        try {
            const savedView = localStorage.getItem('dashboard.currentView');
            if (savedView && ['stats','tables','settings','finances','todos','contacts','music'].includes(savedView)) {
                this.currentView.set(savedView as any);
            }
        } catch (e) {
            // ignore
        }

        try {
            const menu = localStorage.getItem('dashboard.isMenuOpen');
            if (menu === 'true') this.isMenuOpen.set(true);
        } catch (e) {
            // ignore
        }

        // Intercept browser back (popstate) using a native listener and Angular's
        // Location service. This lets us act before Router starts a navigation
        // and avoids using setTimeout hacks.
        // Push a guard state so the first "back" pops to this entry and
        // allows us to intercept the action and show a modal instead of
        // leaving the app.
        try {
            // Push two states: first the guard, then a normal empty state on top.
            // When the user presses back, the popped state's `event.state` will
            // be the guard state, which we can detect reliably.
            history.pushState({ dashboardGuard: true }, '', window.location.href);
            history.pushState({}, '', window.location.href);
        } catch (e) {
            // ignore
        }

        // Fallback native listeners for extra visibility in some browsers/UI
        this._nativePopListener = (ev: PopStateEvent) => {
            this.onPopState(ev);
        };
        window.addEventListener('popstate', this._nativePopListener);
    }

    private _nativePopListener: ((e: PopStateEvent) => void) | null = null;
    private _beforeUnloadListener: ((e: BeforeUnloadEvent) => void) | null = null;

    ngOnDestroy() {
        if (this._nativePopListener) {
            window.removeEventListener('popstate', this._nativePopListener);
            this._nativePopListener = null;
        }
        if (this._beforeUnloadListener) {
            window.removeEventListener('beforeunload', this._beforeUnloadListener);
            this._beforeUnloadListener = null;
        }
    }

    @HostListener('window:popstate', ['$event'])
    onPopState(ev: PopStateEvent) {
        const target = this.location.path() || '/';

        // If the popstate event's state is our guard, the user pressed back
        // from the app shell — show exit confirmation and re-insert the
        // top-of-stack empty state to keep the user on the dashboard.
        if (ev && (ev.state as any)?.dashboardGuard === true) {
            try { history.pushState({}, '', window.location.href); } catch (e) { /* ignore */ }
            this.showExitConfirm.set(true);
            return;
        }

        // Otherwise, ignore (internal navigations will proceed normally).
    }

    confirmExit() {
        this.showExitConfirm.set(false);
        // perform logout and navigate to login
        this.authService.logout();
        // navigate to login (replace history) then allow one back to proceed
        this.router.navigate(['/login'], { replaceUrl: true }).then(() => {
            try { history.back(); } catch (e) { /* ignore */ }
        });
    }

    cancelExit() {
        this.showExitConfirm.set(false);
    }

    toggleMenu() {
        this.isMenuOpen.update(v => !v);
        try { localStorage.setItem('dashboard.isMenuOpen', String(this.isMenuOpen())); } catch (e) { /* ignore */ }
    }

    closeMenu() {
        this.isMenuOpen.set(false);
        try { localStorage.setItem('dashboard.isMenuOpen', 'false'); } catch (e) { /* ignore */ }
    }

    loadStats() {
        this.isLoading.set(true);
        this.statsService.getStats().subscribe({
            next: async (data) => {
                // Soporte para respuestas envueltas en un objeto 'data'
                const finalData = (data as any).data || data;

                // ensure we have guests before computing declined fallback
                try {
                    await this.guestService.loadGuests();
                } catch {
                    // ignore errors, we'll compute from whatever we have
                }

                if (finalData.declined === undefined || finalData.declined === null) {
                    const guests = this.guestService.guests();
                    finalData.declined = guests.filter(g => g.attending === 0).length;
                }

                this.stats.set(finalData);

                // cargar alergias (no depende de invitados)
                this.statsService.getAllergiesStats().subscribe({
                    next: (res: any) => {
                        const items = res.data || res;
                        let totalAllergies = 0;
                        if (Array.isArray(items)) {
                            items.forEach((item: any) => {
                                if (item && typeof item.count === 'number') {
                                    totalAllergies += item.count;
                                } else {
                                    totalAllergies += 1;
                                }
                            });
                        } else if (items && typeof items.count === 'number') {
                            totalAllergies = items.count;
                        }
                        this.allergiesCount.set(totalAllergies);
                    },
                    error: () => {
                        // ignore
                    }
                });

                this.isLoading.set(false);
            },
            error: (err) => {
                console.error('Error fetching stats:', err);
                this.error.set('No se pudieron cargar las estadísticas.');
                this.isLoading.set(false);
            }
        });
    }

    setView(view: 'stats' | 'tables' | 'settings' | 'finances' | 'todos' | 'contacts' | 'music') {
        this.currentView.set(view);
        try { localStorage.setItem('dashboard.currentView', view); } catch (e) { /* ignore */ }
        this.closeMenu();
    }

    logout() {
        this.closeMenu();
        this.showExitConfirm.set(true);
    }

    openDeclinedGuestsModal() {
        this.showDeclinedGuestsModal.set(true);
    }

    closeDeclinedGuestsModal() {
        this.showDeclinedGuestsModal.set(false);
    }

    // Métodos para abrir el modal genérico con diferentes listas
    openGuestsModal(type: 'confirmed' | 'adults' | 'children' | 'unassigned' | 'transport' | 'allergies') {
        let title = '';
        let guestsList: Guest[] = [];

        switch(type) {
            case 'confirmed':
                title = 'Invitados Confirmados';
                guestsList = this.confirmedGuestsList();
                break;
            case 'adults':
                title = 'Invitados Adultos';
                guestsList = this.adultsGuestsList();
                break;
            case 'children':
                title = 'Invitados Niños';
                guestsList = this.childrenGuestsList();
                break;
            case 'unassigned':
                title = 'Invitados Sin Asignar';
                guestsList = this.unassignedGuestsList();
                break;
            case 'transport':
                title = 'Invitados que Necesitan Transporte';
                guestsList = this.transportGuestsList();
                break;
            case 'allergies':
                title = 'Invitados con Alergias';
                guestsList = this.allergiesGuestsList();
                break;
        }

        this.modalTitle.set(title);
        this.modalGuestsList.set(guestsList);
        this.modalShowActions.set(false); // Sin botones de acción
        this.showGuestsModal.set(true);
    }

    closeGuestsModal() {
        this.showGuestsModal.set(false);
        this.modalGuestsList.set([]);
    }

    async moveDeclinedToUnassigned(guest: Guest) {
        const guestId = guest.id || guest.email || guest.phone;
        if (!guestId) return;

        try {
            await this.guestService.updateGuest(guestId, {
                attending: 1,
                attendance: true,
                tableId: null,
                seatNumber: null
            });
        } catch (err) {
            console.error('Error moving declined guest to unassigned:', err);
        }
    }

    async deleteDeclinedGuest(guest: Guest) {
        const guestId = guest.id || guest.email || guest.phone;
        if (!guestId) return;

        try {
            await this.guestService.deleteGuest(guestId);
        } catch (err) {
            console.error('Error deleting declined guest:', err);
        }
    }
}
