import { Component, Input, computed, inject, input } from '@angular/core';

import { WeddingStats } from '../../../services/stats.service';
import { SettingsService } from '../../../services/settings.service';

@Component({
    selector: 'app-attendance-progress',
    standalone: true,
    imports: [],
    templateUrl: './attendance-progress.component.html',
    styleUrl: './attendance-progress.component.css'
})
export class AttendanceProgressComponent {
    private settingsService = inject(SettingsService);

    stats = input.required<WeddingStats | null>();

    totalEstimatedGuests = computed(() => this.settingsService.settings().total_estimated_guests || 0);

    attendancePercentage = computed(() => {
        const estimated = this.totalEstimatedGuests();
        if (estimated === 0) return 0;
        const stats = this.stats();
        if (!stats) return 0;

        // Total responses: confirmed + declined (pending are those who still haven't answered)
        const confirmed = stats.confirmed || 0;
        const declined = stats.declined || 0;
        const totalResponses = confirmed + declined;
        return Math.min(Math.round((totalResponses / estimated) * 100), 100);
    });

    confirmedPercentage = computed(() => {
        const estimated = this.totalEstimatedGuests();
        if (estimated === 0) return 0;
        const stats = this.stats();
        if (!stats) return 0;

        const confirmed = stats.confirmed || 0;
        return Math.min(Math.round((confirmed / estimated) * 100), 100);
    });
}
