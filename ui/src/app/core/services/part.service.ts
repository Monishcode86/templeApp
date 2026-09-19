import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { PartMaster, ApiResponse } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class PartService {
  private api = inject(ApiService);

  getParts(params?: { search?: string; page?: number; limit?: number; plant_id?: string }): Observable<ApiResponse<PartMaster[]>> {
    const queryParams: any = {};
    if (params?.search) queryParams.search = params.search;
    if (params?.page) queryParams.page = params.page;
    if (params?.limit) queryParams.limit = params.limit;
    if (params?.plant_id) queryParams.plant_id = params.plant_id;
    return this.api.get<ApiResponse<PartMaster[]>>('/part', { params: queryParams });
  }

  getPartById(id: string): Observable<ApiResponse<PartMaster>> {
    return this.api.get<ApiResponse<PartMaster>>(`/part/${id}`);
  }

  createPart(part: Partial<PartMaster>): Observable<ApiResponse<PartMaster>> {
    return this.api.post<ApiResponse<PartMaster>>('/part', part);
  }

  updatePart(id: string, part: Partial<PartMaster>): Observable<ApiResponse<PartMaster>> {
    return this.api.put<ApiResponse<PartMaster>>(`/part/${id}`, part);
  }

  deletePart(id: string): Observable<ApiResponse<any>> {
    return this.api.delete<ApiResponse<any>>(`/part/${id}`);
  }
}
