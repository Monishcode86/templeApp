import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Donation, ApiResponse, User } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class DonationService {
  private api = inject(ApiService);

  /**
   * Get all donations with pagination and optional search/type filters
   */
  getDonations(params?: {
    page?: number;
    limit?: number;
    search?: string;
    type?: string;
  }): Observable<ApiResponse<Donation[]>> {
    const queryParams: any = {};
    if (params?.page) queryParams.page = params.page;
    if (params?.limit) queryParams.limit = params.limit;
    if (params?.search) queryParams.search = params.search;
    if (params?.type) queryParams.type = params.type;
    return this.api.get<ApiResponse<Donation[]>>('/donation', { params: queryParams });
  }

  /**
   * Get single donation by ID
   */
  getDonationById(id: string): Observable<ApiResponse<Donation>> {
    return this.api.get<ApiResponse<Donation>>(`/donation/${id}`);
  }

  /**
   * Create new donation
   */
  createDonation(data: Partial<Donation>): Observable<ApiResponse<Donation>> {
    return this.api.post<ApiResponse<Donation>>('/donation', data);
  }

  /**
   * Update a donation (only type and remarks)
   */
  updateDonation(id: string, data: Partial<Donation>): Observable<ApiResponse<Donation>> {
    return this.api.put<ApiResponse<Donation>>(`/donation/${id}`, data);
  }

  /**
   * Delete a donation
   */
  deleteDonation(id: string): Observable<ApiResponse<any>> {
    return this.api.delete<ApiResponse<any>>(`/donation/${id}`);
  }

  /**
   * Get users for dropdown (all non-admin users)
   */
  getUsersForDropdown(): Observable<ApiResponse<User[]>> {
    return this.api.get<ApiResponse<User[]>>('/user', { params: { limit: 500 } });
  }
}
