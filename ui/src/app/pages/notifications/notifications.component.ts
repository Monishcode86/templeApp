import {
  Component,
  inject,
  signal,
  OnInit,
  OnDestroy
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { NotificationService } from '../../core/services/notification.service';
import { AuthService } from '../../core/services/auth.service';
import { TranslatePipe } from '../../core/services/translation.service';
import { PendingNotification, NotificationFailure } from '../../core/models/auth.model';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, PaginationComponent],
  templateUrl: './notifications.component.html',
  styleUrls: ['./notifications.component.css']
})
export class NotificationsComponent implements OnInit, OnDestroy {
  private notificationService = inject(NotificationService);
  authService = inject(AuthService);

  activeTab = signal<'pending' | 'failed'>('pending');

  pendingList = signal<PendingNotification[]>([]);
  failedList = signal<NotificationFailure[]>([]);

  searchQuery = signal<string>('');
  currentPage = signal<number>(1);
  pageSize = signal<number>(10);
  totalCount = signal<number>(0);

  isLoading = signal<boolean>(false);
  sendingIds = signal<Set<string>>(new Set());
  selectedIds = signal<Set<string>>(new Set());
  isBulkSending = signal<boolean>(false);
  errorMessage = signal<string | null>(null);
  successMessage = signal<string | null>(null);
  whatsappStatus = signal<{ provider: string; status: string; info?: any; message?: string } | null>(null);

  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;

  ngOnInit(): void {
    this.loadData();
    this.checkWhatsAppStatus();

    this.searchSub = this.searchSubject
      .pipe(debounceTime(350), distinctUntilChanged())
      .subscribe(() => {
        this.currentPage.set(1);
        this.loadData();
      });
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
  }

  checkWhatsAppStatus(): void {
    this.notificationService.getWhatsAppStatus().subscribe({
      next: (res) => {
        if (res.data) {
          this.whatsappStatus.set(res.data);
        }
      },
      error: () => {
        // Silently keep default
      }
    });
  }

  switchTab(tab: 'pending' | 'failed'): void {
    this.activeTab.set(tab);
    this.currentPage.set(1);
    this.searchQuery.set('');
    this.errorMessage.set(null);
    this.selectedIds.set(new Set());
    this.loadData();
  }

  loadData(): void {
    if (this.activeTab() === 'pending') {
      this.loadPending();
    } else {
      this.loadFailed();
    }
  }

  loadPending(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const term = this.searchQuery().trim();

    this.notificationService.getPendingNotifications({
      page: this.currentPage(),
      limit: this.pageSize(),
      search: term || undefined
    }).subscribe({
      next: (res) => {
        const list = res.data || [];
        this.pendingList.set(list);
        if (res.pagination) {
          this.totalCount.set(res.pagination.total);
        } else {
          this.totalCount.set(list.length);
        }
        // Retain only selected IDs that are still in pending
        const validIds = new Set(list.map(d => d._id || d.id).filter(Boolean) as string[]);
        const currentSelected = new Set(this.selectedIds());
        for (const sid of currentSelected) {
          if (!validIds.has(sid)) {
            currentSelected.delete(sid);
          }
        }
        this.selectedIds.set(currentSelected);

        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Failed to load pending notifications.');
      }
    });
  }

  loadFailed(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const term = this.searchQuery().trim();

    this.notificationService.getFailedNotifications({
      page: this.currentPage(),
      limit: this.pageSize(),
      search: term || undefined
    }).subscribe({
      next: (res) => {
        this.failedList.set(res.data || []);
        if (res.pagination) {
          this.totalCount.set(res.pagination.total);
        } else {
          this.totalCount.set((res.data || []).length);
        }
        this.isLoading.set(false);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Failed to load failed notification records.');
      }
    });
  }

  /* ─────────────────────────────────────────────────────────────
     SELECTION METHODS
  ───────────────────────────────────────────────────────────── */
  isSelected(id?: string): boolean {
    if (!id) return false;
    return this.selectedIds().has(id);
  }

  toggleSelect(id?: string, event?: Event): void {
    if (event) event.stopPropagation();
    if (!id) return;
    const current = new Set(this.selectedIds());
    if (current.has(id)) {
      current.delete(id);
    } else {
      current.add(id);
    }
    this.selectedIds.set(current);
  }

  selectAll(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.checked) {
      // Select all actionable pending items with valid mobile numbers
      const actionable = this.pendingList()
        .filter(d => d.has_valid_mobile && !this.isSending(d._id || d.id))
        .map(d => d._id || d.id)
        .filter(Boolean) as string[];
      this.selectedIds.set(new Set(actionable));
    } else {
      this.selectedIds.set(new Set());
    }
  }

  isAllSelected(): boolean {
    const selectable = this.pendingList().filter(d => d.has_valid_mobile && !this.isSending(d._id || d.id));
    if (selectable.length === 0) return false;
    return selectable.every(d => this.selectedIds().has((d._id || d.id)!));
  }

  isIndeterminate(): boolean {
    const selectable = this.pendingList().filter(d => d.has_valid_mobile && !this.isSending(d._id || d.id));
    const count = selectable.filter(d => this.selectedIds().has((d._id || d.id)!)).length;
    return count > 0 && count < selectable.length;
  }

  /* ─────────────────────────────────────────────────────────────
     SENDING METHODS
  ───────────────────────────────────────────────────────────── */
  sendWhatsApp(donation: PendingNotification): void {
    const id = donation._id || donation.id;
    if (!id) return;

    if (!this.authService.isAdmin()) {
      this.errorMessage.set('Only administrators can send WhatsApp notifications.');
      return;
    }

    if (this.isSending(id)) {
      return; // Prevent duplicate clicks while in-progress
    }

    // Set sending state
    const currentSending = new Set(this.sendingIds());
    currentSending.add(id);
    this.sendingIds.set(currentSending);

    this.errorMessage.set(null);

    this.notificationService.sendNotification(id).subscribe({
      next: () => {
        const updated = new Set(this.sendingIds());
        updated.delete(id);
        this.sendingIds.set(updated);

        // Remove from selected set if present
        const currentSelected = new Set(this.selectedIds());
        currentSelected.delete(id);
        this.selectedIds.set(currentSelected);

        const phoneDisplay = donation.mobile_number
          ? `${donation.country_code || '+91'} ${donation.mobile_number}`
          : '';
        this.showSuccess(`WhatsApp message sent successfully to ${donation.username || 'donor'} ${phoneDisplay}!`);

        // Refresh pending list
        this.loadPending();
        this.checkWhatsAppStatus();
      },
      error: (err) => {
        const updated = new Set(this.sendingIds());
        updated.delete(id);
        this.sendingIds.set(updated);

        const errorMsg = err.error?.message || err.message || 'WhatsApp sending failed.';
        this.errorMessage.set(`${errorMsg} Recorded into Failed Notifications.`);

        // Refresh pending list so failure status or updates reflect
        this.loadPending();
        this.checkWhatsAppStatus();
      }
    });
  }

  sendSelected(): void {
    const ids = Array.from(this.selectedIds());
    if (ids.length === 0 || this.isBulkSending()) return;

    if (!this.authService.isAdmin()) {
      this.errorMessage.set('Only administrators can send WhatsApp notifications.');
      return;
    }

    this.isBulkSending.set(true);
    this.errorMessage.set(null);

    // Mark all selected ids as sending in UI
    const currentSending = new Set(this.sendingIds());
    ids.forEach(id => currentSending.add(id));
    this.sendingIds.set(currentSending);

    this.notificationService.sendBulkNotifications(ids).subscribe({
      next: (res) => {
        this.isBulkSending.set(false);
        // Clear sending flags for these ids
        const updatedSending = new Set(this.sendingIds());
        ids.forEach(id => updatedSending.delete(id));
        this.sendingIds.set(updatedSending);

        // Clear selection
        this.selectedIds.set(new Set());

        const data = res.data;
        if (data) {
          if (data.successful > 0 && data.failed === 0) {
            this.showSuccess(`Successfully sent ${data.successful} WhatsApp notification(s) in parallel!`);
          } else if (data.successful > 0 && data.failed > 0) {
            this.showSuccess(`Sent ${data.successful} message(s). ${data.failed} failed and recorded into Failed Deliveries.`);
          } else {
            this.errorMessage.set(`Bulk dispatch completed: ${data.failed} failed. Check Failed Deliveries tab.`);
          }
        } else {
          this.showSuccess('Bulk WhatsApp dispatch completed.');
        }

        this.loadPending();
        this.checkWhatsAppStatus();
      },
      error: (err) => {
        this.isBulkSending.set(false);
        const updatedSending = new Set(this.sendingIds());
        ids.forEach(id => updatedSending.delete(id));
        this.sendingIds.set(updatedSending);

        this.errorMessage.set(err.error?.message || 'Bulk notification dispatch failed.');
        this.loadPending();
        this.checkWhatsAppStatus();
      }
    });
  }

  retryFailed(failure: NotificationFailure): void {
    const donationId = failure.donation_id;
    if (!donationId) return;

    const currentSending = new Set(this.sendingIds());
    currentSending.add(failure._id || donationId);
    this.sendingIds.set(currentSending);

    this.notificationService.sendNotification(donationId).subscribe({
      next: () => {
        const updated = new Set(this.sendingIds());
        updated.delete(failure._id || donationId);
        this.sendingIds.set(updated);

        this.showSuccess(`WhatsApp message successfully redelivered to ${failure.username || 'donor'}!`);
        this.loadFailed();
        this.checkWhatsAppStatus();
      },
      error: (err) => {
        const updated = new Set(this.sendingIds());
        updated.delete(failure._id || donationId);
        this.sendingIds.set(updated);

        this.errorMessage.set(err.error?.message || 'Retry delivery failed.');
        this.loadFailed();
        this.checkWhatsAppStatus();
      }
    });
  }

  isSending(id?: string): boolean {
    if (!id) return false;
    return this.sendingIds().has(id);
  }

  onSearchChange(query: string): void {
    this.searchQuery.set(query);
    this.searchSubject.next(query.trim());
  }

  clearSearch(): void {
    this.searchQuery.set('');
    this.searchSubject.next('');
  }

  onPageChange(page: number): void {
    this.currentPage.set(page);
    this.loadData();
  }

  onLimitChange(limit: number): void {
    this.pageSize.set(limit);
    this.currentPage.set(1);
    this.loadData();
  }

  formatAmount(amount: number): string {
    return '₹' + Number(amount || 0).toLocaleString('en-IN', {
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

  private showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => this.successMessage.set(null), 4500);
  }
}
