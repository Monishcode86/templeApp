import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { DowntimeReason, ApiResponse } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class DowntimeService {
  private api = inject(ApiService);

  getDowntimeReasons(params?: {
    search?: string;
    page?: number;
    limit?: number;
    plant_id?: string;
    downtime_type?: string;
  }): Observable<ApiResponse<DowntimeReason[]>> {
    const queryParams: any = {};
    if (params?.search) queryParams.search = params.search;
    if (params?.page) queryParams.page = params.page;
    if (params?.limit) queryParams.limit = params.limit;
    if (params?.plant_id) queryParams.plant_id = params.plant_id;
    if (params?.downtime_type) queryParams.downtime_type = params.downtime_type;
    return this.api.get<ApiResponse<DowntimeReason[]>>('/downtime', { params: queryParams });
  }

  getDowntimeReasonById(id: string): Observable<ApiResponse<DowntimeReason>> {
    return this.api.get<ApiResponse<DowntimeReason>>(`/downtime/${id}`);
  }

  createDowntimeReason(reason: Partial<DowntimeReason>): Observable<ApiResponse<DowntimeReason>> {
    return this.api.post<ApiResponse<DowntimeReason>>('/downtime', reason);
  }

  updateDowntimeReason(id: string, reason: Partial<DowntimeReason>): Observable<ApiResponse<DowntimeReason>> {
    return this.api.put<ApiResponse<DowntimeReason>>(`/downtime/${id}`, reason);
  }

  deleteDowntimeReason(id: string): Observable<ApiResponse<any>> {
    return this.api.delete<ApiResponse<any>>(`/downtime/${id}`);
  }
}
