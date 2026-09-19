import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { PartService } from '../../core/services/part.service';
import { PlantService } from '../../core/services/plant.service';
import { PartMaster, PartOperation, Plant } from '../../core/models/auth.model';
import { TranslatePipe } from '../../core/services/translation.service';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-parts',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, PaginationComponent],
  templateUrl: './parts.component.html',
  styleUrls: ['./parts.component.css']
})
export class PartsComponent implements OnInit, OnDestroy {
  private partService = inject(PartService);
  private plantService = inject(PlantService);

  partsList = signal<PartMaster[]>([]);
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
  editingPart = signal<PartMaster | null>(null);
  isDeleteConfirmOpen = signal<boolean>(false);
  partToDelete = signal<PartMaster | null>(null);

  // Form State
  formData = signal<{
    id?: string;
    part_id?: string;
    program_number: string;
    part_name: string;
    plant_id: string;
    plant_name: string;
    has_operation: boolean;
    run_time: number;
    load_time: number;
    unload_time: number;
    cycle_type: 'part_per_cycle' | 'unit_per_parts';
    count: number;
  }>({
    program_number: '',
    part_name: '',
    plant_id: '',
    plant_name: '',
    has_operation: false,
    run_time: 0,
    load_time: 0,
    unload_time: 0,
    cycle_type: 'part_per_cycle',
    count: 1
  });

  // Dynamic operations builder (when has_operation === true)
  operations = signal<PartOperation[]>([]);

  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;

  ngOnInit(): void {
    this.loadPlants();
    this.loadParts();

    this.searchSub = this.searchSubject
      .pipe(debounceTime(350), distinctUntilChanged())
      .subscribe(() => {
        this.currentPage.set(1);
        this.loadParts();
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
          this.loadParts();
        }
      },
      error: () => {}
    });
  }

  loadParts(): void {
    this.isLoading.set(true);
    this.partService
      .getParts({
        search: this.searchQuery().trim() || undefined,
        plant_id: this.filterPlantId() || undefined,
        page: this.currentPage(),
        limit: this.pageSize()
      })
      .subscribe({
        next: (res) => {
          this.isLoading.set(false);
          if (res.status === 'Success') {
            this.partsList.set(res.data || []);
            if (res.pagination) {
              this.totalCount.set(res.pagination.total);
            }
          }
        },
        error: (err) => {
          this.isLoading.set(false);
          this.errorMessage.set(err?.error?.message || 'Failed to load parts.');
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
    this.loadParts();
  }

  onFilterPlantChange(plantId: string): void {
    this.filterPlantId.set(plantId);
    this.currentPage.set(1);
    this.loadParts();
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadParts();
  }

  onLimitChange(limit: number): void {
    this.pageSize.set(limit);
    this.currentPage.set(1);
    this.loadParts();
  }

  // Open Create Modal
  openAddModal(): void {
    this.isEditMode.set(false);
    this.editingPart.set(null);
    this.modalError.set(null);

    const defaultPlantId = this.filterPlantId() || (this.plantsList()[0]?.plant_id ?? '');
    const defaultPlant = this.plantsList().find((p) => p.plant_id === defaultPlantId);

    this.formData.set({
      program_number: '',
      part_name: '',
      plant_id: defaultPlantId,
      plant_name: defaultPlant?.plant_name || '',
      has_operation: false,
      run_time: 0,
      load_time: 0,
      unload_time: 0,
      cycle_type: 'part_per_cycle',
      count: 1
    });

    this.operations.set([]);
    this.isModalOpen.set(true);
  }

  // Open Edit Modal
  openEditModal(part: PartMaster): void {
    this.isEditMode.set(true);
    this.editingPart.set(part);
    this.modalError.set(null);

    this.formData.set({
      id: part._id,
      part_id: part.part_id,
      program_number: part.program_number,
      part_name: part.part_name,
      plant_id: part.plant_id,
      plant_name: part.plant_name,
      has_operation: !!part.has_operation,
      run_time: part.run_time ?? 0,
      load_time: part.load_time ?? 0,
      unload_time: part.unload_time ?? 0,
      cycle_type: part.cycle_type ?? 'part_per_cycle',
      count: part.count ?? 1
    });

    if (part.has_operation && part.operations && part.operations.length > 0) {
      this.operations.set(
        part.operations.map((op) => ({
          operation_name: op.operation_name,
          run_time: Number(op.run_time) || 0,
          load_time: Number(op.load_time) || 0,
          unload_time: Number(op.unload_time) || 0,
          cycle_type: op.cycle_type === 'unit_per_parts' ? 'unit_per_parts' : 'part_per_cycle',
          count: Math.max(1, Number(op.count) || 1)
        }))
      );
    } else {
      this.operations.set([]);
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

  setHasOperation(hasOp: boolean): void {
    this.formData.update((d) => ({ ...d, has_operation: hasOp }));
    if (hasOp && this.operations().length === 0) {
      this.operations.set([
        {
          operation_name: 'OP-1',
          run_time: 0,
          load_time: 0,
          unload_time: 0,
          cycle_type: 'part_per_cycle',
          count: 1
        }
      ]);
    }
  }

  addOperation(): void {
    const current = this.operations();
    const nextIdx = current.length + 1;
    this.operations.set([
      ...current,
      {
        operation_name: `OP-${nextIdx}`,
        run_time: 0,
        load_time: 0,
        unload_time: 0,
        cycle_type: 'part_per_cycle',
        count: 1
      }
    ]);
  }

  removeOperation(index: number): void {
    const current = this.operations();
    if (current.length <= 1) {
      this.modalError.set('At least one operation is required when multi-operation mode is enabled.');
      return;
    }
    const updated = current.filter((_, i) => i !== index);
    this.operations.set(updated);
    this.modalError.set(null);
  }

  savePart(): void {
    this.modalError.set(null);
    const form = this.formData();

    if (!form.plant_id) {
      this.modalError.set('Please select a plant.');
      return;
    }

    if (!form.program_number || !form.program_number.trim()) {
      this.modalError.set('Program number is required.');
      return;
    }

    if (!form.part_name || !form.part_name.trim()) {
      this.modalError.set('Part name is required.');
      return;
    }

    const payload: Partial<PartMaster> = {
      program_number: form.program_number.trim(),
      part_name: form.part_name.trim(),
      plant_id: form.plant_id.trim().toUpperCase(),
      plant_name: form.plant_name.trim(),
      has_operation: form.has_operation
    };

    if (!form.has_operation) {
      const run_time = Number(form.run_time);
      const load_time = Number(form.load_time);
      const unload_time = Number(form.unload_time);
      const count = Number(form.count);

      if (isNaN(run_time) || run_time < 0) {
        this.modalError.set('Run time must be a non-negative number.');
        return;
      }
      if (isNaN(load_time) || load_time < 0) {
        this.modalError.set('Load time must be a non-negative number.');
        return;
      }
      if (isNaN(unload_time) || unload_time < 0) {
        this.modalError.set('Unload time must be a non-negative number.');
        return;
      }
      if (isNaN(count) || count < 1) {
        this.modalError.set('Count must be at least 1.');
        return;
      }

      payload.run_time = run_time;
      payload.load_time = load_time;
      payload.unload_time = unload_time;
      payload.cycle_type = form.cycle_type;
      payload.count = count;
      payload.operations = [];
    } else {
      const ops = this.operations();
      if (!ops || ops.length === 0) {
        this.modalError.set('Please configure at least one operation.');
        return;
      }

      const seenNames = new Set<string>();
      const sanitizedOps: PartOperation[] = [];

      for (let i = 0; i < ops.length; i++) {
        const op = ops[i];
        if (!op.operation_name || !op.operation_name.trim()) {
          this.modalError.set(`Operation #${i + 1} requires an Operation Name / ID.`);
          return;
        }

        const nameKey = op.operation_name.trim().toLowerCase();
        if (seenNames.has(nameKey)) {
          this.modalError.set(`Duplicate operation name '${op.operation_name.trim()}'. Each operation name must be unique.`);
          return;
        }
        seenNames.add(nameKey);

        const rTime = Number(op.run_time);
        const lTime = Number(op.load_time);
        const uTime = Number(op.unload_time);
        const cnt = Number(op.count);

        if (isNaN(rTime) || rTime < 0 || isNaN(lTime) || lTime < 0 || isNaN(uTime) || uTime < 0) {
          this.modalError.set(`Operation '${op.operation_name.trim()}' has invalid time values. All times must be non-negative.`);
          return;
        }

        if (isNaN(cnt) || cnt < 1) {
          this.modalError.set(`Operation '${op.operation_name.trim()}' count must be at least 1.`);
          return;
        }

        sanitizedOps.push({
          operation_name: op.operation_name.trim(),
          run_time: rTime,
          load_time: lTime,
          unload_time: uTime,
          cycle_type: op.cycle_type === 'unit_per_parts' ? 'unit_per_parts' : 'part_per_cycle',
          count: cnt
        });
      }

      payload.operations = sanitizedOps;
    }

    if (this.isEditMode() && form.id) {
      this.partService.updatePart(form.id, payload).subscribe({
        next: (res) => {
          this.closeModal();
          this.showSuccess(res.message || 'Part master updated successfully.');
          this.loadParts();
        },
        error: (err) => {
          this.modalError.set(err?.error?.message || 'Failed to update part.');
        }
      });
    } else {
      this.partService.createPart(payload).subscribe({
        next: (res) => {
          this.closeModal();
          this.showSuccess(res.message || 'Part master configured successfully.');
          this.loadParts();
        },
        error: (err) => {
          this.modalError.set(err?.error?.message || 'Failed to create part.');
        }
      });
    }
  }

  // Delete flow
  openDeleteConfirm(part: PartMaster): void {
    this.partToDelete.set(part);
    this.isDeleteConfirmOpen.set(true);
  }

  closeDeleteConfirm(): void {
    this.partToDelete.set(null);
    this.isDeleteConfirmOpen.set(false);
  }

  cancelDelete(): void {
    this.closeDeleteConfirm();
  }

  executeDelete(): void {
    this.confirmDelete();
  }

  confirmDelete(): void {
    const part = this.partToDelete();
    if (!part?._id) return;

    this.partService.deletePart(part._id).subscribe({
      next: (res) => {
        this.closeDeleteConfirm();
        this.showSuccess(res.message || `Part '${part.part_name}' deleted successfully.`);
        this.loadParts();
      },
      error: (err) => {
        this.closeDeleteConfirm();
        this.errorMessage.set(err?.error?.message || 'Failed to delete part.');
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
