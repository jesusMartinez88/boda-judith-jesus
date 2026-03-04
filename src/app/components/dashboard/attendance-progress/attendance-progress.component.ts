import { Component, Input, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { WeddingStats } from '../../../services/stats.service';
import { SettingsService } from '../../../services/settings.service';

@Component({
    selector: 'app-attendance-progress',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './attendance-progress.component.html',
    styleUrl: './attendance-progress.component.css'
})
export class AttendanceProgressComponent {
    private settingsService = inject(SettingsService);

    @Input({ required: true }) stats: WeddingStats | null = null;

    totalEstimatedGuests = computed(() => this.settingsService.settings().total_estimated_guests || 0);

    attendancePercentage = computed(() => {
        const estimated = this.totalEstimatedGuests();
        if (estimated === 0) return 0;
        const stats = this.stats;
        if (!stats) return 0;

        // Total responses (confirmed + pending)
        const totalGuests = (stats.confirmed || 0) + (stats.pending || 0);
        return Math.min(Math.round((totalGuests / estimated) * 100), 100);
    });

    confirmedPercentage = computed(() => {
        const estimated = this.totalEstimatedGuests();
        if (estimated === 0) return 0;
        const stats = this.stats;
        if (!stats) return 0;

        const confirmed = stats.confirmed || 0;
        return Math.min(Math.round((confirmed / estimated) * 100), 100);
    });
}
