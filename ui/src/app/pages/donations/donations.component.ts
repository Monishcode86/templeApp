import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  ElementRef,
  HostListener,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import { DonationService } from '../../core/services/donation.service';
import { AuthService } from '../../core/services/auth.service';
import { TranslatePipe, TranslationService } from '../../core/services/translation.service';
import { Donation, User } from '../../core/models/auth.model';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { toEnglishWords, toTamilWords } from '../../core/utils/number-to-words';
import jsPDF from 'jspdf';
import * as htmlToImage from 'html-to-image';

@Component({
  selector: 'app-donations',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, PaginationComponent],
  templateUrl: './donations.component.html',
  styleUrls: ['./donations.component.css'],
})
export class DonationsComponent implements OnInit, OnDestroy {
  private donationService = inject(DonationService);
  authService = inject(AuthService);
  private translationService = inject(TranslationService);
  private elementRef = inject(ElementRef);

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

  // Receipt View / Print Modal
  isReceiptModalOpen = signal<boolean>(false);
  receiptView = signal<Donation | null>(null);
  receiptViewLang = signal<'en' | 'ta'>('ta');
  isDownloadingPdf = signal<boolean>(false);

  // Language for the Traditional Receipt Form (Always Tamil)
  formLanguage = signal<'en' | 'ta'>('ta');

  // Searchable Head User Combobox
  userSearchText = signal<string>('');
  isUserDropdownOpen = signal<boolean>(false);
  selectedUser = signal<User | null>(null);

  // Form state
  formData = signal<{
    id?: string;
    user_id: string;
    username: string;
    donor_name: string;
    donor_mobile: string;
    donor_email: string;
    donor_address: string;
    type: 'UPI' | 'Cash' | 'Cheque';
    upi_ref_no: string;
    cheque_no: string;
    bank_name: string;
    amount: string;
    date: string;
    remarks: string;
    whatsapp_send: boolean;
  }>({
    user_id: '',
    username: '',
    donor_name: '',
    donor_mobile: '',
    donor_email: '',
    donor_address: '',
    type: 'Cash',
    upi_ref_no: '',
    cheque_no: '',
    bank_name: '',
    amount: '',
    date: this.getTodayDateString(),
    remarks: '',
    whatsapp_send: false,
  });

  readonly donationTypes: Array<'Cash' | 'UPI' | 'Cheque'> = ['Cash', 'UPI', 'Cheque'];

  // Filtered users for combobox
  filteredUsers = computed(() => {
    const list = this.usersList();
    const query = this.userSearchText().trim().toLowerCase();
    if (!query) {
      return list.slice(0, 30);
    }
    return list
      .filter((u) => {
        const name = (u.username || '').toLowerCase();
        const mobile = (u.mobile_number || '').toLowerCase();
        const email = (u.email || '').toLowerCase();
        const uid = (u.user_id || u._id || '').toLowerCase();
        return (
          name.includes(query) ||
          mobile.includes(query) ||
          email.includes(query) ||
          uid.includes(query)
        );
      })
      .slice(0, 30);
  });

  // Dynamic amount in words (calculated live as user types amount)
  amountInWords = computed(() => {
    const amt = Number(this.formData().amount);
    if (!amt || isNaN(amt) || amt <= 0) {
      return this.formLanguage() === 'ta' ? 'பூஜ்ஜியம் மட்டும்' : 'Zero Only';
    }
    return this.formLanguage() === 'ta' ? toTamilWords(amt) : toEnglishWords(amt);
  });

  // Debounced search for table
  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;

  // Click outside listener to close user combobox dropdown
  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.user-search-container')) {
      this.isUserDropdownOpen.set(false);
    }
  }

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

    this.donationService
      .getDonations({
        page: this.currentPage(),
        limit: this.pageSize(),
        search: term || undefined,
        type: type || undefined,
      })
      .subscribe({
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
        },
      });
  }

  loadUsersForDropdown(forceRefresh: boolean = true): void {
    this.donationService.getUsersForDropdown(forceRefresh).subscribe({
      next: (res) => {
        const users = (res.data || [])
          .filter((u) => u.email?.toLowerCase() !== 'admin@gmail.com' && u.role !== 'ADMIN')
          .sort((a, b) => (a.username || '').localeCompare(b.username || ''));
        this.usersList.set(users);
      },
      error: () => {
        /* silent */
      },
    });
  }

  refreshUsersCache(): void {
    this.loadUsersForDropdown(true);
  }

  // Combobox user selection
  onUserSearchInput(text: string): void {
    this.userSearchText.set(text);
    this.formData.update((f) => ({
      ...f,
      donor_name: text,
    }));
    this.isUserDropdownOpen.set(true);
  }

  openUserDropdown(): void {
    this.isUserDropdownOpen.set(true);
  }

  toggleUserDropdown(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.isUserDropdownOpen.update((v) => !v);
  }

  selectHeadUser(u: User, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.selectedUser.set(u);
    this.userSearchText.set(u.username);
    this.formData.update((f) => ({
      ...f,
      user_id: u.user_id || u._id || '',
      username: u.username,
      donor_name: u.username,
      donor_mobile: u.mobile_number || '',
      donor_email: u.email || '',
      donor_address: u.address || '',
    }));
    this.isUserDropdownOpen.set(false);
  }

  clearSelectedUser(event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.selectedUser.set(null);
    this.userSearchText.set('');
    this.formData.update((f) => ({
      ...f,
      user_id: '',
      username: '',
      donor_name: '',
      donor_mobile: '',
      donor_email: '',
      donor_address: '',
    }));
    this.isUserDropdownOpen.set(true);
  }

  // Switch form language (onload English, can switch to Tamil)
  setFormLanguage(lang: 'en' | 'ta'): void {
    this.formLanguage.set(lang);
  }

  // Switch payment mode [Cash | UPI | Cheque]
  setPaymentType(type: 'Cash' | 'UPI' | 'Cheque'): void {
    this.formData.update((f) => ({
      ...f,
      type,
      upi_ref_no: type === 'UPI' ? f.upi_ref_no : '',
      cheque_no: type === 'Cheque' ? f.cheque_no : '',
      bank_name: type === 'Cheque' ? f.bank_name : '',
    }));
  }

  onAmountChange(val: any): void {
    let str = String(val === null || val === undefined ? '' : val).trim();
    if (str.length > 10) {
      str = str.slice(0, 10);
    }
    const num = Number(str);
    if (!isNaN(num) && num > 9999999999) {
      str = '9999999999';
    }
    this.formData.update((f) => ({ ...f, amount: str }));
  }

  onRemarksChange(val: any): void {
    const text = val || '';
    this.formData.update((f) => ({
      ...f,
      remarks: text,
      bank_name: text,
    }));
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
    this.formLanguage.set('ta'); // Always Tamil
    this.selectedUser.set(null);
    this.userSearchText.set('');
    this.isUserDropdownOpen.set(false);

    this.formData.set({
      user_id: '',
      username: '',
      donor_name: '',
      donor_mobile: '',
      donor_email: '',
      donor_address: '',
      type: 'Cash',
      upi_ref_no: '',
      cheque_no: '',
      bank_name: '',
      amount: '',
      date: this.getTodayDateString(),
      remarks: '',
      whatsapp_send: false,
    });
    this.isModalOpen.set(true);
  }

  openEditModal(donation: Donation): void {
    this.modalError.set(null);
    this.isEditMode.set(true);
    this.userSearchText.set(
      donation.username ? `${donation.username} (${donation.user_id})` : donation.user_id,
    );

    this.formData.set({
      id: donation._id || donation.id,
      user_id: donation.user_id,
      username: donation.username || '',
      donor_name: donation.donor_name || donation.username || '',
      donor_mobile: donation.donor_mobile || '',
      donor_email: donation.donor_email || '',
      donor_address: donation.donor_address || '',
      type: donation.type,
      upi_ref_no: donation.upi_ref_no || '',
      cheque_no: donation.cheque_no || '',
      bank_name: donation.bank_name || '',
      amount: String(donation.amount),
      date: this.formatDateForInput(donation.date || donation.createdAt),
      remarks: donation.remarks || '',
      whatsapp_send: donation.whatsapp_send,
    });
    this.isModalOpen.set(true);
  }

  closeModal(): void {
    this.modalError.set(null);
    this.isModalOpen.set(false);
  }

  // View & Print Receipt
  openReceiptModal(donation: Donation, lang: 'en' | 'ta' = 'ta'): void {
    this.receiptView.set(donation);
    this.receiptViewLang.set(lang);
    this.isReceiptModalOpen.set(true);
  }

  closeReceiptModal(): void {
    this.isReceiptModalOpen.set(false);
    this.receiptView.set(null);
  }

  setReceiptViewLang(lang: 'en' | 'ta'): void {
    this.receiptViewLang.set(lang);
  }

  printReceipt(): void {
    window.print();
  }

  async downloadReceiptPdf(): Promise<void> {
    const d = this.receiptView();
    if (!d) return;

    const receiptElem = document.getElementById('printable-receipt-slip');
    if (!receiptElem) return;

    this.isDownloadingPdf.set(true);

    try {
      // Use html-to-image (SVG ForeignObject) to render the element using the browser's
      // native text shaping engine (HarfBuzz), preserving Tamil ligatures like ஸ்ரீ (Sri) perfectly.
      const dataUrl = await htmlToImage.toPng(receiptElem, {
        quality: 1,
        pixelRatio: 2.5,
        backgroundColor: '#ffffff',
      });

      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();

      const margin = 8;
      const maxWidth = pageWidth - margin * 2;
      const maxHeight = pageHeight - margin * 2;

      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = (e) => reject(e);
      });

      let imgWidth = maxWidth;
      let imgHeight = (img.naturalHeight * imgWidth) / img.naturalWidth;

      if (imgHeight > maxHeight) {
        imgHeight = maxHeight;
        imgWidth = (img.naturalWidth * imgHeight) / img.naturalHeight;
      }

      const xPos = (pageWidth - imgWidth) / 2;
      const yPos = (pageHeight - imgHeight) / 2;

      pdf.addImage(dataUrl, 'PNG', xPos, yPos, imgWidth, imgHeight);

      const rawNumber = d.receipt_number || `receipt_${d.receipt_no || d._id}`;
      const safeNumber = rawNumber.replace(/[/\\?%*:|"<>]/g, '_');
      pdf.save(`Donation_Receipt_${safeNumber}.pdf`);
    } catch (err) {
      console.error('PDF generation error:', err);
      alert('Failed to generate PDF. Please try again.');
    } finally {
      this.isDownloadingPdf.set(false);
    }
  }

  // Submit Receipt Form
  submitForm(): void {
    const data = this.formData();
    this.modalError.set(null);

    if (!this.isEditMode() && !this.authService.isAdmin()) {
      this.modalError.set('Only administrators can record donations.');
      return;
    }

    if (!data.user_id?.trim()) {
      this.modalError.set(
        this.formLanguage() === 'ta'
          ? 'தயவுசெய்து தலைமைப் பயனரைத் தேர்ந்தெடுக்கவும்.'
          : 'Please select a head user (donor).',
      );
      return;
    }

    if (!data.date?.trim()) {
      this.modalError.set(
        this.formLanguage() === 'ta'
          ? 'தேதியைத் தேர்ந்தெடுக்கவும்.'
          : 'Please select a valid date.',
      );
      return;
    }

    const parsedAmount = Number(data.amount);
    if (!data.amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      this.modalError.set(
        this.formLanguage() === 'ta'
          ? 'தொகை 0 ஐ விட அதிகமாக இருக்க வேண்டும்.'
          : 'Amount must be greater than 0.',
      );
      return;
    }

    if (parsedAmount > 9999999999) {
      this.modalError.set(
        this.formLanguage() === 'ta'
          ? 'தொகை ₹9,99,99,99,999 ஐ தாண்டக்கூடாது.'
          : 'Amount cannot exceed ₹9,99,99,99,999.',
      );
      return;
    }

    if (data.type === 'UPI' && !data.upi_ref_no?.trim()) {
      this.modalError.set(
        this.formLanguage() === 'ta'
          ? 'UPI முறைக்கு UPI குறிப்பு எண் (Ref No) கட்டாயம்.'
          : 'UPI Reference Number is required for UPI donations.',
      );
      return;
    }

    if (data.type === 'Cheque' && !data.cheque_no?.trim()) {
      this.modalError.set(
        this.formLanguage() === 'ta'
          ? 'காசோலை முறைக்கு காசோலை எண் கட்டாயம்.'
          : 'Cheque Number is required for Cheque donations.',
      );
      return;
    }

    this.executeSave();
  }

  private executeSave(): void {
    const data = this.formData();
    this.isLoading.set(true);

    if (this.isEditMode() && data.id) {
      const payload: Partial<Donation> = {
        amount: Number(data.amount),
        type: data.type,
        upi_ref_no: data.type === 'UPI' ? data.upi_ref_no.trim() : null,
        cheque_no: data.type === 'Cheque' ? data.cheque_no.trim() : null,
        bank_name: data.type === 'Cheque' ? data.bank_name?.trim() || null : null,
        donor_name: data.donor_name?.trim() || data.username,
        donor_mobile: data.donor_mobile?.trim() || null,
        remarks: data.remarks?.trim() || null,
      };

      this.donationService.updateDonation(data.id, payload).subscribe({
        next: (res) => {
          this.isLoading.set(false);
          this.closeModal();
          this.showSuccess('Donation updated successfully.');
          this.loadDonations();
        },
        error: (err) => {
          this.isLoading.set(false);
          this.modalError.set(err.error?.message || 'Failed to update donation.');
        },
      });
    } else {
      const payload: Partial<Donation> = {
        user_id: data.user_id.trim(),
        donor_name: data.donor_name?.trim() || data.username,
        donor_mobile: data.donor_mobile?.trim() || null,
        donor_email: data.donor_email?.trim() || null,
        donor_address: data.donor_address?.trim() || null,
        type: data.type,
        upi_ref_no: data.type === 'UPI' ? data.upi_ref_no.trim() : null,
        cheque_no: data.type === 'Cheque' ? data.cheque_no.trim() : null,
        bank_name: data.type === 'Cheque' ? data.bank_name?.trim() || null : null,
        amount: Number(data.amount),
        date: data.date,
        remarks: data.remarks?.trim() || null,
        whatsapp_send: false,
      };

      this.donationService.createDonation(payload).subscribe({
        next: (res) => {
          this.isLoading.set(false);
          this.closeModal();
          const savedReceipt = res.data;
          this.showSuccess(
            `Donation recorded successfully! Receipt No: ${savedReceipt?.receipt_number || ''}`,
          );
          this.loadDonations();
          // Open the receipt view modal immediately so the user can inspect/print with the backend-assigned receipt number!
          if (savedReceipt) {
            this.openReceiptModal(savedReceipt, this.formLanguage());
          }
        },
        error: (err) => {
          this.isLoading.set(false);
          this.modalError.set(err.error?.message || 'Failed to create donation.');
        },
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
      },
    });
  }

  formatAmount(amount: number): string {
    return (
      '₹' +
      Number(amount).toLocaleString('en-IN', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
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

  getReceiptWords(d: Donation | null, lang: 'en' | 'ta'): string {
    if (!d) return '';
    if (lang === 'ta') {
      return d.amount_in_words_ta || toTamilWords(d.amount);
    }
    return d.amount_in_words || toEnglishWords(d.amount);
  }

  private showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => this.successMessage.set(null), 5000);
  }
}
