import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { DonationService } from '../../core/services/donation.service';
import { AuthService } from '../../core/services/auth.service';
import { TranslatePipe, TranslationService } from '../../core/services/translation.service';
import { Donation, User } from '../../core/models/auth.model';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-donations',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, PaginationComponent],
  templateUrl: './donations.component.html',
  styleUrls: ['./donations.component.css']
})
export class DonationsComponent implements OnInit, OnDestroy {
  private donationService = inject(DonationService);
  authService = inject(AuthService);
  private translationService = inject(TranslationService);

  donationsList = signal<Donation[]>([]);
  usersList = signal<User[]>([]);
  searchQuery = signal<string>('');
  filterType = signal<string>('');
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);
  totalCount = signal<number>(0);

  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  modalError = signal<string | null>(null);

  // Modal states
  isModalOpen = signal<boolean>(false);
  isEditMode = signal<boolean>(false);
  isDeleteConfirmOpen = signal<boolean>(false);
  donationToDelete = signal<Donation | null>(null);

  // Confirmation modal (before saving new donation)
  isConfirmModalOpen = signal<boolean>(false);
  pendingPayload = signal<Partial<Donation> | null>(null);

  // Form state
  formData = signal<{
    id?: string;
    user_id: string;
    username: string;
    type: 'UPI' | 'Cash' | 'Cheque';
    amount: string;
    date: string;
    remarks: string;
    whatsapp_send: boolean;
  }>({
    user_id: '',
    username: '',
    type: 'UPI',
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    remarks: '',
    whatsapp_send: false
  });

  readonly donationTypes: Array<'UPI' | 'Cash' | 'Cheque'> = ['UPI', 'Cash', 'Cheque'];

  // Debounced search
  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;

  ngOnInit(): void {
    this.loadDonations();
    this.loadUsersForDropdown();

    this.searchSub = this.searchSubject
      .pipe(debounceTime(350), distinctUntilChanged())
      .subscribe(() => {
        this.currentPage.set(1);
        this.loadDonations();
      });
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  loadDonations(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const term = this.searchQuery().trim();
    const type = this.filterType();

    this.donationService.getDonations({
      page: this.currentPage(),
      limit: this.pageSize(),
      search: term || undefined,
      type: type || undefined
    }).subscribe({
      next: (res) => {
        this.donationsList.set(res.data || []);
        if (res.pagination) {
          this.totalCount.set(res.pagination.total);
        } else {
          this.totalCount.set((res.data || []).length);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Failed to load donations.');
      }
    });
  }

  loadUsersForDropdown(): void {
    this.donationService.getUsersForDropdown().subscribe({
      next: (res) => {
        // Filter out admin email and sort by username
        const users = (res.data || [])
          .filter((u) => u.email?.toLowerCase() !== 'admin@gmail.com' && u.role !== 'ADMIN')
          .sort((a, b) => a.username.localeCompare(b.username));
        this.usersList.set(users);
      },
      error: () => { /* silent — users list just stays empty */ }
    });
  }

  onUserSelect(userId: string): void {
    const selected = this.usersList().find(
      (u) => (u.user_id || u._id) === userId
    );
    if (selected) {
      this.formData.update((f) => ({
        ...f,
        user_id: selected.user_id || selected._id || '',
        username: selected.username
      }));
    } else {
      this.formData.update((f) => ({ ...f, user_id: '', username: '' }));
    }
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadDonations();
  }

  onLimitChange(limit: number): void {
    this.pageSize.set(limit);
    this.currentPage.set(1);
    this.loadDonations();
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
    this.searchSubject.next(query.trim());
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchSubject.next('');
  }

  onTypeFilterChange(type: string): void {
    this.filterType.set(type);
    this.currentPage.set(1);
    this.loadDonations();
  }

  openAddModal(): void {
    if (!this.authService.isAdmin()) {
      return;
    }
    this.modalError.set(null);
    this.isEditMode.set(false);
    this.formData.set({
      user_id: '',
      username: '',
      type: 'UPI',
      amount: '',
      date: this.getTodayDateString(),
      remarks: '',
      whatsapp_send: false
    });
    this.isModalOpen.set(true);
  }

  openEditModal(donation: Donation): void {
    this.modalError.set(null);
    this.isEditMode.set(true);
    this.formData.set({
      id: donation._id || donation.id,
      user_id: donation.user_id,
      username: donation.username || '',
      type: donation.type,
      amount: String(donation.amount),
      date: this.formatDateForInput(donation.date || donation.createdAt),
      remarks: donation.remarks || '',
      whatsapp_send: donation.whatsapp_send
    });
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.modalError.set(null);
    this.isModalOpen.set(false);
  }

  // ── Step 1: Validate & show confirmation popup ──────────────────────────────
  submitForm(): void {
    const data = this.formData();
    this.modalError.set(null);

    if (!this.isEditMode() && !this.authService.isAdmin()) {
      this.modalError.set('Only administrators can record donations.');
      return;
    }

    if (!data.user_id?.trim()) {
      this.modalError.set('Please select a user.');
      return;
    }

    if (!data.date?.trim()) {
      this.modalError.set('Please select a valid date.');
      return;
    }

    const parsedAmount = Number(data.amount);
    if (!data.amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      this.modalError.set('Amount must be a positive number.');
      return;
    }

    if (!data.type) {
      this.modalError.set('Please select a donation type.');
      return;
    }

    if (this.isEditMode()) {
      // Edit: directly save (no confirmation popup — already editing)
      this.executeSave();
    } else {
      // Add: show confirmation popup first
      this.pendingPayload.set({
        user_id: data.user_id.trim(),
        username: data.username,
        type: data.type,
        amount: parsedAmount,
        date: data.date,
        remarks: data.remarks?.trim() || null,
        whatsapp_send: false
      });
      this.isModalOpen.set(false);
      this.isConfirmModalOpen.set(true);
    }
  }

  // ── Step 2a: Confirmed → save to DB ────────────────────────────────────────
  confirmAndSave(): void {
    this.isConfirmModalOpen.set(false);
    this.executeSave();
  }

  // ── Step 2b: Go back to the add form ───────────────────────────────────────
  backToForm(): void {
    this.isConfirmModalOpen.set(false);
    this.isModalOpen.set(true);
  }

  private executeSave(): void {
    const data = this.formData();

    if (!this.isEditMode() && !this.authService.isAdmin()) {
      this.modalError.set('Only administrators can record donations.');
      return;
    }

    this.isLoading.set(true);

    if (this.isEditMode() && data.id) {
      // Only type and remarks are editable
      const payload = {
        type: data.type,
        remarks: data.remarks?.trim() || null
      };
      this.donationService.updateDonation(data.id, payload).subscribe({
        next: () => {
          this.isLoading.set(false);
          this.closeModal();
          this.showSuccess('Donation updated successfully.');
          this.loadDonations();
        },
        error: (err) => {
          this.isLoading.set(false);
          this.modalError.set(err.error?.message || 'Failed to update donation.');
          this.isModalOpen.set(true);
        }
      });
    } else {
      const payload: Partial<Donation> = this.pendingPayload() || {
        user_id: data.user_id.trim(),
        type: data.type,
        amount: Number(data.amount),
        date: data.date,
        remarks: data.remarks?.trim() || null,
        whatsapp_send: false
      };
      this.donationService.createDonation(payload).subscribe({
        next: () => {
          this.isLoading.set(false);
          this.pendingPayload.set(null);
          this.showSuccess('Donation recorded successfully.');
          this.loadDonations();
        },
        error: (err) => {
          this.isLoading.set(false);
          this.pendingPayload.set(null);
          this.isModalOpen.set(true);
          this.modalError.set(err.error?.message || 'Failed to create donation.');
        }
      });
    }
  }

  confirmDelete(donation: Donation): void {
    this.donationToDelete.set(donation);
    this.isDeleteConfirmOpen.set(true);
  }

  cancelDelete(): void {
    this.donationToDelete.set(null);
    this.isDeleteConfirmOpen.set(false);
  }

  executeDelete(): void {
    const d = this.donationToDelete();
    if (!d) return;
    const id = d._id || d.id;
    if (!id) return;

    this.isLoading.set(true);
    this.donationService.deleteDonation(id).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.cancelDelete();
        this.showSuccess('Donation deleted successfully.');
        this.loadDonations();
      },
      error: (err) => {
        this.isLoading.set(false);
        this.cancelDelete();
        this.errorMessage.set(err.error?.message || 'Failed to delete donation.');
      }
    });
  }

  formatAmount(amount: number): string {
    return '₹' + Number(amount).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  formatDate(dateVal: any): string {
    if (!dateVal) return '—';
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  getTodayDateString(): string {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  formatDateForInput(dateVal: any): string {
    if (!dateVal) return this.getTodayDateString();
    const d = new Date(dateVal);
    if (isNaN(d.getTime())) return this.getTodayDateString();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => this.successMessage.set(null), 4000);
  }
}
