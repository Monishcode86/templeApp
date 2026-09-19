import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';
import { Shift, ApiResponse } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class ShiftService {
  private api = inject(ApiService);

  getShifts(params?: { search?: string; page?: number; limit?: number; plant_id?: string }): Observable<ApiResponse<Shift[]>> {
    const queryParams: any = {};
    if (params?.search) queryParams.search = params.search;
    if (params?.page) queryParams.page = params.page;
    if (params?.limit) queryParams.limit = params.limit;
    if (params?.plant_id) queryParams.plant_id = params.plant_id;
    return this.api.get<ApiResponse<Shift[]>>('/shift', { params: queryParams });
  }

  getShiftById(id: string): Observable<ApiResponse<Shift>> {
    return this.api.get<ApiResponse<Shift>>(`/shift/${id}`);
  }

  createShift(shift: Partial<Shift>): Observable<ApiResponse<Shift>> {
    return this.api.post<ApiResponse<Shift>>('/shift', shift);
  }

  updateShift(id: string, shift: Partial<Shift>): Observable<ApiResponse<Shift>> {
    return this.api.put<ApiResponse<Shift>>(`/shift/${id}`, shift);
  }

  deleteShift(id: string): Observable<ApiResponse<any>> {
    return this.api.delete<ApiResponse<any>>(`/shift/${id}`);
  }
}
