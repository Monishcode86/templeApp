import { Injectable, inject } from '@angular/core';
import { Observable, of, forkJoin } from 'rxjs';
import { map, switchMap, tap, shareReplay, catchError } from 'rxjs/operators';
import { ApiService } from './api.service';
import { User, ApiResponse } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private api = inject(ApiService);

  private readonly CACHE_STORAGE_KEY = 'temple_app_cached_users_v1';
  private usersMemoryCache: User[] | null = null;
  private inFlightFetch$: Observable<User[]> | null = null;

  /**
   * Check if users are currently stored in memory cache or session storage
   */
  hasCachedUsers(): boolean {
    if (this.usersMemoryCache && this.usersMemoryCache.length > 0) {
      return true;
    }
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const stored = sessionStorage.getItem(this.CACHE_STORAGE_KEY);
        return !!stored && stored.length > 2;
      } catch {
        return false;
      }
    }
    return false;
  }

  /**
   * Get direct synchronous snapshot from memory cache if available
   */
  getCachedUsersSnapshot(): User[] | null {
    if (this.usersMemoryCache && this.usersMemoryCache.length > 0) {
      return this.usersMemoryCache;
    }
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const stored = sessionStorage.getItem(this.CACHE_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.usersMemoryCache = parsed;
            return parsed;
          }
        }
      } catch {}
    }
    return null;
  }

  /**
   * Clear the in-memory and session cache (used when users are added, updated, or deleted)
   */
  clearUsersCache(): void {
    this.usersMemoryCache = null;
    this.inFlightFetch$ = null;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        sessionStorage.removeItem(this.CACHE_STORAGE_KEY);
      } catch {}
    }
  }

  /**
   * Get all users with caching in memory.
   * If cached in memory, returns immediately from cache without network call.
   * If not cached or forceRefresh is true, fetches all users from backend, caches in memory, and returns.
   */
  getAllUsersCached(forceRefresh: boolean = false): Observable<User[]> {
    // 1. Check in-memory cache
    if (!forceRefresh && this.usersMemoryCache && this.usersMemoryCache.length > 0) {
      return of(this.usersMemoryCache);
    }

    // 2. Check session storage cache fallback
    if (!forceRefresh && typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const stored = sessionStorage.getItem(this.CACHE_STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.usersMemoryCache = parsed;
            return of(parsed);
          }
        }
      } catch { /* ignore parse error */ }
    }

    // 3. Deduplicate concurrent in-flight HTTP requests
    if (this.inFlightFetch$) {
      return this.inFlightFetch$;
    }

    // 4. Fetch all users from server
    this.inFlightFetch$ = this.api.get<ApiResponse<User[]>>('/user', {
      params: { page: 1, limit: 1000, all: 'true' }
    }).pipe(
      switchMap((firstPageRes) => {
        const totalPages = firstPageRes.pagination?.totalPages || 1;
        const initialUsers = firstPageRes.data || [];

        // If server paginated across multiple pages, fetch the remaining pages to ensure 100% of users are collected
        if (totalPages > 1) {
          const pageRequests: Observable<ApiResponse<User[]>>[] = [];
          for (let p = 2; p <= totalPages; p++) {
            pageRequests.push(
              this.api.get<ApiResponse<User[]>>('/user', {
                params: { page: p, limit: firstPageRes.pagination?.limit || 100, all: 'true' }
              })
            );
          }

          return forkJoin(pageRequests).pipe(
            map((additionalPages) => {
              const combined = [...initialUsers];
              for (const pageRes of additionalPages) {
                if (pageRes.data) {
                  combined.push(...pageRes.data);
                }
              }
              return combined;
            }),
            catchError(() => of(initialUsers))
          );
        }

        return of(initialUsers);
      }),
      map((allRawUsers) => {
        // Exclude system admin user
        const cleaned = allRawUsers
          .filter((u) => u.email?.toLowerCase() !== 'admin@gmail.com' && u.role !== 'ADMIN')
          .sort((a, b) => (a.username || '').localeCompare(b.username || ''));

        // Save in memory cache
        this.usersMemoryCache = cleaned;

        // Persist in sessionStorage for quick reload within same tab
        if (typeof window !== 'undefined' && window.sessionStorage) {
          try {
            sessionStorage.setItem(this.CACHE_STORAGE_KEY, JSON.stringify(cleaned));
          } catch {}
        }

        return cleaned;
      }),
      tap(() => {
        this.inFlightFetch$ = null;
      }),
      catchError((err) => {
        this.inFlightFetch$ = null;
        // If memory cache exists from earlier, fallback to it
        if (this.usersMemoryCache && this.usersMemoryCache.length > 0) {
          return of(this.usersMemoryCache);
        }
        throw err;
      }),
      shareReplay(1)
    );

    return this.inFlightFetch$;
  }

  /**
   * Get users with pagination, search, and plant_id filter
   */
  getUsers(params?: { page?: number; limit?: number; search?: string; plant_id?: string }): Observable<ApiResponse<User[]>> {
    const queryParams: any = {};
    if (params?.page) queryParams.page = params.page;
    if (params?.limit) queryParams.limit = params.limit;
    if (params?.search) queryParams.search = params.search;
    if (params?.plant_id) queryParams.plant_id = params.plant_id;

    return this.api.get<ApiResponse<User[]>>('/user', { params: queryParams });
  }

  /**
   * Get single user by ID
   */
  getUserById(id: string): Observable<ApiResponse<User>> {
    return this.api.get<ApiResponse<User>>(`/user/${id}`);
  }

  /**
   * Create new user and invalidate cache
   */
  createUser(userData: Partial<User> & { password?: string }): Observable<ApiResponse<User>> {
    return this.api.post<ApiResponse<User>>('/user', userData).pipe(
      tap(() => this.clearUsersCache())
    );
  }

  /**
   * Update existing user and invalidate cache
   */
  updateUser(id: string, userData: Partial<User> & { password?: string }): Observable<ApiResponse<User>> {
    return this.api.put<ApiResponse<User>>(`/user/${id}`, userData).pipe(
      tap(() => this.clearUsersCache())
    );
  }

  /**
   * Delete user by ID and invalidate cache
   */
  deleteUser(id: string): Observable<ApiResponse<any>> {
    return this.api.delete<ApiResponse<any>>(`/user/${id}`).pipe(
      tap(() => this.clearUsersCache())
    );
  }

  /**
   * Upload user profile avatar image
   */
  uploadAvatar(file: File): Observable<{ status: string; imageUrl: string; filename: string }> {
    const formData = new FormData();
    formData.append('image', file);
    return this.api.post<{ status: string; imageUrl: string; filename: string }>('/user/upload-avatar', formData);
  }

  /**
   * Get system health probe
   */
  getSystemHealth(): Observable<any> {
    return this.api.get<any>('/health');
  }
}
