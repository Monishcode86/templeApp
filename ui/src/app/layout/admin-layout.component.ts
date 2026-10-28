import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { ThemeService } from '../core/services/theme.service';
import {
  TranslationService,
  TranslatePipe,
  LanguageCode,
} from '../core/services/translation.service';
import { UserService } from '../core/services/user.service';
import { Subscription, interval } from 'rxjs';

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, TranslatePipe],
  templateUrl: './admin-layout.component.html',
  styleUrls: ['./admin-layout.component.css'],
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  authService = inject(AuthService);
  themeService = inject(ThemeService);
  translationService = inject(TranslationService);
  private userService = inject(UserService);

  // Layout states
  isSidebarCollapsed = signal<boolean>(false);
  isMobileSidebarOpen = signal<boolean>(false);
  isLanguageDropdownOpen = signal<boolean>(false);
  isConfigMenuOpen = signal<boolean>(true);
  isConfigDropdownOpen = signal<boolean>(false);
  isApiOnline = signal<boolean>(true);
  isFullscreen = signal<boolean>(false);

  private healthSub?: Subscription;

  ngOnInit(): void {
    this.checkHealth();
    // Poll server health every 30 seconds
    this.healthSub = interval(30000).subscribe(() => this.checkHealth());

    // Preload and store all users in memory cache on layout onload to reuse across donations and dropdowns
    this.userService.getAllUsersCached().subscribe({
      next: () => {},
      error: () => {}
    });

    if (typeof document !== 'undefined') {
      this.isFullscreen.set(!!document.fullscreenElement);
      document.addEventListener('fullscreenchange', this.onFullscreenChange);
    }
  }

  ngOnDestroy(): void {
    this.healthSub?.unsubscribe();
    if (typeof document !== 'undefined') {
      document.removeEventListener('fullscreenchange', this.onFullscreenChange);
    }
  }

  private onFullscreenChange = (): void => {
    if (typeof document !== 'undefined') {
      this.isFullscreen.set(!!document.fullscreenElement);
    }
  };

  toggleFullscreen(): void {
    if (typeof document === 'undefined') return;

    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch((err) => {
        console.warn('Fullscreen request failed:', err);
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch((err) => {
          console.warn('Exit fullscreen failed:', err);
        });
      }
    }
  }

  toggleSidebar(): void {
    // If mobile viewport (< 768px), toggle drawer
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      this.isMobileSidebarOpen.update((v) => !v);
    } else {
      this.isSidebarCollapsed.update((v) => !v);
    }
  }

  closeMobileSidebar(): void {
    this.isMobileSidebarOpen.set(false);
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  toggleConfigMenu(): void {
    this.isConfigMenuOpen.update((v) => !v);
  }

  toggleConfigDropdown(): void {
    this.isConfigDropdownOpen.update((v) => !v);
    if (this.isConfigDropdownOpen()) {
      this.isLanguageDropdownOpen.set(false);
    }
  }

  closeConfigDropdown(): void {
    this.isConfigDropdownOpen.set(false);
  }

  toggleLanguageDropdown(): void {
    this.isLanguageDropdownOpen.update((v) => !v);
    if (this.isLanguageDropdownOpen()) {
      this.isConfigDropdownOpen.set(false);
    }
  }

  selectLanguage(code: LanguageCode): void {
    this.translationService.setLanguage(code);
    this.isLanguageDropdownOpen.set(false);
  }

  logout(): void {
    this.authService.logout();
  }

  private checkHealth(): void {
    this.userService.getSystemHealth().subscribe({
      next: () => this.isApiOnline.set(true),
      error: () => this.isApiOnline.set(false),
    });
  }
}
