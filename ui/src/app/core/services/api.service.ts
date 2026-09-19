import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface RequestOptions {
  headers?: HttpHeaders | { [header: string]: string | string[] };
  params?: HttpParams | { [param: string]: string | number | boolean | ReadonlyArray<string | number | boolean> };
  withCredentials?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);

  // Prefix path for all API calls (proxied to backend in development or base domain in production)
  private readonly baseUrl = '/api';

  /**
   * Generic GET request
   */
  get<T>(endpoint: string, options?: RequestOptions): Observable<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    return this.http.get<T>(url, options);
  }

  /**
   * Generic POST request
   */
  post<T>(endpoint: string, body: any, options?: RequestOptions): Observable<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    return this.http.post<T>(url, body, options);
  }

  /**
   * Generic PUT request
   */
  put<T>(endpoint: string, body: any, options?: RequestOptions): Observable<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    return this.http.put<T>(url, body, options);
  }

  /**
   * Generic DELETE request
   */
  delete<T>(endpoint: string, options?: RequestOptions): Observable<T> {
    const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
    return this.http.delete<T>(url, options);
  }

  /**
   * Direct fetch (e.g. for health probe outside /api)
   */
  fetchDirect<T>(path: string): Observable<T> {
    return this.http.get<T>(path);
  }

  /**
   * Helper to resolve uploaded image paths in both local dev (4200 -> 5000) and production.
   */
  getImageUrl(path?: string | null): string {
    if (!path) return '';
    if (path.startsWith('data:') || path.startsWith('blob:') || path.startsWith('http')) {
      return path;
    }
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    if (typeof window !== 'undefined' && window.location.port === '4200') {
      return `http://localhost:5000${cleanPath}`;
    }
    return cleanPath;
  }
}
