import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { DowntimeService } from '../../core/services/downtime.service';
import { PlantService } from '../../core/services/plant.service';
import { DowntimeReason, DowntimeSubReason, Plant } from '../../core/models/auth.model';
import { TranslatePipe } from '../../core/services/translation.service';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-downtime',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, PaginationComponent],
  templateUrl: './downtime.component.html',
  styleUrls: ['./downtime.component.css']
})
export class DowntimeComponent implements OnInit, OnDestroy {
  private downtimeService = inject(DowntimeService);
  private plantService = inject(PlantService);

  reasonsList = signal<DowntimeReason[]>([]);
  plantsList = signal<Plant[]>([]);
  searchQuery = signal<string>('');
  filterPlantId = signal<string>('');
  filterType = signal<string>('all'); // 'all' | 'rejection' | 'downtime'
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
  editingReason = signal<DowntimeReason | null>(null);
  isDeleteConfirmOpen = signal<boolean>(false);
  reasonToDelete = signal<DowntimeReason | null>(null);

  // Form State
  formData = signal<{
    id?: string;
    plant_id: string;
    plant_name: string;
    downtime_type: 'rejection' | 'downtime';
    reason_id?: string;
    mainreason_id: string;
    main_reason: string;
  }>({
    plant_id: '',
    plant_name: '',
    downtime_type: 'rejection',
    mainreason_id: '',
    main_reason: ''
  });

  // Dynamic sub-reasons list
  subReasons = signal<DowntimeSubReason[]>([
    { subreason_id: 'SR-1', sub_reason: '' }
  ]);

  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;

  ngOnInit(): void {
    this.loadPlants();
    this.loadReasons();

    this.searchSub = this.searchSubject
      .pipe(debounceTime(350), distinctUntilChanged())
      .subscribe(() => {
        this.currentPage.set(1);
        this.loadReasons();
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
        if (plants.length > 0 && !this.filterPlantId()) {
          this.filterPlantId.set(plants[0].plant_id);
          this.loadReasons();
        }
      },
      error: () => {}
    });
  }

  loadReasons(): void {
    this.isLoading.set(true);
    const downtime_type =
      this.filterType() === 'all' ? undefined : this.filterType();

    this.downtimeService
      .getDowntimeReasons({
        search: this.searchQuery().trim() || undefined,
        plant_id: this.filterPlantId() || undefined,
        downtime_type,
        page: this.currentPage(),
        limit: this.pageSize()
      })
      .subscribe({
        next: (res) => {
          this.isLoading.set(false);
          if (res.status === 'Success') {
            this.reasonsList.set(res.data || []);
            if (res.pagination) {
              this.totalCount.set(res.pagination.total);
            }
          }
        },
        error: (err) => {
          this.isLoading.set(false);
          this.errorMessage.set(err?.error?.message || 'Failed to load reasons.');
        }
      });
  }

  onSearchChange(value: string): void {
    this.searchQuery.set(value);
    this.searchSubject.next(value);
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.currentPage.set(1);
    this.loadReasons();
  }

  onFilterPlantChange(plantId: string): void {
    this.filterPlantId.set(plantId);
    this.currentPage.set(1);
    this.loadReasons();
  }

  setFilterType(type: string): void {
    this.filterType.set(type);
    this.currentPage.set(1);
    this.loadReasons();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadReasons();
  }

  onLimitChange(limit: number): void {
    this.pageSize.set(limit);
    this.currentPage.set(1);
    this.loadReasons();
  }

  // Open Create Modal
  openAddModal(): void {
    this.isEditMode.set(false);
    this.editingReason.set(null);
    this.modalError.set(null);

    const defaultPlantId = this.filterPlantId() || (this.plantsList()[0]?.plant_id ?? '');
    const defaultPlant = this.plantsList().find((p) => p.plant_id === defaultPlantId);
    const initialType: 'rejection' | 'downtime' =
      this.filterType() === 'downtime' ? 'downtime' : 'rejection';

    this.formData.set({
      plant_id: defaultPlantId,
      plant_name: defaultPlant?.plant_name || '',
      downtime_type: initialType,
      mainreason_id: '',
      main_reason: ''
    });

    this.subReasons.set([]);

    this.isModalOpen.set(true);
  }

  // Open Edit Modal
  openEditModal(reason: DowntimeReason): void {
    this.isEditMode.set(true);
    this.editingReason.set(reason);
    this.modalError.set(null);

    this.formData.set({
      id: reason._id,
      plant_id: reason.plant_id,
      plant_name: reason.plant_name,
      downtime_type: reason.downtime_type,
      reason_id: reason.reason_id,
      mainreason_id: reason.mainreason_id,
      main_reason: reason.main_reason
    });

    if (reason.sub_reasons && reason.sub_reasons.length > 0) {
      this.subReasons.set(
        reason.sub_reasons.map((s) => ({
          subreason_id: s.subreason_id,
          sub_reason: s.sub_reason
        }))
      );
    } else if (reason.subreason_id && reason.sub_reason) {
      this.subReasons.set([
        {
          subreason_id: reason.subreason_id,
          sub_reason: reason.sub_reason
        }
      ]);
    } else {
      this.subReasons.set([]);
    }

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

  setDowntimeType(type: 'rejection' | 'downtime'): void {
    this.formData.update((d) => ({ ...d, downtime_type: type }));
  }

  addSubReason(): void {
    const current = this.subReasons();
    const nextIdx = current.length + 1;
    this.subReasons.set([
      ...current,
      { subreason_id: `SR-${nextIdx}`, sub_reason: '' }
    ]);
  }

  removeSubReason(index: number): void {
    const current = this.subReasons();
    if (current.length <= 1) {
      this.modalError.set('At least one sub-reason is required.');
      return;
    }
    const updated = current.filter((_, i) => i !== index);
    this.subReasons.set(updated);
    this.modalError.set(null);
  }

  saveReason(): void {
    this.modalError.set(null);
    const form = this.formData();

    if (!form.plant_id) {
      this.modalError.set('Please select a plant.');
      return;
    }

    if (!form.mainreason_id || !form.mainreason_id.trim()) {
      this.modalError.set('Main reason ID is required.');
      return;
    }

    if (!form.main_reason || !form.main_reason.trim()) {
      this.modalError.set('Main reason name is required.');
      return;
    }

    const subs = this.subReasons() || [];
    const seenIds = new Set<string>();
    const sanitizedSubs: DowntimeSubReason[] = [];

    for (let i = 0; i < subs.length; i++) {
      const item = subs[i];
      const trimmedId = item.subreason_id ? item.subreason_id.trim() : '';
      const trimmedDesc = item.sub_reason ? item.sub_reason.trim() : '';

      // If row is completely blank, skip it
      if (!trimmedId && !trimmedDesc) {
        continue;
      }

      if (!trimmedId) {
        this.modalError.set(`Sub-reason #${i + 1} requires a valid Sub-Reason ID.`);
        return;
      }
      if (!trimmedDesc) {
        this.modalError.set(`Sub-reason #${i + 1} requires a description.`);
        return;
      }

      const idKey = trimmedId.toLowerCase();
      if (seenIds.has(idKey)) {
        this.modalError.set(`Duplicate sub-reason ID '${trimmedId}'. IDs must be unique.`);
        return;
      }
      seenIds.add(idKey);

      sanitizedSubs.push({
        subreason_id: trimmedId,
        sub_reason: trimmedDesc
      });
    }

    const payload: Partial<DowntimeReason> = {
      plant_id: form.plant_id.trim().toUpperCase(),
      plant_name: form.plant_name.trim(),
      downtime_type: form.downtime_type,
      mainreason_id: form.mainreason_id.trim(),
      main_reason: form.main_reason.trim(),
      subreason_id: sanitizedSubs.length > 0 ? sanitizedSubs[0].subreason_id : '',
      sub_reason: sanitizedSubs.length > 0 ? sanitizedSubs[0].sub_reason : '',
      sub_reasons: sanitizedSubs
    };

    if (this.isEditMode() && form.id) {
      this.downtimeService.updateDowntimeReason(form.id, payload).subscribe({
        next: (res) => {
          this.closeModal();
          this.showSuccess(res.message || 'Reason updated successfully.');
          this.loadReasons();
        },
        error: (err) => {
          this.modalError.set(err?.error?.message || 'Failed to update reason.');
        }
      });
    } else {
      this.downtimeService.createDowntimeReason(payload).subscribe({
        next: (res) => {
          this.closeModal();
          this.showSuccess(res.message || 'Reason configured successfully.');
          this.loadReasons();
        },
        error: (err) => {
          this.modalError.set(err?.error?.message || 'Failed to create reason.');
        }
      });
    }
  }

  // Delete Flow
  openDeleteConfirm(reason: DowntimeReason): void {
    this.reasonToDelete.set(reason);
    this.isDeleteConfirmOpen.set(true);
  }

  closeDeleteConfirm(): void {
    this.reasonToDelete.set(null);
    this.isDeleteConfirmOpen.set(false);
  }

  cancelDelete(): void {
    this.closeDeleteConfirm();
  }

  executeDelete(): void {
    this.confirmDelete();
  }

  confirmDelete(): void {
    const reason = this.reasonToDelete();
    if (!reason?._id) return;

    this.downtimeService.deleteDowntimeReason(reason._id).subscribe({
      next: (res) => {
        this.closeDeleteConfirm();
        this.showSuccess(res.message || `Reason '${reason.reason_id}' deleted successfully.`);
        this.loadReasons();
      },
      error: (err) => {
        this.closeDeleteConfirm();
        this.errorMessage.set(err?.error?.message || 'Failed to delete reason.');
      }
    });
  }

  private showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => {
      this.successMessage.set(null);
    }, 4000);
  }
}
