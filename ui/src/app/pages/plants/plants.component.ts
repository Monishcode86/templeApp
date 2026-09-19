import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { PlantService } from '../../core/services/plant.service';
import { ApiService } from '../../core/services/api.service';
import { TranslatePipe } from '../../core/services/translation.service';
import { Plant } from '../../core/models/auth.model';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-plants',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, PaginationComponent],
  templateUrl: './plants.component.html',
  styleUrls: ['./plants.component.css']
})
export class PlantsComponent implements OnInit, OnDestroy {
  private plantService = inject(PlantService);
  private apiService = inject(ApiService);

  plantsList = signal<Plant[]>([]);
  searchQuery = signal<string>('');
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
  isDeleteConfirmOpen = signal<boolean>(false);
  plantToDelete = signal<Plant | null>(null);

  // Image Upload State
  selectedFile = signal<File | null>(null);
  imagePreview = signal<string | null>(null);
  isUploadingImage = signal<boolean>(false);

  getImageUrl(path?: string | null): string {
    return this.apiService.getImageUrl(path);
  }

  // Debounced search subject
  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;

  // Form State
  formData = signal<{
    id?: string;
    plant_id: string;
    plant_name: string;
    location: string;
    plant_img?: string | null;
    pincode: string;
    no_of_employee?: number;
  }>({
    plant_id: '',
    plant_name: '',
    location: '',
    plant_img: null,
    pincode: '',
    no_of_employee: 0
  });

  ngOnInit(): void {
    this.loadPlants();

    this.searchSub = this.searchSubject
      .pipe(debounceTime(350), distinctUntilChanged())
      .subscribe(() => {
        this.currentPage.set(1);
        this.loadPlants();
      });
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  loadPlants(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const term = this.searchQuery().trim();

    this.plantService.getPlants({
      page: this.currentPage(),
      limit: this.pageSize(),
      search: term || undefined
    }).subscribe({
      next: (res) => {
        this.plantsList.set(res.data || []);
        if (res.pagination) {
          this.totalCount.set(res.pagination.total);
        } else {
          this.totalCount.set((res.data || []).length);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Failed to fetch plants from server.');
      }
    });
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadPlants();
  }

  onLimitChange(limit: number): void {
    this.pageSize.set(limit);
    this.currentPage.set(1);
    this.loadPlants();
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
    this.searchSubject.next(query.trim());
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchSubject.next('');
  }

  openAddModal(): void {
    this.modalError.set(null);
    this.isEditMode.set(false);
    this.selectedFile.set(null);
    this.imagePreview.set(null);
    this.formData.set({
      plant_id: '',
      plant_name: '',
      location: '',
      plant_img: null,
      pincode: '',
      no_of_employee: 0
    });
    this.isModalOpen.set(true);
  }

  openEditModal(plant: Plant): void {
    this.modalError.set(null);
    this.isEditMode.set(true);
    this.selectedFile.set(null);
    this.imagePreview.set(plant.plant_img || null);
    this.formData.set({
      id: plant._id,
      plant_id: plant.plant_id,
      plant_name: plant.plant_name,
      location: plant.location,
      plant_img: plant.plant_img || null,
      pincode: plant.pincode,
      no_of_employee: plant.no_of_employee || 0
    });
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.modalError.set(null);
    this.selectedFile.set(null);
    this.imagePreview.set(null);
    this.isModalOpen.set(false);
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      if (file.size > 5 * 1024 * 1024) {
        this.modalError.set('Plant image must be less than 5MB.');
        return;
      }
      this.selectedFile.set(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        this.imagePreview.set(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  removeImage(): void {
    this.selectedFile.set(null);
    this.imagePreview.set(null);
    this.formData.update((f) => ({ ...f, plant_img: null }));
  }

  savePlant(): void {
    const data = this.formData();
    this.modalError.set(null);

    if (!data.plant_id?.trim() || !data.plant_name?.trim() || !data.location?.trim() || !data.pincode?.trim()) {
      this.modalError.set('Plant ID, Name, Location, and Pincode are required.');
      return;
    }

    this.isLoading.set(true);

    if (this.selectedFile()) {
      this.isUploadingImage.set(true);
      this.plantService.uploadPlantImage(this.selectedFile()!).subscribe({
        next: (res) => {
          this.isUploadingImage.set(false);
          this.executeSave({ ...data, plant_img: res.imageUrl });
        },
        error: (err) => {
          this.isUploadingImage.set(false);
          this.isLoading.set(false);
          this.modalError.set(err.error?.message || 'Failed to upload plant image.');
        }
      });
    } else {
      this.executeSave(data);
    }
  }

  private executeSave(data: any): void {
    if (this.isEditMode() && data.id) {
      this.plantService.updatePlant(data.id, data).subscribe({
        next: () => {
          this.isLoading.set(false);
          this.closeModal();
          this.showSuccess('Plant updated successfully.');
          this.loadPlants();
        },
        error: (err) => {
          this.isLoading.set(false);
          this.modalError.set(err.error?.message || 'Failed to update plant.');
        }
      });
    } else {
      this.plantService.createPlant(data).subscribe({
        next: () => {
          this.isLoading.set(false);
          this.closeModal();
          this.showSuccess('Plant configured successfully.');
          this.loadPlants();
        },
        error: (err) => {
          this.isLoading.set(false);
          this.modalError.set(err.error?.message || 'Failed to create plant.');
        }
      });
    }
  }

  confirmDelete(plant: Plant): void {
    this.plantToDelete.set(plant);
    this.isDeleteConfirmOpen.set(true);
  }

  cancelDelete(): void {
    this.plantToDelete.set(null);
    this.isDeleteConfirmOpen.set(false);
  }

  executeDelete(): void {
    const plant = this.plantToDelete();
    if (!plant || !plant._id) return;

    this.isLoading.set(true);
    this.plantService.deletePlant(plant._id).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.cancelDelete();
        this.showSuccess('Plant deleted successfully.');
        this.loadPlants();
      },
      error: (err) => {
        this.isLoading.set(false);
        this.cancelDelete();
        this.errorMessage.set(err.error?.message || 'Failed to delete plant.');
      }
    });
  }

  private showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => this.successMessage.set(null), 4000);
  }
}
