import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StatsService, WeddingStats } from '../../services/stats.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';
import { TablesComponent } from './tables/tables.component';
import { SettingsComponent } from '../settings/settings.component';
import { FinancesComponent } from './finances/finances.component';
import { AttendanceProgressComponent } from './attendance-progress/attendance-progress.component';
import { Guest, GuestService } from '../../services/guest.service';
import { SettingsService } from '../../services/settings.service';
import { DragDropModule } from '@angular/cdk/drag-drop';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, TablesComponent, SettingsComponent, FinancesComponent, AttendanceProgressComponent, DragDropModule],
    templateUrl: './dashboard.component.html',
    styleUrl: './dashboard.component.css'
})
export class DashboardComponent implements OnInit {
    private statsService = inject(StatsService);
    private guestService = inject(GuestService);
    private authService = inject(AuthService);
    private settingsService = inject(SettingsService);
    private router = inject(Router);

    stats = signal<WeddingStats | null>(null);
    allergiesCount = signal<number | null>(null);

    // Automatic count based on the shared signal in GuestService
    unassignedGuestsCount = computed(() => {
        const guests = this.guestService.guests();
        return guests.filter(g => !g.tableId || g.tableId === 0).length;
    });

    sentGuestsCount = computed(() => {
        const guests = this.guestService.guests();
        return guests.filter(g => g.tableId && g.tableId !== 0).length;
    });

    childrenCount = computed(() => {
        const guests = this.guestService.guests();
        return guests.reduce((total, guest: Guest) => {
            const childrenFromRsvp = Number(guest.children) || 0;
            return total + (childrenFromRsvp > 0 ? childrenFromRsvp : guest.isAdult === 1 ? 0 : 1);
        }, 0);
    });

    adultsCount = computed(() => {
        const guests = this.guestService.guests();
        return guests.reduce((total, guest: Guest) => {
            const adultsFromRsvp = Number(guest.adults) || 0;
            return total + (adultsFromRsvp > 0 ? adultsFromRsvp : guest.isAdult === 1 ? 1 : 0);
        }, 0);
    });

    pendings = computed(() => {
        const estimated = this.settingsService.settings().total_estimated_guests || 0;
        const confirmed = this.stats()?.confirmed || 0;
        return estimated - confirmed;
    });

    isLoading = signal(true);
    error = signal<string | null>(null);
    currentView = signal<'stats' | 'tables' | 'settings' | 'finances'>('stats');
    isMenuOpen = signal(false);

    ngOnInit() {
        this.loadStats();
        this.settingsService.loadSettings().subscribe();
    }

    toggleMenu() {
        this.isMenuOpen.update(v => !v);
    }

    closeMenu() {
        this.isMenuOpen.set(false);
    }

    loadStats() {
        this.isLoading.set(true);
        this.statsService.getStats().subscribe({
            next: (data) => {
                // Soporte para respuestas envueltas en un objeto 'data'
                const finalData = (data as any).data || data;
                this.stats.set(finalData);

                // Cargar también las alergias
                this.statsService.getAllergiesStats().subscribe({
                    next: (res: any) => {
                        // Soporte para datos envueltos en 'data'
                        const items = res.data || res;
                        let totalAllergies = 0;

                        if (Array.isArray(items)) {
                            // Sumar el atributo 'count' de cada item si existe, sino contar el item
                            items.forEach((item: any) => {
                                if (item && typeof item.count === 'number') {
                                    totalAllergies += item.count;
                                } else {
                                    // Fallback: si no tiene count pero es un item de la lista, contar como 1
                                    totalAllergies += 1;
                                }
                            });
                        } else if (items && typeof items.count === 'number') {
                            totalAllergies = items.count;
                        }

                        this.allergiesCount.set(totalAllergies);

                        // Simplemente cargar para disparar la actualización de la señal en el servicio
                        this.guestService.loadGuests().finally(() => {
                            this.isLoading.set(false);
                        });
                    },
                    error: () => {
                        this.isLoading.set(false);
                    }
                });
            },
            error: (err) => {
                console.error('Error fetching stats:', err);
                this.error.set('No se pudieron cargar las estadísticas.');
                this.isLoading.set(false);
            }
        });
    }

    setView(view: 'stats' | 'tables' | 'settings' | 'finances') {
        this.currentView.set(view);
        this.closeMenu();
    }

    logout() {
        this.authService.logout();
    }
}
