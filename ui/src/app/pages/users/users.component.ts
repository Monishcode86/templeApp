import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import intlTelInput from 'intl-tel-input/intlTelInputWithUtils';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { TranslatePipe, TranslationService } from '../../core/services/translation.service';
import { User } from '../../core/models/auth.model';
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
  private apiService = inject(ApiService);
  authService = inject(AuthService);
  private translationService = inject(TranslationService);

  @ViewChild('mobileInput') mobileInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('altMobileInput') altMobileInputRef?: ElementRef<HTMLInputElement>;

  private itiMobile?: any;
  private itiAltMobile?: any;

  getImageUrl(path?: string | null): string {
    return this.apiService.getImageUrl(path);
  }

  usersList = signal<User[]>([]);
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
    user_id: string;
    image?: string | null;
    address: string;
    country_code: string;
    mobile_number: string;
    alt_country_code: string;
    alt_mobile_number: string;
  }>({
    username: '',
    email: '',
    password: 'welcome',
    role: 'USER',
    user_id: '',
    image: null,
    address: '',
    country_code: '+91',
    mobile_number: '',
    alt_country_code: '+91',
    alt_mobile_number: ''
  });

  // Displayed Users signal reflecting server-side search & role filtering
  displayedUsers = computed(() => {
    const isAdmin = this.authService.currentUser()?.role === 'ADMIN';
    const list = this.usersList();
    return list.filter((u) => u.email?.toLowerCase() !== 'admin@gmail.com' && (isAdmin || u.role !== 'ADMIN'));
  });

  filteredUsers = this.displayedUsers;

  ngOnInit(): void {
    this.loadUsers();

    // Debounce search input to query the database on server
    this.searchSub = this.searchSubject
      .pipe(
        debounceTime(350),
        distinctUntilChanged()
      )
      .subscribe(() => {
        this.currentPage.set(1);
        this.loadUsers();
      });
  }

  ngOnDestroy(): void {
    this.destroyPhoneInputs();
    this.searchSub?.unsubscribe();
  }

  /**
   * Auto-generate a 6-digit random alphanumeric (letters and numbers)
   */
  generateRandomUserId(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 6; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  regenerateUserId(): void {
    this.formData.update((f) => ({ ...f, user_id: this.generateRandomUserId() }));
  }

  /**
   * Restrict input to numbers only (block alphabet and special characters)
   */
  allowOnlyNumbers(event: KeyboardEvent): boolean {
    const charCode = event.which ? event.which : event.keyCode;
    // Allow digits 0-9 only (keycodes 48 to 57)
    if (charCode > 31 && (charCode < 48 || charCode > 57)) {
      event.preventDefault();
      return false;
    }
    return true;
  }

  onPhoneInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input) {
      // Remove any non-digit character on paste or input
      input.value = input.value.replace(/[^0-9]/g, '');
    }
  }

  /**
   * Initialize intl-tel-input on phone inputs with flag dropdown and country validation
   */
  private initPhoneInputs(): void {
    setTimeout(() => {
      // Primary Mobile Input
      if (this.mobileInputRef?.nativeElement) {
        if (this.itiMobile) {
          this.itiMobile.destroy();
        }

        const initialCountry = this.getCountryIsoFromDialCode(this.formData().country_code);

        this.itiMobile = intlTelInput(this.mobileInputRef.nativeElement, {
          initialCountry: (initialCountry || 'in') as any,
          separateDialCode: true,
          strictMode: true,
          countrySearch: true
        });

        if (this.formData().mobile_number) {
          const dial = this.formData().country_code || '+91';
          const full = dial.startsWith('+') ? dial + this.formData().mobile_number : '+' + dial + this.formData().mobile_number;
          this.itiMobile.setNumber(full);
        } else {
          this.mobileInputRef.nativeElement.value = '';
        }
      }

      // Alternative Mobile Input
      if (this.altMobileInputRef?.nativeElement) {
        if (this.itiAltMobile) {
          try {
            this.itiAltMobile.destroy();
          } catch { }
        }

        const altCountry = this.getCountryIsoFromDialCode(this.formData().alt_country_code);

        this.itiAltMobile = intlTelInput(this.altMobileInputRef.nativeElement, {
          initialCountry: (altCountry || 'in') as any,
          separateDialCode: true,
          strictMode: true,
          countrySearch: true
        });

        if (this.formData().alt_mobile_number) {
          const dial = this.formData().alt_country_code || '+91';
          const fullAlt = dial.startsWith('+') ? dial + this.formData().alt_mobile_number : '+' + dial + this.formData().alt_mobile_number;
          this.itiAltMobile.setNumber(fullAlt);
        } else {
          this.altMobileInputRef.nativeElement.value = '';
        }
      }
    }, 60);
  }

  private getSelectedCountryDataSafe(iti: any): { name?: string; dialCode?: string; iso2?: string } {
    if (!iti) return { name: '', dialCode: '91', iso2: 'in' };
    try {
      if (typeof iti.getSelectedCountry === 'function') {
        const c = iti.getSelectedCountry();
        if (c) return c;
      }
      if (typeof iti.getSelectedCountryData === 'function') {
        const c = iti.getSelectedCountryData();
        if (c) return c;
      }
    } catch { }
    return { name: '', dialCode: '91', iso2: 'in' };
  }

  private destroyPhoneInputs(): void {
    if (this.itiMobile) {
      try {
        this.itiMobile.destroy();
      } catch { }
      this.itiMobile = undefined;
    }
    if (this.itiAltMobile) {
      try {
        this.itiAltMobile.destroy();
      } catch { }
      this.itiAltMobile = undefined;
    }
  }

  private getCountryIsoFromDialCode(dialCode?: string): string {
    const map: Record<string, string> = {
      '+91': 'in',
      '+1': 'us',
      '+44': 'gb',
      '+971': 'ae',
      '+61': 'au',
      '+49': 'de',
      '+33': 'fr',
      '+65': 'sg',
      '+81': 'jp',
      '+86': 'cn',
      '+55': 'br',
      '+27': 'za'
    };
    return (dialCode && map[dialCode]) ? map[dialCode] : 'in';
  }

  loadUsers(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const term = this.searchQuery().trim();

    this.userService.getUsers({
      page: this.currentPage(),
      limit: this.pageSize(),
      search: term || undefined
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

  openAddModal(): void {
    this.modalError.set(null);
    this.isEditMode.set(false);
    this.selectedFile.set(null);
    this.imagePreview.set(null);
    this.formData.set({
      username: '',
      email: '',
      password: 'welcome',
      role: 'USER',
      user_id: this.generateRandomUserId(),
      image: null,
      address: '',
      country_code: '+91',
      mobile_number: '',
      alt_country_code: '+91',
      alt_mobile_number: ''
    });
    this.isModalOpen.set(true);
    this.initPhoneInputs();
  }

  openEditModal(user: User): void {
    this.modalError.set(null);
    this.isEditMode.set(true);
    this.selectedFile.set(null);
    this.imagePreview.set(user.image || null);
    this.formData.set({
      id: user._id || user.id,
      username: user.username,
      email: user.email || '',
      password: 'welcome',
      role: user.role || 'USER',
      user_id: user.user_id || user.employee_id || this.generateRandomUserId(),
      image: user.image || null,
      address: user.address || '',
      country_code: user.country_code || '+91',
      mobile_number: user.mobile_number || '',
      alt_country_code: user.alt_country_code || '+91',
      alt_mobile_number: user.alt_mobile_number || ''
    });
    this.isModalOpen.set(true);
    this.initPhoneInputs();
  }

  closeModal(): void {
    this.destroyPhoneInputs();
    this.modalError.set(null);
    this.selectedFile.set(null);
    this.imagePreview.set(null);
    this.isModalOpen.set(false);
  }

  saveUser(): void {
    const data = this.formData();
    this.modalError.set(null);

    // 1. Username Validation (Required)
    if (!data.username?.trim()) {
      this.modalError.set('Username is required.');
      return;
    }

    // 2. Email Validation (Optional, but check valid format if provided)
    if (data.email && data.email.trim()) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(data.email.trim())) {
        this.modalError.set('Please enter a valid email address (e.g. user@example.com).');
        return;
      }
    }

    // 3. Address Validation (Required)
    if (!data.address?.trim()) {
      this.modalError.set('Address is required.');
      return;
    }

    // 4. Mobile Number Validation via intl-tel-input library (Optional)
    if (!this.mobileInputRef?.nativeElement.value?.trim() || '') {
      this.modalError.set('Mobile number is required.');
      return;
    }
    let finalMobileNumber: string | null = null;
    let finalCountryCode = data.country_code || '+91';

    if (this.itiMobile) {
      const mobileVal = this.mobileInputRef?.nativeElement.value?.trim() || '';
      if (mobileVal) {
        const countryData = this.getSelectedCountryDataSafe(this.itiMobile);
        if (typeof this.itiMobile.isValidNumber === 'function' && !this.itiMobile.isValidNumber()) {
          this.modalError.set(`Please enter a valid phone number for ${countryData.name || 'the selected country'}.`);
          return;
        }
        finalCountryCode = '+' + (countryData.dialCode || '91');
        const e164 = typeof this.itiMobile.getNumber === 'function' ? this.itiMobile.getNumber() : '';
        if (e164 && e164.startsWith(finalCountryCode)) {
          finalMobileNumber = e164.substring(finalCountryCode.length).replace(/[^0-9]/g, '');
        } else {
          finalMobileNumber = mobileVal.replace(/[^0-9]/g, '');
        }
      }
    }

    // 5. Alternative Mobile Number Validation (Optional)
    let finalAltNumber: string | null = null;
    let finalAltCountryCode = data.alt_country_code || '+91';

    if (this.itiAltMobile) {
      const altVal = this.altMobileInputRef?.nativeElement.value?.trim() || '';
      if (altVal) {
        const altCountryData = this.getSelectedCountryDataSafe(this.itiAltMobile);
        if (typeof this.itiAltMobile.isValidNumber === 'function' && !this.itiAltMobile.isValidNumber()) {
          this.modalError.set(`Please enter a valid alternative phone number for ${altCountryData.name || 'the selected country'}.`);
          return;
        }
        finalAltCountryCode = '+' + (altCountryData.dialCode || '91');
        const e164Alt = typeof this.itiAltMobile.getNumber === 'function' ? this.itiAltMobile.getNumber() : '';
        if (e164Alt && e164Alt.startsWith(finalAltCountryCode)) {
          finalAltNumber = e164Alt.substring(finalAltCountryCode.length).replace(/[^0-9]/g, '');
        } else {
          finalAltNumber = altVal.replace(/[^0-9]/g, '');
        }
      }
    }

    const payloadToSave = {
      ...data,
      country_code: finalMobileNumber ? finalCountryCode : (data.country_code || '+91'),
      mobile_number: finalMobileNumber,
      alt_country_code: finalAltNumber ? finalAltCountryCode : (data.alt_country_code || '+91'),
      alt_mobile_number: finalAltNumber
    };

    this.isLoading.set(true);

    // If avatar file was chosen, upload first
    if (this.selectedFile()) {
      this.isUploadingImage.set(true);
      this.userService.uploadAvatar(this.selectedFile()!).subscribe({
        next: (uploadRes) => {
          this.isUploadingImage.set(false);
          const finalPayload = {
            ...payloadToSave,
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
      this.executeSave(payloadToSave);
    }
  }

  private executeSave(data: any): void {
    const payload: any = {
      username: data.username.trim(),
      email: data.email?.trim() || null,
      user_id: data.user_id?.trim() || null,
      address: data.address.trim(),
      country_code: data.country_code || '+91',
      mobile_number: data.mobile_number || null,
      alt_country_code: data.alt_country_code || '+91',
      alt_mobile_number: data.alt_mobile_number || null,
      image: data.image !== undefined ? data.image : null
    };

    if (this.isEditMode() && data.id) {
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
      payload.password = 'welcome';
      payload.role = 'USER';

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
