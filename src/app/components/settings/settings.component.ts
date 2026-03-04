import { Component, inject, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../../services/settings.service';

@Component({
    selector: 'app-settings',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './settings.component.html',
    styleUrl: './settings.component.css'
})
export class SettingsComponent implements OnInit {
    private settingsService = inject(SettingsService);

    /** Value shared across the app */
    maxGuests = computed(() => this.settingsService.settings().max_guests_per_table);
    totalEstimatedGuests = computed(() => this.settingsService.settings().total_estimated_guests || 0);

    ngOnInit() {
        // make sure we have the latest values from backend
        this.settingsService.loadSettings().subscribe();
    }

    updateMaxGuests(val: number) {
        // delegate to service; component doesn't need to know about HTTP details
        this.settingsService.updateMaxGuests(val).subscribe();
    }

    updateTotalEstimatedGuests(val: number) {
        this.settingsService.updateTotalEstimatedGuests(val).subscribe();
    }
}
