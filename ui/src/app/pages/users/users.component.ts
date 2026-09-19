import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { PlantService } from '../../core/services/plant.service';
import { ApiService } from '../../core/services/api.service';
import { TranslatePipe, TranslationService } from '../../core/services/translation.service';
import { User, Plant } from '../../core/models/auth.model';

import { PaginationComponent } from '../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, PaginationComponent],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css']
})
export class UsersComponent implements OnInit, OnDestroy {
  private userService = inject(UserService);
  private plantService = inject(PlantService);
  private apiService = inject(ApiService);
  authService = inject(AuthService);
  private translationService = inject(TranslationService);

  getImageUrl(path?: string | null): string {
    return this.apiService.getImageUrl(path);
  }

  usersList = signal<User[]>([]);
  plantsList = signal<Plant[]>([]);
  selectedPlantId = signal<string>('');
  searchQuery = signal<string>('');
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);
  totalCount = signal<number>(0);

  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  modalError = signal<string | null>(null);

  // Modal States
  isModalOpen = signal<boolean>(false);
  isEditMode = signal<boolean>(false);
  isDeleteConfirmOpen = signal<boolean>(false);
  userToDelete = signal<User | null>(null);

  // Image Upload State
  selectedFile = signal<File | null>(null);
  imagePreview = signal<string | null>(null);
  isUploadingImage = signal<boolean>(false);

  // Debounced search subject
  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;

  // Form State
  formData = signal<{
    id?: string;
    username: string;
    email: string;
    password?: string;
    role: 'ADMIN' | 'USER';
    employee_id?: string;
    image?: string | null;
    plant_id?: string | null;
    plant_name?: string | null;
  }>({
    username: '',
    email: '',
    password: '',
    role: 'USER',
    employee_id: '',
    image: null,
    plant_id: '',
    plant_name: ''
  });

  // Displayed Users signal reflecting server-side search & role filtering
  displayedUsers = computed(() => {
    const isAdmin = this.authService.currentUser()?.role === 'ADMIN';
    const list = this.usersList();
    return list.filter((u) => u.email?.toLowerCase() !== 'admin@gmail.com' && (isAdmin || u.role !== 'ADMIN'));
  });

  // Alias for backward compatibility
  filteredUsers = this.displayedUsers;

  ngOnInit(): void {
    // Load plants first, select first plant, and fetch only users of that plant
    this.loadPlants();

    // Debounce search input to query the entire database on server
    this.searchSub = this.searchSubject
      .pipe(
        debounceTime(350),
        distinctUntilChanged()
      )
      .subscribe((query) => {
        this.currentPage.set(1);
        this.loadUsers();
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
        // Onload automatically pick first plant and query only users of that plant
        if (plants.length > 0 && !this.selectedPlantId()) {
          this.selectedPlantId.set(plants[0].plant_id);
        }
        this.loadUsers();
      },
      error: (err) => {
        console.error('Failed to load plants', err);
        this.loadUsers();
      }
    });
  }

  loadUsers(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const term = this.searchQuery().trim();

    this.userService.getUsers({
      page: this.currentPage(),
      limit: this.pageSize(),
      search: term || undefined,
      plant_id: this.selectedPlantId() || undefined
    }).subscribe({
      next: (res) => {
        const rawUsers = res.data || [];
        const filtered = rawUsers.filter((u) => u.email?.toLowerCase() !== 'admin@gmail.com');
        this.usersList.set(filtered);
        if (res.pagination) {
          this.totalCount.set(res.pagination.total);
        } else {
          this.totalCount.set(filtered.length);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Failed to fetch users from server.');
      }
    });
  }

  onPlantFilterChange(plantId: string): void {
    this.selectedPlantId.set(plantId);
    this.currentPage.set(1);
    this.loadUsers();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadUsers();
  }

  onLimitChange(limit: number): void {
    this.pageSize.set(limit);
    this.currentPage.set(1);
    this.loadUsers();
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
    this.searchSubject.next(query.trim());
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchSubject.next('');
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      if (file.size > 5 * 1024 * 1024) {
        this.modalError.set('Profile image must be less than 5MB.');
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
    this.formData.update(f => ({ ...f, image: null }));
  }

  onPlantSelected(plantId: string): void {
    const plant = this.plantsList().find(p => p.plant_id === plantId);
    this.formData.update(f => ({
      ...f,
      plant_id: plant ? plant.plant_id : null,
      plant_name: plant ? plant.plant_name : null
    }));
  }

  openAddModal(): void {
    this.modalError.set(null);
    this.isEditMode.set(false);
    this.selectedFile.set(null);
    this.imagePreview.set(null);
    const defaultPlant = this.plantsList().find(p => p.plant_id === this.selectedPlantId()) || this.plantsList()[0];
    this.formData.set({
      username: '',
      email: '',
      password: '',
      role: 'USER',
      employee_id: '',
      image: null,
      plant_id: defaultPlant ? defaultPlant.plant_id : '',
      plant_name: defaultPlant ? defaultPlant.plant_name : ''
    });
    this.isModalOpen.set(true);
  }

  openEditModal(user: User): void {
    this.modalError.set(null);
    this.isEditMode.set(true);
    this.selectedFile.set(null);
    this.imagePreview.set(user.image || null);
    this.formData.set({
      id: user._id || user.id,
      username: user.username,
      email: user.email,
      password: '', // leave empty if not changing
      role: user.role,
      employee_id: user.employee_id || '',
      image: user.image || null,
      plant_id: user.plant_id || '',
      plant_name: user.plant_name || ''
    });
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.modalError.set(null);
    this.selectedFile.set(null);
    this.imagePreview.set(null);
    this.isModalOpen.set(false);
  }

  saveUser(): void {
    const data = this.formData();
    this.modalError.set(null);

    if (!data.username?.trim() || !data.email?.trim()) {
      this.modalError.set('Username and Email are required.');
      return;
    }

    if (!this.isEditMode() && !data.password) {
      this.modalError.set('Password is required for new users.');
      return;
    }

    this.isLoading.set(true);

    // If a new avatar file was chosen, upload it first
    if (this.selectedFile()) {
      this.isUploadingImage.set(true);
      this.userService.uploadAvatar(this.selectedFile()!).subscribe({
        next: (uploadRes) => {
          this.isUploadingImage.set(false);
          const finalPayload = {
            ...data,
            image: uploadRes.imageUrl
          };
          this.executeSave(finalPayload);
        },
        error: (err) => {
          this.isUploadingImage.set(false);
          this.isLoading.set(false);
          this.modalError.set(err.error?.message || 'Failed to upload profile photo.');
        }
      });
    } else {
      this.executeSave(data);
    }
  }

  private executeSave(data: any): void {
    if (this.isEditMode() && data.id) {
      // Update existing user
      const payload: any = {
        username: data.username.trim(),
        email: data.email.trim(),
        role: data.role,
        employee_id: data.employee_id?.trim() || null,
        plant_id: data.plant_id || null,
        plant_name: data.plant_name || null,
        image: data.image !== undefined ? data.image : null
      };
      if (data.password) {
        payload.password = data.password;
      }

      this.userService.updateUser(data.id, payload).subscribe({
        next: () => {
          this.isLoading.set(false);
          this.closeModal();
          this.showSuccess('User updated successfully.');
          this.loadUsers();
        },
        error: (err) => {
          this.isLoading.set(false);
          this.modalError.set(err.error?.message || 'Failed to update user.');
        }
      });
    } else {
      // Create new user
      const payload: any = {
        username: data.username.trim(),
        email: data.email.trim(),
        password: data.password,
        role: data.role,
        employee_id: data.employee_id?.trim() || null,
        plant_id: data.plant_id || null,
        plant_name: data.plant_name || null,
        image: data.image || null
      };

      this.userService.createUser(payload).subscribe({
        next: () => {
          this.isLoading.set(false);
          this.closeModal();
          this.showSuccess('User created successfully.');
          this.loadUsers();
        },
        error: (err) => {
          this.isLoading.set(false);
          this.modalError.set(err.error?.message || 'Failed to create user.');
        }
      });
    }
  }

  confirmDelete(user: User): void {
    if (user.role === 'ADMIN') {
      this.errorMessage.set(this.translationService.translate('CANNOT_DELETE_ADMIN'));
      return;
    }
    this.userToDelete.set(user);
    this.isDeleteConfirmOpen.set(true);
  }

  cancelDelete(): void {
    this.userToDelete.set(null);
    this.isDeleteConfirmOpen.set(false);
  }

  executeDelete(): void {
    const user = this.userToDelete();
    if (!user) return;

    if (user.role === 'ADMIN') {
      this.cancelDelete();
      this.errorMessage.set(this.translationService.translate('CANNOT_DELETE_ADMIN'));
      return;
    }

    const id = user._id || user.id;
    if (!id) return;

    this.isLoading.set(true);
    this.userService.deleteUser(id).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.cancelDelete();
        this.showSuccess('User deleted successfully.');
        this.loadUsers();
      },
      error: (err) => {
        this.isLoading.set(false);
        this.cancelDelete();
        this.errorMessage.set(err.error?.message || 'Failed to delete user.');
      }
    });
  }

  private showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => this.successMessage.set(null), 4000);
  }
}
