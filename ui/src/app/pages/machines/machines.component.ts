import { Component, OnInit, OnDestroy, signal, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { TranslatePipe } from '../../core/services/translation.service';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { MachineService } from '../../core/services/machine.service';
import { PlantService } from '../../core/services/plant.service';
import { DepartmentService } from '../../core/services/department.service';
import { MachineTypeService } from '../../core/services/machinetype.service';
import { Machine, Plant, Department, MachineType } from '../../core/models/auth.model';

@Component({
  selector: 'app-machines',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, PaginationComponent],
  templateUrl: './machines.component.html',
  styleUrls: ['./machines.component.css']
})
export class MachinesComponent implements OnInit, OnDestroy {
  private machineService = inject(MachineService);
  private plantService = inject(PlantService);
  private departmentService = inject(DepartmentService);
  private machineTypeService = inject(MachineTypeService);

  // Reactive state signals
  machinesList = signal<Machine[]>([]);
  plantsList = signal<Plant[]>([]);
  departmentsList = signal<Department[]>([]);
  machineTypesList = signal<MachineType[]>([]);

  isLoading = signal<boolean>(false);
  isSaving = signal<boolean>(false);
  isDeleting = signal<boolean>(false);

  // Pagination & Filtering
  totalCount = signal<number>(0);
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);
  filterPlantId = signal<string>('');
  searchQuery = signal<string>('');

  // Toast / Alerts
  successMessage = signal<string | null>(null);
  errorMessage = signal<string | null>(null);
  private toastTimer: any = null;

  // Add / Edit Modal state
  isModalOpen = signal<boolean>(false);
  isEditMode = signal<boolean>(false);
  modalError = signal<string | null>(null);
  editingMachine = signal<Machine | null>(null);

  formData = signal<{
    id?: string;
    plant_id: string;
    plant_name: string;
    department_id: string;
    department_name: string;
    machinetype: string;
    machinetype_id: string;
    machine_id?: string;
    machine_ip: string;
    machine_liscence: string;
  }>({
    plant_id: '',
    plant_name: '',
    department_id: '',
    department_name: '',
    machinetype: '',
    machinetype_id: '',
    machine_ip: '',
    machine_liscence: ''
  });

  // Delete modal state
  isDeleteModalOpen = signal<boolean>(false);
  deletingMachine = signal<Machine | null>(null);

  // IPv4 validation & formatting
  readonly IPV4_REGEX = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

  isIpValid = computed(() => {
    const ip = this.formData().machine_ip?.trim();
    if (!ip) return false;
    return this.IPV4_REGEX.test(ip);
  });

  // Search debounce
  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;

  ngOnInit(): void {
    this.loadPlants();

    this.searchSub = this.searchSubject
      .pipe(debounceTime(350), distinctUntilChanged())
      .subscribe((query) => {
        this.searchQuery.set(query);
        this.currentPage.set(1);
        this.loadMachines();
      });
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
  }

  loadPlants(): void {
    this.plantService.getPlants().subscribe({
      next: (res) => {
        const plants = (res.data || []) as Plant[];
        this.plantsList.set(plants);
        if (plants.length > 0 && !this.filterPlantId()) {
          this.filterPlantId.set(plants[0].plant_id);
        }
        this.loadMachines();
      },
      error: () => {
        this.plantsList.set([]);
        this.loadMachines();
      }
    });
  }

  loadMachines(): void {
    this.isLoading.set(true);

    const params: {
      search?: string;
      page: number;
      limit: number;
      plant_id?: string;
    } = {
      page: this.currentPage(),
      limit: this.pageSize()
    };

    if (this.searchQuery().trim()) {
      params.search = this.searchQuery().trim();
    }
    if (this.filterPlantId()) {
      params.plant_id = this.filterPlantId();
    }

    this.machineService.getMachines(params).subscribe({
      next: (res) => {
        this.machinesList.set(res.data || []);
        if (res.pagination) {
          this.totalCount.set(res.pagination.total);
        } else {
          this.totalCount.set(res.data?.length || 0);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.showError(err?.error?.message || 'Failed to load machines.');
      }
    });
  }

  onSearchInput(val: string): void {
    this.searchSubject.next(val);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchSubject.next('');
  }

  onPlantFilterChange(plantId: string): void {
    this.filterPlantId.set(plantId);
    this.currentPage.set(1);
    this.loadMachines();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadMachines();
  }

  onLimitChange(limit: number): void {
    this.pageSize.set(limit);
    this.currentPage.set(1);
    this.loadMachines();
  }

  // Load cascading dropdown options for plant
  loadPlantRelatedOptions(plantId: string, callback?: () => void): void {
    // 1. Load departments for this plant
    this.departmentService.getDepartments({ plant_id: plantId }).subscribe({
      next: (res) => {
        this.departmentsList.set(res.data || []);
      },
      error: () => {
        this.departmentsList.set([]);
      }
    });

    // 2. Load machine types for this plant
    this.machineTypeService.getMachineTypes({ plant_id: plantId }).subscribe({
      next: (res) => {
        this.machineTypesList.set(res.data || []);
        if (callback) callback();
      },
      error: () => {
        this.machineTypesList.set([]);
        if (callback) callback();
      }
    });
  }

  // Open Add Modal
  openAddModal(): void {
    this.isEditMode.set(false);
    this.editingMachine.set(null);
    this.modalError.set(null);

    const defaultPlant = this.plantsList()[0];
    const defaultPlantId = this.filterPlantId() || defaultPlant?.plant_id || '';
    const activePlant = this.plantsList().find((p) => p.plant_id === defaultPlantId) || defaultPlant;

    this.formData.set({
      plant_id: defaultPlantId,
      plant_name: activePlant?.plant_name || '',
      department_id: '',
      department_name: '',
      machinetype: '',
      machinetype_id: '',
      machine_ip: '',
      machine_liscence: ''
    });

    if (defaultPlantId) {
      this.loadPlantRelatedOptions(defaultPlantId, () => {
        // Auto-select first department if available
        const depts = this.departmentsList();
        const types = this.machineTypesList();
        this.formData.update((d) => ({
          ...d,
          department_id: depts.length > 0 ? depts[0].department_id || '' : '',
          department_name: depts.length > 0 ? depts[0].department_name || '' : '',
          machinetype: types.length > 0 ? types[0].machinetype || '' : '',
          machinetype_id: types.length > 0 ? types[0].machinetype_id || '' : ''
        }));
      });
    }

    this.isModalOpen.set(true);
  }

  // Open Edit Modal
  openEditModal(item: Machine): void {
    this.isEditMode.set(true);
    this.editingMachine.set(item);
    this.modalError.set(null);

    this.formData.set({
      id: item._id,
      plant_id: item.plant_id,
      plant_name: item.plant_name,
      department_id: item.department_id,
      department_name: item.department_name,
      machinetype: item.machinetype,
      machinetype_id: item.machinetype_id || '',
      machine_id: item.machine_id,
      machine_ip: item.machine_ip,
      machine_liscence: item.machine_liscence
    });

    this.loadPlantRelatedOptions(item.plant_id);
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.modalError.set(null);
  }

  onModalPlantChange(plantId: string): void {
    const selected = this.plantsList().find((p) => p.plant_id === plantId);
    this.formData.update((d) => ({
      ...d,
      plant_id: plantId,
      plant_name: selected?.plant_name || '',
      department_id: '',
      department_name: '',
      machinetype: '',
      machinetype_id: ''
    }));

    this.loadPlantRelatedOptions(plantId, () => {
      const depts = this.departmentsList();
      const types = this.machineTypesList();
      this.formData.update((d) => ({
        ...d,
        department_id: depts.length > 0 ? depts[0].department_id || '' : '',
        department_name: depts.length > 0 ? depts[0].department_name || '' : '',
        machinetype: types.length > 0 ? types[0].machinetype || '' : '',
        machinetype_id: types.length > 0 ? types[0].machinetype_id || '' : ''
      }));
    });
  }

  onDepartmentSelectChange(deptId: string): void {
    const dept = this.departmentsList().find((d) => d.department_id === deptId);
    this.formData.update((f) => ({
      ...f,
      department_id: deptId,
      department_name: dept?.department_name || ''
    }));
  }

  onMachineTypeSelectChange(typeName: string): void {
    const mt = this.machineTypesList().find((m) => m.machinetype === typeName);
    this.formData.update((f) => ({
      ...f,
      machinetype: typeName,
      machinetype_id: mt?.machinetype_id || ''
    }));
  }

  onIpInput(event: Event): void {
    const inputElement = event.target as HTMLInputElement;
    const inputEvent = event as InputEvent;
    const inputType = inputEvent.inputType || '';
    const isDeleting = inputType.startsWith('delete');
    const rawValue = inputElement.value || '';

    const formatted = this.formatIpAddress(rawValue, isDeleting);
    inputElement.value = formatted;
    this.formData.update((f) => ({ ...f, machine_ip: formatted }));
  }

  private formatIpAddress(value: string, isDeleting: boolean = false): string {
    if (!value) return '';

    // 1. Keep only digits and dots
    let cleaned = value.replace(/[^0-9.]/g, '');

    // 2. Prevent leading dot
    cleaned = cleaned.replace(/^\.+/, '');

    // 3. Prevent multiple consecutive dots
    cleaned = cleaned.replace(/\.{2,}/g, '.');

    // If user pasted or typed numbers without any dots and length > 3:
    if (!cleaned.includes('.') && cleaned.length > 3) {
      const chunks: string[] = [];
      for (let i = 0; i < cleaned.length && chunks.length < 4; i += 3) {
        let chunk = cleaned.slice(i, i + 3);
        if (parseInt(chunk, 10) > 255) {
          chunk = '255';
        }
        chunks.push(chunk);
      }
      return chunks.join('.');
    }

    // Split by dots
    let parts = cleaned.split('.');
    if (parts.length > 4) {
      parts = parts.slice(0, 4);
    }

    const formattedParts: string[] = [];
    for (let i = 0; i < parts.length; i++) {
      let part = parts[i];
      // Max 3 digits per octet
      if (part.length > 3) {
        part = part.slice(0, 3);
      }
      // Cap at 255
      if (part.length > 0) {
        const val = parseInt(part, 10);
        if (val > 255) {
          part = '255';
        }
      }
      formattedParts.push(part);
    }

    let result = formattedParts.join('.');

    // Auto-append dot if typing (not deleting), current octet reached 3 digits, and fewer than 4 octets
    if (
      !isDeleting &&
      parts.length < 4 &&
      parts[parts.length - 1].length === 3 &&
      !cleaned.endsWith('.')
    ) {
      result += '.';
    }

    return result;
  }

  saveMachine(): void {
    this.modalError.set(null);
    const form = this.formData();

    if (!form.plant_id) {
      this.modalError.set('Please select a plant.');
      return;
    }

    if (!form.department_id) {
      this.modalError.set('Please select a department.');
      return;
    }

    if (!form.machinetype || !form.machinetype.trim()) {
      this.modalError.set('Please select a machine type.');
      return;
    }

    if (!form.machine_ip || !form.machine_ip.trim()) {
      this.modalError.set('Machine IP address is required.');
      return;
    }

    if (!this.IPV4_REGEX.test(form.machine_ip.trim())) {
      this.modalError.set('Please enter a valid IPv4 address (e.g. 192.55.55.5).');
      return;
    }

    if (!form.machine_liscence || !form.machine_liscence.trim()) {
      this.modalError.set('Machine license is required.');
      return;
    }

    this.isSaving.set(true);

    const payload: Partial<Machine> = {
      plant_id: form.plant_id.trim().toUpperCase(),
      plant_name: form.plant_name.trim(),
      department_id: form.department_id.trim(),
      department_name: form.department_name.trim(),
      machinetype: form.machinetype.trim(),
      machinetype_id: form.machinetype_id ? form.machinetype_id.trim() : '',
      machine_ip: form.machine_ip.trim(),
      machine_liscence: form.machine_liscence.trim()
    };

    if (this.isEditMode() && form.id) {
      this.machineService.updateMachine(form.id, payload).subscribe({
        next: (res) => {
          this.isSaving.set(false);
          this.closeModal();
          this.showSuccess(res.message || 'Machine updated successfully.');
          this.loadMachines();
        },
        error: (err) => {
          this.isSaving.set(false);
          this.modalError.set(err?.error?.message || 'Failed to update machine.');
        }
      });
    } else {
      this.machineService.createMachine(payload).subscribe({
        next: (res) => {
          this.isSaving.set(false);
          this.closeModal();
          this.showSuccess(res.message || 'Machine configured successfully.');
          this.loadMachines();
        },
        error: (err) => {
          this.isSaving.set(false);
          this.modalError.set(err?.error?.message || 'Failed to create machine.');
        }
      });
    }
  }

  // Delete modal
  openDeleteModal(item: Machine): void {
    this.deletingMachine.set(item);
    this.isDeleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    this.isDeleteModalOpen.set(false);
    this.deletingMachine.set(null);
  }

  confirmDelete(): void {
    const item = this.deletingMachine();
    if (!item?._id) return;

    this.isDeleting.set(true);
    this.machineService.deleteMachine(item._id).subscribe({
      next: (res) => {
        this.isDeleting.set(false);
        this.closeDeleteModal();
        this.showSuccess(res.message || 'Machine deleted successfully.');
        this.loadMachines();
      },
      error: (err) => {
        this.isDeleting.set(false);
        this.closeDeleteModal();
        this.showError(err?.error?.message || 'Failed to delete machine.');
      }
    });
  }

  showSuccess(msg: string): void {
    this.successMessage.set(msg);
    this.errorMessage.set(null);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.successMessage.set(null), 4000);
  }

  showError(msg: string): void {
    this.errorMessage.set(msg);
    this.successMessage.set(null);
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.errorMessage.set(null), 4000);
  }
}
