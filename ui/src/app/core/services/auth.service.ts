import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { User, AuthResponse, ApiResponse } from '../models/auth.model';
import { environment } from '../../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);

  private readonly authUrl = `${environment.apiUrl || 'https://templeapp-ruvv.onrender.com/api'}/login`;
  private readonly ACCESS_TOKEN_KEY = 'node24_access_token';
  private readonly REFRESH_TOKEN_KEY = 'node24_refresh_token';
  private readonly USER_KEY = 'node24_user';

  // Reactive Angular signals
  private currentUserSignal = signal<User | null>(this.loadStoredUser());
  readonly currentUser = computed(() => this.currentUserSignal());
  readonly isLoggedIn = computed(() => !!this.currentUserSignal() && this.currentUserSignal()?.role === 'ADMIN' && !!this.getAccessToken());
  readonly isAdmin = computed(() => this.currentUserSignal()?.role === 'ADMIN');

  /**
   * Login user with credentials (supports email or employee_id)
   */
  login(credentials: { email?: string; identifier?: string; employee_id?: string; password: string }): Observable<ApiResponse<AuthResponse>> {
    const payload = {
      identifier: credentials.identifier || credentials.email || credentials.employee_id,
      password: credentials.password
    };
    return this.http.post<ApiResponse<AuthResponse>>(this.authUrl, payload).pipe(
      tap((response) => {
        if (response.data) {
          if (response.data.user?.role !== 'ADMIN') {
            this.logout();
            throw new Error('Access denied. Only administrators are allowed to sign in.');
          }
          this.setTokens(response.data.accessToken, response.data.refreshToken);
          this.setUser(response.data.user);
        }
      })
    );
  }

  /**
   * Request a new access token using the stored refresh token
   */
  refreshToken(): Observable<ApiResponse<AuthResponse>> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.logout();
      return throwError(() => new Error('No refresh token available.'));
    }

    return this.http.post<ApiResponse<AuthResponse>>(`${this.authUrl}/refresh`, { refreshToken }).pipe(
      tap((response) => {
        if (response.data) {
          if (response.data.user && response.data.user.role !== 'ADMIN') {
            this.logout();
            throw new Error('Access denied. Only administrators are allowed to sign in.');
          }
          this.setTokens(response.data.accessToken, response.data.refreshToken);
          if (response.data.user) {
            this.setUser(response.data.user);
          }
        }
      }),
      catchError((err) => {
        this.logout();
        return throwError(() => err);
      })
    );
  }

  /**
   * Logout user, clear storage, and navigate to login
   */
  logout(): void {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.ACCESS_TOKEN_KEY);
      localStorage.removeItem(this.REFRESH_TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
    }
    this.currentUserSignal.set(null);
    this.router.navigate(['/login']);
  }

  /**
   * Token getters & setters
   */
  getAccessToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(this.ACCESS_TOKEN_KEY);
    }
    return null;
  }

  getRefreshToken(): string | null {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(this.REFRESH_TOKEN_KEY);
    }
    return null;
  }

  private setTokens(accessToken: string, refreshToken: string): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.ACCESS_TOKEN_KEY, accessToken);
      localStorage.setItem(this.REFRESH_TOKEN_KEY, refreshToken);
    }
  }

  private setUser(user: User): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    }
    this.currentUserSignal.set(user);
  }

  private loadStoredUser(): User | null {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(this.USER_KEY);
      if (stored) {
        try {
          const user = JSON.parse(stored);
          if (user?.role !== 'ADMIN') {
            localStorage.removeItem(this.ACCESS_TOKEN_KEY);
            localStorage.removeItem(this.REFRESH_TOKEN_KEY);
            localStorage.removeItem(this.USER_KEY);
            return null;
          }
          return user;
        } catch {
          return null;
        }
      }
    }
    return null;
  }
}
