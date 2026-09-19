import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Plant, ApiResponse } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class PlantService {
  private api = inject(ApiService);

  /**
   * Get all plants (supports search & pagination)
   */
  getPlants(params?: { search?: string; page?: number; limit?: number }): Observable<ApiResponse<Plant[]>> {
    const queryParams: any = {};
    if (params?.search) queryParams.search = params.search;
    if (params?.page) queryParams.page = params.page;
    if (params?.limit) queryParams.limit = params.limit;

    return this.api.get<ApiResponse<Plant[]>>('/plant', { params: queryParams });
  }

  /**
   * Get single plant by ID
   */
  getPlantById(id: string): Observable<ApiResponse<Plant>> {
    return this.api.get<ApiResponse<Plant>>(`/plant/${id}`);
  }

  /**
   * Create new plant
   */
  createPlant(plant: Partial<Plant>): Observable<ApiResponse<Plant>> {
    return this.api.post<ApiResponse<Plant>>('/plant', plant);
  }

  /**
   * Update existing plant
   */
  updatePlant(id: string, plant: Partial<Plant>): Observable<ApiResponse<Plant>> {
    return this.api.put<ApiResponse<Plant>>(`/plant/${id}`, plant);
  }

  /**
   * Delete plant
   */
  deletePlant(id: string): Observable<ApiResponse<any>> {
    return this.api.delete<ApiResponse<any>>(`/plant/${id}`);
  }

  /**
   * Upload plant image
   */
  uploadPlantImage(file: File): Observable<{ status: string; imageUrl: string; filename: string }> {
    const formData = new FormData();
    formData.append('plant_img', file);
    return this.api.post<{ status: string; imageUrl: string; filename: string }>('/plant/upload-image', formData);
  }
}
