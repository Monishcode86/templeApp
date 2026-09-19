import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { User, ApiResponse } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class UserService {
  private api = inject(ApiService);

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
   * Create new user
   */
  createUser(userData: Partial<User> & { password?: string }): Observable<ApiResponse<User>> {
    return this.api.post<ApiResponse<User>>('/user', userData);
  }

  /**
   * Update existing user
   */
  updateUser(id: string, userData: Partial<User> & { password?: string }): Observable<ApiResponse<User>> {
    return this.api.put<ApiResponse<User>>(`/user/${id}`, userData);
  }

  /**
   * Delete user by ID
   */
  deleteUser(id: string): Observable<ApiResponse<any>> {
    return this.api.delete<ApiResponse<any>>(`/user/${id}`);
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
