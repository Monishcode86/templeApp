import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription, debounceTime, distinctUntilChanged } from 'rxjs';
import intlTelInput from 'intl-tel-input/intlTelInputWithUtils';
import { UserService } from '../../core/services/user.service';
import { AuthService } from '../../core/services/auth.service';
import { ApiService } from '../../core/services/api.service';
import { TranslatePipe, TranslationService } from '../../core/services/translation.service';
import { User, FamilyMember } from '../../core/models/auth.model';
import { PaginationComponent } from '../../shared/components/pagination/pagination.component';
import { COUNTRIES, getStatesForCountry, getCitiesForState } from '../../core/data/location.data';
import { TamilKeypadComponent } from '../../shared/components/tamil-keypad/tamil-keypad.component';
import { TamilInputService, InputMode } from '../../core/services/tamil-input.service';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe, PaginationComponent, TamilKeypadComponent],
  templateUrl: './users.component.html',
  styleUrls: ['./users.component.css'],
})
export class UsersComponent implements OnInit, OnDestroy {
  private userService = inject(UserService);
  private apiService = inject(ApiService);
  authService = inject(AuthService);
  private translationService = inject(TranslationService);
  tamilInputService = inject(TamilInputService);
  inputMode = this.tamilInputService.inputMode;

  @ViewChild('mobileInput') mobileInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('altMobileInput') altMobileInputRef?: ElementRef<HTMLInputElement>;

  private itiMobile?: any;
  private itiAltMobile?: any;

  readonly relationTypes = [
    { value: 'son', labelKey: 'RELATION_SON' },
    { value: 'daughter', labelKey: 'RELATION_DAUGHTER' },
    { value: 'wife', labelKey: 'RELATION_WIFE' },
    { value: 'husband', labelKey: 'RELATION_HUSBAND' },
    { value: 'father', labelKey: 'RELATION_FATHER' },
    { value: 'mom', labelKey: 'RELATION_MOTHER' },
    { value: 'uncle', labelKey: 'RELATION_UNCLE' },
    { value: 'aunt', labelKey: 'RELATION_AUNT' },
    { value: 'grandfather', labelKey: 'RELATION_GRANDFATHER' },
    { value: 'grandmother', labelKey: 'RELATION_GRANDMOTHER' },
  ];

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
  isFamilyModalOpen = signal<boolean>(false);
  selectedUserForFamily = signal<User | null>(null);

  // Image Upload State
  selectedFile = signal<File | null>(null);
  imagePreview = signal<string | null>(null);
  isUploadingImage = signal<boolean>(false);

  // Debounced search subject
  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;

  // Location state & helpers
  countriesList = COUNTRIES;

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
    address_line1: string;
    address_line2: string;
    nation: string;
    state: string;
    city: string;
    pincode: string;
    country_code: string;
    mobile_number: string;
    alt_country_code: string;
    alt_mobile_number: string;
    family_data: FamilyMember[];
  }>({
    username: '',
    email: '',
    password: 'welcome',
    role: 'USER',
    user_id: '',
    image: null,
    address: '',
    address_line1: '',
    address_line2: '',
    nation: 'India',
    state: 'Tamil Nadu',
    city: 'Coimbatore',
    pincode: '',
    country_code: '+91',
    mobile_number: '',
    alt_country_code: '+91',
    alt_mobile_number: '',
    family_data: [],
  });

  // Dynamic States based on selected Nation
  availableStates = computed(() => getStatesForCountry(this.formData().nation));

  // Dynamic City suggestions based on selected State
  availableCities = computed(() => getCitiesForState(this.formData().state));

  // Live formatted address preview
  formattedAddressPreview = computed(() => {
    const f = this.formData();
    const parts = [
      f.address_line1?.trim(),
      f.address_line2?.trim() || null,
      f.city?.trim() || null,
      f.pincode?.trim()
        ? `${f.state?.trim() || ''} - ${f.pincode.trim()}`
        : f.state?.trim() || null,
      f.nation?.trim() || null,
    ].filter(Boolean);
    return parts.join(', ');
  });

  /**
   * Helper to format city, state, pincode, nation for table display
   */
  formatUserLocation(user: User): string {
    const parts: string[] = [];
    if (user.city) parts.push(user.city);
    if (user.state) parts.push(user.state);
    let loc = parts.join(', ');
    if (user.pincode) {
      loc = loc ? `${loc} - ${user.pincode}` : user.pincode;
    }
    if (user.nation) {
      loc = loc ? `${loc} (${user.nation})` : user.nation;
    }
    return loc;
  }

  // Displayed Users signal reflecting server-side search & role filtering
  displayedUsers = computed(() => {
    const isAdmin = this.authService.currentUser()?.role === 'ADMIN';
    const list = this.usersList();
    return list.filter(
      (u) => u.email?.toLowerCase() !== 'admin@gmail.com' && (isAdmin || u.role !== 'ADMIN'),
    );
  });

  filteredUsers = this.displayedUsers;

  ngOnInit(): void {
    this.loadUsers();

    // Debounce search input to query the database on server
    this.searchSub = this.searchSubject
      .pipe(debounceTime(350), distinctUntilChanged())
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
          countrySearch: true,
        });

        if (this.formData().mobile_number) {
          const dial = this.formData().country_code || '+91';
          const full = dial.startsWith('+')
            ? dial + this.formData().mobile_number
            : '+' + dial + this.formData().mobile_number;
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
          } catch {}
        }

        const altCountry = this.getCountryIsoFromDialCode(this.formData().alt_country_code);

        this.itiAltMobile = intlTelInput(this.altMobileInputRef.nativeElement, {
          initialCountry: (altCountry || 'in') as any,
          separateDialCode: true,
          strictMode: true,
          countrySearch: true,
        });

        if (this.formData().alt_mobile_number) {
          const dial = this.formData().alt_country_code || '+91';
          const fullAlt = dial.startsWith('+')
            ? dial + this.formData().alt_mobile_number
            : '+' + dial + this.formData().alt_mobile_number;
          this.itiAltMobile.setNumber(fullAlt);
        } else {
          this.altMobileInputRef.nativeElement.value = '';
        }
      }
    }, 60);
  }

  private getSelectedCountryDataSafe(iti: any): {
    name?: string;
    dialCode?: string;
    iso2?: string;
  } {
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
    } catch {}
    return { name: '', dialCode: '91', iso2: 'in' };
  }

  private destroyPhoneInputs(): void {
    if (this.itiMobile) {
      try {
        this.itiMobile.destroy();
      } catch {}
      this.itiMobile = undefined;
    }
    if (this.itiAltMobile) {
      try {
        this.itiAltMobile.destroy();
      } catch {}
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
      '+27': 'za',
    };
    return dialCode && map[dialCode] ? map[dialCode] : 'in';
  }

  loadUsers(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    const term = this.searchQuery().trim();

    this.userService
      .getUsers({
        page: this.currentPage(),
        limit: this.pageSize(),
        search: term || undefined,
      })
      .subscribe({
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
        },
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
    this.formData.update((f) => ({ ...f, image: null }));
  }

  onNationChange(nation: string): void {
    const isIndia = nation?.trim().toLowerCase() === 'india';
    this.formData.update((f) => ({
      ...f,
      nation,
      state: isIndia ? 'Tamil Nadu' : '',
      city: isIndia ? 'Coimbatore' : '',
    }));
  }

  onStateChange(state: string): void {
    const isTN = state?.trim().toLowerCase() === 'tamil nadu';
    this.formData.update((f) => ({
      ...f,
      state,
      city: isTN ? 'Coimbatore' : '',
    }));
  }

  onCityChange(city: string): void {
    this.formData.update((f) => ({
      ...f,
      city,
    }));
  }

  onAddressLine1Change(address_line1: string): void {
    this.formData.update((f) => ({
      ...f,
      address_line1,
    }));
  }

  onAddressLine2Change(address_line2: string): void {
    this.formData.update((f) => ({
      ...f,
      address_line2,
    }));
  }

  onPincodeChange(pincode: string): void {
    this.formData.update((f) => ({
      ...f,
      pincode,
    }));
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
      address_line1: '',
      address_line2: '',
      nation: 'India',
      state: 'Tamil Nadu',
      city: 'Coimbatore',
      pincode: '',
      country_code: '+91',
      mobile_number: '',
      alt_country_code: '+91',
      alt_mobile_number: '',
      family_data: [],
    });
    this.isModalOpen.set(true);
    this.initPhoneInputs();

    // Set initial input mode: Tamil if current UI language is Tamil, otherwise English
    const defaultMode: InputMode =
      this.translationService.currentLanguage() === 'ta' ? 'tanglish' : 'english';
    this.onInputModeChange(defaultMode);
  }

  openEditModal(user: User): void {
    this.modalError.set(null);
    this.isEditMode.set(true);
    this.selectedFile.set(null);
    this.imagePreview.set(user.image || null);

    const userNation = user.nation || 'India';
    const isIndia = userNation.trim().toLowerCase() === 'india';
    const userState = user.state || (isIndia ? 'Tamil Nadu' : '');
    const isTN = userState.trim().toLowerCase() === 'tamil nadu';
    const userCity = user.city || (isTN ? 'Coimbatore' : '');

    this.formData.set({
      id: user._id || user.id,
      username: user.username,
      email: user.email || '',
      password: 'welcome',
      role: user.role || 'USER',
      user_id: user.user_id || user.employee_id || this.generateRandomUserId(),
      image: user.image || null,
      address: user.address || '',
      address_line1: user.address_line1 || user.address || '',
      address_line2: user.address_line2 || '',
      nation: userNation,
      state: userState,
      city: userCity,
      pincode: user.pincode || '',
      country_code: user.country_code || '+91',
      mobile_number: user.mobile_number || '',
      alt_country_code: user.alt_country_code || '+91',
      alt_mobile_number: user.alt_mobile_number || '',
      family_data: (user.family_data || []).map((m) => ({ ...m })),
    });
    this.isModalOpen.set(true);
    this.initPhoneInputs();

    // Set initial input mode: Tamil if current UI language is Tamil, otherwise English
    const defaultMode: InputMode =
      this.translationService.currentLanguage() === 'ta' ? 'tanglish' : 'english';
    this.onInputModeChange(defaultMode);
  }

  closeModal(): void {
    this.destroyPhoneInputs();
    this.modalError.set(null);
    this.selectedFile.set(null);
    this.imagePreview.set(null);
    this.isModalOpen.set(false);
    this.onInputModeChange('english');
  }

  /**
   * Register active input element for virtual keypad
   */
  onInputFocus(event: FocusEvent): void {
    this.tamilInputService.registerActiveInput(event.target);
  }

  /**
   * Handle dropdown change for input mode:
   * - english: only english typing
   * - tamil: opens windows tamil keyboard
   * - tanglish: converts english to tamil after space bar
   */
  onInputModeChange(mode: InputMode): void {
    this.tamilInputService.setInputMode(mode);
  }

  /**
   * Handle Tanglish to Tamil phonetic transliteration on keydown (Space bar)
   */
  onTanglishKeyDown(
    event: KeyboardEvent,
    fieldName: 'username' | 'address_line1' | 'address_line2' | 'state' | 'city',
  ): void {
    if (this.tamilInputService.inputMode() !== 'tanglish') return;
    this.tamilInputService.handleKeyDown(event, (newVal) => {
      this.formData.update((f) => ({ ...f, [fieldName]: newVal }));
    });
  }

  /**
   * Family members (sub-users) management
   */
  addFamilyMember(): void {
    const current = this.formData().family_data || [];
    this.formData.update((f) => ({
      ...f,
      family_data: [
        ...current,
        {
          username: '',
          email: '',
          country_code: '+91',
          mobile_number: '',
          relation_type: 'son',
        },
      ],
    }));
  }

  removeFamilyMember(index: number): void {
    const current = [...(this.formData().family_data || [])];
    current.splice(index, 1);
    this.formData.update((f) => ({
      ...f,
      family_data: current,
    }));
  }

  updateFamilyMember(index: number, field: keyof FamilyMember, value: any): void {
    const list = [...(this.formData().family_data || [])];
    if (list[index]) {
      list[index] = { ...list[index], [field]: value };
      this.formData.update((f) => ({ ...f, family_data: list }));
    }
  }

  onTanglishFamilyKeyDown(
    event: KeyboardEvent,
    index: number,
    fieldName: keyof FamilyMember,
  ): void {
    if (this.tamilInputService.inputMode() !== 'tanglish') return;
    this.tamilInputService.handleKeyDown(event, (newVal) => {
      this.updateFamilyMember(index, fieldName, newVal);
    });
  }

  getFamilyMembersSummary(user: User): string {
    const list = this.getFamilyMembersList(user);
    return list.map((m) => `${m.username} (${m.relation_type})`).join(', ');
  }

  getFamilyMembersList(user: User | null): FamilyMember[] {
    if (!user) return [];
    return user.family_data || [];
  }

  openFamilyModal(user: User): void {
    this.selectedUserForFamily.set(user);
    this.isFamilyModalOpen.set(true);
  }

  closeFamilyModal(): void {
    this.isFamilyModalOpen.set(false);
    this.selectedUserForFamily.set(null);
  }

  getRelationLabel(relValue?: string): string {
    if (!relValue) return '—';
    const match = this.relationTypes.find((r) => r.value.toLowerCase() === relValue.toLowerCase());
    return match ? match.labelKey : relValue;
  }

  /**
   * Toggle the Windows Tamil Keypad manually
   */
  toggleTamilKeypad(): void {
    this.tamilInputService.toggleKeypad();
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

    // 3. Address Validations
    if (!data.address_line1?.trim()) {
      this.modalError.set('Address Line 1 is required.');
      return;
    }
    if (!data.nation?.trim()) {
      this.modalError.set('Please select a Nation.');
      return;
    }
    if (!data.state?.trim()) {
      this.modalError.set('Please select or enter a State.');
      return;
    }
    if (!data.city?.trim()) {
      this.modalError.set('City is required.');
      return;
    }
    if (!data.pincode?.trim()) {
      this.modalError.set('Pincode is required.');
      return;
    }

    // 4. Mobile Number Validation via intl-tel-input library (Required)
    if (!this.mobileInputRef?.nativeElement.value?.trim() || '') {
      this.modalError.set('Mobile number is required.');
      return;
    }

    // 5. Family Members Validation (Optional collection, but if row exists, username & relation are required)
    const family = data.family_data || [];
    const mainEmail = (data.email || '').trim().toLowerCase();
    const seenFamilyEmails: { email: string; index: number }[] = [];

    for (let i = 0; i < family.length; i++) {
      const member = family[i];
      if (!member.username?.trim()) {
        this.modalError.set(`Family member #${i + 1}: Username is required.`);
        return;
      }
      if (!member.relation_type?.trim()) {
        this.modalError.set(`Family member #${i + 1}: Relation type is required.`);
        return;
      }
      if (member.email && member.email.trim()) {
        const mEmail = member.email.trim().toLowerCase();
        const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!emailRegex.test(mEmail)) {
          this.modalError.set(`Family member #${i + 1}: Please enter a valid email address.`);
          return;
        }

        // Check against main user email
        if (mainEmail && mEmail === mainEmail) {
          this.modalError.set(
            `Family member #${i + 1} has the same email ('${member.email}') as the main user. Email must be unique.`,
          );
          return;
        }

        // Check against other family members in this form
        const duplicate = seenFamilyEmails.find((f) => f.email === mEmail);
        if (duplicate) {
          this.modalError.set(
            `Family member #${i + 1} and #${duplicate.index + 1} have the same email ('${member.email}'). Email must be unique.`,
          );
          return;
        }

        seenFamilyEmails.push({ email: mEmail, index: i });
      }
    }

    // 6. Fast Client-side Check: Check all emails against currently loaded users in the table
    const currentId = this.isEditMode() ? data.id || (data as any)._id : null;
    const allFormEmails = [
      ...(mainEmail ? [{ email: mainEmail, source: 'Main user' }] : []),
      ...seenFamilyEmails.map((f) => ({ email: f.email, source: `Family member #${f.index + 1}` })),
    ];

    for (const item of allFormEmails) {
      const conflict = this.usersList().find((u: User) => {
        const uId = u.id || (u as any)._id;
        if (currentId && uId === currentId) return false;

        const uEmail = (u.email || '').trim().toLowerCase();
        if (uEmail && uEmail === item.email) return true;

        const uFamily = u.family_data || [];
        return uFamily.some((fm: any) => (fm.email || '').trim().toLowerCase() === item.email);
      });

      if (conflict) {
        this.modalError.set(
          `${item.source}: Email '${item.email}' is already registered to user '${conflict.username}' or their family. Email must be unique.`,
        );
        return;
      }
    }
    let finalMobileNumber: string | null = null;
    let finalCountryCode = data.country_code || '+91';

    if (this.itiMobile) {
      const mobileVal = this.mobileInputRef?.nativeElement.value?.trim() || '';
      if (mobileVal) {
        const countryData = this.getSelectedCountryDataSafe(this.itiMobile);
        if (typeof this.itiMobile.isValidNumber === 'function' && !this.itiMobile.isValidNumber()) {
          this.modalError.set(
            `Please enter a valid phone number for ${countryData.name || 'the selected country'}.`,
          );
          return;
        }
        finalCountryCode = '+' + (countryData.dialCode || '91');
        const e164 =
          typeof this.itiMobile.getNumber === 'function' ? this.itiMobile.getNumber() : '';
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
        if (
          typeof this.itiAltMobile.isValidNumber === 'function' &&
          !this.itiAltMobile.isValidNumber()
        ) {
          this.modalError.set(
            `Please enter a valid alternative phone number for ${altCountryData.name || 'the selected country'}.`,
          );
          return;
        }
        finalAltCountryCode = '+' + (altCountryData.dialCode || '91');
        const e164Alt =
          typeof this.itiAltMobile.getNumber === 'function' ? this.itiAltMobile.getNumber() : '';
        if (e164Alt && e164Alt.startsWith(finalAltCountryCode)) {
          finalAltNumber = e164Alt.substring(finalAltCountryCode.length).replace(/[^0-9]/g, '');
        } else {
          finalAltNumber = altVal.replace(/[^0-9]/g, '');
        }
      }
    }

    // Format composite full address
    const parts = [
      data.address_line1.trim(),
      data.address_line2?.trim() || null,
      data.city.trim(),
      data.pincode.trim() ? `${data.state.trim()} - ${data.pincode.trim()}` : data.state.trim(),
      data.nation.trim(),
    ].filter(Boolean);
    const compositeAddress = parts.join(', ');

    const payloadToSave = {
      ...data,
      address: compositeAddress,
      address_line1: data.address_line1.trim(),
      address_line2: data.address_line2?.trim() || '',
      nation: data.nation.trim(),
      state: data.state.trim(),
      city: data.city.trim(),
      pincode: data.pincode.trim(),
      country_code: finalMobileNumber ? finalCountryCode : data.country_code || '+91',
      mobile_number: finalMobileNumber,
      alt_country_code: finalAltNumber ? finalAltCountryCode : data.alt_country_code || '+91',
      alt_mobile_number: finalAltNumber,
      family_data: data.family_data || [],
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
            image: uploadRes.imageUrl,
          };
          this.executeSave(finalPayload);
        },
        error: (err) => {
          this.isUploadingImage.set(false);
          this.isLoading.set(false);
          this.modalError.set(err.error?.message || 'Failed to upload profile photo.');
        },
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
      address: data.address?.trim() || null,
      address_line1: data.address_line1?.trim() || null,
      address_line2: data.address_line2?.trim() || null,
      nation: data.nation?.trim() || null,
      state: data.state?.trim() || null,
      city: data.city?.trim() || null,
      pincode: data.pincode?.trim() || null,
      country_code: data.country_code || '+91',
      mobile_number: data.mobile_number || null,
      alt_country_code: data.alt_country_code || '+91',
      alt_mobile_number: data.alt_mobile_number || null,
      family_data: (data.family_data || []).map((m: any) => ({
        username: (m.username || '').trim(),
        email: m.email && m.email.trim() ? m.email.trim() : null,
        country_code: m.country_code || '+91',
        mobile_number: m.mobile_number && m.mobile_number.trim() ? m.mobile_number.trim() : null,
        relation_type: (m.relation_type || '').trim().toLowerCase(),
      })),
      image: data.image !== undefined ? data.image : null,
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
        },
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
        },
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
      },
    });
  }

  private showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => this.successMessage.set(null), 4000);
  }
}
