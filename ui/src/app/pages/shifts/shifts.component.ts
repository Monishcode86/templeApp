import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { ShiftService } from '../../core/services/shift.service';
import { PlantService } from '../../core/services/plant.service';
import { Shift, Plant } from '../../core/models/auth.model';
import { TranslatePipe } from '../../core/services/translation.service';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-shifts',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, PaginationComponent],
  templateUrl: './shifts.component.html',
  styleUrls: ['./shifts.component.css']
})
export class ShiftsComponent implements OnInit, OnDestroy {
  private shiftService = inject(ShiftService);
  private plantService = inject(PlantService);

  shiftsList = signal<Shift[]>([]);
  plantsList = signal<Plant[]>([]);
  searchQuery = signal<string>('');
  filterPlantId = signal<string>('');
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);
  totalCount = signal<number>(0);

  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  modalError = signal<string | null>(null);

  // Modal State
  isModalOpen = signal<boolean>(false);
  isEditMode = signal<boolean>(false);
  editingShift = signal<Shift | null>(null);
  isDeleteConfirmOpen = signal<boolean>(false);
  shiftToDelete = signal<Shift | null>(null);
  isStartTimeLocked = signal<boolean>(false);
  remainingSeconds = signal<number>(86400); // total remaining capacity in seconds (24h = 86400s)

  // Form State
  formData = signal<{
    id?: string;
    shift_name: string;
    plant_id: string;
    plant_name: string;
    start_time: string;
    end_time: string;
  }>({
    shift_name: '',
    plant_id: '',
    plant_name: '',
    start_time: '',
    end_time: ''
  });

  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;

  ngOnInit(): void {
    this.loadPlants();
    this.loadShifts();

    this.searchSub = this.searchSubject
      .pipe(debounceTime(350), distinctUntilChanged())
      .subscribe(() => {
        this.currentPage.set(1);
        this.loadShifts();
      });
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  loadPlants(): void {
    this.plantService.getPlants().subscribe({
      next: (res) => {
        const plants = res.data || [];
        this.plantsList.set(plants);
        // Auto-select first plant on load (like user config)
        if (plants.length > 0 && !this.filterPlantId()) {
          this.filterPlantId.set(plants[0].plant_id);
          this.loadShifts();
        }
      },
      error: () => {}
    });
  }

  loadShifts(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.shiftService.getShifts({
      page: this.currentPage(),
      limit: this.pageSize(),
      search: this.searchQuery().trim() || undefined,
      plant_id: this.filterPlantId() || undefined
    }).subscribe({
      next: (res) => {
        this.shiftsList.set(res.data || []);
        this.totalCount.set(res.pagination?.total ?? (res.data || []).length);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Failed to fetch shifts.');
      }
    });
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadShifts();
  }

  onLimitChange(limit: number): void {
    this.pageSize.set(limit);
    this.currentPage.set(1);
    this.loadShifts();
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
    this.searchSubject.next(query.trim());
  }

  onFilterPlantChange(plantId: string): void {
    this.filterPlantId.set(plantId);
    this.currentPage.set(1);
    this.loadShifts();
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchSubject.next('');
  }

  /** When a plant is selected in the form, auto-fill plant_name and fetch last shift's end_time */
  onPlantSelect(plantId: string): void {
    const plant = this.plantsList().find(p => p.plant_id === plantId);
    this.formData.update(f => ({
      ...f,
      plant_id: plantId,
      plant_name: plant?.plant_name || '',
      start_time: ''
    }));
    this.isStartTimeLocked.set(false);
    if (plantId) {
      this.fetchAndSetLastShiftTime(plantId);
    }
  }

  /** Fetch shifts for the given plant, find the last one, and lock start_time to its end_time */
  private fetchAndSetLastShiftTime(plantId: string): void {
    this.shiftService.getShifts({ plant_id: plantId, limit: 100 }).subscribe({
      next: (res) => {
        const shifts = res.data || [];

        // Compute total allocated seconds
        const totalAllocated = shifts.reduce((sum, s) => {
          let end = this.toSeconds(s.end_time);
          const start = this.toSeconds(s.start_time);
          if (end <= start) end += 86400;
          return sum + (end - start);
        }, 0);
        this.remainingSeconds.set(Math.max(0, 86400 - totalAllocated));

        if (shifts.length > 0) {
          // Pick shift with highest shift_id as the "last" shift
          const lastShift = shifts.reduce((prev, curr) =>
            (curr.shift_id ?? 0) > (prev.shift_id ?? 0) ? curr : prev
          );
          this.formData.update(f => ({ ...f, start_time: this.normalizeTime(lastShift.end_time) }));
          this.isStartTimeLocked.set(true);
        }
      },
      error: () => {}
    });
  }

  openAddModal(): void {
    this.modalError.set(null);
    this.isEditMode.set(false);
    this.editingShift.set(null);
    this.isStartTimeLocked.set(false);

    const currentPlantId = this.filterPlantId();
    const currentPlant = this.plantsList().find(p => p.plant_id === currentPlantId);

    this.formData.set({
      shift_name: '',
      plant_id: currentPlantId,
      plant_name: currentPlant?.plant_name || '',
      start_time: '',
      end_time: ''
    });

    // Auto-fill start time from last shift's end time for current plant
    if (currentPlantId) {
      this.fetchAndSetLastShiftTime(currentPlantId);
    }

    this.isModalOpen.set(true);
  }

  openEditModal(shift: Shift): void {
    this.modalError.set(null);
    this.isEditMode.set(true);
    this.editingShift.set(shift);
    this.formData.set({
      id: shift._id,
      shift_name: shift.shift_name,
      plant_id: shift.plant_id,
      plant_name: shift.plant_name,
      start_time: this.normalizeTime(shift.start_time),
      end_time: this.normalizeTime(shift.end_time)
    });
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.modalError.set(null);
    this.isEditMode.set(false);
    this.editingShift.set(null);
    this.isStartTimeLocked.set(false);
    this.isModalOpen.set(false);
  }

  saveShift(): void {
    const data = this.formData();
    this.modalError.set(null);

    if (!data.shift_name?.trim()) {
      this.modalError.set('Shift name is required.');
      return;
    }

    this.isLoading.set(true);

    if (this.isEditMode() && data.id) {
      // Allow editing ONLY the shift name
      this.shiftService.updateShift(data.id, { shift_name: data.shift_name.trim() }).subscribe({
        next: () => {
          this.isLoading.set(false);
          this.closeModal();
          this.showSuccess('Shift name updated successfully.');
          this.loadShifts();
        },
        error: (err) => {
          this.isLoading.set(false);
          this.modalError.set(err.error?.message || 'Failed to update shift name.');
        }
      });
    } else {
      if (!data.plant_id) {
        this.isLoading.set(false);
        this.modalError.set('Please select a plant.');
        return;
      }
      if (!data.start_time || !data.end_time) {
        this.isLoading.set(false);
        this.modalError.set('Start time and end time are required.');
        return;
      }

      const payload = {
        ...data,
        start_time: this.normalizeTime(data.start_time),
        end_time: this.normalizeTime(data.end_time)
      };

      this.shiftService.createShift(payload).subscribe({
        next: () => {
          this.isLoading.set(false);
          this.closeModal();
          this.showSuccess('Shift created successfully.');
          this.loadShifts();
        },
        error: (err) => {
          this.isLoading.set(false);
          this.modalError.set(err.error?.message || 'Failed to create shift.');
        }
      });
    }
  }

  /** Check if a shift is the last shift for its plant (only last item can be deleted) */
  isLastShift(shift: Shift): boolean {
    if (shift.is_last !== undefined) {
      return shift.is_last;
    }
    const plantShifts = this.shiftsList().filter(s => s.plant_id === shift.plant_id);
    if (plantShifts.length === 0) return true;
    const maxId = Math.max(...plantShifts.map(s => s.shift_id ?? 0));
    return (shift.shift_id ?? 0) === maxId;
  }

  confirmDelete(shift: Shift): void {
    if (!this.isLastShift(shift)) {
      this.errorMessage.set('Cannot delete shift in the middle. Only the last shift for this plant can be deleted.');
      return;
    }
    this.shiftToDelete.set(shift);
    this.isDeleteConfirmOpen.set(true);
  }

  cancelDelete(): void {
    this.shiftToDelete.set(null);
    this.isDeleteConfirmOpen.set(false);
  }

  executeDelete(): void {
    const shift = this.shiftToDelete();
    if (!shift?._id) return;

    this.isLoading.set(true);
    this.shiftService.deleteShift(shift._id).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.cancelDelete();
        this.showSuccess('Shift deleted successfully.');
        this.loadShifts();
      },
      error: (err) => {
        this.isLoading.set(false);
        this.cancelDelete();
        this.errorMessage.set(err.error?.message || 'Failed to delete shift.');
      }
    });
  }

  /** Format HH:mm:ss display */
  formatTime(time: string): string {
    if (!time) return '-';
    return this.normalizeTime(time);
  }

  /** Calculate shift duration label */
  getDuration(start: string, end: string): string {
    if (!start || !end) return '';
    let diff = this.toSeconds(end) - this.toSeconds(start);
    if (diff <= 0) diff += 86400;
    const h = Math.floor(diff / 3600);
    const m = Math.floor((diff % 3600) / 60);
    const s = diff % 60;
    const parts: string[] = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0) parts.push(`${s}s`);
    return parts.length > 0 ? parts.join(' ') : '0s';
  }

  /** Format remainingSeconds into readable label */
  formatRemaining(): string {
    const sec = this.remainingSeconds();
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const parts: string[] = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0) parts.push(`${s}s`);
    return parts.length > 0 ? parts.join(' ') : '0s';
  }

  /** Percentage of day already allocated */
  allocatedPercent(): number {
    return Math.min(100, Math.round(((86400 - this.remainingSeconds()) / 86400) * 100));
  }

  private normalizeTime(timeStr: string): string {
    if (!timeStr) return '';
    const parts = timeStr.trim().split(':');
    const h = (parts[0] || '00').padStart(2, '0');
    const m = (parts[1] || '00').padStart(2, '0');
    const s = (parts[2] || '00').padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  private toSeconds(timeStr: string): number {
    if (!timeStr) return 0;
    const parts = timeStr.trim().split(':').map(Number);
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    const s = parts[2] || 0;
    return h * 3600 + m * 60 + s;
  }

  private showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => this.successMessage.set(null), 4000);
  }
}
