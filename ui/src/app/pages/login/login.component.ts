import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';
import { TranslationService, TranslatePipe, LanguageCode } from '../../core/services/translation.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslatePipe],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  themeService = inject(ThemeService);
  translationService = inject(TranslationService);

  identifier = signal<string>('admin@gmail.com');
  password = signal<string>('Admin@12345');
  rememberMe = signal<boolean>(true);
  
  isLoading = signal<boolean>(false);
  errorMessage = signal<string | null>(null);

  onSubmit(): void {
    if (!this.identifier() || !this.password()) {
      this.errorMessage.set('Please enter both Email or Employee ID and password.');
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.authService.login({
      identifier: this.identifier().trim(),
      password: this.password()
    }).subscribe({
      next: () => {
        this.isLoading.set(false);
        const returnUrl = this.route.snapshot.queryParams['returnUrl'] || '/dashboard';
        this.router.navigateByUrl(returnUrl);
      },
      error: (err) => {
        this.isLoading.set(false);
        const errorMsg = err.error?.message || err.message || 'Authentication failed. Please check your credentials.';
        this.errorMessage.set(errorMsg);
      }
    });
  }

  toggleTheme(): void {
    this.themeService.toggleTheme();
  }

  changeLanguage(code: LanguageCode): void {
    this.translationService.setLanguage(code);
  }
}
