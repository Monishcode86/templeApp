import { Injectable, signal, computed } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly THEME_STORAGE_KEY = 'node24_theme_mode';

  private currentThemeSignal = signal<ThemeMode>(this.getInitialTheme());
  readonly currentTheme = computed(() => this.currentThemeSignal());
  readonly isDark = computed(() => this.currentThemeSignal() === 'dark');

  constructor() {
    this.applyTheme(this.currentThemeSignal());
  }

  /**
   * Toggle between light and dark themes
   */
  toggleTheme(): void {
    const nextTheme: ThemeMode = this.currentThemeSignal() === 'dark' ? 'light' : 'dark';
    this.setTheme(nextTheme);
  }

  /**
   * Explicitly set theme
   */
  setTheme(theme: ThemeMode): void {
    this.currentThemeSignal.set(theme);
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.THEME_STORAGE_KEY, theme);
    }
    this.applyTheme(theme);
  }

  private applyTheme(theme: ThemeMode): void {
    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      if (theme === 'dark') {
        root.classList.add('dark-theme');
        root.classList.remove('light-theme');
        root.setAttribute('data-theme', 'dark');
      } else {
        root.classList.add('light-theme');
        root.classList.remove('dark-theme');
        root.setAttribute('data-theme', 'light');
      }
    }
  }

  private getInitialTheme(): ThemeMode {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(this.THEME_STORAGE_KEY) as ThemeMode;
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    }
    return 'dark'; // Default sleek dark theme as per modern web standards
  }
}
