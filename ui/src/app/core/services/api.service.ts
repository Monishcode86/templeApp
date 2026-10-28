import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

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

  // Base server domain and API prefix path deployed on Render
  readonly serverUrl = environment.serverUrl || 'https://templeapp-ruvv.onrender.com';
  readonly baseUrl = environment.apiUrl || `${this.serverUrl}/api`;

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
    const url = path.startsWith('http') ? path : `${this.serverUrl}${path.startsWith('/') ? path : '/' + path}`;
    return this.http.get<T>(url);
  }

  /**
   * Helper to resolve uploaded image paths (avatars, receipts) from the backend server
   */
  getImageUrl(path?: string | null): string {
    if (!path) return '';
    if (path.startsWith('data:') || path.startsWith('blob:') || path.startsWith('http')) {
      return path;
    }
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${this.serverUrl}${cleanPath}`;
  }
}
