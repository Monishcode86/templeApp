import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { DepartmentService } from '../../core/services/department.service';
import { PlantService } from '../../core/services/plant.service';
import { ShiftService } from '../../core/services/shift.service';
import { Department, DepartmentShift, Plant, Shift } from '../../core/models/auth.model';
import { TranslatePipe } from '../../core/services/translation.service';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-departments',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, PaginationComponent],
  templateUrl: './departments.component.html',
  styleUrls: ['./departments.component.css']
})
export class DepartmentsComponent implements OnInit, OnDestroy {
  private departmentService = inject(DepartmentService);
  private plantService = inject(PlantService);
  private shiftService = inject(ShiftService);

  departmentsList = signal<Department[]>([]);
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
  editingDepartment = signal<Department | null>(null);
  isDeleteConfirmOpen = signal<boolean>(false);
  departmentToDelete = signal<Department | null>(null);

  // Plant preview shifts (when is_shift === true)
  plantShiftsPreview = signal<Shift[]>([]);
  isLoadingPlantShifts = signal<boolean>(false);

  // Form State
  formData = signal<{
    id?: string;
    department_name: string;
    plant_id: string;
    plant_name: string;
    is_shift: boolean;
    shift_data: DepartmentShift[];
  }>({
    department_name: '',
    plant_id: '',
    plant_name: '',
    is_shift: true,
    shift_data: []
  });

  // Shift builder draft (when is_shift === false)
  customShifts = signal<DepartmentShift[]>([]);

  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;

  ngOnInit(): void {
    this.loadPlants();
    this.loadDepartments();

    this.searchSub = this.searchSubject
      .pipe(debounceTime(350), distinctUntilChanged())
      .subscribe(() => {
        this.currentPage.set(1);
        this.loadDepartments();
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
        // Auto-select first plant on load (like user & shift config)
        if (plants.length > 0 && !this.filterPlantId()) {
          this.filterPlantId.set(plants[0].plant_id);
          this.loadDepartments();
        }
      },
      error: () => {}
    });
  }

  loadDepartments(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.departmentService.getDepartments({
      page: this.currentPage(),
      limit: this.pageSize(),
      search: this.searchQuery().trim() || undefined,
      plant_id: this.filterPlantId() || undefined
    }).subscribe({
      next: (res) => {
        this.departmentsList.set(res.data || []);
        this.totalCount.set(res.pagination?.total ?? (res.data || []).length);
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Failed to fetch departments.');
      }
    });
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadDepartments();
  }

  onLimitChange(limit: number): void {
    this.pageSize.set(limit);
    this.currentPage.set(1);
    this.loadDepartments();
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
    this.searchSubject.next(query.trim());
  }

  onFilterPlantChange(plantId: string): void {
    this.filterPlantId.set(plantId);
    this.currentPage.set(1);
    this.loadDepartments();
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchSubject.next('');
  }

  openAddModal(): void {
    this.modalError.set(null);
    this.isEditMode.set(false);
    this.editingDepartment.set(null);

    const currentPlantId = this.filterPlantId();
    const currentPlant = this.plantsList().find(p => p.plant_id === currentPlantId);

    this.formData.set({
      department_name: '',
      plant_id: currentPlantId,
      plant_name: currentPlant?.plant_name || '',
      is_shift: true,
      shift_data: []
    });

    this.customShifts.set([]);

    if (currentPlantId) {
      this.fetchPlantShiftsPreview(currentPlantId);
    }

    this.isModalOpen.set(true);
  }

  openEditModal(dept: Department): void {
    this.modalError.set(null);
    this.isEditMode.set(true);
    this.editingDepartment.set(dept);

    this.formData.set({
      id: dept._id,
      department_name: dept.department_name,
      plant_id: dept.plant_id,
      plant_name: dept.plant_name,
      is_shift: dept.is_shift,
      shift_data: dept.shift_data || []
    });

    if (!dept.is_shift) {
      this.customShifts.set(JSON.parse(JSON.stringify(dept.shift_data || [])));
    } else {
      this.customShifts.set([]);
      this.fetchPlantShiftsPreview(dept.plant_id);
    }

    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.modalError.set(null);
    this.isEditMode.set(false);
    this.editingDepartment.set(null);
    this.isModalOpen.set(false);
  }

  onPlantSelect(plantId: string): void {
    const plant = this.plantsList().find(p => p.plant_id === plantId);
    this.formData.update(f => ({
      ...f,
      plant_id: plantId,
      plant_name: plant?.plant_name || ''
    }));

    if (plantId && this.formData().is_shift) {
      this.fetchPlantShiftsPreview(plantId);
    }
  }

  setShiftMode(isShift: boolean): void {
    this.formData.update(f => ({ ...f, is_shift: isShift }));
    if (isShift) {
      if (this.formData().plant_id) {
        this.fetchPlantShiftsPreview(this.formData().plant_id);
      }
    } else {
      // If switching to custom and empty, initialize with first shift
      if (this.customShifts().length === 0) {
        this.customShifts.set([
          { shift_id: 1, shift_name: 'Shift-1', start_time: '00:00:00', end_time: '08:00:00', duration: '8h' }
        ]);
      }
    }
  }

  fetchPlantShiftsPreview(plantId: string): void {
    this.isLoadingPlantShifts.set(true);
    this.shiftService.getShifts({ plant_id: plantId, limit: 100 }).subscribe({
      next: (res) => {
        this.plantShiftsPreview.set(res.data || []);
        this.isLoadingPlantShifts.set(false);
      },
      error: () => {
        this.plantShiftsPreview.set([]);
        this.isLoadingPlantShifts.set(false);
      }
    });
  }

  // --- Custom Shift Builder Helpers ---

  addCustomShift(): void {
    const shifts = this.customShifts();
    const nextId = shifts.length + 1;
    let nextStartTime = '00:00:00';

    if (shifts.length > 0) {
      const last = shifts[shifts.length - 1];
      nextStartTime = last.end_time || '00:00:00';
    }

    const remainingSec = this.customRemainingSeconds();
    // Default end time: remaining time or next 8h
    const startSec = this.toSeconds(nextStartTime);
    const allocSec = Math.min(remainingSec, 8 * 3600);
    const endSec = (startSec + allocSec) % 86400;
    const defaultEndTime = this.secondsToTimeString(endSec);

    const newShift: DepartmentShift = {
      shift_id: nextId,
      shift_name: `Shift-${nextId}`,
      start_time: nextStartTime,
      end_time: defaultEndTime,
      duration: this.calcDuration(nextStartTime, defaultEndTime)
    };

    this.customShifts.update(list => [...list, newShift]);
  }

  removeLastCustomShift(): void {
    if (this.customShifts().length > 0) {
      this.customShifts.update(list => list.slice(0, -1));
    }
  }

  onCustomShiftChange(index: number): void {
    const shifts = [...this.customShifts()];
    const current = shifts[index];
    if (!current) return;

    current.start_time = this.normalizeTime(current.start_time);
    current.end_time = this.normalizeTime(current.end_time);
    current.duration = this.calcDuration(current.start_time, current.end_time);

    // Auto-update subsequent shift start time
    if (index + 1 < shifts.length) {
      shifts[index + 1].start_time = current.end_time;
      shifts[index + 1].duration = this.calcDuration(shifts[index + 1].start_time, shifts[index + 1].end_time);
    }

    this.customShifts.set(shifts);
  }

  customTotalSeconds(): number {
    return this.customShifts().reduce((sum, s) => {
      const start = this.toSeconds(s.start_time);
      let end = this.toSeconds(s.end_time);
      if (end <= start) end += 86400;
      return sum + (end - start);
    }, 0);
  }

  customRemainingSeconds(): number {
    return Math.max(0, 86400 - this.customTotalSeconds());
  }

  customAllocatedPercent(): number {
    return Math.min(100, Math.round((this.customTotalSeconds() / 86400) * 100));
  }

  isCustom24HoursComplete(): boolean {
    return this.customTotalSeconds() === 86400;
  }

  saveDepartment(): void {
    const data = this.formData();
    this.modalError.set(null);

    if (!data.department_name?.trim()) {
      this.modalError.set('Department name is required.');
      return;
    }
    if (!data.plant_id) {
      this.modalError.set('Please select a plant.');
      return;
    }

    let payloadShiftData: DepartmentShift[] = [];

    if (!data.is_shift) {
      if (this.customShifts().length === 0) {
        this.modalError.set('Please configure at least one shift for this department.');
        return;
      }
      if (!this.isCustom24HoursComplete()) {
        const configured = this.formatSeconds(this.customTotalSeconds());
        this.modalError.set(`Custom shifts must complete exactly 24 hours. Currently configured: ${configured} (${this.customAllocatedPercent()}%).`);
        return;
      }
      payloadShiftData = this.customShifts().map((s, idx) => ({
        shift_id: idx + 1,
        shift_name: s.shift_name.trim(),
        start_time: this.normalizeTime(s.start_time),
        end_time: this.normalizeTime(s.end_time),
        duration: this.calcDuration(s.start_time, s.end_time)
      }));
    }

    const payload = {
      department_name: data.department_name.trim(),
      plant_id: data.plant_id,
      plant_name: data.plant_name,
      is_shift: data.is_shift,
      shift_data: payloadShiftData
    };

    this.isLoading.set(true);

    if (this.isEditMode() && data.id) {
      this.departmentService.updateDepartment(data.id, payload).subscribe({
        next: () => {
          this.isLoading.set(false);
          this.closeModal();
          this.showSuccess('Department updated successfully.');
          this.loadDepartments();
        },
        error: (err) => {
          this.isLoading.set(false);
          this.modalError.set(err.error?.message || 'Failed to update department.');
        }
      });
    } else {
      this.departmentService.createDepartment(payload).subscribe({
        next: () => {
          this.isLoading.set(false);
          this.closeModal();
          this.showSuccess('Department created successfully.');
          this.loadDepartments();
        },
        error: (err) => {
          this.isLoading.set(false);
          this.modalError.set(err.error?.message || 'Failed to create department.');
        }
      });
    }
  }

  confirmDelete(dept: Department): void {
    this.departmentToDelete.set(dept);
    this.isDeleteConfirmOpen.set(true);
  }

  cancelDelete(): void {
    this.departmentToDelete.set(null);
    this.isDeleteConfirmOpen.set(false);
  }

  executeDelete(): void {
    const dept = this.departmentToDelete();
    if (!dept?._id) return;

    this.isLoading.set(true);
    this.departmentService.deleteDepartment(dept._id).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.cancelDelete();
        this.showSuccess('Department deleted successfully.');
        this.loadDepartments();
      },
      error: (err) => {
        this.isLoading.set(false);
        this.cancelDelete();
        this.errorMessage.set(err.error?.message || 'Failed to delete department.');
      }
    });
  }

  // --- Utility Functions ---

  normalizeTime(timeStr: string): string {
    if (!timeStr) return '00:00:00';
    const parts = timeStr.trim().split(':');
    const h = (parts[0] || '00').padStart(2, '0');
    const m = (parts[1] || '00').padStart(2, '0');
    const s = (parts[2] || '00').padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  toSeconds(timeStr: string): number {
    if (!timeStr) return 0;
    const parts = timeStr.trim().split(':').map(Number);
    const h = parts[0] || 0;
    const m = parts[1] || 0;
    const s = parts[2] || 0;
    return h * 3600 + m * 60 + s;
  }

  secondsToTimeString(sec: number): string {
    const h = Math.floor(sec / 3600).toString().padStart(2, '0');
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  calcDuration(start: string, end: string): string {
    if (!start || !end) return '';
    let diff = this.toSeconds(end) - this.toSeconds(start);
    if (diff <= 0) diff += 86400;
    return this.formatSeconds(diff);
  }

  formatSeconds(sec: number): string {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = sec % 60;
    const parts: string[] = [];
    if (h > 0) parts.push(`${h}h`);
    if (m > 0) parts.push(`${m}m`);
    if (s > 0) parts.push(`${s}s`);
    return parts.length > 0 ? parts.join(' ') : '0s';
  }

  private showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => this.successMessage.set(null), 4000);
  }
}
