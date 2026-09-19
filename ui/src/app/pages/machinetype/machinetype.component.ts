import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { TranslatePipe } from '../../core/services/translation.service';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { MachineTypeService } from '../../core/services/machinetype.service';
import { PlantService } from '../../core/services/plant.service';
import { MachineType, Plant } from '../../core/models/auth.model';

@Component({
  selector: 'app-machinetype',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, PaginationComponent],
  templateUrl: './machinetype.component.html',
  styleUrls: ['./machinetype.component.css']
})
export class MachineTypeComponent implements OnInit, OnDestroy {
  private machineTypeService = inject(MachineTypeService);
  private plantService = inject(PlantService);

  // Reactive state signals
  machineTypesList = signal<MachineType[]>([]);
  plantsList = signal<Plant[]>([]);
  isLoading = signal<boolean>(false);
  isSaving = signal<boolean>(false);
  isDeleting = signal<boolean>(false);

  // Pagination & Filtering
  totalCount = signal<number>(0);
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);
  filterPlantId = signal<string>('');
  searchQuery = signal<string>('');

  // Toast notification
  toastMessage = signal<string | null>(null);
  toastType = signal<'success' | 'error'>('success');
  private toastTimer: any = null;

  // Add / Edit Modal state
  isModalOpen = signal<boolean>(false);
  isEditMode = signal<boolean>(false);
  modalError = signal<string | null>(null);
  editingType = signal<MachineType | null>(null);

  formData = signal<{
    id?: string;
    plant_id: string;
    plant_name: string;
    machinetype_id?: string;
    machinetype: string;
    description: string;
  }>({
    plant_id: '',
    plant_name: '',
    machinetype: '',
    description: ''
  });

  // Delete modal state
  isDeleteModalOpen = signal<boolean>(false);
  deletingType = signal<MachineType | null>(null);

  // Search debounce
  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;

  ngOnInit(): void {
    this.loadPlants();
    this.loadMachineTypes();

    this.searchSub = this.searchSubject
      .pipe(debounceTime(350), distinctUntilChanged())
      .subscribe((query) => {
        this.searchQuery.set(query);
        this.currentPage.set(1);
        this.loadMachineTypes();
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
      },
      error: () => {
        this.plantsList.set([]);
      }
    });
  }

  loadMachineTypes(): void {
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

    this.machineTypeService.getMachineTypes(params).subscribe({
      next: (res) => {
        this.machineTypesList.set(res.data || []);
        if (res.pagination) {
          this.totalCount.set(res.pagination.total);
        } else {
          this.totalCount.set(res.data?.length || 0);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.showError(err?.error?.message || 'Failed to load machine types.');
      }
    });
  }

  onSearchInput(val: string): void {
    this.searchSubject.next(val);
  }

  onPlantFilterChange(plantId: string): void {
    this.filterPlantId.set(plantId);
    this.currentPage.set(1);
    this.loadMachineTypes();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadMachineTypes();
  }

  onLimitChange(limit: number): void {
    this.pageSize.set(limit);
    this.currentPage.set(1);
    this.loadMachineTypes();
  }

  // Open Add Modal
  openAddModal(): void {
    this.isEditMode.set(false);
    this.editingType.set(null);
    this.modalError.set(null);

    const defaultPlant = this.plantsList()[0];
    const defaultPlantId = this.filterPlantId() || defaultPlant?.plant_id || '';
    const activePlant = this.plantsList().find((p) => p.plant_id === defaultPlantId) || defaultPlant;

    this.formData.set({
      plant_id: defaultPlantId,
      plant_name: activePlant?.plant_name || '',
      machinetype: '',
      description: ''
    });

    this.isModalOpen.set(true);
  }

  // Open Edit Modal
  openEditModal(item: MachineType): void {
    this.isEditMode.set(true);
    this.editingType.set(item);
    this.modalError.set(null);

    this.formData.set({
      id: item._id,
      plant_id: item.plant_id,
      plant_name: item.plant_name,
      machinetype_id: item.machinetype_id,
      machinetype: item.machinetype,
      description: item.description || ''
    });

    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.isModalOpen.set(false);
    this.modalError.set(null);
  }

  onPlantSelectChange(plantId: string): void {
    const selected = this.plantsList().find((p) => p.plant_id === plantId);
    this.formData.update((d) => ({
      ...d,
      plant_id: plantId,
      plant_name: selected?.plant_name || ''
    }));
  }

  saveMachineType(): void {
    this.modalError.set(null);
    const form = this.formData();

    if (!form.plant_id) {
      this.modalError.set('Please select a plant.');
      return;
    }

    if (!form.machinetype || !form.machinetype.trim()) {
      this.modalError.set('Machine type name is required.');
      return;
    }

    this.isSaving.set(true);

    const payload: Partial<MachineType> = {
      plant_id: form.plant_id.trim().toUpperCase(),
      plant_name: form.plant_name.trim(),
      machinetype: form.machinetype.trim(),
      description: form.description ? form.description.trim() : ''
    };

    if (this.isEditMode() && form.id) {
      this.machineTypeService.updateMachineType(form.id, payload).subscribe({
        next: (res) => {
          this.isSaving.set(false);
          this.closeModal();
          this.showSuccess(res.message || 'Machine type updated successfully.');
          this.loadMachineTypes();
        },
        error: (err) => {
          this.isSaving.set(false);
          this.modalError.set(err?.error?.message || 'Failed to update machine type.');
        }
      });
    } else {
      this.machineTypeService.createMachineType(payload).subscribe({
        next: (res) => {
          this.isSaving.set(false);
          this.closeModal();
          this.showSuccess(res.message || 'Machine type configured successfully.');
          this.loadMachineTypes();
        },
        error: (err) => {
          this.isSaving.set(false);
          this.modalError.set(err?.error?.message || 'Failed to create machine type.');
        }
      });
    }
  }

  // Delete modal
  openDeleteModal(item: MachineType): void {
    this.deletingType.set(item);
    this.isDeleteModalOpen.set(true);
  }

  closeDeleteModal(): void {
    this.isDeleteModalOpen.set(false);
    this.deletingType.set(null);
  }

  confirmDelete(): void {
    const item = this.deletingType();
    if (!item?._id) return;

    this.isDeleting.set(true);
    this.machineTypeService.deleteMachineType(item._id).subscribe({
      next: (res) => {
        this.isDeleting.set(false);
        this.closeDeleteModal();
        this.showSuccess(res.message || 'Machine type deleted successfully.');
        this.loadMachineTypes();
      },
      error: (err) => {
        this.isDeleting.set(false);
        this.closeDeleteModal();
        this.showError(err?.error?.message || 'Failed to delete machine type.');
      }
    });
  }

  showSuccess(msg: string): void {
    this.toastMessage.set(msg);
    this.toastType.set('success');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastMessage.set(null), 4000);
  }

  showError(msg: string): void {
    this.toastMessage.set(msg);
    this.toastType.set('error');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toastMessage.set(null), 4000);
  }
}
